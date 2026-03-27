/**
 * Subscription tier definitions.
 * Mirrors the seed data in the subscription_plans DB table.
 * Used at the API layer for feature gating without a DB round-trip.
 */

export interface SubscriptionPlanDef {
  name: string;
  displayName: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  maxPlans: number | null; // null = unlimited
  features: {
    can_create_goals: boolean;
    can_use_ai: boolean;
    can_view_percentile: boolean;
    can_what_if: boolean;
    can_compare_plans: boolean;
    can_export_pdf: boolean;
    can_share_plans: boolean;
    max_alerts: number | null; // null = unlimited
  };
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDef[] = [
  {
    name: "starter",
    displayName: "Starter",
    priceMonthly: null, // free
    priceAnnual: null,
    maxPlans: 1,
    features: {
      can_create_goals: false,
      can_use_ai: false,
      can_view_percentile: false,
      can_what_if: false,
      can_compare_plans: false,
      can_export_pdf: false,
      can_share_plans: true,
      max_alerts: 5,
    },
  },
  {
    name: "plus",
    displayName: "Plus",
    priceMonthly: 4.99,
    priceAnnual: 49.99,
    maxPlans: 5,
    features: {
      can_create_goals: true,
      can_use_ai: false,
      can_view_percentile: false,
      can_what_if: true,
      can_compare_plans: true,
      can_export_pdf: true,
      can_share_plans: true,
      max_alerts: null,
    },
  },
  {
    name: "pro",
    displayName: "Pro",
    priceMonthly: 9.99,
    priceAnnual: 99.99,
    maxPlans: null, // unlimited
    features: {
      can_create_goals: true,
      can_use_ai: true,
      can_view_percentile: false,
      can_what_if: true,
      can_compare_plans: true,
      can_export_pdf: true,
      can_share_plans: true,
      max_alerts: null,
    },
  },
  {
    name: "elite",
    displayName: "Elite",
    priceMonthly: 19.99,
    priceAnnual: 199.99,
    maxPlans: null, // unlimited
    features: {
      can_create_goals: true,
      can_use_ai: true,
      can_view_percentile: true,
      can_what_if: true,
      can_compare_plans: true,
      can_export_pdf: true,
      can_share_plans: true,
      max_alerts: null,
    },
  },
];
