import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  gradeEntries,
  courses,
  accounts,
  accountMembers,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";
import { calculateGPA } from "@/lib/gpa/calc";
import { getEffectiveTier } from "@/lib/subscription/middleware";
import { ALL_GRADES } from "@/config/grade-scale";

// ─── Validation ────────────────────────────────────────────────────────────

const whatIfChangeSchema = z.object({
  course_id: z.string().uuid(),
  grade: z.enum(ALL_GRADES),
  action: z.enum(["add", "change", "remove"]),
});

const whatIfBodySchema = z.object({
  changes: z.array(whatIfChangeSchema).min(1).max(50),
});

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

// ─── POST /api/v1/gpa/what-if ──────────────────────────────────────────────

/**
 * What-if GPA simulation.
 * Applies hypothetical grade changes to the student's current grades and
 * recalculates GPA without persisting anything.
 *
 * Plus+ tier feature — returns 402 if the user's subscription is not eligible.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const rl = await rateLimit(`gpa-whatif:post:${user.id}`, 20, 60);
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

    // ── Subscription tier check (Plus+ feature) ─────────────────────────

    const tier = await getEffectiveTier({
      accountId: accountCtx.accountId,
      userId: user.id,
    });

    if (!tier.canWhatIf) {
      return errorResponse(
        "UPGRADE_REQUIRED",
        "What-if GPA simulation requires a Plus or Elite subscription.",
        402,
        { minimum_tier: "plus", current_tier: tier.tier }
      );
    }

    const studentId = await resolveStudentId(accountCtx.accountId);
    if (!studentId) {
      return errorResponse(
        "NOT_FOUND",
        "No student linked to this account.",
        404
      );
    }

    // ── Validate body ───────────────────────────────────────────────────

    const body = await request.json();
    const parsed = whatIfBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { changes } = parsed.data;

    // ── Fetch current grade entries with course info ─────────────────────

    const entries = await db
      .select({
        courseId: gradeEntries.courseId,
        finalGrade: gradeEntries.finalGrade,
        creditValue: courses.creditValue,
        creditType: courses.creditType,
        gpaWaiver: courses.gpaWaiver,
      })
      .from(gradeEntries)
      .innerJoin(courses, eq(gradeEntries.courseId, courses.id))
      .where(eq(gradeEntries.studentId, studentId));

    // Build a mutable map of courseId → course data
    const courseMap = new Map<
      string,
      {
        courseId: string;
        finalGrade: string | null;
        creditValue: string;
        creditType: string;
        gpaWaiver: boolean | null;
        removed: boolean;
      }
    >();

    for (const e of entries) {
      courseMap.set(e.courseId, { ...e, removed: false });
    }

    // ── Apply hypothetical changes ──────────────────────────────────────

    // For "add" actions, we need course info for courses not in grade_entries
    const addCourseIds = changes
      .filter((c) => c.action === "add" && !courseMap.has(c.course_id))
      .map((c) => c.course_id);

    // Fetch course info for new courses (if any)
    if (addCourseIds.length > 0) {
      const addedCourses = await db
        .select({
          id: courses.id,
          creditValue: courses.creditValue,
          creditType: courses.creditType,
          gpaWaiver: courses.gpaWaiver,
        })
        .from(courses)
        .where(inArray(courses.id, addCourseIds));

      for (const ac of addedCourses) {
        courseMap.set(ac.id, {
          courseId: ac.id,
          finalGrade: null,
          creditValue: ac.creditValue,
          creditType: ac.creditType,
          gpaWaiver: ac.gpaWaiver,
          removed: false,
        });
      }
    }

    for (const change of changes) {
      const existing = courseMap.get(change.course_id);

      switch (change.action) {
        case "add":
        case "change":
          if (existing) {
            existing.finalGrade = change.grade;
            existing.removed = false;
          }
          // If course wasn't found even after fetch, skip silently
          break;
        case "remove":
          if (existing) {
            existing.removed = true;
          }
          break;
      }
    }

    // ── Recalculate GPA with modified data ──────────────────────────────

    const simulatedCourses = Array.from(courseMap.values())
      .filter((c) => !c.removed)
      .map((c) => ({
        creditValue: c.creditValue,
        creditType: c.creditType,
        plannedGrade: c.finalGrade,
        status: c.finalGrade ? ("completed" as const) : ("enrolled" as const),
        gpaWaiver: c.gpaWaiver ?? false,
        gpaWaiverApplied: false,
      }));

    const simulated = calculateGPA(simulatedCourses, "actual");

    // Also calculate the current (unmodified) GPA for comparison
    const currentCourses = entries.map((e) => ({
      creditValue: e.creditValue,
      creditType: e.creditType,
      plannedGrade: e.finalGrade,
      status: e.finalGrade ? ("completed" as const) : ("enrolled" as const),
      gpaWaiver: e.gpaWaiver ?? false,
      gpaWaiverApplied: false,
    }));

    const current = calculateGPA(currentCourses, "actual");

    return successResponse({
      current: {
        unweighted: current.unweighted,
        weighted: current.weighted,
        credits: current.totalCredits,
        courses: current.coursesUsed,
      },
      simulated: {
        unweighted: simulated.unweighted,
        weighted: simulated.weighted,
        credits: simulated.totalCredits,
        courses: simulated.coursesUsed,
      },
      changes_applied: changes.length,
    });
  } catch (error) {
    console.error("[gpa/what-if] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
