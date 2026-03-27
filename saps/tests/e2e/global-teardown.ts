/**
 * Playwright global teardown — cleans up E2E test data from the database.
 * Runs once after all E2E tests complete.
 */

import pg from "pg";

async function globalTeardown() {
  const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Delete plan_courses for E2E test plans
    await client.query(`
      DELETE FROM plan_courses WHERE plan_id IN (
        SELECT id FROM four_year_plans
        WHERE name LIKE 'E2E %' OR name = 'Demo'
      )
    `);

    // Delete plan_history for E2E test plans
    await client.query(`
      DELETE FROM plan_history WHERE plan_id IN (
        SELECT id FROM four_year_plans
        WHERE name LIKE 'E2E %' OR name = 'Demo'
      )
    `);

    // Delete the E2E test plans themselves
    const result = await client.query(`
      DELETE FROM four_year_plans
      WHERE name LIKE 'E2E %' OR name = 'Demo'
      RETURNING id, name
    `);

    if (result.rowCount && result.rowCount > 0) {
      console.log(`[e2e-teardown] Cleaned up ${result.rowCount} E2E test plan(s)`);
    } else {
      console.log("[e2e-teardown] No E2E test data to clean up");
    }

    // Also clean up orphaned plan_history (plans deleted during tests)
    const orphaned = await client.query(`
      DELETE FROM plan_history
      WHERE plan_id NOT IN (SELECT id FROM four_year_plans)
      RETURNING id
    `);
    if (orphaned.rowCount && orphaned.rowCount > 0) {
      console.log(`[e2e-teardown] Cleaned up ${orphaned.rowCount} orphaned plan_history row(s)`);
    }
  } catch (error) {
    console.warn("[e2e-teardown] Cleanup failed (non-fatal):", error);
  } finally {
    await client.end();
  }
}

export default globalTeardown;
