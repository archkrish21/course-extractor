"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Trial banner that shows "X days left in your free trial" when trial is active.
 * Shows from day 10 onward (4 days remaining or fewer).
 * Dismissible for the session.
 */
export function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check session storage for dismissal
    const wasDismissed = sessionStorage.getItem("trial-banner-dismissed");
    if (wasDismissed === "true") {
      setDismissed(true);
      return;
    }

    // In production, this would come from the user's subscription data.
    // For now, simulate a trial that started some days ago.
    // We check if the user has a trial_start in localStorage for demo purposes.
    const trialStart = localStorage.getItem("saps-trial-start");
    if (!trialStart) {
      // No trial data - set a default for demo (day 11 of 14)
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 11);
      localStorage.setItem("saps-trial-start", start.toISOString());
    }

    const start = new Date(localStorage.getItem("saps-trial-start") || new Date().toISOString());
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, 14 - daysPassed);

    setDaysLeft(remaining);
    // Show banner from day 10 onward (4 or fewer days remaining)
    setVisible(daysPassed >= 10 && remaining > 0);
  }, []);

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
          <span className="text-muted-foreground"> - Upgrade to keep all features</span>
        </p>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <Button size="sm">
          Upgrade now
        </Button>
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
