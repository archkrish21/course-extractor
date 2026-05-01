import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  fourYearPlans,
  studentParentLinks,
  counselorStudentLinks,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { validatePlanIntegrity, type Violation } from "@/lib/prereq/validator";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Legacy access check for pre-migration plans.
 */
async function canReadPlanLegacy(
  planStudentId: string,
  userId: string
): Promise<boolean> {
  if (planStudentId === userId) return true;

  const [parentLink] = await db
    .select({ studentId: studentParentLinks.studentId })
    .from(studentParentLinks)
    .where(
      and(
        eq(studentParentLinks.studentId, planStudentId),
        eq(studentParentLinks.parentId, userId)
      )
    )
    .limit(1);
  if (parentLink) return true;

  const [counselorLink] = await db
    .select({ studentId: counselorStudentLinks.studentId })
    .from(counselorStudentLinks)
    .where(
      and(
        eq(counselorStudentLinks.studentId, planStudentId),
        eq(counselorStudentLinks.counselorId, userId)
      )
    )
    .limit(1);
  if (counselorLink) return true;

  return false;
}

/**
 * GET /api/v1/plans/:id/validate
 * Full plan validation. Returns all violations grouped by course.
 * Any account member can validate (read-only operation).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: planId } = await context.params;

    // Fetch the plan
    const [plan] = await db
      .select()
      .from(fourYearPlans)
      .where(eq(fourYearPlans.id, planId))
      .limit(1);

    if (!plan) {
      return errorResponse("NOT_FOUND", "Plan not found.", 404);
    }

    // Account-based authorization
    if (plan.accountId) {
      const accountCtx = await getAccountContext(user.id, plan.accountId);
      if (!accountCtx) {
        return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
      }
    } else {
      // Backward compatibility
      if (!plan.studentId || !(await canReadPlanLegacy(plan.studentId, user.id))) {
        return errorResponse(
          "FORBIDDEN",
          "You do not have access to this plan.",
          403
        );
      }
    }

    // Run full plan validation
    const result = await validatePlanIntegrity(planId);

    // Group violations by course
    const violationsByCourse: Record<
      string,
      {
        courseId: string;
        courseCode: string;
        courseName: string;
        violations: Violation[];
      }
    > = {};

    for (const v of result.violations) {
      if (!violationsByCourse[v.courseId]) {
        violationsByCourse[v.courseId] = {
          courseId: v.courseId,
          courseCode: v.courseCode,
          courseName: v.courseName,
          violations: [],
        };
      }
      violationsByCourse[v.courseId].violations.push(v);
    }

    // Group ignored (override-suppressed) violations by course separately so
    // the UI can render them under a "warnings ignored" affordance.
    const ignoredByCourse: Record<
      string,
      {
        courseId: string;
        courseCode: string;
        courseName: string;
        violations: Violation[];
      }
    > = {};
    for (const v of result.ignoredViolations ?? []) {
      if (!ignoredByCourse[v.courseId]) {
        ignoredByCourse[v.courseId] = {
          courseId: v.courseId,
          courseCode: v.courseCode,
          courseName: v.courseName,
          violations: [],
        };
      }
      ignoredByCourse[v.courseId].violations.push(v);
    }

    return successResponse({
      valid: result.valid,
      totalViolations: result.violations.length,
      courseViolations: Object.values(violationsByCourse),
      ignoredCourseViolations: Object.values(ignoredByCourse),
    });
  } catch (error) {
    console.error("[plans/:id/validate] GET error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
