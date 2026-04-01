import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  gpaSnapshots,
  gradeEntries,
  courses,
  accounts,
  accountMembers,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";
import { calculateGPA } from "@/lib/gpa/calc";

// ─── Helpers ───────────────────────────────────────────────────────────────

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

async function resolveStudentId(accountId: string): Promise<string | null> {
  const [account] = await db
    .select({ studentUserId: accounts.studentUserId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return account?.studentUserId ?? null;
}

// ─── GET /api/v1/gpa/snapshots ─────────────────────────────────────────────

/**
 * List GPA snapshot history ordered by date desc.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const rl = await rateLimit(`gpa-snapshots:get:${user.id}`, 60, 60);
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
      return errorResponse(
        "NOT_FOUND",
        "No student linked to this account.",
        404
      );
    }

    const snapshots = await db
      .select({
        id: gpaSnapshots.id,
        snapshotDate: gpaSnapshots.snapshotDate,
        trigger: gpaSnapshots.trigger,
        cumulativeGpa: gpaSnapshots.cumulativeGpa,
        weightedGpa: gpaSnapshots.weightedGpa,
        semesterGpa: gpaSnapshots.semesterGpa,
        creditsEarned: gpaSnapshots.creditsEarned,
        creditsAttempted: gpaSnapshots.creditsAttempted,
      })
      .from(gpaSnapshots)
      .where(eq(gpaSnapshots.studentId, studentId))
      .orderBy(desc(gpaSnapshots.snapshotDate));

    return successResponse(snapshots);
  } catch (error) {
    console.error("[gpa/snapshots] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

// ─── POST /api/v1/gpa/snapshots ────────────────────────────────────────────

/**
 * Create a manual GPA snapshot from current grade_entries.
 * Requires student role.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const rl = await rateLimit(`gpa-snapshots:post:${user.id}`, 10, 60);
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
        "Only students can create GPA snapshots.",
        403
      );
    }

    if (!accountCtx.canEdit) {
      return errorResponse("FORBIDDEN", "Read-only access.", 403);
    }

    const studentId = await resolveStudentId(accountCtx.accountId);
    if (!studentId) {
      return errorResponse(
        "NOT_FOUND",
        "No student linked to this account.",
        404
      );
    }

    // Fetch all grade entries with course info
    const entries = await db
      .select({
        finalGrade: gradeEntries.finalGrade,
        creditValue: courses.creditValue,
        creditType: courses.creditType,
        gpaWaiver: courses.gpaWaiver,
      })
      .from(gradeEntries)
      .innerJoin(courses, eq(gradeEntries.courseId, courses.id))
      .where(eq(gradeEntries.studentId, studentId));

    // Build courses array for GPA calculation
    const gpaCoursesInput = entries.map((e) => ({
      creditValue: e.creditValue,
      creditType: e.creditType,
      plannedGrade: e.finalGrade,
      status: e.finalGrade ? ("completed" as const) : ("enrolled" as const),
      gpaWaiver: e.gpaWaiver ?? false,
      gpaWaiverApplied: false,
    }));

    const result = calculateGPA(gpaCoursesInput, "actual");

    // Insert snapshot
    const [snapshot] = await db
      .insert(gpaSnapshots)
      .values({
        studentId,
        accountId: accountCtx.accountId,
        trigger: "manual",
        cumulativeGpa: result.unweighted !== null ? String(result.unweighted) : null,
        weightedGpa: result.weighted !== null ? String(result.weighted) : null,
        creditsEarned: String(result.totalCredits),
        creditsAttempted: String(result.totalCredits),
      })
      .returning();

    return successResponse(snapshot, undefined, 201);
  } catch (error) {
    console.error("[gpa/snapshots] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
