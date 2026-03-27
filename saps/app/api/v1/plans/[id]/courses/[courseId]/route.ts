import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  fourYearPlans,
  planCourses,
  courses,
  planHistory,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import {
  validatePlanIntegrity,
  getTransitiveDownstream,
} from "@/lib/prereq/validator";

import { ALL_GRADES } from "@/config/grade-scale";

const patchCourseSchema = z.object({
  semester: z.number().int().min(1).max(2).nullable().optional(),
  planned_grade: z
    .enum(ALL_GRADES)
    .nullable()
    .optional(),
  status: z.enum(["planned", "enrolled", "completed", "dropped"]).optional(),
});

interface RouteContext {
  params: Promise<{ id: string; courseId: string }>;
}

/**
 * PATCH /api/v1/plans/:id/courses/:courseId
 * Update a course in the plan (change semester, planned_grade, status).
 * :courseId here is plan_courses.id (not courses.id).
 * Requires canEdit. Only the student can modify completed courses.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: planId, courseId: planCourseId } = await context.params;

    const body = await request.json();
    const parsed = patchCourseSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updates = parsed.data;
    if (
      updates.semester === undefined &&
      updates.planned_grade === undefined &&
      updates.status === undefined
    ) {
      return errorResponse(
        "VALIDATION_ERROR",
        "At least one of 'semester', 'planned_grade', or 'status' must be provided.",
        400
      );
    }

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
      if (!accountCtx.canEdit) {
        return errorResponse("FORBIDDEN", "Read-only access.", 403);
      }
    } else {
      // Backward compatibility
      if (plan.studentId !== user.id) {
        return errorResponse(
          "FORBIDDEN",
          "You do not have access to modify this plan.",
          403
        );
      }
    }

    // Fetch the plan course
    const [planCourse] = await db
      .select({
        id: planCourses.id,
        planId: planCourses.planId,
        courseId: planCourses.courseId,
        gradeLevel: planCourses.gradeLevel,
        semester: planCourses.semester,
        status: planCourses.status,
        plannedGrade: planCourses.plannedGrade,
      })
      .from(planCourses)
      .where(
        and(
          eq(planCourses.id, planCourseId),
          eq(planCourses.planId, planId)
        )
      )
      .limit(1);

    if (!planCourse) {
      return errorResponse("NOT_FOUND", "Plan course not found.", 404);
    }

    // Cannot modify completed courses (unless the student is doing it via account)
    if (planCourse.status === "completed") {
      if (plan.accountId) {
        const accountCtx = await getAccountContext(user.id, plan.accountId);
        if (!accountCtx || accountCtx.role !== "student") {
          return errorResponse(
            "CONFLICT",
            "Only the student can modify a completed course.",
            409
          );
        }
      } else {
        return errorResponse(
          "CONFLICT",
          "Cannot modify a completed course.",
          409
        );
      }
    }

    // Build update values
    const updateValues: Record<string, unknown> = {};
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    if (updates.semester !== undefined) {
      beforeState.semester = planCourse.semester;
      afterState.semester = updates.semester;
      updateValues.semester = updates.semester;
    }
    if (updates.planned_grade !== undefined) {
      beforeState.plannedGrade = planCourse.plannedGrade;
      afterState.plannedGrade = updates.planned_grade;
      updateValues.plannedGrade = updates.planned_grade;
    }
    if (updates.status !== undefined) {
      beforeState.status = planCourse.status;
      afterState.status = updates.status;
      updateValues.status = updates.status;
    }

    // Update the plan course
    const [updated] = await db
      .update(planCourses)
      .set(updateValues)
      .where(eq(planCourses.id, planCourseId))
      .returning();

    // Determine action type for history
    let action: string = "change_status";
    if (updates.semester !== undefined) action = "change_semester";
    if (updates.planned_grade !== undefined) action = "change_planned_grade";
    if (updates.status !== undefined) action = "change_status";

    await db.insert(planHistory).values({
      planId,
      changedBy: user.id,
      action: action as any,
      beforeState,
      afterState: { ...afterState, planCourseId, courseId: planCourse.courseId },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("[plans/:id/courses/:courseId] PATCH error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}

/**
 * DELETE /api/v1/plans/:id/courses/:courseId
 * Remove a course from the plan. Cannot remove completed courses.
 * Requires canEdit. Only the student can remove completed courses.
 * After removal, runs transitive validation and returns downstream violations as warnings.
 * :courseId here is plan_courses.id (not courses.id).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: planId, courseId: planCourseId } = await context.params;

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
      if (!accountCtx.canEdit) {
        return errorResponse("FORBIDDEN", "Read-only access.", 403);
      }
    } else {
      // Backward compatibility
      if (plan.studentId !== user.id) {
        return errorResponse(
          "FORBIDDEN",
          "You do not have access to modify this plan.",
          403
        );
      }
    }

    // Fetch the plan course with course details
    const [planCourse] = await db
      .select({
        id: planCourses.id,
        planId: planCourses.planId,
        courseId: planCourses.courseId,
        gradeLevel: planCourses.gradeLevel,
        semester: planCourses.semester,
        status: planCourses.status,
        courseCode: courses.code,
        courseName: courses.name,
        catalogVersionId: courses.catalogVersionId,
      })
      .from(planCourses)
      .innerJoin(courses, eq(planCourses.courseId, courses.id))
      .where(
        and(
          eq(planCourses.id, planCourseId),
          eq(planCourses.planId, planId)
        )
      )
      .limit(1);

    if (!planCourse) {
      return errorResponse("NOT_FOUND", "Plan course not found.", 404);
    }

    // Cannot remove completed courses (unless student via account)
    if (planCourse.status === "completed") {
      if (plan.accountId) {
        const accountCtx = await getAccountContext(user.id, plan.accountId);
        if (!accountCtx || accountCtx.role !== "student") {
          return errorResponse(
            "CONFLICT",
            "Only the student can remove a completed course.",
            409
          );
        }
      } else {
        return errorResponse(
          "CONFLICT",
          "Cannot remove a completed course.",
          409
        );
      }
    }

    // Get transitive downstream courses (blast radius) before deletion
    const downstream = await getTransitiveDownstream(
      planCourse.courseId,
      planCourse.catalogVersionId
    );

    // Delete the plan course
    await db
      .delete(planCourses)
      .where(eq(planCourses.id, planCourseId));

    // Log in plan_history
    await db.insert(planHistory).values({
      planId,
      changedBy: user.id,
      action: "remove_course",
      beforeState: {
        planCourseId: planCourse.id,
        courseId: planCourse.courseId,
        courseCode: planCourse.courseCode,
        courseName: planCourse.courseName,
        gradeLevel: planCourse.gradeLevel,
        semester: planCourse.semester,
      },
    });

    // Run integrity validation after removal to find downstream violations
    const validation = await validatePlanIntegrity(planId);

    // Filter to only violations related to downstream courses
    const downstreamCourseIds = new Set(downstream.map((d) => d.courseId));
    const downstreamViolations = validation.violations.filter(
      (v) => downstreamCourseIds.has(v.courseId)
    );

    return successResponse({
      deleted: true,
      removedCourse: {
        courseId: planCourse.courseId,
        courseCode: planCourse.courseCode,
        courseName: planCourse.courseName,
      },
      downstreamWarnings:
        downstreamViolations.length > 0 ? downstreamViolations : undefined,
    });
  } catch (error) {
    console.error("[plans/:id/courses/:courseId] DELETE error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
