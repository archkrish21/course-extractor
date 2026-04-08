"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";
import { FREE_LAUNCH_MODE } from "@/config/subscription-plans";
import Link from "next/link";

interface SubscriptionData {
  planName: string;
  planDisplayName: string;
  status: string;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
}

interface TrialData {
  active: boolean;
  endsAt: string;
  daysRemaining: number;
  expired: boolean;
}

const PLANS = [
  {
    name: "starter",
    display: "Starter",
    description: "Basic planning tools",
    monthly: 0,
    annual: 0,
    fourYear: 0,
    features: ["1 plan", "3 linked accounts", "Course browser", "Prerequisite validation", "GPA tracking"],
  },
  {
    name: "plus",
    display: "Plus",
    description: "Full planning suite",
    monthly: 9.99,
    annual: 107.88,
    fourYear: 399,
    features: ["10 plans", "5 linked accounts", "What-if GPA", "Plan comparison", "PDF export/print", "Share links", "Goal tracking", "Full alerts", "Parent plan drafts"],
  },
  {
    name: "elite",
    display: "Elite",
    description: "AI-powered planning",
    monthly: 19.99,
    annual: 215.88,
    fourYear: 799,
    features: ["Unlimited plans", "8 linked accounts", "Everything in Plus", "AI course suggestions", "AI plan review", "AI chat", "Percentile comparison", "Course rigor scoring"],
  },
];

type BillingInterval = "monthly" | "annual" | "four_year";

