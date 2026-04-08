import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

/**
 * Singleton Stripe client.
 * Returns null if STRIPE_SECRET_KEY is not configured (dev mode).
 */
function createStripeClient(): Stripe | null {
  if (!STRIPE_SECRET_KEY) {
    console.warn("[stripe] STRIPE_SECRET_KEY not configured. Stripe features disabled.");
    return null;
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    typescript: true,
  });
}

export const stripe = createStripeClient();

/**
 * Get the Stripe client or throw if not configured.
 * Use in API routes that require Stripe.
 */
export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local");
  }
  return stripe;
}
