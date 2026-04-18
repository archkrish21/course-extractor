import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  users,
  studentProfiles,
  subscriptions,
  subscriptionPlans,
  accounts,
  accountMembers,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";

const profileSetupSchema = z.object({
  role: z.enum(["student", "parent", "guardian", "counselor"]),
  name: z.string().min(1).max(200),
  age_confirmed: z.literal(true, {
    message: "You must confirm that you are at least 13 years old.",
  }),
});

/**
 * POST /api/v1/auth/profile-setup
 * Completes profile setup for Google OAuth users.
 * Creates role-appropriate DB records (accounts, profiles, subscriptions for students).
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rl = await rateLimit(`profile-setup:${ip}`, 5, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", 429);
    }

    const user = await requireAuth();
    if (user instanceof Response) return user;

    // Verify user exists and hasn't already completed profile setup
    const [userRow] = await db
      .select({
        id: users.id,
        email: users.email,
        profileSetupCompletedAt: users.profileSetupCompletedAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userRow) {
      return errorResponse("NOT_FOUND", "User not found.", 404);
    }

    if (userRow.profileSetupCompletedAt) {
      return errorResponse(
        "ALREADY_COMPLETED",
        "Profile setup has already been completed.",
        409
      );
    }

    const body = await request.json();
    const parsed = profileSetupSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message ?? "Invalid input.",
        400
      );
    }

    const { role: rawRole, name } = parsed.data;
    // Map "guardian" to "parent" (identical behavior)
    const role = rawRole === "guardian" ? "parent" : rawRole;
    const now = new Date();

    if (role === "student") {
      // ── Student: create account, membership, profile, subscription ──
      const currentYear = new Date().getFullYear();
      const defaultGradYear = currentYear + 4;

      const [newAccount] = await db
        .insert(accounts)
        .values({
          studentName: name,
          gradeLevel: 9,
          graduationYear: defaultGradYear,
          state: "IL",
          schoolName: "Adlai E. Stevenson High School",
          studentUserId: user.id,
          createdBy: user.id,
          claimedAt: now,
        })
        .returning({ id: accounts.id });

      await db.insert(accountMembers).values({
        accountId: newAccount.id,
        userId: user.id,
        role: "student",
        canEdit: true,
      });

      await db.insert(studentProfiles).values({
        userId: user.id,
        graduationYear: defaultGradYear,
        currentGradeLevel: 9,
      });

      // Create subscription: 14-day plus trial
      const plusPlan = await db
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, "plus"))
        .limit(1)
        .then((rows) => rows[0]);

      if (plusPlan) {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);

        await db.insert(subscriptions).values({
          userId: user.id,
          accountId: newAccount.id,
          subscriptionPlanId: plusPlan.id,
          status: "trialing",
          trialEndsAt,
        });
      }
    }

    // Update user record with chosen role, name, and mark setup complete
    await db
      .update(users)
      .set({
        role,
        firstName: name,
        profileSetupCompletedAt: now,
      })
      .where(eq(users.id, user.id));

    console.log(
      `[profile-setup] Completed for ${userRow.email} (${user.id}), role=${role}`
    );

    return successResponse({
      role,
      next:
        role === "student"
          ? "/consent?next=/onboarding"
          : "/consent?next=/dashboard",
    });
  } catch (error) {
    console.error("[profile-setup] Unexpected error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