export default function BillingPage() {
  const { currentAccount, refetchAccounts } = useAccount();

  if (FREE_LAUNCH_MODE) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Billing</h1>
        <Card>
          <CardContent className="flex flex-col items-center py-12 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <svg aria-hidden="true" className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-semibold text-foreground">Free Early Access</p>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              All features are free during the early access period. No credit card required.
              We&apos;ll notify you before any changes to pricing.
            </p>
            <Link href="/settings" className="mt-6 text-sm text-primary hover:underline">
              Back to Settings
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [trial, setTrial] = useState<TrialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("annual");
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);

  useEffect(() => {
    async function fetchSub() {
      try {
        const res = await apiFetch("/api/v1/subscriptions");
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          setSubscription(data.subscription);
          setTrial(data.trial);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }

    // If redirected from Stripe checkout, wait a moment for webhook then refresh
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (params?.get("upgraded") === "true") {
      setUpgraded(true);
      // Give webhook time to process, then fetch
      setTimeout(() => {
        fetchSub();
        refetchAccounts();
      }, 3000);
    } else {
      fetchSub();
    }
  }, [currentAccount, refetchAccounts]);

  const handleUpgrade = async (planName: string) => {
    setUpgrading(planName);
    try {
      const res = await apiFetch("/api/v1/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName, billingCycle: billingInterval }),
      });
      if (res.ok) {
        const json = await res.json();
        const url = json.data?.url ?? json.url;
        if (url) window.location.href = url;
      }
    } catch { /* silent */ }
    finally { setUpgrading(null); }
  };

  const handleManageBilling = async () => {
    try {
      const res = await apiFetch("/api/v1/stripe/portal", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        const url = json.data?.url ?? json.url;
        if (url) window.location.href = url;
      }
    } catch { /* silent */ }
  };

  const getPrice = (plan: typeof PLANS[0]) => {
    if (plan.monthly === 0) return "Free";
    if (billingInterval === "monthly") return `$${plan.monthly}/mo`;
    if (billingInterval === "annual") return `$${plan.annual}/yr`;
    return `$${plan.fourYear}`;
  };

  const getSubPrice = (plan: typeof PLANS[0]) => {
    if (plan.monthly === 0) return null;
    if (billingInterval === "monthly") return null;
    if (billingInterval === "annual") return `$${(plan.annual / 12).toFixed(2)}/mo`;
    return `$${(plan.fourYear / 48).toFixed(2)}/mo`;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Billing & Subscription</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Billing & Subscription</h1>

      {upgraded && (
        <div className="mb-6 rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-2">
            <svg aria-hidden="true" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm font-semibold text-success">Upgrade successful!</p>
          </div>
          <p className="mt-1 ml-7 text-sm text-muted-foreground">
            Your subscription has been updated. It may take a moment to reflect below.
          </p>
        </div>
      )}

      {/* Current plan */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                <svg aria-hidden="true" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-foreground">
                    {subscription?.status === "trialing" ? "Free Trial" : (subscription?.planDisplayName ?? "Starter")}
                  </p>
                  {subscription?.status === "trialing" && (
                    <Badge variant="warning">{trial?.daysRemaining ?? 14} days left</Badge>
                  )}
                  {subscription?.status === "active" && (
                    <Badge variant="success">Active</Badge>
                  )}
                  {subscription?.status === "past_due" && (
                    <Badge variant="destructive">Past Due</Badge>
                  )}
                  {subscription?.status === "canceled" && (
                    <Badge>Canceled</Badge>
                  )}
                </div>
                {subscription?.billingCycle && subscription.currentPeriodEnd && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {subscription.billingCycle === "four_year" ? "4-Year" : subscription.billingCycle.charAt(0).toUpperCase() + subscription.billingCycle.slice(1)} cycle
                    {subscription.cancelAtPeriodEnd
                      ? ` · Cancels ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                      : subscription.billingCycle === "four_year"
                        ? ` · Expires ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : ` · Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            </div>
            {subscription?.hasStripeCustomer && (
              <Button variant="outline" size="sm" onClick={handleManageBilling}>
                Manage Billing
              </Button>
            )}
          </div>

          {/* Trial info */}
          {trial?.active && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-sm text-foreground">
                  <span className="font-bold text-warning">{trial.daysRemaining} day{trial.daysRemaining !== 1 ? "s" : ""}</span> remaining in your free trial.
                </p>
              </div>
              <Button size="sm" onClick={() => { const el = document.getElementById("pricing-cards"); el?.scrollIntoView({ behavior: "smooth" }); }}>
                Upgrade Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing interval toggle */}
      <div className="mb-6 flex items-center justify-center gap-1 rounded-full bg-muted p-1">
        {([
          { key: "monthly" as BillingInterval, label: "Monthly" },
          { key: "annual" as BillingInterval, label: "Annual", badge: "Save 10%" },
          { key: "four_year" as BillingInterval, label: "4-Year", badge: "Save 17%" },
        ]).map((interval) => (
          <button
            key={interval.key}
            type="button"
            onClick={() => setBillingInterval(interval.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              billingInterval === interval.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {interval.label}
            {interval.badge && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                billingInterval === interval.key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-success/15 text-success"
              }`}>
                {interval.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pricing cards */}
      <div id="pricing-cards" className="grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          // Trialing users are not on any paid plan — all paid plans show as upgrade
          const isCurrent = subscription?.status !== "trialing" && subscription?.planName === plan.name;
          const isUpgrade = plan.name !== "starter" && !isCurrent;

          return (
            <Card
              key={plan.name}
              className={`flex flex-col transition-shadow ${
                isCurrent
                  ? "ring-2 ring-primary border-primary/40"
                  : plan.name === "elite"
                    ? "border-purple-500/30 ring-1 ring-purple-500/20"
                    : plan.name === "plus"
                      ? "border-primary/30"
                      : ""
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{plan.display}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCurrent && (
                      <Badge variant="success">Current</Badge>
                    )}
                    {plan.name === "elite" && (
                      <Badge className="bg-ap-light text-ap">Popular</Badge>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-foreground">{getPrice(plan)}</span>
                  {getSubPrice(plan) && (
                    <span className="ml-1.5 text-sm text-muted-foreground">{getSubPrice(plan)}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm leading-5 text-foreground">
                      <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-4 border-t border-border">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full cursor-default opacity-60" disabled>
                      Current Plan
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      className={`w-full ${plan.name === "elite" ? "bg-ap hover:bg-ap/90" : ""}`}
                      onClick={() => handleUpgrade(plan.name)}
                      disabled={!!upgrading}
                    >
                      {upgrading === plan.name ? "Redirecting..." : `Upgrade to ${plan.display}`}
                    </Button>
                  ) : (
                    <Button variant="ghost" className="w-full text-muted-foreground cursor-default" disabled>
                      Free Forever
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
