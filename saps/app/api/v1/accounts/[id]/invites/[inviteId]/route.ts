import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { accountInviteCodes } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { successResponse, errorResponse, serverError } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { audit } from "@/lib/audit/log";

interface RouteContext {
  params: Promise<{ id: string; inviteId: string }>;
}

/**
 * DELETE /api/v1/accounts/:id/invites/:inviteId
 * Revoke a single pending (unclaimed) invite by ID. Mirrors the
 * remove-member permission rule: students can revoke any invite on
 * their account, other roles can only revoke invites they created.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: accountId, inviteId } = await context.params;

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    const [invite] = await db
      .select({
        id: accountInviteCodes.id,
        accountId: accountInviteCodes.accountId,
        createdBy: accountInviteCodes.createdBy,
        claimedBy: accountInviteCodes.claimedBy,
        targetEmail: accountInviteCodes.targetEmail,
      })
      .from(accountInviteCodes)
      .where(
        and(
          eq(accountInviteCodes.id, inviteId),
          eq(accountInviteCodes.accountId, accountId)
        )
      )
      .limit(1);

    if (!invite) {
      return errorResponse("NOT_FOUND", "Invite not found.", 404);
    }

    // Already claimed: revoke is a no-op and would mislead the caller —
    // the membership exists; remove via the member endpoint instead.
    if (invite.claimedBy) {
      return errorResponse(
        "CONFLICT",
        "Invite has already been accepted. Remove the member instead.",
        409
      );
    }

    // Students can revoke any invite on their account; others only their own.
    if (accountCtx.role !== "student" && invite.createdBy !== user.id) {
      return errorResponse(
        "FORBIDDEN",
        "You can only revoke invites you sent.",
        403
      );
    }

    await db
      .delete(accountInviteCodes)
      .where(
        and(
          eq(accountInviteCodes.id, inviteId),
          isNull(accountInviteCodes.claimedBy)
        )
      );

    await audit({
      userId: user.id,
      action: "member.invite_revoked",
      resourceType: "account",
      resourceId: accountId,
      metadata: { inviteId, targetEmail: invite.targetEmail },
      request,
    });

    return successResponse({ revoked: true });
  } catch (error) {
    return serverError(error, "accounts/:id/invites/:inviteId DELETE");
  }
}
