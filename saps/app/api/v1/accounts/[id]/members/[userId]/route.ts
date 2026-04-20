import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { accounts, accountMembers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { audit } from "@/lib/audit/log";

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * DELETE /api/v1/accounts/:id/members/:userId
 * Remove a member from the account.
 * Cannot remove the student (the account subject).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: accountId, userId: targetUserId } = await context.params;

    // Verify the requesting user is an account member
    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    // Fetch the account to check the student
    const [account] = await db
      .select({ studentUserId: accounts.studentUserId })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      return errorResponse("NOT_FOUND", "Account not found.", 404);
    }

    // Cannot remove the student who owns the account (they should delete the account instead)
    if (account.studentUserId === targetUserId && account.studentUserId !== user.id) {
      return errorResponse(
        "CONFLICT",
        "Only the student can remove themselves from their own account.",
        409
      );
    }

    // Verify the target user is actually a member
    const [targetMember] = await db
      .select({
        userId: accountMembers.userId,
        invitedBy: accountMembers.invitedBy,
      })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, accountId),
          eq(accountMembers.userId, targetUserId)
        )
      )
      .limit(1);

    if (!targetMember) {
      return errorResponse("NOT_FOUND", "Member not found.", 404);
    }

    // Students can remove anyone; others can only remove members they invited
    if (accountCtx.role !== "student" && targetMember.invitedBy !== user.id) {
      return errorResponse(
        "FORBIDDEN",
        "You can only remove members you invited.",
        403
      );
    }

    // Delete plans this member created on this account (orphan cleanup).
    // Without this, the plans remain in four_year_plans and still count against
    // the account's plan limit, blocking remaining members from creating new plans
    // for slots freed up by the removal. Skip the student's own plans (they shouldn't
    // be removable via this endpoint anyway — guarded above).
    await db.execute(sql`
      DELETE FROM four_year_plans
      WHERE created_by = ${targetUserId}
        AND account_id = ${accountId}
        AND is_template = false
        AND student_id IS DISTINCT FROM ${targetUserId}
    `);

    // Remove the member
    await db
      .delete(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, accountId),
          eq(accountMembers.userId, targetUserId)
        )
      );

    await audit({
      userId: user.id,
      action: "member.removed",
      resourceType: "account",
      resourceId: accountId,
      metadata: { targetUserId },
      request,
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("[accounts/:id/members/:userId] DELETE error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
