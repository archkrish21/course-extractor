import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { accountMembers, accountInviteCodes } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
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

    await db.transaction(async (tx) => {
      // Create account member
      await tx.insert(accountMembers).values({
        accountId,
        userId: user.id,
        role: invite.targetRole,
        canEdit: true,
        invitedBy: invite.createdBy,
      });

      // Mark invite as claimed
      await tx
        .update(accountInviteCodes)
        .set({
          claimedBy: user.id,
          claimedAt: new Date(),
        })
        .where(eq(accountInviteCodes.id, invite.id));
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("[accounts/:id/members/join] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
