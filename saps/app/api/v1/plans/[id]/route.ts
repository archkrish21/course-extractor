import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  fourYearPlans,
  planCourses,
  courses,
  planHistory,
  studentParentLinks,
  counselorStudentLinks,
} from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { getPlanAccess, hasPermission } from "@/lib/auth/plan-permissions";
import { validatePlanIntegrity } from "@/lib/prereq/validator";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Legacy access check for pre-migration plans without accountId.
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
 * GET /api/v1/plans/:id
 * Get plan detail with all courses, organized by grade_level and semester.
 * Includes validation status for each course.
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
      // Backward compatibility: studentId-based access
      if (!plan.studentId || !(await canReadPlanLegacy(plan.studentId, user.id))) {
        return errorResponse("FORBIDDEN", "You do not have access to this plan.", 403);
      }
    }

    // Fetch all plan courses with course details
    const planCoursesData = await db
      .select({
        id: planCourses.id,
        courseId: planCourses.courseId,
        gradeLevel: planCourses.gradeLevel,
        semester: planCourses.semester,
        status: planCourses.status,
        plannedGrade: planCourses.plannedGrade,
        displayOrder: planCourses.displayOrder,
        notes: planCourses.notes,
        course: {
          id: courses.id,
          code: courses.code,
          name: courses.name,
          creditValue: courses.creditValue,
          duration: courses.duration,
          creditType: courses.creditType,
          isAp: courses.isAp,
          isDualCredit: courses.isDualCredit,
          isHonors: courses.isHonors,
          gpaWaiver: courses.gpaWaiver,
          gradeLevels: courses.gradeLevels,
          semestersOffered: courses.semestersOffered,
        },
      })
      .from(planCourses)
      .innerJoin(courses, eq(planCourses.courseId, courses.id))
      .where(eq(planCourses.planId, planId))
      .orderBy(planCourses.gradeLevel, planCourses.semester, planCourses.displayOrder);

    // Run plan validation
    const validation = await validatePlanIntegrity(planId);

    // Build violation lookup: courseId -> violations
    const violationsByCourse = new Map<string, typeof validation.violations>();
    for (const v of validation.violations) {
      const existing = violationsByCourse.get(v.courseId) ?? [];
      existing.push(v);
      violationsByCourse.set(v.courseId, existing);
    }

    // Organize by grade_level and semester
    const coursesByGradeAndSemester: Record<
      number,
      Record<string, Array<(typeof planCoursesData)[0] & { violations: typeof validation.violations }>>
    > = {};

    for (const pc of planCoursesData) {
      const grade = pc.gradeLevel;
      const sem = pc.semester !== null ? String(pc.semester) : "full_year";

      if (!coursesByGradeAndSemester[grade]) {
        coursesByGradeAndSemester[grade] = {};
      }
      if (!coursesByGradeAndSemester[grade][sem]) {
        coursesByGradeAndSemester[grade][sem] = [];
      }

      coursesByGradeAndSemester[grade][sem].push({
        ...pc,
        violations: violationsByCourse.get(pc.courseId) ?? [],
      });
    }

    return successResponse({
      plan: {
        id: plan.id,
        name: plan.name,
        schoolYear: plan.schoolYear,
        catalogVersionId: plan.catalogVersionId,
        status: plan.status,
        isPrimary: plan.isPrimary,
        activatedAt: plan.activatedAt,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
      courses: coursesByGradeAndSemester,
      validation: {
        valid: validation.valid,
        violationCount: validation.violations.length,
      },
    });
  } catch (error) {
    console.error("[plans/:id] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * PATCH /api/v1/plans/:id
 * Update plan (rename, change status).
 * Account members with canEdit can rename. Only student can archive.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: planId } = await context.params;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, status } = parsed.data;
    if (!name && !status) {
      return errorResponse(
        "VALIDATION_ERROR",
        "At least one of 'name' or 'status' must be provided.",
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
      // Only the student can archive
      if (status === "archived" && accountCtx.role !== "student") {
        return errorResponse("FORBIDDEN", "Only the student can archive a plan.", 403);
      }
    } else {
      // Backward compatibility: only the owning student can update
      if (plan.studentId !== user.id) {
        return errorResponse("FORBIDDEN", "You do not have access to modify this plan.", 403);
      }
    }

    // Build update values
    const updateValues: Record<string, unknown> = {};
    if (name) updateValues.name = name;
    if (status) updateValues.status = status;

    // Update the plan
    const [updated] = await db
      .update(fourYearPlans)
      .set(updateValues)
      .where(eq(fourYearPlans.id, planId))
      .returning();

    // Log history
    if (name && name !== plan.name) {
      await db.insert(planHistory).values({
        planId,
        changedBy: user.id,
        action: "rename_plan",
        beforeState: { name: plan.name },
        afterState: { name },
      });
    }
    if (status && status !== plan.status) {
      await db.insert(planHistory).values({
        planId,
        changedBy: user.id,
        action: "change_status",
        beforeState: { status: plan.status },
        afterState: { status },
      });
    }

    return successResponse(updated);
  } catch (error) {
    console.error("[plans/:id] PATCH error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * DELETE /api/v1/plans/:id
 * Delete a plan. Only the plan creator or the student can delete.
 * Cannot delete if it's the only plan. Cannot delete completed courses.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

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

    // Per-plan permissions check
    const access = await getPlanAccess(user.id, planId, plan.accountId);
    if (!access || !hasPermission(access.permission, "delete")) {
      return errorResponse("FORBIDDEN", "You do not have permission to delete this plan.", 403);
    }

    // Cannot delete if it's the only plan
    const planCountCondition = plan.accountId
      ? and(
          eq(fourYearPlans.accountId, plan.accountId),
          eq(fourYearPlans.isTemplate, false)
        )
      : and(
          eq(fourYearPlans.studentId, user.id),
          eq(fourYearPlans.isTemplate, false)
        );

    const [planCountRow] = await db
      .select({ count: count() })
      .from(fourYearPlans)
      .where(planCountCondition);

    if ((planCountRow?.count ?? 0) <= 1) {
      return errorResponse(
        "CONFLICT",
        "Cannot delete your only plan. Create another plan first.",
        409
      );
    }

    // Check for completed courses
    const [completedRow] = await db
      .select({ count: count() })
      .from(planCourses)
      .where(
        and(
          eq(planCourses.planId, planId),
          eq(planCourses.status, "completed")
        )
      );

    if ((completedRow?.count ?? 0) > 0) {
      return errorResponse(
        "CONFLICT",
        "Cannot delete a plan with completed courses. Archive it instead.",
        409
      );
    }

    // Delete the plan (cascades to plan_courses, plan_history, etc.)
    await db.delete(fourYearPlans).where(eq(fourYearPlans.id, planId));

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("[plans/:id] DELETE error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
