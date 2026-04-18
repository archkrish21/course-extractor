import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth } from "@/lib/auth/get-user";

const updateNameSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().max(100).optional(),
  tour_state: z.record(z.string(), z.boolean()).optional(),
});

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's basic info (email, role).
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const [userData] = await db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role, tourState: users.tourState, onboardingCompletedAt: users.onboardingCompletedAt, profileSetupCompletedAt: users.profileSetupCompletedAt })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userData) {
      return errorResponse("NOT_FOUND", "User not found.", 404);
    }

    return successResponse({
      email: userData.email,
      first_name: userData.firstName,
      last_name: userData.lastName,
      role: userData.role,
      tour_state: userData.tourState ?? {},
      onboarding_completed: userData.role !== "student" || !!userData.onboardingCompletedAt,
      profile_setup_completed: !!userData.profileSetupCompletedAt,
    });
  } catch (error) {
    console.error("[auth/me] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * PATCH /api/v1/auth/me
 * Update the authenticated user's name.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const body = await request.json();
    const parsed = updateNameSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400);
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.first_name !== undefined) updates.firstName = parsed.data.first_name;
    if (parsed.data.last_name !== undefined) updates.lastName = parsed.data.last_name;
    // Merge incoming tour_state into existing value (avoids read-then-write race)
    if (parsed.data.tour_state !== undefined) {
      updates.tourState = sql`COALESCE(${users.tourState}, '{}'::jsonb) || ${JSON.stringify(parsed.data.tour_state)}::jsonb`;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("VALIDATION_ERROR", "At least one field required.", 400);
    }

    await db.update(users).set(updates).where(eq(users.id, user.id));

    return successResponse({ updated: true });
  } catch (error) {
    console.error("[auth/me] PATCH error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
