import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ALL_GRADES } from "@/config/grade-scale";
import {
  fourYearPlans,
  planCourses,
  courses,
  accounts,
  accountMembers,
  studentProfiles,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { maybeCreateSemesterSnapshot } from "@/lib/gpa/snapshot";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";
import { isYearEndBannerActive } from "@/config/school-calendar";

async function resolveAccountId(request: NextRequest, userId: string): Promise<string | null> {
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
 * GET /api/v1/year-end
 * Returns the current year-end transition state and courses that need grade confirmation.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const accountId = await resolveAccountId(request, user.id);
    if (!accountId) return errorResponse("NOT_FOUND", "No account found.", 404);

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) return errorResponse("FORBIDDEN", "Not a member of this account.", 403);

    // Only show year-end data when we're in the banner window
    if (!isYearEndBannerActive()) {
      return successResponse({
        transitionState: "pending",
        gradeLevel: null,
        isGraduating: false,
        planId: null,
        currentYearCourses: [],
        nextYearCourses: [],
        incompleteCount: 0,
      });
    }

    // Get account grade level
    const [account] = await db
      .select({ gradeLevel: accounts.gradeLevel })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    // Allow overriding grade level via query param (for locking a specific grade from planner)
    const gradeParam = request.nextUrl.searchParams.get("grade");
    const accountGradeLevel = account?.gradeLevel ?? 9;
    const gradeLevel = gradeParam ? parseInt(gradeParam, 10) : accountGradeLevel;

    // Get transition state
    const [profile] = await db
      .select({ yearEndTransitionState: studentProfiles.yearEndTransitionState })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, user.id))
      .limit(1);

    const transitionState = profile?.yearEndTransitionState ?? "pending";

    // Get primary plan
    const [plan] = await db
      .select({ id: fourYearPlans.id })
      .from(fourYearPlans)
      .where(
        and(
          eq(fourYearPlans.accountId, accountId),
          eq(fourYearPlans.isPrimary, true),
          eq(fourYearPlans.isTemplate, false)
        )
      )
      .limit(1);

    if (!plan) {
      return successResponse({
        transitionState,
        gradeLevel,
        isGraduating: gradeLevel >= 12,
        planId: null,
        currentYearCourses: [],
        nextYearCourses: [],
        incompleteCount: 0,
      });
    }

    // Get current year courses (enrolled or planned for current grade)
    const currentYearCourses = await db
      .select({
        id: planCourses.id,
        courseId: planCourses.courseId,
        code: courses.code,
        name: courses.name,
        gradeLevel: planCourses.gradeLevel,
        semester: planCourses.semester,
        status: planCourses.status,
        plannedGrade: planCourses.plannedGrade,
        creditValue: courses.creditValue,
        creditType: courses.creditType,
      })
      .from(planCourses)
      .innerJoin(courses, eq(planCourses.courseId, courses.id))
      .where(
        and(
          eq(planCourses.planId, plan.id),
          eq(planCourses.gradeLevel, gradeLevel)
        )
      )
      .orderBy(planCourses.semester, courses.code);

    // Get next year courses
    const nextGrade = Math.min(gradeLevel + 1, 12);
    const nextYearCourses = await db
      .select({
        id: planCourses.id,
        courseId: planCourses.courseId,
        code: courses.code,
        name: courses.name,
        gradeLevel: planCourses.gradeLevel,
        semester: planCourses.semester,
        status: planCourses.status,
        plannedGrade: planCourses.plannedGrade,
      })
      .from(planCourses)
      .innerJoin(courses, eq(planCourses.courseId, courses.id))
      .where(
        and(
          eq(planCourses.planId, plan.id),
          eq(planCourses.gradeLevel, nextGrade)
        )
      )
      .orderBy(planCourses.semester, courses.code);

    // Count courses without grades (incomplete). A "completed" status with no
    // grade is still incomplete — the student finished the course but hasn't
    // recorded the final grade yet.
    const incompleteCount = currentYearCourses.filter(
      (c) => c.status !== "dropped" && !c.plannedGrade
    ).length;

    return successResponse({
      transitionState,
      gradeLevel,
      isGraduating: gradeLevel >= 12,
      planId: plan.id,
      currentYearCourses,
      nextYearCourses,
      incompleteCount,
    });
  } catch (error) {
    console.error("[year-end] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * POST /api/v1/year-end
 * Complete the year-end transition.
 * Body: { grades: [{ planCourseId, grade }], action: "complete" }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const rl = await rateLimit(`year-end:${user.id}`, 5, 60);
    if (!rl.success) return errorResponse("RATE_LIMITED", "Too many requests.", 429);

    const accountId = await resolveAccountId(request, user.id);
    if (!accountId) return errorResponse("NOT_FOUND", "No account found.", 404);

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx || !accountCtx.canEdit) {
      return errorResponse("FORBIDDEN", "Not authorized.", 403);
    }

    const body = await request.json();

    const yearEndSchema = z.object({
      action: z.literal("complete"),
      grades: z
        .array(
          z.object({
            planCourseId: z.string().uuid(),
            grade: z.enum(ALL_GRADES),
          })
        )
        .optional(),
      grade: z.number().int().min(9).max(12).optional(),
    });

    const parsed = yearEndSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { grades, action, grade: gradeOverride } = parsed.data;

    // Get account (including studentUserId for snapshot)
    const [account] = await db
      .select({ gradeLevel: accounts.gradeLevel, studentUserId: accounts.studentUserId })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    const accountGradeLevel = account?.gradeLevel ?? 9;
    const gradeLevel = typeof gradeOverride === "number" ? gradeOverride : accountGradeLevel;
    const isGraduating = gradeLevel >= 12;

    // Get primary plan
    const [plan] = await db
      .select({ id: fourYearPlans.id })
      .from(fourYearPlans)
      .where(
        and(
          eq(fourYearPlans.accountId, accountId),
          eq(fourYearPlans.isPrimary, true),
          eq(fourYearPlans.isTemplate, false)
        )
      )
      .limit(1);

    if (!plan) {
      return errorResponse("NOT_FOUND", "No primary plan found.", 404);
    }

    // Apply grades and mark courses as completed
    if (Array.isArray(grades)) {
      for (const { planCourseId, grade } of grades) {
        if (planCourseId && grade) {
          await db
            .update(planCourses)
            .set({
              plannedGrade: grade,
              status: "completed",
            })
            .where(
              and(
                eq(planCourses.id, planCourseId),
                eq(planCourses.planId, plan.id)
              )
            );
        }
      }
    }

    // Mark all remaining current-year courses as completed (if they have grades)
    await db.execute(sql`
      UPDATE plan_courses
      SET status = 'completed'
      WHERE plan_id = ${plan.id}
        AND grade_level = ${gradeLevel}
        AND status IN ('planned', 'enrolled')
        AND planned_grade IS NOT NULL
    `);

    // Lock the completed grade level
    const currentLocked = await db
      .select({ lockedGradeLevels: fourYearPlans.lockedGradeLevels })
      .from(fourYearPlans)
      .where(eq(fourYearPlans.id, plan.id))
      .limit(1);
    const existing = (currentLocked[0]?.lockedGradeLevels as number[]) ?? [];
    if (!existing.includes(gradeLevel)) {
      await db
        .update(fourYearPlans)
        .set({ lockedGradeLevels: [...existing, gradeLevel] })
        .where(eq(fourYearPlans.id, plan.id));
    }

    // Only advance grade level and promote courses if completing the current grade
    const isCurrentGrade = gradeLevel === accountGradeLevel;
    if (isCurrentGrade && !isGraduating) {
      await db
        .update(accounts)
        .set({ gradeLevel: gradeLevel + 1 })
        .where(eq(accounts.id, accountId));

      // Move next year's planned courses to enrolled
      await db.execute(sql`
        UPDATE plan_courses
        SET status = 'enrolled'
        WHERE plan_id = ${plan.id}
          AND grade_level = ${gradeLevel + 1}
          AND status = 'planned'
      `);
    }

    // Update transition state only if completing current grade.
    // Use account's studentUserId — the caller may be a parent.
    // If the student advanced to a new grade, reset the flag to "pending"
    // so next year's banner/wizard eligibility works. For graduation there
    // is no next transition — leave the flag "completed" as a terminal state.
    if (isCurrentGrade) {
      const profileUserId = account?.studentUserId ?? user.id;
      await db
        .update(studentProfiles)
        .set({ yearEndTransitionState: isGraduating ? "completed" : "pending" })
        .where(eq(studentProfiles.userId, profileUserId));
    }

    // Auto-create GPA snapshot for the completed semester
    // Use the account's actual student ID, not the authenticated user (who may be a parent)
    const studentId = account?.studentUserId ?? user.id;
    await maybeCreateSemesterSnapshot({
      studentId,
      accountId,
      planId: plan.id,
    });

    return successResponse({
      success: true,
      newGradeLevel: isGraduating ? gradeLevel : gradeLevel + 1,
      isGraduating,
    });
  } catch (error) {
    console.error("[year-end] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
