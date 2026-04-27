import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { EPHEMERAL_EMAILS } from "../tests/e2e/global-setup";

// Safety: block production execution
if (process.env.NODE_ENV === "production") {
  console.error("ERROR: cleanup-test-users cannot run in production (NODE_ENV=production). Aborting.");
  process.exit(1);
}

const confirmFlag = process.argv.includes("--confirm");

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function cleanup() {
  // Accept emails from CLI args, or fall back to the shared constant from global-setup
  const cliEmails = process.argv.filter((a) => a.includes("@"));
  const emails = cliEmails.length > 0 ? cliEmails : EPHEMERAL_EMAILS;

  // Get user IDs first
  const userIds = await pool.query(
    `SELECT id, email FROM users WHERE email = ANY($1)`,
    [emails],
  );
  const ids = userIds.rows.map((r: any) => r.id);

  if (ids.length === 0) {
    console.log("No test users found to delete.");
    await pool.end();
    return;
  }

  // Print summary of what will be deleted
  console.log("=== Cleanup Summary ===");
  console.log(`Target emails: ${emails.join(", ")}`);
  console.log(`Matched users: ${userIds.rows.map((r: any) => `${r.email} (${r.id})`).join(", ")}`);
  console.log("Tables affected:");
  console.log("  - plan_shares (user_id / granted_by)");
  console.log("  - plan_history (changed_by)");
  console.log("  - gpa_snapshots (student_id)");
  console.log("  - four_year_plans (created_by)");
  console.log("  - account_invite_codes (created_by / claimed_by)");
  console.log("  - accounts (created_by / student_user_id / billing_contact_id)");
  console.log("  - users (CASCADE to account_members, student_profiles, etc.)");
  console.log("  - auth.users (Supabase auth)");
  console.log("  - orphaned accounts (no remaining members)");

  if (!confirmFlag) {
    console.log("\nDry run — no changes made. Pass --confirm to execute deletions.");
    await pool.end();
    return;
  }

  console.log("\n--confirm passed. Proceeding with deletion...\n");

  // Clean up all references to these users
  for (const id of ids) {
    // Delete owned data
    await db.execute(sql`DELETE FROM plan_shares WHERE user_id = ${id} OR granted_by = ${id}`);
    await db.execute(sql`DELETE FROM plan_history WHERE changed_by = ${id}`);
    await db.execute(sql`DELETE FROM gpa_snapshots WHERE student_id = ${id}`);
    await db.execute(sql`DELETE FROM four_year_plans WHERE created_by = ${id}`);
    await db.execute(sql`DELETE FROM account_invite_codes WHERE created_by = ${id}`);
    // Null out claimed_by references
    await db.execute(sql`UPDATE account_invite_codes SET claimed_by = NULL, claimed_at = NULL WHERE claimed_by = ${id}`);
    // Delete accounts created by this user
    await db.execute(sql`DELETE FROM accounts WHERE created_by = ${id}`);
    // Unlink from other accounts
    await db.execute(sql`UPDATE accounts SET student_user_id = NULL WHERE student_user_id = ${id}`);
    await db.execute(sql`UPDATE accounts SET billing_contact_id = NULL WHERE billing_contact_id = ${id}`);
  }

  // Delete users — CASCADE handles account_members, student_profiles, plan_shares, etc.
  const result = await pool.query(
    `DELETE FROM users WHERE email = ANY($1) RETURNING id, email`,
    [emails],
  );
  console.log("Deleted:", result.rows);

  // Clean up orphaned accounts (no members left)
  const orphans = await db.execute(sql`
    DELETE FROM accounts WHERE id IN (
      SELECT a.id FROM accounts a
      LEFT JOIN account_members am ON am.account_id = a.id
      WHERE am.user_id IS NULL
    ) RETURNING id, student_name
  `);
  console.log("Orphaned accounts removed:", orphans.rows);

  // Also delete from Supabase auth.users
  await pool.query(
    `DELETE FROM auth.users WHERE email = ANY($1)`,
    [emails],
  );
  console.log("Supabase auth users cleaned up");

  await pool.end();
}

cleanup().catch((e) => { console.error(e); pool.end(); process.exit(1); });
