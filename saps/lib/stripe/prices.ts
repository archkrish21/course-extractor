/**
 * Stripe Price ID mapping.
 * Maps plan name + billing cycle to Stripe Price IDs from environment variables.
 *
 * Stripe Products:
 *   - SAPS Plus: 3 prices (monthly recurring, annual recurring, 4-year one-time)
 *   - SAPS Elite: 3 prices (monthly recurring, annual recurring, 4-year one-time)
 *
 * The 4-year prices are one-time payments (not recurring subscriptions).
 * Checkout for 4-year uses mode: "payment" instead of mode: "subscription".
 */

export const STRIPE_PRICES: Record<string, Record<string, string | undefined>> = {
  plus: {
    monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY,
    annual: process.env.STRIPE_PRICE_PLUS_ANNUAL,
    four_year: process.env.STRIPE_PRICE_PLUS_FOUR_YEAR,
  },
  elite: {
    monthly: process.env.STRIPE_PRICE_ELITE_MONTHLY,
    annual: process.env.STRIPE_PRICE_ELITE_ANNUAL,
    four_year: process.env.STRIPE_PRICE_ELITE_FOUR_YEAR,
  },
};

/**
 * Get the Stripe Price ID for a given plan and billing cycle.
 * Returns null if the price is not configured.
 */
export function getStripePriceId(
  planName: string,
  billingCycle: "monthly" | "annual" | "four_year"
): string | null {
  const priceId = STRIPE_PRICES[planName]?.[billingCycle];
  return priceId || null;
}

/**
 * Whether a billing cycle uses one-time payment (vs recurring subscription).
 */
export function isOneTimePayment(billingCycle: string): boolean {
  return billingCycle === "four_year";
}
