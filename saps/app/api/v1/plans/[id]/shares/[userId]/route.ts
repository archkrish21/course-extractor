import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { planShares } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth } from "@/lib/auth/get-user";
import { getPlanAccess, hasPermission } from "@/lib/auth/plan-permissions";

const updateShareSchema = z.object({
  permission: z.enum(["view", "edit", "delete"]),
});

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * PATCH /api/v1/plans/:id/shares/:userId
 * Update a share's permission level. Requires owner permission.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: planId, userId: targetUserId } = await context.params;

    const body = await request.json();
    const parsed = updateShareSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const access = await getPlanAccess(user.id, planId);
    if (!access || !hasPermission(access.permission, "owner")) {
      return errorResponse("FORBIDDEN", "Only the plan owner can update shares.", 403);
    }

    // Cannot change owner's permission
    const [targetShare] = await db
      .select({ permission: planShares.permission })
      .from(planShares)
      .where(
        and(eq(planShares.planId, planId), eq(planShares.userId, targetUserId))
      )
      .limit(1);

    if (!targetShare) {
      return errorResponse("NOT_FOUND", "Share not found.", 404);
    }

    if (targetShare.permission === "owner") {
      return errorResponse("CONFLICT", "Cannot change the owner's permission.", 409);
    }

    const [updated] = await db
      .update(planShares)
      .set({ permission: parsed.data.permission })
      .where(
        and(eq(planShares.planId, planId), eq(planShares.userId, targetUserId))
      )
      .returning();

    return successResponse({
      user_id: updated.userId,
      permission: updated.permission,
    });
  } catch (error) {
    console.error("[plans/:id/shares/:userId] PATCH error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * DELETE /api/v1/plans/:id/shares/:userId
 * Revoke a share. Requires owner permission. Cannot revoke the owner.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: planId, userId: targetUserId } = await context.params;

    const access = await getPlanAccess(user.id, planId);
    if (!access || !hasPermission(access.permission, "owner")) {
      return errorResponse("FORBIDDEN", "Only the plan owner can revoke shares.", 403);
    }

    // Cannot revoke the owner's share
    const [targetShare] = await db
      .select({ permission: planShares.permission })
      .from(planShares)
      .where(
        and(eq(planShares.planId, planId), eq(planShares.userId, targetUserId))
      )
      .limit(1);

    if (!targetShare) {
      return errorResponse("NOT_FOUND", "Share not found.", 404);
    }

    if (targetShare.permission === "owner") {
      return errorResponse("CONFLICT", "Cannot revoke the owner's access.", 409);
    }

    await db
      .delete(planShares)
      .where(
        and(eq(planShares.planId, planId), eq(planShares.userId, targetUserId))
      );

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("[plans/:id/shares/:userId] DELETE error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
