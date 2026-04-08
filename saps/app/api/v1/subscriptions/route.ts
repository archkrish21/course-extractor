import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, subscriptionPlans, accountMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";

async function resolveAccountId(request: NextRequest, userId: string): Promise<string | null> {
  const headerAccountId = request.headers.get("X-Account-Id");
  if (headerAccountId) return headerAccountId;
  const [membership] = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(eq(accountMembers.userId, userId))
    .limit(1);
  return membership?.accountId ?? null;
}

/**
 * GET /api/v1/subscriptions
 * Returns the current subscription details for the authenticated user's account.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const rl = await rateLimit(`subscriptions:get:${user.id}`, 30, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    }

    const accountId = await resolveAccountId(request, user.id);
    if (!accountId) {
      return errorResponse("NOT_FOUND", "No account found.", 404);
    }

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    const [sub] = await db
      .select({
        id: subscriptions.id,
        status: subscriptions.status,
        billingCycle: subscriptions.billingCycle,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        canceledAt: subscriptions.canceledAt,
        stripeCustomerId: subscriptions.stripeCustomerId,
        planName: subscriptionPlans.name,
        planDisplayName: subscriptionPlans.displayName,
        priceMonthly: subscriptionPlans.priceMonthly,
        priceAnnual: subscriptionPlans.priceAnnual,
        priceFourYear: subscriptionPlans.priceFourYear,
        maxPlans: subscriptionPlans.maxPlans,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.subscriptionPlanId, subscriptionPlans.id))
      .where(eq(subscriptions.accountId, accountId))
      .limit(1);

    if (!sub) {
      return successResponse({
        subscription: null,
        message: "No subscription found for this account.",
      });
    }

    // Compute trial status
    const isTrialing = sub.status === "trialing";
    const trialEndsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
    const trialExpired = trialEndsAt ? new Date() >= trialEndsAt : false;
    const trialDaysRemaining = trialEndsAt && !trialExpired
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    return successResponse({
      subscription: {
        planName: sub.planName,
        planDisplayName: sub.planDisplayName,
        status: sub.status,
        billingCycle: sub.billingCycle,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        canceledAt: sub.canceledAt,
        hasStripeCustomer: !!sub.stripeCustomerId,
        priceMonthly: sub.priceMonthly,
        priceAnnual: sub.priceAnnual,
        priceFourYear: sub.priceFourYear,
        maxPlans: sub.maxPlans,
      },
      trial: isTrialing ? {
        active: !trialExpired,
        endsAt: trialEndsAt,
        daysRemaining: trialDaysRemaining,
        expired: trialExpired,
      } : null,
    });
  } catch (error) {
    console.error("[subscriptions] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
