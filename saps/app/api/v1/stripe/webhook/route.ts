import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, subscriptionPlans, stripeEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe/client";
import { invalidateSubscriptionCache } from "@/lib/subscription/middleware";
import type Stripe from "stripe";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/v1/stripe/webhook
 * Handles Stripe webhook events.
 * No auth — Stripe calls this endpoint directly.
 * Idempotent: checks stripe_events table before processing.
 */
export async function POST(request: NextRequest) {
  if (!stripe || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check
  const [existing] = await db
    .select({ id: stripeEvents.id, processed: stripeEvents.processed })
    .from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, event.id))
    .limit(1);

  if (existing?.processed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Log the event
  if (!existing) {
    await db.insert(stripeEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      apiVersion: event.api_version ?? null,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[stripe/webhook] Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await db
      .update(stripeEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(stripeEvents.stripeEventId, event.id));

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[stripe/webhook] Error processing ${event.type}:`, error);
    await db
      .update(stripeEvents)
      .set({ errorMessage: error instanceof Error ? error.message : "Unknown error" })
      .where(eq(stripeEvents.stripeEventId, event.id));
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const accountId = session.metadata?.accountId;
  if (!accountId) {
    console.warn("[stripe/webhook] checkout.session.completed missing accountId metadata");
    return;
  }

  const planName = session.metadata?.planName;
  const billingCycle = session.metadata?.billingCycle;

  // Look up the subscription plan
  const [plan] = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, planName ?? "plus"))
    .limit(1);

  if (!plan) return;

  const now = new Date();
  let periodEnd: Date;

  if (billingCycle === "four_year") {
    // One-time payment: set period end to 4 years from now
    periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 4);
  } else if (session.subscription) {
    // Subscription mode: fetch the subscription to get period dates
    const stripeSub = await stripe!.subscriptions.retrieve(session.subscription as string) as unknown as Record<string, unknown>;
    const rawEnd = stripeSub.current_period_end;
    if (typeof rawEnd === "number") {
      periodEnd = new Date(rawEnd * 1000);
    } else {
      // Fallback: estimate based on billing cycle
      periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === "annual" ? 12 : 1));
    }
  } else {
    periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === "annual" ? 12 : 1));
  }

  // Update the subscription record
  await db
    .update(subscriptions)
    .set({
      subscriptionPlanId: plan.id,
      status: "active",
      billingCycle: billingCycle as "monthly" | "annual" | "four_year",
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: (session.subscription as string) ?? null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    })
    .where(eq(subscriptions.accountId, accountId));

  await invalidateSubscriptionCache({ accountId });
  console.log(`[stripe/webhook] Activated ${planName}/${billingCycle} for account ${accountId}`);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const subAny = sub as unknown as Record<string, unknown>;
  const metadata = (subAny.metadata ?? {}) as Record<string, string>;
  const accountId = metadata.accountId;
  if (!accountId) return;

  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    incomplete: "past_due",
    incomplete_expired: "canceled",
    trialing: "trialing",
    paused: "paused",
  };

  const mappedStatus = statusMap[sub.status] ?? "active";

  await db
    .update(subscriptions)
    .set({
      status: mappedStatus as "trialing" | "active" | "past_due" | "canceled" | "paused",
      stripeSubscriptionId: sub.id,
      currentPeriodStart: new Date((subAny.current_period_start as number) * 1000),
      currentPeriodEnd: new Date((subAny.current_period_end as number) * 1000),
      cancelAtPeriodEnd: !!(subAny.cancel_at_period_end),
      canceledAt: subAny.canceled_at ? new Date((subAny.canceled_at as number) * 1000) : null,
    })
    .where(eq(subscriptions.accountId, accountId));

  await invalidateSubscriptionCache({ accountId });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const metadata = ((sub as unknown as Record<string, unknown>).metadata ?? {}) as Record<string, string>;
  const accountId = metadata.accountId;
  if (!accountId) return;

  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      cancelAtPeriodEnd: false,
    })
    .where(eq(subscriptions.accountId, accountId));

  await invalidateSubscriptionCache({ accountId });
  console.log(`[stripe/webhook] Subscription canceled for account ${accountId}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as unknown as Record<string, unknown>;
  if (!invoiceAny.subscription) return;

  const sub = await stripe!.subscriptions.retrieve(invoiceAny.subscription as string) as unknown as { metadata: Record<string, string>; current_period_start: number; current_period_end: number };
  const accountId = sub.metadata?.accountId;
  if (!accountId) return;

  await db
    .update(subscriptions)
    .set({
      status: "active",
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    })
    .where(eq(subscriptions.accountId, accountId));

  await invalidateSubscriptionCache({ accountId });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as unknown as Record<string, unknown>;
  if (!invoiceAny.subscription) return;

  const sub = await stripe!.subscriptions.retrieve(invoiceAny.subscription as string) as unknown as { metadata: Record<string, string>; current_period_start: number; current_period_end: number };
  const accountId = sub.metadata?.accountId;
  if (!accountId) return;

  await db
    .update(subscriptions)
    .set({ status: "past_due" })
    .where(eq(subscriptions.accountId, accountId));

  await invalidateSubscriptionCache({ accountId });
  console.log(`[stripe/webhook] Payment failed for account ${accountId}`);
}
