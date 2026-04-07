"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";

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
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-xl font-bold text-foreground">
                {subscription?.status === "trialing" ? "Free Trial" : (subscription?.planDisplayName ?? "Starter")}
                {subscription?.status === "trialing" && (
                  <Badge className="ml-2 bg-warning/15 text-warning text-[10px]">{trial?.daysRemaining ?? 14} days left</Badge>
                )}
                {subscription?.status === "active" && (
                  <Badge className="ml-2 bg-success/15 text-success text-[10px]">Active</Badge>
                )}
                {subscription?.status === "past_due" && (
                  <Badge className="ml-2 bg-destructive/15 text-destructive text-[10px]">Past Due</Badge>
                )}
                {subscription?.status === "canceled" && (
                  <Badge className="ml-2 bg-muted text-muted-foreground text-[10px]">Canceled</Badge>
                )}
              </p>
            </div>
            {subscription?.hasStripeCustomer && (
              <Button variant="outline" size="sm" onClick={handleManageBilling}>
                Manage Billing
              </Button>
            )}
          </div>

          {/* Trial info */}
          {trial?.active && (
            <div className="mt-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
              <p className="text-sm text-warning">
                <span className="font-semibold">{trial.daysRemaining} day{trial.daysRemaining !== 1 ? "s" : ""}</span> remaining in your free trial.
                Upgrade to keep your premium features.
              </p>
            </div>
          )}

          {/* Billing cycle info */}
          {subscription?.billingCycle && subscription.currentPeriodEnd && (
            <p className="mt-2 text-xs text-muted-foreground">
              {subscription.billingCycle === "four_year" ? "4-year" : subscription.billingCycle} billing
              {subscription.cancelAtPeriodEnd
                ? ` · Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : subscription.billingCycle === "four_year"
                  ? ` · Expires on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : ` · Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Billing interval toggle */}
      <div className="mb-6 flex items-center justify-center gap-1 rounded-lg bg-muted p-1">
        {([
          { key: "monthly" as BillingInterval, label: "Monthly" },
          { key: "annual" as BillingInterval, label: "Annual", badge: "Save 10%" },
          { key: "four_year" as BillingInterval, label: "4-Year", badge: "Save 17%" },
        ]).map((interval) => (
          <button
            key={interval.key}
            type="button"
            onClick={() => setBillingInterval(interval.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingInterval === interval.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {interval.label}
            {interval.badge && billingInterval === interval.key && (
              <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                {interval.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pricing cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          // Trialing users are not on any paid plan — all paid plans show as upgrade
          const isCurrent = subscription?.status !== "trialing" && subscription?.planName === plan.name;
          const isUpgrade = plan.name !== "starter" && !isCurrent;

          return (
            <Card
              key={plan.name}
              className={`flex flex-col ${
                plan.name === "elite"
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
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                  {plan.name === "elite" && (
                    <Badge className="bg-purple-500/15 text-purple-600 text-[10px]">Popular</Badge>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">{getPrice(plan)}</span>
                  {getSubPrice(plan) && (
                    <span className="ml-1 text-xs text-muted-foreground">{getSubPrice(plan)}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-border">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      className={`w-full ${plan.name === "elite" ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                      onClick={() => handleUpgrade(plan.name)}
                      disabled={!!upgrading}
                    >
                      {upgrading === plan.name ? "Redirecting..." : `Upgrade to ${plan.display}`}
                    </Button>
                  ) : (
                    <Button variant="ghost" className="w-full text-muted-foreground" disabled>
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
