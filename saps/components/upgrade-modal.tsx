"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  minimumTier: string;
  currentTier: string;
}

const TIER_FEATURES: Record<string, string[]> = {
  plus: [
    "10 active plans",
    "What-if GPA simulator",
    "Plan comparison",
    "PDF export",
    "Share links",
    "Goal tracking",
    "Full alert system",
    "Parent plan drafts",
  ],
  elite: [
    "Everything in Plus",
    "Unlimited plans",
    "AI course suggestions",
    "AI plan review",
    "AI chat",
    "Percentile comparison",
    "Course rigor scoring",
  ],
};

const TIER_PRICES: Record<string, string> = {
  plus: "$9.99/mo",
  elite: "$19.99/mo",
};

export function UpgradeModal({ isOpen, onClose, feature, minimumTier, currentTier }: UpgradeModalProps) {
  const [upgrading, setUpgrading] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = async (planName: string) => {
    setUpgrading(true);
    try {
      const res = await apiFetch("/api/v1/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName, billingCycle: "monthly" }),
      });
      if (res.ok) {
        const json = await res.json();
        const url = json.data?.url ?? json.url;
        if (url) window.location.href = url;
      }
    } catch { /* silent */ }
    finally { setUpgrading(false); }
  };

  const tierColor = minimumTier === "elite" ? "bg-purple-600 hover:bg-purple-700" : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <svg aria-hidden="true" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Upgrade Required</h2>
            <p className="text-sm text-muted-foreground">
              {feature} requires {minimumTier === "elite" ? "an Elite" : "a Plus"} subscription.
            </p>
          </div>
        </div>

        {/* Current tier */}
        <p className="mb-4 text-xs text-muted-foreground">
          You're currently on the <span className="font-semibold text-foreground">{currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}</span> plan.
        </p>

        {/* Features */}
        <div className="mb-4 rounded-lg border border-border p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">
            {minimumTier.charAt(0).toUpperCase() + minimumTier.slice(1)} includes:
          </p>
          <ul className="space-y-1">
            {(TIER_FEATURES[minimumTier] ?? []).slice(0, 5).map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            className={`flex-1 ${tierColor}`}
            onClick={() => handleUpgrade(minimumTier)}
            disabled={upgrading}
          >
            {upgrading ? "Redirecting..." : `Upgrade to ${minimumTier.charAt(0).toUpperCase() + minimumTier.slice(1)} — ${TIER_PRICES[minimumTier]}`}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
        </div>

        {/* Link to full pricing */}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <a href="/settings/billing" className="text-primary hover:underline">View all plans & pricing</a>
        </p>
      </div>
    </div>
  );
}

/**
 * Hook to manage the upgrade modal state.
 * Call `checkResponse(res, featureName)` after API calls that may return 402.
 */
export function useUpgradeModal() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    feature: string;
    minimumTier: string;
    currentTier: string;
  }>({ isOpen: false, feature: "", minimumTier: "plus", currentTier: "starter" });

  const checkResponse = async (res: Response, featureName: string): Promise<boolean> => {
    if (res.status === 402) {
      try {
        const json = await res.json();
        const data = json.data ?? json;
        setModalState({
          isOpen: true,
          feature: featureName,
          minimumTier: data.minimum_tier ?? "plus",
          currentTier: data.current_tier ?? "starter",
        });
      } catch {
        setModalState({
          isOpen: true,
          feature: featureName,
          minimumTier: "plus",
          currentTier: "starter",
        });
      }
      return true; // was a 402
    }
    return false; // not a 402
  };

  const closeModal = () => setModalState((prev) => ({ ...prev, isOpen: false }));

  return { modalState, checkResponse, closeModal, UpgradeModalComponent: UpgradeModal };
}
