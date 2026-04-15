import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { subscriptions, subscriptionPlans, accountMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireStripe } from "@/lib/stripe/client";
import { getStripePriceId, isOneTimePayment } from "@/lib/stripe/prices";

const checkoutSchema = z.object({
  planName: z.enum(["plus", "elite"]),
  billingCycle: z.enum(["monthly", "annual", "four_year"]),
});

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
 * POST /api/v1/stripe/checkout
 * Creates a Stripe Checkout Session for upgrading a subscription.
 * Returns { url } for the client to redirect to.
 */
export async function POST(request: NextRequest) {
  try {
    const stripe = requireStripe();

    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const rl = await rateLimit(`stripe:checkout:${user.id}`, 5, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid plan or billing cycle.", 400);
    }

    const { planName, billingCycle } = parsed.data;

    const accountId = await resolveAccountId(request, user.id);
    if (!accountId) {
      return errorResponse("NOT_FOUND", "No account found.", 404);
    }

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    // Get Stripe Price ID
    const priceId = getStripePriceId(planName, billingCycle);
    if (!priceId) {
      return errorResponse("NOT_FOUND", `Price not configured for ${planName}/${billingCycle}.`, 404);
    }

    // Look up the subscription plan in DB
    const [plan] = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, planName))
      .limit(1);

    if (!plan) {
      return errorResponse("NOT_FOUND", `Plan "${planName}" not found.`, 404);
    }

    // Get or create Stripe customer
    const [sub] = await db
      .select({
        id: subscriptions.id,
        stripeCustomerId: subscriptions.stripeCustomerId,
      })
      .from(subscriptions)
      .where(eq(subscriptions.accountId, accountId))
      .limit(1);

    let stripeCustomerId = sub?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          accountId,
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Store customer ID
      if (sub) {
        await db
          .update(subscriptions)
          .set({ stripeCustomerId })
          .where(eq(subscriptions.id, sub.id));
      }
    }

    // Determine checkout mode
    const isOneTime = isOneTimePayment(billingCycle);
    const mode = isOneTime ? "payment" as const : "subscription" as const;

    const origin = request.nextUrl.origin;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/billing?upgraded=true`,
      cancel_url: `${origin}/settings/billing`,
      metadata: {
        accountId,
        userId: user.id,
        planName,
        billingCycle,
      },
      ...(mode === "subscription"
        ? { subscription_data: { metadata: { accountId, planName, billingCycle } } }
        : { payment_intent_data: { metadata: { accountId, planName, billingCycle } } }),
    });

    return successResponse({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Stripe is not configured")) {
      return errorResponse("SERVICE_UNAVAILABLE", "Payment system not configured.", 503);
    }
    console.error("[stripe/checkout] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
