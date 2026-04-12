import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  gradeEntries,
  courses,
  accounts,
  accountMembers,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";
import { ALL_GRADES } from "@/config/grade-scale";

// ─── Validation ────────────────────────────────────────────────────────────

const gradeEnum = z.enum(ALL_GRADES);

const gradeEntrySchema = z.object({
  course_id: z.string().uuid(),
  academic_year: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "academic_year must be in format YYYY-YYYY"),
  semester: z.number().int().min(-2).max(2),
  grade: gradeEnum.optional().nullable(),
  credit_earned: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? String(v) : v))
    .pipe(z.string().regex(/^\d{1,2}(\.\d)?$/, "Invalid credit value"))
    .optional()
    .nullable(),
});

const bulkUpsertSchema = z.object({
  entries: z.array(gradeEntrySchema).min(1).max(100),
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Resolves the accountId for the current user.
 * Uses X-Account-Id header if present, otherwise finds the user's account.
 */
async function resolveAccountId(
  request: NextRequest,
  userId: string
): Promise<string | null> {
  const headerAccountId = request.headers.get("X-Account-Id");
  if (headerAccountId) return headerAccountId;

  const [membership] = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(eq(accountMembers.userId, userId))
    .limit(1);

  return membership?.accountId ?? null;
}

/**
 * Resolves the studentUserId from an account.
 */
async function resolveStudentId(
  accountId: string
): Promise<string | null> {
  const [account] = await db
    .select({ studentUserId: accounts.studentUserId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return account?.studentUserId ?? null;
}

// ─── GET /api/v1/transcript ────────────────────────────────────────────────────

/**
 * List grade entries for the student's account.
 * Query params: academic_year (optional), semester (optional)
 * Returns entries grouped by academic_year → semester → courses.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const rl = await rateLimit(`grades:get:${user.id}`, 60, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    }

    const accountId = await resolveAccountId(request, user.id);
    if (!accountId) {
      return errorResponse("NOT_FOUND", "No account found.", 404);
    }

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    const studentId = await resolveStudentId(accountCtx.accountId);
    if (!studentId) {
      return errorResponse("NOT_FOUND", "No student linked to this account.", 404);
    }

    // Parse optional query filters
    const { searchParams } = new URL(request.url);
    const academicYearFilter = searchParams.get("academic_year");
    const semesterFilter = searchParams.get("semester");

    // Build conditions
    const conditions = [eq(gradeEntries.studentId, studentId)];
    if (academicYearFilter) {
      conditions.push(eq(gradeEntries.academicYear, academicYearFilter));
    }
    if (semesterFilter) {
      const sem = parseInt(semesterFilter, 10);
      if ([-2, -1, 1, 2].includes(sem)) {
        conditions.push(eq(gradeEntries.semester, sem));
      }
    }

    // Query grade entries joined with course info
    const rows = await db
      .select({
        id: gradeEntries.id,
        courseId: gradeEntries.courseId,
        academicYear: gradeEntries.academicYear,
        semester: gradeEntries.semester,
        finalGrade: gradeEntries.finalGrade,
        creditEarned: gradeEntries.creditEarned,
        createdAt: gradeEntries.createdAt,
        updatedAt: gradeEntries.updatedAt,
        courseCode: courses.code,
        courseName: courses.name,
        creditType: courses.creditType,
        creditValue: courses.creditValue,
      })
      .from(gradeEntries)
      .innerJoin(courses, eq(gradeEntries.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(gradeEntries.academicYear, gradeEntries.semester);

    // Group by academic_year → semester → courses
    const grouped: Record<
      string,
      {
        academic_year: string;
        bySemester: Record<
          number,
          {
            semester: number;
            courses: Array<{
              id: string;
              course_id: string;
              code: string;
              name: string;
              credit_type: string;
              credit_value: string;
              grade: string | null;
              credit_earned: string | null;
            }>;
          }
        >;
      }
    > = {};

    for (const row of rows) {
      if (!grouped[row.academicYear]) {
        grouped[row.academicYear] = {
          academic_year: row.academicYear,
          bySemester: {},
        };
      }

      const yearGroup = grouped[row.academicYear];
      if (!yearGroup.bySemester[row.semester]) {
        yearGroup.bySemester[row.semester] = {
          semester: row.semester,
          courses: [],
        };
      }

      yearGroup.bySemester[row.semester].courses.push({
        id: row.id,
        course_id: row.courseId,
        code: row.courseCode,
        name: row.courseName,
        credit_type: row.creditType,
        credit_value: row.creditValue,
        grade: row.finalGrade,
        credit_earned: row.creditEarned,
      });
    }

    // Convert to array
    const result = Object.values(grouped).map((yearGroup) => ({
      academic_year: yearGroup.academic_year,
      semesters: Object.values(yearGroup.bySemester),
    }));

    return successResponse(result);
  } catch (error) {
    console.error("[grades] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

// ─── POST /api/v1/transcript ───────────────────────────────────────────────────

/**
 * Create or update grade entries (bulk upsert).
 * Requires student role.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const rl = await rateLimit(`grades:post:${user.id}`, 30, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    }

    const accountId = await resolveAccountId(request, user.id);
    if (!accountId) {
      return errorResponse("NOT_FOUND", "No account found.", 404);
    }

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    if (accountCtx.role !== "student") {
      return errorResponse(
        "FORBIDDEN",
        "Only students can create or update grade entries.",
        403
      );
    }

    if (!accountCtx.canEdit) {
      return errorResponse("FORBIDDEN", "Read-only access.", 403);
    }

    const studentId = await resolveStudentId(accountCtx.accountId);
    if (!studentId) {
      return errorResponse("NOT_FOUND", "No student linked to this account.", 404);
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = bulkUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { entries } = parsed.data;

    // Upsert each entry using the unique constraint
    const upserted = [];
    for (const entry of entries) {
      const values: Record<string, unknown> = {
        studentId,
        accountId: accountCtx.accountId,
        courseId: entry.course_id,
        academicYear: entry.academic_year,
        semester: entry.semester,
      };

      if (entry.grade !== undefined) {
        values.finalGrade = entry.grade;
      }
      if (entry.credit_earned !== undefined) {
        values.creditEarned = entry.credit_earned;
      }

      const [row] = await db
        .insert(gradeEntries)
        .values(values as typeof gradeEntries.$inferInsert)
        .onConflictDoUpdate({
          target: [
            gradeEntries.studentId,
            gradeEntries.courseId,
            gradeEntries.academicYear,
            gradeEntries.semester,
          ],
          set: {
            ...(entry.grade !== undefined && {
              finalGrade: entry.grade,
            }),
            ...(entry.credit_earned !== undefined && {
              creditEarned: entry.credit_earned,
            }),
            updatedAt: sql`now()`,
          },
        })
        .returning();

      upserted.push(row);
    }

    return successResponse(upserted, undefined, 201);
  } catch (error) {
    console.error("[grades] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
