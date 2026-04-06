import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { accountMembers, accountInviteCodes, accounts, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { sendEmail } from "@/lib/email/client";
import { inviteEmail as inviteEmailTemplate } from "@/lib/email/templates";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const inviteSchema = z.object({
  target_role: z.enum(["student", "parent", "guardian"]),
  email: z.string().email().optional(),
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
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(accountMembers)
      .innerJoin(users, eq(accountMembers.userId, users.id))
      .where(eq(accountMembers.accountId, accountId));

    return successResponse(
      members.map((m) => ({
        user_id: m.userId,
        email: m.email,
        first_name: m.firstName,
        last_name: m.lastName,
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

    // Send email invite if email provided
    console.log("[members] Invite created:", inviteCode, "email:", parsed.data.email ?? "none");
    if (parsed.data.email) {
      const [account] = await db
        .select({ studentName: accounts.studentName })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);

      const [inviter] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      const origin = request.nextUrl.origin;
      const claimUrl = `${origin}/signup?invite=${inviteCode}&account=${accountId}&role=${target_role}`;

      const template = inviteEmailTemplate({
        inviterName: inviter?.email ?? "A student",
        studentName: account?.studentName ?? "a student",
        role: target_role,
        inviteCode,
        claimUrl,
      });

      console.log("[members] Sending invite email to:", parsed.data.email);
      const emailSent = await sendEmail({
        to: parsed.data.email,
        subject: template.subject,
        html: template.html,
      });
      console.log("[members] Email sent:", emailSent);
    }

    return successResponse(
      {
        invite_code: invite.code,
        expires_at: invite.expiresAt,
        email_sent: !!parsed.data.email,
      },
      undefined,
      201
    );
  } catch (error) {
    console.error("[accounts/:id/members] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
