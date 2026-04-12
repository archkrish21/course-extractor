import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, accountMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireStripe } from "@/lib/stripe/client";

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
 * POST /api/v1/stripe/portal
 * Creates a Stripe Billing Portal session for managing the subscription.
 * Returns { url } for the client to redirect to.
 */
export async function POST(request: NextRequest) {
  try {
    const stripe = requireStripe();

    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const rl = await rateLimit(`stripe:portal:${user.id}`, 10, 60);
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

    // Get Stripe customer ID
    const [sub] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.accountId, accountId))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      return errorResponse("NOT_FOUND", "No billing account found. Upgrade first.", 404);
    }

    const origin = request.nextUrl.origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/settings/billing`,
    });

    return successResponse({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Stripe is not configured")) {
      return errorResponse("SERVICE_UNAVAILABLE", "Payment system not configured.", 503);
    }
    console.error("[stripe/portal] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
