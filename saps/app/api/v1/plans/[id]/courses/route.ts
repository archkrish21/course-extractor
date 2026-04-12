import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  fourYearPlans,
  planCourses,
  courses,
  divisions,
  planHistory,
  studentParentLinks,
  counselorStudentLinks,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { getPlanAccess, hasPermission } from "@/lib/auth/plan-permissions";
import { validateCourseAddition } from "@/lib/prereq/validator";

import { ALL_GRADES } from "@/config/grade-scale";

const addCourseSchema = z.object({
  course_id: z.string().uuid(),
  grade_level: z.number().int().min(9).max(12),
  semester: z.number().int().min(-2).max(2).nullable(),
  planned_grade: z
    .enum(ALL_GRADES)
    .nullable()
    .optional(),
  force_add: z.boolean().optional().default(false),
  skip_validation: z.boolean().optional().default(false),
  status: z.enum(["planned", "enrolled", "completed", "dropped"]).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Legacy access check for pre-migration plans.
 */
// DEPRECATED: This function uses the old student_parent_links table for backward
// compatibility with plans created before the accounts model migration.
// Remove this function once all plans have been migrated to have account_id set.
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
 * GET /api/v1/plans/:id/courses
 * List courses in this plan, grouped by grade_level and semester.
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

    // Templates are readable by any authenticated user
    if (!plan.isTemplate) {
      // Account-based authorization
      if (plan.accountId) {
        const accountCtx = await getAccountContext(user.id, plan.accountId);
        if (!accountCtx) {
          return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
        }
      } else if (plan.studentId) {
        // Backward compatibility
        if (!(await canReadPlanLegacy(plan.studentId, user.id))) {
          return errorResponse(
            "FORBIDDEN",
            "You do not have access to this plan.",
            403
          );
        }
      } else {
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
        gpaWaiverApplied: planCourses.gpaWaiverApplied,
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
          divisionName: divisions.name,
        },
      })
      .from(planCourses)
      .innerJoin(courses, eq(planCourses.courseId, courses.id))
      .leftJoin(divisions, eq(courses.divisionId, divisions.id))
      .where(eq(planCourses.planId, planId))
      .orderBy(
        planCourses.gradeLevel,
        planCourses.semester,
        planCourses.displayOrder
      );

    // Group by grade_level and semester
    const grouped: Record<
      number,
      Record<string, Array<(typeof planCoursesData)[0]>>
    > = {};

    for (const pc of planCoursesData) {
      const grade = pc.gradeLevel;
      const sem = pc.semester !== null ? String(pc.semester) : "full_year";

      if (!grouped[grade]) grouped[grade] = {};
      if (!grouped[grade][sem]) grouped[grade][sem] = [];
      grouped[grade][sem].push(pc);
    }

    return successResponse(grouped);
  } catch (error) {
    console.error("[plans/:id/courses] GET error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}

/**
 * POST /api/v1/plans/:id/courses
 * Add a course to the plan. Runs prerequisite validation before adding.
 * Requires canEdit permission via account membership.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: planId } = await context.params;

    // Parse body
    const body = await request.json();
    const parsed = addCourseSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { course_id, grade_level, semester, planned_grade, force_add, skip_validation, status: requestedStatus } = parsed.data;

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
    if (!access || !hasPermission(access.permission, "edit")) {
      return errorResponse("FORBIDDEN", "You do not have permission to edit this plan.", 403);
    }

    // F-PL-10: Cannot add courses to a locked grade level
    const lockedGrades = (plan.lockedGradeLevels as number[]) ?? [];
    if (lockedGrades.includes(grade_level)) {
      return errorResponse(
        "CONFLICT",
        `Grade ${grade_level} is locked. Unlock it first to add courses.`,
        409
      );
    }

    // Verify the course exists
    const [course] = await db
      .select({ id: courses.id, code: courses.code, name: courses.name })
      .from(courses)
      .where(eq(courses.id, course_id))
      .limit(1);

    if (!course) {
      return errorResponse("NOT_FOUND", "Course not found.", 404);
    }

    // Run prerequisite validation (skipped for undo operations)
    let warningViolations: Array<{ type: string; message: string }> = [];
    if (!skip_validation) {
      const validation = await validateCourseAddition(
        planId,
        course_id,
        grade_level,
        semester
      );

      // Separate blocking violations (duplicates) from warnings
      const blockingViolations = validation.violations.filter(
        (v) => v.type === "duplicate"
      );
      warningViolations = validation.violations.filter(
        (v) => v.type !== "duplicate"
      );

      // Block if duplicate
      if (blockingViolations.length > 0) {
        return errorResponse(
          "CONFLICT",
          blockingViolations[0].message,
          409,
          { violations: blockingViolations }
        );
      }

      // If there are warnings and user hasn't acknowledged, return 422 with violations
      if (warningViolations.length > 0 && !force_add) {
        return NextResponse.json(
          {
            violations: warningViolations,
            message: "Course has validation warnings. Set force_add=true to add anyway.",
          },
          { status: 422 }
        );
      }
    }

    // Insert the course into the plan
    const [newPlanCourse] = await db
      .insert(planCourses)
      .values({
        planId,
        courseId: course_id,
        gradeLevel: grade_level,
        semester,
        status: requestedStatus ?? "planned",
        plannedGrade: planned_grade ?? null,
      })
      .returning();

    // Log in plan_history
    await db.insert(planHistory).values({
      planId,
      changedBy: user.id,
      action: "add_course",
      afterState: {
        planCourseId: newPlanCourse.id,
        courseId: course_id,
        courseCode: course.code,
        courseName: course.name,
        gradeLevel: grade_level,
        semester,
        plannedGrade: planned_grade,
      },
    });

    // Enqueue alert evaluation (Phase 2: BullMQ; for now, just log)
    console.log(
      `[alert-evaluation] Plan ${planId}: course ${course.code} added at grade ${grade_level}, semester ${semester}. Would enqueue alert evaluation job.`
    );

    // Return the new plan course with any warnings
    return successResponse(
      {
        planCourse: newPlanCourse,
        warnings: warningViolations.length > 0 ? warningViolations : undefined,
      },
      undefined,
      201
    );
  } catch (error) {
    console.error("[plans/:id/courses] POST error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
