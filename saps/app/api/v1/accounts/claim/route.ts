import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  accounts,
  accountMembers,
  studentProfiles,
  users,
  subscriptions,
  subscriptionPlans,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/get-user";

const claimSchema = z.object({
  claim_code: z.string().min(1).max(8),
});

/**
 * POST /api/v1/accounts/claim
 * Student claims an account using a claim code.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    // Verify user is a student
    const [userData] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userData || userData.role !== "student") {
      return errorResponse("FORBIDDEN", "Only students can claim accounts.", 403);
    }

    const body = await request.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { claim_code } = parsed.data;

    // Look up account by claim code where not yet claimed
    const [account] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.claimCode, claim_code),
          isNull(accounts.claimedAt)
        )
      )
      .limit(1);

    if (!account) {
      return errorResponse("NOT_FOUND", "Invalid or already claimed code.", 404);
    }

    // Verify not expired
    if (account.claimExpiresAt && new Date() > new Date(account.claimExpiresAt)) {
      return errorResponse("GONE", "Claim code has expired.", 410);
    }

    // Check if student already has an account
    const [existingAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.studentUserId, user.id))
      .limit(1);

    if (existingAccount) {
      return errorResponse(
        "CONFLICT",
        "You already have an account. A student can only be linked to one account.",
        409
      );
    }

    // Find the Elite subscription plan for the trial
    const [elitePlan] = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "elite"))
      .limit(1);

    const now = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const result = await db.transaction(async (tx) => {
      // Set account as claimed
      const [updatedAccount] = await tx
        .update(accounts)
        .set({
          studentUserId: user.id,
          claimedAt: now,
        })
        .where(eq(accounts.id, account.id))
        .returning();

      // Create account member for the student
      await tx.insert(accountMembers).values({
        accountId: account.id,
        userId: user.id,
        role: "student",
        canEdit: true,
      });

      // Upsert student profile with account data
      const existingProfile = await tx
        .select({ userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, user.id))
        .limit(1);

      if (existingProfile.length > 0) {
        await tx
          .update(studentProfiles)
          .set({
            graduationYear: account.graduationYear ?? undefined,
            currentGradeLevel: account.gradeLevel ?? undefined,
          })
          .where(eq(studentProfiles.userId, user.id));
      } else if (account.graduationYear && account.gradeLevel) {
        await tx.insert(studentProfiles).values({
          userId: user.id,
          graduationYear: account.graduationYear,
          currentGradeLevel: account.gradeLevel,
        });
      }

      // Create subscription (14-day Elite trial)
      if (elitePlan) {
        await tx.insert(subscriptions).values({
          userId: user.id,
          accountId: account.id,
          subscriptionPlanId: elitePlan.id,
          status: "trialing",
          trialEndsAt,
        });
      }

      return updatedAccount;
    });

    return successResponse({
      account: {
        id: result.id,
        student_name: result.studentName,
      },
      message: "Account claimed successfully",
    });
  } catch (error) {
    console.error("[accounts/claim] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
