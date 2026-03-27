import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { accountMembers, accountInviteCodes, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const inviteSchema = z.object({
  target_role: z.enum(["parent", "guardian"]),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/accounts/:id/members
 * List all members of an account.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: accountId } = await context.params;

    // Verify account membership
    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    const members = await db
      .select({
        userId: accountMembers.userId,
        role: accountMembers.role,
        canEdit: accountMembers.canEdit,
        joinedAt: accountMembers.joinedAt,
        email: users.email,
      })
      .from(accountMembers)
      .innerJoin(users, eq(accountMembers.userId, users.id))
      .where(eq(accountMembers.accountId, accountId));

    return successResponse(
      members.map((m) => ({
        user_id: m.userId,
        email: m.email,
        role: m.role,
        can_edit: m.canEdit,
        joined_at: m.joinedAt,
      }))
    );
  } catch (error) {
    console.error("[accounts/:id/members] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * POST /api/v1/accounts/:id/members
 * Generate an invite code for a new member.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: accountId } = await context.params;

    // Verify account membership + canEdit
    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }
    if (!accountCtx.canEdit) {
      return errorResponse("FORBIDDEN", "Read-only access.", 403);
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { target_role } = parsed.data;

    // Generate invite code with 7-day expiry
    const inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invite] = await db
      .insert(accountInviteCodes)
      .values({
        accountId,
        code: inviteCode,
        targetRole: target_role,
        expiresAt,
        createdBy: user.id,
      })
      .returning();

    return successResponse(
      {
        invite_code: invite.code,
        expires_at: invite.expiresAt,
      },
      undefined,
      201
    );
  } catch (error) {
    console.error("[accounts/:id/members] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
