import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function cleanup() {
  const emails = ["student2@test.com", "student3@test.com"];
  console.log("Deleting users:", emails);

  // Get user IDs first
  const userIds = await db.execute(
    sql`SELECT id FROM users WHERE email IN ('student2@test.com', 'student3@test.com')`
  );
  const ids = userIds.rows.map((r: any) => r.id);
  console.log("User IDs:", ids);

  if (ids.length === 0) {
    console.log("No users found to delete.");
    await pool.end();
    return;
  }

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
  const result = await db.execute(
    sql`DELETE FROM users WHERE email IN ('student2@test.com', 'student3@test.com') RETURNING id, email`
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
  await db.execute(sql`
    DELETE FROM auth.users WHERE email IN ('student2@test.com', 'student3@test.com')
  `);
  console.log("Supabase auth users cleaned up");

  await pool.end();
}

cleanup().catch((e) => { console.error(e); pool.end(); process.exit(1); });
