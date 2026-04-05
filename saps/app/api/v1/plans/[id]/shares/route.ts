import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { planShares, fourYearPlans, accountMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/get-user";
import { getPlanAccess, hasPermission } from "@/lib/auth/plan-permissions";

const shareSchema = z.object({
  user_id: z.string().uuid(),
  permission: z.enum(["view", "edit", "delete"]),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/plans/:id/shares
 * List all shares for a plan. Requires owner permission.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: planId } = await context.params;

    const access = await getPlanAccess(user.id, planId);
    if (!access || !hasPermission(access.permission, "owner")) {
      return errorResponse("FORBIDDEN", "Only the plan owner can view shares.", 403);
    }

    const shares = await db
      .select({
        userId: planShares.userId,
        permission: planShares.permission,
        isHidden: planShares.isHidden,
        createdAt: planShares.createdAt,
        email: users.email,
      })
      .from(planShares)
      .innerJoin(users, eq(planShares.userId, users.id))
      .where(eq(planShares.planId, planId));

    return successResponse(
      shares.map((s) => ({
        user_id: s.userId,
        email: s.email,
        permission: s.permission,
        is_hidden: s.isHidden,
        created_at: s.createdAt,
      }))
    );
  } catch (error) {
    console.error("[plans/:id/shares] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * POST /api/v1/plans/:id/shares
 * Share a plan with another account member. Requires owner permission.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: planId } = await context.params;

    const body = await request.json();
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { user_id: targetUserId, permission } = parsed.data;

    // Can't share with yourself
    if (targetUserId === user.id) {
      return errorResponse("VALIDATION_ERROR", "Cannot share a plan with yourself.", 400);
    }

    const access = await getPlanAccess(user.id, planId);
    if (!access || !hasPermission(access.permission, "owner")) {
      return errorResponse("FORBIDDEN", "Only the plan owner can share plans.", 403);
    }

    // Verify the plan exists and get accountId
    const [plan] = await db
      .select({ accountId: fourYearPlans.accountId })
      .from(fourYearPlans)
      .where(eq(fourYearPlans.id, planId))
      .limit(1);

    if (!plan) {
      return errorResponse("NOT_FOUND", "Plan not found.", 404);
    }

    // Verify target user is a member of the same account
    if (plan.accountId) {
      const [membership] = await db
        .select({ userId: accountMembers.userId })
        .from(accountMembers)
        .where(
          and(
            eq(accountMembers.userId, targetUserId),
            eq(accountMembers.accountId, plan.accountId)
          )
        )
        .limit(1);

      if (!membership) {
        return errorResponse(
          "VALIDATION_ERROR",
          "User is not a member of this account.",
          400
        );
      }
    }

    // Check if already shared
    const [existing] = await db
      .select({ id: planShares.id })
      .from(planShares)
      .where(
        and(eq(planShares.planId, planId), eq(planShares.userId, targetUserId))
      )
      .limit(1);

    if (existing) {
      return errorResponse(
        "CONFLICT",
        "Plan is already shared with this user. Use PATCH to update permission.",
        409
      );
    }

    const [share] = await db
      .insert(planShares)
      .values({
        planId,
        userId: targetUserId,
        grantedBy: user.id,
        permission,
      })
      .returning();

    return successResponse(
      {
        user_id: share.userId,
        permission: share.permission,
        created_at: share.createdAt,
      },
      undefined,
      201
    );
  } catch (error) {
    console.error("[plans/:id/shares] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
