/**
 * Playwright global setup — creates and VERIFIES all test data before E2E tests.
 *
 * Ensures (not just creates):
 *   - student@test.com: student (Gr10) with plan, completed courses, grades, GPA snapshot
 *   - student-b@test.com: 2nd student (Gr9) — parent's other child for multi-child switcher tests
 *   - parent@test.com: parent linked to BOTH student accounts with edit access + plan shares
 *   - counselor@test.com: counselor linked to student's account (read-only) with plan share (view)
 *   - Course catalog verified non-empty (fails loudly if not seeded)
 *   - Ephemeral accounts cleaned up from previous runs
 *
 * Idempotent: safe to run multiple times. Fills gaps in existing data.
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

// ── Constants ────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const TEST_PASSWORD = "Test1234!";
export const TEST_STUDENT_EMAIL = "student@test.com";
export const TEST_STUDENT_B_EMAIL = "student-b@test.com";
export const TEST_PARENT_EMAIL = "parent@test.com";
export const TEST_COUNSELOR_EMAIL = "counselor@test.com";
export const EPHEMERAL_EMAILS = ["student2@test.com", "student3@test.com"];

const TEST_STATE = "IL";
const TEST_SCHOOL = "Stevenson High School";
const TEST_GRADE_LEVEL = 10;
const TEST_GRADUATION_YEAR = 2028;
const STUDENT_B_GRADE_LEVEL = 9;
const STUDENT_B_GRADUATION_YEAR = 2029;
const COURSES_PER_SEMESTER = 4;
const SAMPLE_GRADES = ["A", "A-", "B+", "B"];

interface TestUser {
  email: string;
  role: "student" | "parent" | "counselor";
  name: string;
  dob: string;
}

const TEST_USERS: TestUser[] = [
  { email: TEST_STUDENT_EMAIL, role: "student", name: "Test Student", dob: "2010-03-15" },
  { email: TEST_STUDENT_B_EMAIL, role: "student", name: "Test Sibling", dob: "2012-07-22" },
  { email: TEST_PARENT_EMAIL, role: "parent", name: "Test Parent", dob: "1980-06-01" },
  { email: TEST_COUNSELOR_EMAIL, role: "counselor", name: "Test Counselor", dob: "1985-09-20" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function ensureAccountMember(
  client: pg.Client, accountId: string, userId: string,
  role: string, canEdit: boolean, invitedBy: string,
) {
  await client.query(
    `INSERT INTO account_members (account_id, user_id, role, can_edit, invited_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (account_id, user_id) DO NOTHING`,
    [accountId, userId, role, canEdit, invitedBy],
  );
}

async function ensureConsent(client: pg.Client, userId: string) {
  const docs = await client.query(`SELECT id FROM legal_documents ORDER BY version DESC`);
  if (docs.rows.length === 0) return;

  for (const doc of docs.rows) {
    await client.query(
      `INSERT INTO consent_records (user_id, legal_document_id, action, consented_at)
       VALUES ($1, $2, 'accepted', NOW()) ON CONFLICT DO NOTHING`,
      [userId, doc.id],
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function globalSetup() {
  console.log("[e2e-setup] Starting test data setup...");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("[e2e-setup] Missing Supabase credentials — skipping setup");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // ── 1. Clean up ephemeral accounts from previous runs ────────────
    const ephemeral = await client.query(
      `SELECT id FROM users WHERE email = ANY($1)`, [EPHEMERAL_EMAILS],
    );
    if (ephemeral.rows.length > 0) {
      const ids = ephemeral.rows.map((r: { id: string }) => r.id);
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
      await client.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
      try { await client.query(`DELETE FROM auth.users WHERE email = ANY($1)`, [EPHEMERAL_EMAILS]); } catch { /* ok */ }
      console.log(`[e2e-setup] Cleaned ${ids.length} ephemeral account(s)`);
    }

    // ── 2. Create/verify auth users ──────────────────────────────────
    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const authByEmail = new Map(
      existingAuth?.users?.map((u) => [u.email, u.id]) ?? [],
    );

    const userIds: Record<string, string> = {};
    for (const user of TEST_USERS) {
      const existingId = authByEmail.get(user.email);
      if (existingId) {
        userIds[user.email] = existingId;
        continue;
      }
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email, password: TEST_PASSWORD, email_confirm: true,
        user_metadata: { name: user.name, role: user.role },
      });
      if (error) { console.error(`[e2e-setup] Failed: ${user.email}:`, error.message); continue; }
      userIds[user.email] = data.user.id;
      console.log(`[e2e-setup] Created auth user ${user.email}`);
    }

    const studentId = userIds[TEST_STUDENT_EMAIL];
    const studentBId = userIds[TEST_STUDENT_B_EMAIL];
    const parentId = userIds[TEST_PARENT_EMAIL];
    const counselorId = userIds[TEST_COUNSELOR_EMAIL];

    if (!studentId) { console.error("[e2e-setup] Student not found — aborting"); return; }

    // ── 3. Ensure app user rows ──────────────────────────────────────
    for (const user of TEST_USERS) {
      const id = userIds[user.email];
      if (!id) continue;
      const [first, last] = user.name.split(" ");
      await client.query(
        `INSERT INTO users (id, email, first_name, last_name, role, date_of_birth, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name, role = EXCLUDED.role`,
        [id, user.email, first, last || null, user.role, user.dob],
      );
    }

    // ── 4. Ensure student account ────────────────────────────────────
    const acctResult = await client.query(
      `SELECT id FROM accounts WHERE student_user_id = $1 LIMIT 1`, [studentId],
    );
    let accountId: string;
    if (acctResult.rows.length > 0) {
      accountId = acctResult.rows[0].id;
      // Ensure account fields are correct
      await client.query(
        `UPDATE accounts SET student_name = 'Test Student', grade_level = $1, graduation_year = $2,
         state = $3, school_name = $4, claimed_at = COALESCE(claimed_at, NOW())
         WHERE id = $5`,
        [TEST_GRADE_LEVEL, TEST_GRADUATION_YEAR, TEST_STATE, TEST_SCHOOL, accountId],
      );
    } else {
      const ins = await client.query(
        `INSERT INTO accounts (student_user_id, student_name, grade_level, graduation_year, state, school_name, claimed_at, created_by)
         VALUES ($1, 'Test Student', $2, $3, $4, $5, NOW(), $1) RETURNING id`,
        [studentId, TEST_GRADE_LEVEL, TEST_GRADUATION_YEAR, TEST_STATE, TEST_SCHOOL],
      );
      accountId = ins.rows[0].id;
    }
    console.log(`[e2e-setup] Student account: ${accountId}`);

    // ── 5. Ensure all account members ────────────────────────────────
    await ensureAccountMember(client, accountId, studentId, "student", true, studentId);
    if (parentId) await ensureAccountMember(client, accountId, parentId, "parent", true, studentId);
    if (counselorId) await ensureAccountMember(client, accountId, counselorId, "counselor", false, studentId);

    // ── 6. Ensure student profile ────────────────────────────────────
    await client.query(
      `INSERT INTO student_profiles (user_id, current_grade_level, graduation_year)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET current_grade_level = EXCLUDED.current_grade_level,
         graduation_year = EXCLUDED.graduation_year`,
      [studentId, TEST_GRADE_LEVEL, TEST_GRADUATION_YEAR],
    );

    // ── 7. Ensure primary plan exists ────────────────────────────────
    const planResult = await client.query(
      `SELECT id FROM four_year_plans WHERE account_id = $1 AND is_primary = true AND is_template = false LIMIT 1`,
      [accountId],
    );
    let planId: string;
    if (planResult.rows.length > 0) {
      planId = planResult.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO four_year_plans (account_id, student_id, name, school_year, is_primary, is_template, status, created_by)
         VALUES ($1, $2, 'E2E Test Plan', '2024-2025', true, false, 'active', $2) RETURNING id`,
        [accountId, studentId],
      );
      planId = ins.rows[0].id;
    }
    console.log(`[e2e-setup] Primary plan: ${planId}`);

    // ── 8. Verify course catalog is seeded ─────────────────────────
    const catalogCheck = await client.query(
      `SELECT COUNT(*)::int as n FROM courses WHERE is_active = true`,
    );
    if (catalogCheck.rows[0].n === 0) {
      throw new Error(
        "[e2e-setup] Course catalog is empty — run `npx tsx scripts/seed.ts` before tests. " +
        "Transcript, GPA, and planner tests depend on real course data."
      );
    }
    console.log(`[e2e-setup] Course catalog: ${catalogCheck.rows[0].n} active courses`);

    // ── 9. Ensure plan has courses (Gr9 completed + Gr10 enrolled) ───
    const completedCount = await client.query(
      `SELECT COUNT(*)::int as n FROM plan_courses WHERE plan_id = $1 AND status = 'completed' AND planned_grade IS NOT NULL`,
      [planId],
    );

    if (completedCount.rows[0].n === 0) {
      const catalog = await client.query(
        `SELECT id, code FROM courses WHERE is_active = true ORDER BY code LIMIT $1`,
        [COURSES_PER_SEMESTER * 4],
      );

      let courseIdx = 0;
      for (let grade = 9; grade <= TEST_GRADE_LEVEL; grade++) {
        for (let sem = 1; sem <= 2; sem++) {
          for (let i = 0; i < COURSES_PER_SEMESTER && courseIdx < catalog.rows.length; i++) {
            const isCompleted = grade === 9;
            const status = isCompleted ? "completed" : "enrolled";
            const plannedGrade = isCompleted ? SAMPLE_GRADES[i] : null;

            await client.query(
              `INSERT INTO plan_courses (plan_id, course_id, grade_level, semester, status, planned_grade)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING`,
              [planId, catalog.rows[courseIdx].id, grade, sem, status, plannedGrade],
            );
            courseIdx++;
          }
        }
      }
      console.log(`[e2e-setup] Ensured ${courseIdx} courses (Gr9 completed with grades, Gr10 enrolled)`);
    } else {
      console.log(`[e2e-setup] Plan has ${completedCount.rows[0].n} completed courses with grades`);
    }

    // ── 10. Ensure GPA snapshot exists ───────────────────────────────
    const snap = await client.query(
      `SELECT id FROM gpa_snapshots WHERE student_id = $1 AND trigger = 'semester_end' LIMIT 1`,
      [studentId],
    );
    if (snap.rows.length === 0) {
      await client.query(
        `INSERT INTO gpa_snapshots (student_id, account_id, trigger, cumulative_gpa, weighted_gpa, credits_earned, credits_attempted)
         VALUES ($1, $2, 'semester_end', '3.500', '3.750', '8', '8')`,
        [studentId, accountId],
      );
      console.log("[e2e-setup] Created GPA snapshot");
    }

    // ── 11. Ensure consent for ALL users ─────────────────────────────
    for (const userId of [studentId, studentBId, parentId, counselorId].filter(Boolean)) {
      await ensureConsent(client, userId as string);
    }
    console.log("[e2e-setup] Ensured consent records for all users");

    // ── 12. Ensure Grade 9 locked ────────────────────────────────────
    await client.query(
      `UPDATE four_year_plans SET locked_grade_levels = $1 WHERE id = $2`,
      [JSON.stringify([9]), planId],
    );

    // ── 13. Ensure plan shares for parent & counselor ────────────────
    for (const { userId, perm } of [
      { userId: parentId, perm: "edit" },
      { userId: counselorId, perm: "view" },
    ]) {
      if (!userId) continue;
      await client.query(
        `INSERT INTO plan_shares (plan_id, user_id, granted_by, permission)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (plan_id, user_id) DO NOTHING`,
        [planId, userId, studentId, perm],
      );
    }
    console.log("[e2e-setup] Ensured plan shares for parent (edit) and counselor (view)");

    // ── 14. Ensure 2nd student account for multi-child tests ─────────
    let accountBId: string | null = null;
    if (studentBId) {
      const acctBResult = await client.query(
        `SELECT id FROM accounts WHERE student_user_id = $1 LIMIT 1`, [studentBId],
      );
      if (acctBResult.rows.length > 0) {
        accountBId = acctBResult.rows[0].id;
        await client.query(
          `UPDATE accounts SET student_name = 'Test Sibling', grade_level = $1, graduation_year = $2,
           state = $3, school_name = $4, claimed_at = COALESCE(claimed_at, NOW())
           WHERE id = $5`,
          [STUDENT_B_GRADE_LEVEL, STUDENT_B_GRADUATION_YEAR, TEST_STATE, TEST_SCHOOL, accountBId],
        );
      } else {
        const ins = await client.query(
          `INSERT INTO accounts (student_user_id, student_name, grade_level, graduation_year, state, school_name, claimed_at, created_by)
           VALUES ($1, 'Test Sibling', $2, $3, $4, $5, NOW(), $1) RETURNING id`,
          [studentBId, STUDENT_B_GRADE_LEVEL, STUDENT_B_GRADUATION_YEAR, TEST_STATE, TEST_SCHOOL],
        );
        accountBId = ins.rows[0].id;
      }

      // Student B is a member of their own account
      await ensureAccountMember(client, accountBId!, studentBId, "student", true, studentBId);
      // Parent linked to 2nd child's account too
      if (parentId) await ensureAccountMember(client, accountBId!, parentId, "parent", true, studentBId);

      // Student profile for student B
      await client.query(
        `INSERT INTO student_profiles (user_id, current_grade_level, graduation_year)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET current_grade_level = EXCLUDED.current_grade_level,
           graduation_year = EXCLUDED.graduation_year`,
        [studentBId, STUDENT_B_GRADE_LEVEL, STUDENT_B_GRADUATION_YEAR],
      );

      // Create a basic plan for student B so parent sees content when switching
      const planBResult = await client.query(
        `SELECT id FROM four_year_plans WHERE account_id = $1 AND is_primary = true LIMIT 1`,
        [accountBId],
      );
      if (planBResult.rows.length === 0) {
        await client.query(
          `INSERT INTO four_year_plans (account_id, student_id, name, school_year, is_primary, is_template, status, created_by)
           VALUES ($1, $2, 'Sibling Test Plan', '2024-2025', true, false, 'active', $2)`,
          [accountBId, studentBId],
        );
      }

      console.log(`[e2e-setup] 2nd student account: ${accountBId} (Grade ${STUDENT_B_GRADE_LEVEL}, linked to parent)`);
    }

    // ── 15. Verify final state ───────────────────────────────────────
    const verify = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM account_members WHERE account_id = $1) as members,
        (SELECT COUNT(*) FROM plan_courses WHERE plan_id = $2) as courses,
        (SELECT COUNT(*) FROM plan_courses WHERE plan_id = $2 AND status = 'completed' AND planned_grade IS NOT NULL) as graded,
        (SELECT COUNT(*) FROM gpa_snapshots WHERE student_id = $3) as snapshots,
        (SELECT COUNT(*) FROM consent_records WHERE user_id = $3) as consent,
        (SELECT COUNT(*) FROM plan_shares WHERE plan_id = $2) as shares
    `, [accountId, planId, studentId]);

    const parentAccounts = await client.query(
      `SELECT COUNT(*)::int as n FROM account_members WHERE user_id = $1 AND role = 'parent'`,
      [parentId],
    );

    const v = verify.rows[0];
    console.log(
      `[e2e-setup] ✅ Setup complete — ${v.members} members, ${v.courses} courses (${v.graded} graded), ` +
      `${v.snapshots} snapshots, ${v.consent} consent records, ${v.shares} plan shares, ` +
      `parent linked to ${parentAccounts.rows[0].n} child account(s)`
    );

  } catch (error) {
    console.error("[e2e-setup] Setup failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

export default globalSetup;
