import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fourYearPlans, planHistory } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/plans/:id/set-primary
 * Set this plan as the primary plan for the student.
 * Only the student role can set primary plan.
 * Wraps in a transaction: unset current primary, set new primary, update activated_at.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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
      if (accountCtx.role !== "student") {
        return errorResponse("FORBIDDEN", "Only students can set primary plan.", 403);
      }
    } else {
      // Backward compatibility
      if (plan.studentId !== user.id) {
        return errorResponse(
          "FORBIDDEN",
          "You do not have access to this plan.",
          403
        );
      }
    }

    if (plan.isPrimary) {
      return successResponse({ message: "Plan is already primary.", plan });
    }

    if (plan.isTemplate) {
      return errorResponse(
        "CONFLICT",
        "Templates cannot be set as primary.",
        409
      );
    }

    if (plan.status === "archived") {
      return errorResponse(
        "CONFLICT",
        "Archived plans cannot be set as primary. Unarchive it first.",
        409
      );
    }

    // Transaction: demote old primary to draft, promote new plan to primary + active
    const result = await db.transaction(async (tx) => {
      // Unset current primary and demote to draft
      const unsetCondition = plan.accountId
        ? and(
            eq(fourYearPlans.accountId, plan.accountId),
            eq(fourYearPlans.isPrimary, true),
            eq(fourYearPlans.isTemplate, false)
          )
        : and(
            eq(fourYearPlans.studentId, user.id),
            eq(fourYearPlans.isPrimary, true),
            eq(fourYearPlans.isTemplate, false)
          );

      await tx
        .update(fourYearPlans)
        .set({ isPrimary: false, status: "draft" })
        .where(unsetCondition);

      // Set new primary + active
      const [updated] = await tx
        .update(fourYearPlans)
        .set({
          isPrimary: true,
          status: "active",
          activatedAt: new Date(),
        })
        .where(eq(fourYearPlans.id, planId))
        .returning();

      // Log in plan_history
      await tx.insert(planHistory).values({
        planId,
        changedBy: user.id,
        action: "set_primary",
        beforeState: { isPrimary: false, status: plan.status },
        afterState: { isPrimary: true, status: "active" },
      });

      return updated;
    });

    return successResponse(result);
  } catch (error) {
    console.error("[plans/:id/set-primary] PATCH error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
