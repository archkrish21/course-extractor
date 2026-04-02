/**
 * Subscription tier definitions — 3 tiers (Starter/Plus/Elite).
 * Mirrors the seed data in the subscription_plans DB table.
 * Used at the API layer for feature gating without a DB round-trip.
 */

export interface SubscriptionFeatures {
  can_create_goals: boolean;
  can_use_ai: boolean;
  can_view_percentile: boolean;
  can_what_if: boolean;
  can_compare_plans: boolean;
  can_export_pdf: boolean;
  can_share_plans: boolean;
  can_parent_draft: boolean;
  can_rigor_scoring: boolean;
  max_alerts: number | null; // null = unlimited
}

export interface SubscriptionPlanDef {
  name: string;
  displayName: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  priceFourYear: number | null;
  maxPlans: number | null; // null = unlimited
  features: SubscriptionFeatures;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDef[] = [
  {
    name: "starter",
    displayName: "Starter",
    priceMonthly: null, // free
    priceAnnual: null,
    priceFourYear: null,
    maxPlans: 1,
    features: {
      can_create_goals: false,
      can_use_ai: false,
      can_view_percentile: false,
      can_what_if: false,
      can_compare_plans: false,
      can_export_pdf: false,
      can_share_plans: false,
      can_parent_draft: false,
      can_rigor_scoring: false,
      max_alerts: 5,
    },
  },
  {
    name: "plus",
    displayName: "Plus",
    priceMonthly: 9.99,
    priceAnnual: 107.88,
    priceFourYear: 399,
    maxPlans: 10,
    features: {
      can_create_goals: true,
      can_use_ai: false,
      can_view_percentile: false,
      can_what_if: true,
      can_compare_plans: true,
      can_export_pdf: true,
      can_share_plans: true,
      can_parent_draft: true,
      can_rigor_scoring: false,
      max_alerts: null,
    },
  },
  {
    name: "elite",
    displayName: "Elite",
    priceMonthly: 19.99,
    priceAnnual: 215.88,
    priceFourYear: 799,
    maxPlans: null, // unlimited
    features: {
      can_create_goals: true,
      can_use_ai: true,
      can_view_percentile: true,
      can_what_if: true,
      can_compare_plans: true,
      can_export_pdf: true,
      can_share_plans: true,
      can_parent_draft: true,
      can_rigor_scoring: true,
      max_alerts: null,
    },
  },
];

/**
 * Trial configuration — 14-day restricted trial.
 * Gives Plus-level features except compare/export/share.
 * No AI, max 2 plans. Prevents build-export-leave pattern.
 */
export const TRIAL_CONFIG = {
  durationDays: 14,
  maxPlans: 2,
  canUseAI: false,
  features: {
    can_create_goals: true,
    can_use_ai: false,
    can_view_percentile: false,
    can_what_if: true,
    can_compare_plans: false,  // restricted in trial
    can_export_pdf: false,     // restricted in trial
    can_share_plans: false,    // restricted in trial
    can_parent_draft: true,
    can_rigor_scoring: false,
    max_alerts: null,
  } satisfies SubscriptionFeatures,
} as const;

/** Helper to find a plan definition by name */
export function getPlanByName(name: string): SubscriptionPlanDef | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.name === name);
}
