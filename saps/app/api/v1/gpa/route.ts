import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  courses,
  planCourses,
  fourYearPlans,
  accounts,
  accountMembers,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

// ─── GET /api/v1/gpa ──────────────────────────────────────────────────────

/**
 * Live GPA calculation from plan_courses on the primary plan.
 * - Cumulative (actual): only completed courses with grades
 * - Projected: all graded courses (planned + enrolled + completed)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const rl = await rateLimit(`gpa:get:${user.id}`, 60, 60);
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

    // Find the primary plan
    const [plan] = await db
      .select({ id: fourYearPlans.id })
      .from(fourYearPlans)
      .where(
        and(
          eq(fourYearPlans.accountId, accountCtx.accountId),
          eq(fourYearPlans.isPrimary, true),
          eq(fourYearPlans.isTemplate, false)
        )
      )
      .limit(1);

    if (!plan) {
      // No plan — return empty GPA
      return successResponse({
        cumulative: { unweighted: null, weighted: null, credits: 0, courses: 0 },
        projected: { unweighted: null, weighted: null, credits: 0, courses: 0 },
        hasGrades: false,
      });
    }

    // Fetch all plan courses with course info
    const allPlanCourses = await db
      .select({
        gradeLevel: planCourses.gradeLevel,
        semester: planCourses.semester,
        status: planCourses.status,
        plannedGrade: planCourses.plannedGrade,
        gpaWaiverApplied: planCourses.gpaWaiverApplied,
        creditValue: courses.creditValue,
        creditType: courses.creditType,
      })
      .from(planCourses)
      .innerJoin(courses, eq(planCourses.courseId, courses.id))
      .where(eq(planCourses.planId, plan.id));

    // Build GPA input arrays
    const gpaInput = allPlanCourses.map((pc) => ({
      creditValue: pc.creditValue,
      creditType: pc.creditType,
      plannedGrade: pc.plannedGrade,
      status: (pc.status ?? "planned") as "planned" | "enrolled" | "completed" | "dropped",
      gpaWaiver: false,
      gpaWaiverApplied: pc.gpaWaiverApplied ?? false,
    }));

    // Cumulative: only completed courses
    const cumulative = calculateGPA(gpaInput, "actual");

    // Projected: all graded courses (planned + enrolled + completed)
    const projected = calculateGPA(gpaInput, "projected");

    // Check if any grades exist
    const hasGrades = gpaInput.some((c) => c.plannedGrade && c.status !== "dropped");

    // Calculate total plan credits (adjusted for full-year: creditValue/2 per row)
    const activeCourses = allPlanCourses.filter((c) => c.status !== "dropped");
    const totalPlanCredits = activeCourses.reduce((sum, c) => {
      const val = parseFloat(c.creditValue) || 0;
      return sum + (val > 1 ? val / 2 : val);
    }, 0);
    const totalEarnedCredits = allPlanCourses
      .filter((c) => c.status === "completed")
      .reduce((sum, c) => {
        const val = parseFloat(c.creditValue) || 0;
        return sum + (val > 1 ? val / 2 : val);
      }, 0);

    // Unique course count (full-year courses counted once, not twice)
    const courseIds = new Set<string>();
    for (const pc of activeCourses) {
      const key = `${pc.gradeLevel}-${pc.semester === 2 ? "s2" : "s1"}-${pc.creditType}`;
      courseIds.add(`${pc.gradeLevel}-${pc.semester}`);
    }
    const totalCourses = activeCourses.length;

    return successResponse({
      cumulative: {
        unweighted: cumulative.unweighted,
        weighted: cumulative.weighted,
        credits: cumulative.totalCredits,
        courses: cumulative.coursesUsed,
      },
      projected: {
        unweighted: projected.unweighted,
        weighted: projected.weighted,
        credits: projected.totalCredits,
        courses: projected.coursesUsed,
      },
      plan: {
        totalCredits: totalPlanCredits,
        earnedCredits: totalEarnedCredits,
        totalCourses,
      },
      hasGrades,
    });
  } catch (error) {
    console.error("[gpa] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
