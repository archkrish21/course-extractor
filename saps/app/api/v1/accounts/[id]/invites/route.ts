import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { accountInviteCodes, accountMembers, accounts } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/accounts/:id/invites
 * Return pending/recent student invite status for this account.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: accountId } = await context.params;

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    // Get the most recent student invite for this account
    const [invite] = await db
      .select({
        id: accountInviteCodes.id,
        code: accountInviteCodes.code,
        targetRole: accountInviteCodes.targetRole,
        expiresAt: accountInviteCodes.expiresAt,
        claimedBy: accountInviteCodes.claimedBy,
        claimedAt: accountInviteCodes.claimedAt,
        createdAt: accountInviteCodes.createdAt,
      })
      .from(accountInviteCodes)
      .where(
        and(
          eq(accountInviteCodes.accountId, accountId),
          eq(accountInviteCodes.targetRole, "student")
        )
      )
      .orderBy(desc(accountInviteCodes.createdAt))
      .limit(1);

    if (!invite) {
      return successResponse({ status: "none" });
    }

    if (invite.claimedBy) {
      return successResponse({
        status: "accepted",
        claimed_at: invite.claimedAt,
      });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      return successResponse({
        status: "expired",
        expired_at: invite.expiresAt,
      });
    }

    return successResponse({
      status: "pending",
      expires_at: invite.expiresAt,
      invite_code: invite.code,
    });
  } catch (error) {
    console.error("[accounts/:id/invites] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * DELETE /api/v1/accounts/:id/invites
 * Revoke the pending student invite for this account.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: accountId } = await context.params;

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }
    if (!accountCtx.canEdit) {
      return errorResponse("FORBIDDEN", "Read-only access.", 403);
    }

    // Check if a student has already joined this account
    const studentMembers = await db
      .select({ userId: accountMembers.userId })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, accountId),
          eq(accountMembers.role, "student")
        )
      )
      .limit(1);

    const studentJoined = studentMembers.length > 0;

    // Delete unclaimed student invites for this account
    const deleted = await db
      .delete(accountInviteCodes)
      .where(
        and(
          eq(accountInviteCodes.accountId, accountId),
          eq(accountInviteCodes.targetRole, "student"),
          isNull(accountInviteCodes.claimedBy)
        )
      )
      .returning({ id: accountInviteCodes.id });

    // If no student has joined, also delete the account entirely.
    // CASCADE will clean up account_members, so the parent's account
    // list updates and the UI can switch to another student.
    let accountDeleted = false;
    if (!studentJoined && deleted.length > 0) {
      await db.delete(accounts).where(eq(accounts.id, accountId));
      accountDeleted = true;
    }

    return successResponse({ revoked: deleted.length, account_deleted: accountDeleted });
  } catch (error) {
    console.error("[accounts/:id/invites] DELETE error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
