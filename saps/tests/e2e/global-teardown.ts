/**
 * Playwright global teardown — cleans up E2E test artifacts after all tests.
 *
 * Cleans up:
 *   - Plans named "E2E %" or "Demo" (created by planner tests)
 *   - Ephemeral accounts: student2@test.com, student3@test.com (created by onboarding tests)
 *   - Orphaned plan_history and memberless accounts
 *
 * Does NOT clean up persistent test accounts (student/parent/counselor@test.com).
 */

import pg from "pg";

const EPHEMERAL_EMAILS = ["student2@test.com", "student3@test.com"];
const E2E_PLAN_PATTERN = "E2E %";
const DEMO_PLAN_NAME = "Demo";

async function globalTeardown() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  });

  try {
    await client.connect();

    // ── Clean up E2E-named plans (single batch) ──────────────────────
    await client.query(`
      DELETE FROM plan_courses WHERE plan_id IN (
        SELECT id FROM four_year_plans WHERE name LIKE $1 OR name = $2
      )`, [E2E_PLAN_PATTERN, DEMO_PLAN_NAME]);

    await client.query(`
      DELETE FROM plan_history WHERE plan_id IN (
        SELECT id FROM four_year_plans WHERE name LIKE $1 OR name = $2
      )`, [E2E_PLAN_PATTERN, DEMO_PLAN_NAME]);

    const plans = await client.query(`
      DELETE FROM four_year_plans WHERE name LIKE $1 OR name = $2 RETURNING id
    `, [E2E_PLAN_PATTERN, DEMO_PLAN_NAME]);

    if (plans.rowCount) console.log(`[e2e-teardown] Removed ${plans.rowCount} E2E plan(s)`);

    // ── Clean up ephemeral accounts (batched by user ID array) ───────
    const userResult = await client.query(
      `SELECT id FROM users WHERE email = ANY($1)`, [EPHEMERAL_EMAILS],
    );
    const ids = userResult.rows.map((r: { id: string }) => r.id);

    if (ids.length > 0) {
      // Batch all cleanup into array-based queries
      await client.query(`DELETE FROM plan_shares WHERE user_id = ANY($1) OR granted_by = ANY($1)`, [ids]);
      await client.query(`DELETE FROM plan_history WHERE changed_by = ANY($1)`, [ids]);
      await client.query(`DELETE FROM gpa_snapshots WHERE student_id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM plan_courses WHERE plan_id IN (SELECT id FROM four_year_plans WHERE created_by = ANY($1))`, [ids]);
      await client.query(`DELETE FROM four_year_plans WHERE created_by = ANY($1)`, [ids]);
      await client.query(`DELETE FROM account_invite_codes WHERE created_by = ANY($1)`, [ids]);
      await client.query(`UPDATE account_invite_codes SET claimed_by = NULL, claimed_at = NULL WHERE claimed_by = ANY($1)`, [ids]);
      await client.query(`DELETE FROM consent_records WHERE user_id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM account_members WHERE user_id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM student_profiles WHERE user_id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM accounts WHERE created_by = ANY($1)`, [ids]);
      await client.query(`UPDATE accounts SET student_user_id = NULL WHERE student_user_id = ANY($1)`, [ids]);
      await client.query(`UPDATE accounts SET billing_contact_id = NULL WHERE billing_contact_id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);

      try {
        await client.query(`DELETE FROM auth.users WHERE email = ANY($1)`, [EPHEMERAL_EMAILS]);
      } catch { /* auth.users may not be accessible */ }

      console.log(`[e2e-teardown] Removed ${ids.length} ephemeral account(s)`);
    }

    // ── Clean up orphans ─────────────────────────────────────────────
    const orphans = await client.query(`
      DELETE FROM accounts WHERE id IN (
        SELECT a.id FROM accounts a LEFT JOIN account_members am ON am.account_id = a.id WHERE am.user_id IS NULL
      ) RETURNING id
    `);
    if (orphans.rowCount) console.log(`[e2e-teardown] Removed ${orphans.rowCount} orphaned account(s)`);

    console.log("[e2e-teardown] ✅ Cleanup complete");
  } catch (error) {
    console.warn("[e2e-teardown] Cleanup failed (non-fatal):", error);
  } finally {
    await client.end();
  }
}

export default globalTeardown;
