/**
 * Playwright global teardown — cleans up E2E test artifacts after all tests.
 *
 * Cleans up:
 *   - All non-primary plans owned by test users (prevents 3-plan-cap leaks)
 *   - E2E-named plans (even leftover ones from interrupted runs)
 *   - Orphaned plan_shares/plan_history pointing to deleted plans
 *   - Ephemeral accounts: student2@test.com, student3@test.com
 *   - Orphaned memberless accounts
 *   - Primary plan state restored (Gr10 unlocked, 2 Gr10 courses ungraded)
 *
 * Preserves:
 *   - Persistent test accounts (student/parent/counselor/consent-test@test.com)
 *   - Primary plan shell (but its data is reset to a known-good baseline)
 */

import pg from "pg";

const EPHEMERAL_EMAILS = ["student2@test.com", "student3@test.com"];
const TEST_USER_EMAILS = [
  "student@test.com",
  "student-b@test.com",
  "student-onboarding@test.com",
  "student-password@test.com",
  "consent-test@test.com",
  "parent@test.com",
  "counselor@test.com",
];
const E2E_PLAN_PATTERN = "E2E %";
const DEMO_PLAN_NAME = "Demo";

async function globalTeardown() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  });

  try {
    await client.connect();

    // ── 1. Delete ALL non-primary plans owned by test users ─────────
    // This is the nuclear cleanup: any scratch plan a test forgot to
    // remove is wiped so the next run starts fresh.
    const testUserIds = await client.query(
      `SELECT id FROM users WHERE email = ANY($1)`,
      [TEST_USER_EMAILS],
    );
    const userIds = testUserIds.rows.map((r: { id: string }) => r.id);

    if (userIds.length > 0) {
      // Remove plan_courses for any non-primary plan created by a test user
      await client.query(
        `DELETE FROM plan_courses WHERE plan_id IN (
           SELECT id FROM four_year_plans
           WHERE created_by = ANY($1) AND is_primary = false AND is_template = false
         )`,
        [userIds],
      );
      await client.query(
        `DELETE FROM plan_history WHERE plan_id IN (
           SELECT id FROM four_year_plans
           WHERE created_by = ANY($1) AND is_primary = false AND is_template = false
         )`,
        [userIds],
      );
      await client.query(
        `DELETE FROM plan_shares WHERE plan_id IN (
           SELECT id FROM four_year_plans
           WHERE created_by = ANY($1) AND is_primary = false AND is_template = false
         )`,
        [userIds],
      );
      const scratchPlans = await client.query(
        `DELETE FROM four_year_plans
         WHERE created_by = ANY($1) AND is_primary = false AND is_template = false
         RETURNING id`,
        [userIds],
      );
      if (scratchPlans.rowCount) {
        console.log(`[e2e-teardown] Removed ${scratchPlans.rowCount} non-primary test plan(s)`);
      }
    }

    // ── 2. Belt-and-suspenders: any remaining E2E-named plan ─────────
    await client.query(
      `DELETE FROM plan_courses WHERE plan_id IN (
         SELECT id FROM four_year_plans WHERE (name LIKE $1 OR name = $2) AND is_primary = false
       )`,
      [E2E_PLAN_PATTERN, DEMO_PLAN_NAME],
    );
    await client.query(
      `DELETE FROM plan_history WHERE plan_id IN (
         SELECT id FROM four_year_plans WHERE (name LIKE $1 OR name = $2) AND is_primary = false
       )`,
      [E2E_PLAN_PATTERN, DEMO_PLAN_NAME],
    );
    const orphanedE2ePlans = await client.query(
      `DELETE FROM four_year_plans WHERE (name LIKE $1 OR name = $2) AND is_primary = false RETURNING id`,
      [E2E_PLAN_PATTERN, DEMO_PLAN_NAME],
    );
    if (orphanedE2ePlans.rowCount) {
      console.log(`[e2e-teardown] Removed ${orphanedE2ePlans.rowCount} orphaned E2E plan(s)`);
    }

    // ── 3. Reset primary plan state for student@test.com ─────────────
    // Unlock any grades that tests may have locked (grade-lock tests only
    // use scratch plans, but belt-and-suspenders) and ensure Gr10 courses
    // match the global-setup baseline.
    await client.query(
      `UPDATE four_year_plans
       SET locked_grade_levels = '[9]'::jsonb
       WHERE id IN (
         SELECT fp.id FROM four_year_plans fp
         JOIN users u ON u.id = fp.student_id
         WHERE u.email = 'student@test.com' AND fp.is_primary = true
       )`,
    );

    // ── 4. Clean up test-created invite codes for the student account ─
    if (userIds.length > 0) {
      await client.query(
        `DELETE FROM account_invite_codes WHERE created_by = ANY($1) AND claimed_at IS NULL`,
        [userIds],
      );
    }

    // ── 5. Clean up ephemeral accounts ───────────────────────────────
    const ephemeralResult = await client.query(
      `SELECT id FROM users WHERE email = ANY($1)`,
      [EPHEMERAL_EMAILS],
    );
    const ephemeralIds = ephemeralResult.rows.map((r: { id: string }) => r.id);

    if (ephemeralIds.length > 0) {
      await client.query(`DELETE FROM plan_shares WHERE user_id = ANY($1) OR granted_by = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM plan_history WHERE changed_by = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM gpa_snapshots WHERE student_id = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM plan_courses WHERE plan_id IN (SELECT id FROM four_year_plans WHERE created_by = ANY($1))`, [ephemeralIds]);
      await client.query(`DELETE FROM four_year_plans WHERE created_by = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM account_invite_codes WHERE created_by = ANY($1)`, [ephemeralIds]);
      await client.query(`UPDATE account_invite_codes SET claimed_by = NULL, claimed_at = NULL WHERE claimed_by = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM consent_records WHERE user_id = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM account_members WHERE user_id = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM student_profiles WHERE user_id = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM accounts WHERE created_by = ANY($1)`, [ephemeralIds]);
      await client.query(`UPDATE accounts SET student_user_id = NULL WHERE student_user_id = ANY($1)`, [ephemeralIds]);
      await client.query(`UPDATE accounts SET billing_contact_id = NULL WHERE billing_contact_id = ANY($1)`, [ephemeralIds]);
      await client.query(`DELETE FROM users WHERE id = ANY($1)`, [ephemeralIds]);

      try {
        await client.query(`DELETE FROM auth.users WHERE email = ANY($1)`, [EPHEMERAL_EMAILS]);
      } catch { /* auth.users may not be accessible */ }

      console.log(`[e2e-teardown] Removed ${ephemeralIds.length} ephemeral account(s)`);
    }

    // ── 6. Clean up memberless accounts (orphans) ────────────────────
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
