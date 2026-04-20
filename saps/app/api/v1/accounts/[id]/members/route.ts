import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { accountMembers, accountInviteCodes, accounts, users, planShares } from "@/lib/db/schema";
import { eq, and, count, inArray } from "drizzle-orm";
import { getEffectiveTier, invalidateSubscriptionCache } from "@/lib/subscription/middleware";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { audit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/client";
import { newUserInviteEmail, existingUserInviteEmail } from "@/lib/email/templates";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const inviteSchema = z.object({
  target_role: z.enum(["student", "parent", "guardian", "counselor"]),
  email: z.string().email().optional(),
  shared_plans: z.array(z.object({
    plan_id: z.string().uuid(),
    permission: z.enum(["view", "edit"]),
  })).optional(),
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
        invitedBy: accountMembers.invitedBy,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(accountMembers)
      .innerJoin(users, eq(accountMembers.userId, users.id))
      .where(eq(accountMembers.accountId, accountId));

    // Students can remove anyone; others can only remove members they invited
    const callerRole = accountCtx.role;

    return successResponse(
      members.map((m) => ({
        user_id: m.userId,
        email: m.email,
        first_name: m.firstName,
        last_name: m.lastName,
        role: m.role,
        can_edit: m.canEdit,
        joined_at: m.joinedAt,
        can_remove:
          m.userId !== user.id &&
          (callerRole === "student" || m.invitedBy === user.id),
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

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    // Rate limit: 20 invites per hour per user. Prevents an invite-spam
    // abuse pattern where a compromised account blasts out invites.
    const rl = await rateLimit(`invite:${user.id}`, 20, 3600);
    if (!rl.success) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many invite attempts. Try again later.",
        429,
        { retry_after: rl.resetAt - Math.floor(Date.now() / 1000) }
      );
    }

    const { id: accountId } = await context.params;

    // Verify account membership + canEdit
    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }
    if (!accountCtx.canEdit) {
      return errorResponse("FORBIDDEN", "Read-only access.", 403);
    }

    // Block students from inviting until they've completed onboarding —
    // ensures they can't share half-set-up plans or drag in parents/counselors
    // before their own profile (grade, grad year, starting plan) is in place.
    const [inviter] = await db
      .select({ role: users.role, onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (inviter?.role === "student" && !inviter.onboardingCompletedAt) {
      return errorResponse(
        "ONBOARDING_REQUIRED",
        "Complete onboarding before inviting others to your account.",
        403
      );
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { target_role, shared_plans } = parsed.data;

    // If an email was provided, block inviting someone already linked to this
    // account — including the inviter themselves. Invite codes don't store the
    // target email, so we can only catch already-joined members; pending invite
    // codes for the same email still pass through.
    if (parsed.data.email) {
      const normalizedEmail = parsed.data.email.trim().toLowerCase();

      // Self-invite: friendlier dedicated message
      if (normalizedEmail === user.email.toLowerCase()) {
        return errorResponse(
          "ALREADY_LINKED",
          "You can't invite yourself to this account — you're already a member.",
          409,
          { self: true, email: user.email }
        );
      }

      const [existing] = await db
        .select({
          userId: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: accountMembers.role,
        })
        .from(users)
        .innerJoin(accountMembers, eq(accountMembers.userId, users.id))
        .where(
          and(
            eq(users.email, normalizedEmail),
            eq(accountMembers.accountId, accountId)
          )
        )
        .limit(1);

      if (existing) {
        const displayName =
          [existing.firstName, existing.lastName].filter(Boolean).join(" ").trim() ||
          existing.email;
        return errorResponse(
          "ALREADY_LINKED",
          `${displayName} is already linked to this account as ${existing.role === "student" ? "the student" : `a ${existing.role}`}.`,
          409,
          { role: existing.role, email: existing.email }
        );
      }
    }

    // Ownership check: users can only grant shares on plans they own.
    // Without this, a malicious client could POST any plan_id and (via the
    // join flow) create plan_shares for plans they don't own.
    if (shared_plans && shared_plans.length > 0) {
      const planIds = shared_plans.map((sp) => sp.plan_id);
      const ownedRows = await db
        .select({ planId: planShares.planId })
        .from(planShares)
        .where(
          and(
            inArray(planShares.planId, planIds),
            eq(planShares.userId, user.id),
            eq(planShares.permission, "owner")
          )
        );
      const ownedSet = new Set(ownedRows.map((r) => r.planId));
      const notOwned = planIds.filter((id) => !ownedSet.has(id));
      if (notOwned.length > 0) {
        return errorResponse(
          "FORBIDDEN",
          "You can only share plans you own.",
          403,
          { not_owned: notOwned }
        );
      }
    }

    // Check linked accounts limit based on subscription tier
    // Invalidate cache first to ensure fresh tier data
    await invalidateSubscriptionCache({ accountId, userId: user.id });
    const tier = await getEffectiveTier({ accountId, userId: user.id });
    const [memberCount] = await db
      .select({ count: count() })
      .from(accountMembers)
      .where(eq(accountMembers.accountId, accountId));

    const currentCount = memberCount?.count ?? 0;
    const maxLinked = tier.maxLinkedAccounts ?? 3;
    if (currentCount >= maxLinked) {
      return errorResponse(
        "UPGRADE_REQUIRED",
        `Linked accounts limit reached (${maxLinked}). Upgrade your subscription to link more accounts.`,
        402,
        { current_count: currentCount, max: maxLinked, minimum_tier: currentCount >= 5 ? "elite" : "plus" }
      );
    }

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
        sharedPlans: shared_plans?.map((sp) => ({ planId: sp.plan_id, permission: sp.permission })) ?? null,
        expiresAt,
        createdBy: user.id,
      })
      .returning();

    await audit({
      userId: user.id,
      action: "member.invited",
      resourceType: "account",
      resourceId: accountId,
      metadata: { targetEmail: parsed.data.email, targetRole: target_role },
      request,
    });

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

      // Check if the invited email already has a SAPS account
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, parsed.data.email))
        .limit(1);

      const origin = request.nextUrl.origin;
      const inviterName = inviter?.email ?? "A student";
      const studentName = account?.studentName ?? "a student";

      const template = existingUser
        ? existingUserInviteEmail({
            inviterName,
            studentName,
            role: target_role,
            joinUrl: `${origin}/join?code=${inviteCode}&account=${accountId}`,
          })
        : newUserInviteEmail({
            inviterName,
            studentName,
            role: target_role,
            claimUrl: `${origin}/signup?invite=${inviteCode}&account=${accountId}&role=${target_role}`,
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
