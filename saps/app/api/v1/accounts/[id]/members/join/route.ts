import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { accountMembers, accountInviteCodes, accounts, studentProfiles, users, subscriptions, subscriptionPlans, planShares } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth } from "@/lib/auth/get-user";

const joinSchema = z.object({
  invite_code: z.string().min(1).max(8),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/accounts/:id/members/join
 * Join an account using an invite code.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    // Rate limit: 10 attempts per hour per IP. Invite codes are 8 chars,
    // so this is the main brute-force surface. Keyed by IP so an attacker
    // can't cycle accounts. Tightening via user.id as well would help but
    // IP alone is the standard bar for code-guessing attacks.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip") ?? "unknown";
    const rl = await rateLimit(`join:${ip}`, 10, 3600);
    if (!rl.success) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many attempts. Try again later.",
        429,
        { retry_after: rl.resetAt - Math.floor(Date.now() / 1000) }
      );
    }

    const { id: accountId } = await context.params;

    const body = await request.json();
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { invite_code } = parsed.data;

    // Look up invite code for this account, unclaimed
    const [invite] = await db
      .select()
      .from(accountInviteCodes)
      .where(
        and(
          eq(accountInviteCodes.accountId, accountId),
          eq(accountInviteCodes.code, invite_code),
          isNull(accountInviteCodes.claimedBy)
        )
      )
      .limit(1);

    if (!invite) {
      return errorResponse("NOT_FOUND", "Invalid or already used invite code.", 404);
    }

    // Verify not expired
    if (new Date() > new Date(invite.expiresAt)) {
      return errorResponse("GONE", "Invite code has expired.", 410);
    }

    // Check if user is already a member
    const [existing] = await db
      .select({ userId: accountMembers.userId })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, accountId),
          eq(accountMembers.userId, user.id)
        )
      )
      .limit(1);

    if (existing) {
      return errorResponse("CONFLICT", "You are already a member of this account.", 409);
    }

    let joinedAccountId = accountId;

    await db.transaction(async (tx) => {
      if (invite.targetRole === "student") {
        // Student joining: check if they already have an account (from signup)
        const [existingAcct] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.studentUserId, user.id))
          .limit(1);

        if (existingAcct) {
          // Student already has an account — add the parent to it
          joinedAccountId = existingAcct.id;

          // Check parent isn't already a member
          if (invite.createdBy) {
            const [parentMember] = await tx
              .select({ userId: accountMembers.userId })
              .from(accountMembers)
              .where(
                and(
                  eq(accountMembers.accountId, existingAcct.id),
                  eq(accountMembers.userId, invite.createdBy)
                )
              )
              .limit(1);

            if (!parentMember) {
              await tx.insert(accountMembers).values({
                accountId: existingAcct.id,
                userId: invite.createdBy,
                role: "parent",
                canEdit: true,
              });
            }
          }
        } else {
          // No existing account — create a new one
          const [userData] = await tx
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const studentName = userData?.email?.split("@")[0] ?? "Student";

          const [parentAcct] = await tx
            .select({ gradeLevel: accounts.gradeLevel, graduationYear: accounts.graduationYear })
            .from(accounts)
            .where(eq(accounts.id, accountId))
            .limit(1);

          const gradeLevel = parentAcct?.gradeLevel ?? 9;
          const graduationYear = parentAcct?.graduationYear ?? (new Date().getFullYear() + (12 - gradeLevel) + 1);

          const [newAccount] = await tx
            .insert(accounts)
            .values({
              studentName,
              studentUserId: user.id,
              gradeLevel,
              graduationYear,
              createdBy: invite.createdBy ?? user.id,
              billingContactId: invite.createdBy ?? user.id,
              claimedAt: new Date(),
            })
            .returning();

          joinedAccountId = newAccount.id;

          // Add student as member
          await tx.insert(accountMembers).values({
            accountId: newAccount.id,
            userId: user.id,
            role: "student",
            canEdit: true,
            invitedBy: invite.createdBy,
          });

          // Add parent as member
          if (invite.createdBy) {
            await tx.insert(accountMembers).values({
              accountId: newAccount.id,
              userId: invite.createdBy,
              role: "parent",
              canEdit: true,
            });
          }

          // Create student profile
          await tx
            .insert(studentProfiles)
            .values({
              userId: user.id,
              currentGradeLevel: gradeLevel,
              graduationYear,
            })
            .onConflictDoNothing();
        }
      } else {
        // Parent/guardian/counselor joining: add them to the existing account
        await tx.insert(accountMembers).values({
          accountId,
          userId: user.id,
          role: invite.targetRole,
          canEdit: invite.targetRole !== "counselor",
          invitedBy: invite.createdBy,
        });
      }

      // Mark invite as claimed
      await tx
        .update(accountInviteCodes)
        .set({
          claimedBy: user.id,
          claimedAt: new Date(),
        })
        .where(eq(accountInviteCodes.id, invite.id));

      // Create plan_shares for any plans shared with the invite
      const sharedPlans = (invite.sharedPlans as Array<{ planId: string; permission: string }>) ?? [];
      for (const sp of sharedPlans) {
        await tx
          .insert(planShares)
          .values({
            planId: sp.planId,
            userId: user.id,
            grantedBy: invite.createdBy,
            permission: sp.permission as "owner" | "view" | "edit" | "delete",
          })
          .onConflictDoNothing();
      }
    });

    return successResponse({ success: true, account_id: joinedAccountId });
  } catch (error) {
    console.error("[accounts/:id/members/join] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
