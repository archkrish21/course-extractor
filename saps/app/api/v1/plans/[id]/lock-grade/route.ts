import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fourYearPlans, accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";

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

    // Authorization
    if (plan.accountId) {
      const accountCtx = await getAccountContext(user.id, plan.accountId);
      if (!accountCtx) {
        return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
      }
      if (!accountCtx.canEdit) {
        return errorResponse("FORBIDDEN", "Read-only access.", 403);
      }
    } else if (plan.studentId !== user.id) {
      return errorResponse("FORBIDDEN", "You do not have access to this plan.", 403);
    }

    const existing = (plan.lockedGradeLevels as number[]) ?? [];

    let updated: number[];
    if (locked) {
      updated = existing.includes(grade_level) ? existing : [...existing, grade_level].sort();
    } else {
      updated = existing.filter((g) => g !== grade_level);
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

    return successResponse({
      locked_grade_levels: updated,
    });
  } catch (error) {
    console.error("[plans/:id/lock-grade] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
