"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";

/**
 * Trial banner that shows "X days left in your free trial" when trial is active.
 * Shows from day 10 onward (4 days remaining or fewer).
 * Dismissible for the session.
 */
export function TrialBanner() {
  const { currentAccount } = useAccount();
  const [dismissed, setDismissed] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show for trialing users
    if (currentAccount?.subscriptionTier !== "trial") return;

    const wasDismissed = sessionStorage.getItem("trial-banner-dismissed");
    if (wasDismissed === "true") {
      setDismissed(true);
      return;
    }

    // Fetch actual trial data from subscriptions API
    async function fetchTrialData() {
      try {
        const res = await apiFetch("/api/v1/subscriptions");
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          const trial = data.trial;
          if (trial?.active && trial.daysRemaining != null) {
            setDaysLeft(trial.daysRemaining);
            // Show banner when 4 or fewer days remaining
            setVisible(trial.daysRemaining <= 4);
          }
        }
      } catch { /* silent */ }
    }
    fetchTrialData();
  }, [currentAccount]);

  if (dismissed || !visible || daysLeft === null) return null;

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem("trial-banner-dismissed", "true");
  }

  return (
    <div
      className="flex flex-col gap-2 border-b border-warning/30 bg-warning-light px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-warning"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <p className="text-sm font-medium text-foreground">
          {daysLeft === 1
            ? "1 day left in your free trial"
            : `${daysLeft} days left in your free trial`}
          <span className="text-muted-foreground"> — Upgrade to keep your features</span>
        </p>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <Link href="/settings/billing">
          <Button size="sm">
            Upgrade now
          </Button>
        </Link>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:bg-warning/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={handleDismiss}
          aria-label="Dismiss trial banner"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
