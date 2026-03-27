import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (
    typeof window === "undefined" ||
    initialized ||
    !process.env.NEXT_PUBLIC_POSTHOG_KEY
  ) {
    return;
  }

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    respect_dnt: true,
    persistence: "localStorage+cookie",
  });

  initialized = true;
}

// -- Typed event helpers for SAPS analytics --

export function trackSignupCompleted(props: {
  role: string;
  grade_level?: number;
  template_selected?: string;
}) {
  posthog.capture("signup_completed", props);
}

export function trackOnboardingStepCompleted(props: {
  step_number: number;
  step_name: string;
  skipped: boolean;
}) {
  posthog.capture("onboarding_step_completed", props);
}

export function trackPlanCreated(props: {
  from_template: boolean;
  template_id?: string;
}) {
  posthog.capture("plan_created", props);
}

export function trackCourseAddedToPlan(props: {
  course_id: string;
  grade_level: number;
  plan_id: string;
}) {
  posthog.capture("course_added_to_plan", props);
}

export function trackGradeEntered(props: {
  semester: number;
  academic_year: string;
}) {
  posthog.capture("grade_entered", props);
}

export function trackAlertViewed(props: {
  alert_type: string;
  severity: string;
}) {
  posthog.capture("alert_viewed", props);
}

export function trackAlertDismissed(props: {
  alert_type: string;
  time_since_triggered: number;
}) {
  posthog.capture("alert_dismissed", props);
}

export function trackFeatureGateHit(props: {
  feature: string;
  current_tier: string;
  minimum_tier: string;
}) {
  posthog.capture("feature_gate_hit", props);
}

export function trackUpgradeModalOpened(props: {
  trigger_feature: string;
  current_tier: string;
}) {
  posthog.capture("upgrade_modal_opened", props);
}

export function trackCheckoutStarted(props: {
  target_tier: string;
  billing_cycle: string;
}) {
  posthog.capture("checkout_started", props);
}

export function trackSubscriptionActivated(props: {
  tier: string;
  billing_cycle: string;
  days_since_trial_start: number;
}) {
  posthog.capture("subscription_activated", props);
}

export function trackPlanExported(props: { format: "pdf" | "share_link" }) {
  posthog.capture("plan_exported", props);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  posthog.identify(userId, properties);
}

export function resetUser() {
  posthog.reset();
}
