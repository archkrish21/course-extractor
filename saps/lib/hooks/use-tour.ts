"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DriveStep } from "driver.js";
import { apiFetch } from "@/lib/api-client";
import { readTourValue, type TourValue, type TourStateMap } from "./tour-state";
import { runTour } from "./run-tour";

interface UseTourOptions {
  tourId: string;
  steps: DriveStep[];
}

/**
 * Manages a guided tour's state. Tours no longer auto-fire — pages render
 * <TourInvite /> when `shouldOffer` is true, and the user opts in.
 */
export function useTour({ tourId, steps }: UseTourOptions) {
  const router = useRouter();
  const [tourState, setTourState] = useState<TourStateMap | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const state = (json?.data?.tour_state ?? json?.tour_state ?? {}) as TourStateMap;
        setTourState(state);
      })
      .catch(() => setTourState({}));
  }, []);

  const { completed, declined } = readTourValue(tourState?.[tourId]);
  const isLoaded = tourState !== null;
  const shouldOffer = isLoaded && !completed && !declined && steps.length > 0;

  const persistTourValue = useCallback(
    async (value: TourValue) => {
      setTourState((prev) => ({ ...(prev ?? {}), [tourId]: value }));
      try {
        await apiFetch("/api/v1/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tour_state: { [tourId]: value } }),
        });
      } catch { /* silent */ }
    },
    [tourId],
  );

  const markCompleted = useCallback(() => persistTourValue({ completed: true }), [persistTourValue]);
  const decline = useCallback(() => persistTourValue({ declined: true }), [persistTourValue]);

  const startTour = useCallback(() => {
    runTour({
      steps,
      onComplete: () => markCompleted(),
      onNavigate: (href) => {
        markCompleted();
        router.push(href);
      },
    });
  }, [steps, markCompleted, router]);

  return {
    startTour,
    shouldOffer,
    completed,
    declined,
    decline,
    markCompleted,
  };
}
