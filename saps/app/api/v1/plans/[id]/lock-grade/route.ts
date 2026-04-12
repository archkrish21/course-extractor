import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fourYearPlans, accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth } from "@/lib/auth/get-user";
import { getPlanAccess, hasPermission } from "@/lib/auth/plan-permissions";
import { maybeCreateSemesterSnapshot } from "@/lib/gpa/snapshot";

const lockGradeSchema = z.object({
  grade_level: z.number().int().min(9).max(12),
  locked: z.boolean(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/plans/:id/lock-grade
 * Toggle the lock state of a grade level.
 * Body: { grade_level: number, locked: boolean }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: planId } = await context.params;

    const body = await request.json();
    const parsed = lockGradeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { grade_level, locked } = parsed.data;

    // Fetch the plan
    const [plan] = await db
      .select({
        id: fourYearPlans.id,
        accountId: fourYearPlans.accountId,
        studentId: fourYearPlans.studentId,
        lockedGradeLevels: fourYearPlans.lockedGradeLevels,
      })
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

    const existing = (plan.lockedGradeLevels as number[]) ?? [];

    let updated: number[];
    if (locked) {
      updated = existing.includes(grade_level) ? existing : [...existing, grade_level].sort();
    } else {
      // Unlocking a grade also unlocks all grades above it
      updated = existing.filter((g) => g < grade_level);
    }

    await db
      .update(fourYearPlans)
      .set({ lockedGradeLevels: updated })
      .where(eq(fourYearPlans.id, planId));

    // Keep account grade level in sync with first unlocked grade
    if (plan.accountId) {
      const newCurrentGrade = [9, 10, 11, 12].find((g) => !updated.includes(g)) ?? 12;
      await db
        .update(accounts)
        .set({ gradeLevel: newCurrentGrade })
        .where(eq(accounts.id, plan.accountId));
    }

    // Auto-snapshot when locking a grade level
    if (locked && plan.studentId && plan.accountId) {
      await maybeCreateSemesterSnapshot({
        studentId: plan.studentId,
        accountId: plan.accountId,
        planId,
      });
    }

    return successResponse({
      locked_grade_levels: updated,
    });
  } catch (error) {
    console.error("[plans/:id/lock-grade] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
