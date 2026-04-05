import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { planShares } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/get-user";
import { getPlanAccess } from "@/lib/auth/plan-permissions";

const visibilitySchema = z.object({
  is_hidden: z.boolean(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/plans/:id/visibility
 * Toggle plan visibility for the current user.
 * Requires at least view permission.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: planId } = await context.params;

    const body = await request.json();
    const parsed = visibilitySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const access = await getPlanAccess(user.id, planId);
    if (!access) {
      return errorResponse("FORBIDDEN", "No access to this plan.", 403);
    }

    await db
      .update(planShares)
      .set({ isHidden: parsed.data.is_hidden })
      .where(
        and(eq(planShares.planId, planId), eq(planShares.userId, user.id))
      );

    return successResponse({ is_hidden: parsed.data.is_hidden });
  } catch (error) {
    console.error("[plans/:id/visibility] PATCH error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
