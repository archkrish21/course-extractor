/**
 * Playwright global setup — creates all test accounts and data before E2E tests.
 * Idempotent: skips creation if accounts already exist.
 * Uses Supabase Admin API for auth + direct DB for app data.
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
export const TEST_PARENT_EMAIL = "parent@test.com";
export const TEST_COUNSELOR_EMAIL = "counselor@test.com";
export const EPHEMERAL_EMAILS = ["student2@test.com", "student3@test.com"];

const TEST_STATE = "IL";
const TEST_SCHOOL = "Stevenson High School";
const TEST_GRADE_LEVEL = 10;
const TEST_GRADUATION_YEAR = 2028;
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
  { email: TEST_PARENT_EMAIL, role: "parent", name: "Test Parent", dob: "1980-06-01" },
  { email: TEST_COUNSELOR_EMAIL, role: "counselor", name: "Test Counselor", dob: "1985-09-20" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function addAccountMember(
  client: pg.Client,
  accountId: string,
  userId: string,
  role: string,
  canEdit: boolean,
  invitedBy: string,
) {
  await client.query(
    `INSERT INTO account_members (account_id, user_id, role, can_edit, invited_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (account_id, user_id) DO NOTHING`,
    [accountId, userId, role, canEdit, invitedBy],
  );
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
    // ── Auth users (fetch all once, then create missing) ─────────────
    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const authByEmail = new Map(
      existingAuth?.users?.map((u) => [u.email, u.id]) ?? [],
    );

    const userIds: Record<string, string> = {};
    for (const user of TEST_USERS) {
      const existingId = authByEmail.get(user.email);
      if (existingId) {
        userIds[user.email] = existingId;
        console.log(`[e2e-setup] Auth user ${user.email} exists`);
        continue;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { name: user.name, role: user.role },
      });

      if (error) {
        console.error(`[e2e-setup] Failed to create ${user.email}:`, error.message);
        continue;
      }
      userIds[user.email] = data.user.id;
      console.log(`[e2e-setup] Created auth user ${user.email}`);
    }

    const studentId = userIds[TEST_STUDENT_EMAIL];
    const parentId = userIds[TEST_PARENT_EMAIL];
    const counselorId = userIds[TEST_COUNSELOR_EMAIL];

    if (!studentId) {
      console.error("[e2e-setup] Student user not found — aborting");
      return;
    }

    // ── App user rows ────────────────────────────────────────────────
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
    console.log("[e2e-setup] Upserted app users");

    // ── Student account ──────────────────────────────────────────────
    const acctResult = await client.query(
      `SELECT id FROM accounts WHERE student_user_id = $1 LIMIT 1`, [studentId],
    );
    let accountId: string;
    if (acctResult.rows.length > 0) {
      accountId = acctResult.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO accounts (student_user_id, student_name, grade_level, graduation_year, state, school_name, claimed_at, created_by)
         VALUES ($1, 'Test Student', $2, $3, $4, $5, NOW(), $1) RETURNING id`,
        [studentId, TEST_GRADE_LEVEL, TEST_GRADUATION_YEAR, TEST_STATE, TEST_SCHOOL],
      );
      accountId = ins.rows[0].id;
      console.log(`[e2e-setup] Created student account (${accountId})`);
    }

    // ── Account members ──────────────────────────────────────────────
    await addAccountMember(client, accountId, studentId, "student", true, studentId);
    if (parentId) {
      await addAccountMember(client, accountId, parentId, "parent", true, studentId);
      console.log("[e2e-setup] Linked parent");
    }
    if (counselorId) {
      await addAccountMember(client, accountId, counselorId, "counselor", false, studentId);
      console.log("[e2e-setup] Linked counselor (read-only)");
    }

    // ── Student profile ──────────────────────────────────────────────
    await client.query(
      `INSERT INTO student_profiles (user_id, current_grade_level, graduation_year)
       VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING`,
      [studentId, TEST_GRADE_LEVEL, TEST_GRADUATION_YEAR],
    );

    // ── Primary plan ─────────────────────────────────────────────────
    const planResult = await client.query(
      `SELECT id FROM four_year_plans WHERE account_id = $1 AND is_primary = true LIMIT 1`, [accountId],
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
      console.log(`[e2e-setup] Created primary plan (${planId})`);
    }

    // ── Courses (batch insert) ───────────────────────────────────────
    const courseCount = await client.query(
      `SELECT COUNT(*)::int as n FROM plan_courses WHERE plan_id = $1`, [planId],
    );
    if (courseCount.rows[0].n === 0) {
      const catalog = await client.query(
        `SELECT id FROM courses ORDER BY code LIMIT $1`,
        [COURSES_PER_SEMESTER * 4], // 4 slots: Gr9 S1, Gr9 S2, Gr10 S1, Gr10 S2
      );

      if (catalog.rows.length > 0) {
        const values: string[] = [];
        const params: unknown[] = [planId];
        let paramIdx = 2;
        let courseIdx = 0;

        for (let grade = 9; grade <= TEST_GRADE_LEVEL; grade++) {
          for (let sem = 1; sem <= 2; sem++) {
            for (let i = 0; i < COURSES_PER_SEMESTER && courseIdx < catalog.rows.length; i++) {
              const isCompleted = grade === 9;
              const status = isCompleted ? "completed" : "enrolled";
              const plannedGrade = isCompleted ? SAMPLE_GRADES[i] : null;

              values.push(`($1, $${paramIdx}, ${grade}, ${sem}, '${status}', ${plannedGrade ? `$${paramIdx + 1}` : "NULL"})`);
              params.push(catalog.rows[courseIdx].id);
              if (plannedGrade) params.push(plannedGrade);
              paramIdx = params.length + 1;
              courseIdx++;
            }
          }
        }

        if (values.length > 0) {
          await client.query(
            `INSERT INTO plan_courses (plan_id, course_id, grade_level, semester, status, planned_grade)
             VALUES ${values.join(", ")} ON CONFLICT DO NOTHING`,
            params,
          );
          console.log(`[e2e-setup] Added ${courseIdx} courses to plan`);
        }
      } else {
        console.warn("[e2e-setup] No courses in catalog — run seed first");
      }
    }

    // ── GPA snapshot ─────────────────────────────────────────────────
    const snap = await client.query(
      `SELECT id FROM gpa_snapshots WHERE student_id = $1 LIMIT 1`, [studentId],
    );
    if (snap.rows.length === 0) {
      await client.query(
        `INSERT INTO gpa_snapshots (student_id, account_id, trigger, cumulative_gpa, weighted_gpa, credits_earned, credits_attempted)
         VALUES ($1, $2, 'semester_end', '3.500', '3.750', '8', '8')`,
        [studentId, accountId],
      );
      console.log("[e2e-setup] Created GPA snapshot");
    }

    // ── Consent records (fetch docs once, batch per user) ────────────
    const docs = await client.query(`SELECT id FROM legal_documents ORDER BY version DESC`);
    for (const userId of [studentId, parentId, counselorId].filter(Boolean)) {
      const existing = await client.query(
        `SELECT id FROM consent_records WHERE user_id = $1 LIMIT 1`, [userId],
      );
      if (existing.rows.length === 0 && docs.rows.length > 0) {
        const vals = docs.rows.map((_, i) => `($1, $${i + 2}, 'accepted', NOW())`).join(", ");
        await client.query(
          `INSERT INTO consent_records (user_id, legal_document_id, action, consented_at) VALUES ${vals} ON CONFLICT DO NOTHING`,
          [userId, ...docs.rows.map((d: { id: string }) => d.id)],
        );
        console.log(`[e2e-setup] Created consent for ${userId}`);
      }
    }

    // ── Lock Grade 9 ─────────────────────────────────────────────────
    await client.query(
      `UPDATE four_year_plans SET locked_grade_levels = $1 WHERE id = $2`,
      [JSON.stringify([9]), planId],
    );

    console.log("[e2e-setup] ✅ Setup complete");
  } catch (error) {
    console.error("[e2e-setup] Setup failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

export default globalSetup;
