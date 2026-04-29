"use client";

import { useCallback, useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { DriveStep } from "driver.js";
import { apiFetch } from "@/lib/api-client";
import { readTourValue, type TourValue, type TourStateMap } from "./tour-state";

interface UseTourOptions {
  tourId: string;
  steps: DriveStep[];
}

/**
 * Manages a guided tour's state. Tours no longer auto-fire — pages render
 * <TourInvite /> when `shouldOffer` is true, and the user opts in.
 */
export function useTour({ tourId, steps }: UseTourOptions) {
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
    if (steps.length === 0) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "rgba(0, 0, 0, 0.5)",
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "saps-tour-popover",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done!",
      progressText: "{{current}} of {{total}}",
      steps,
      onDestroyed: () => {
        markCompleted();
      },
    });

    driverObj.drive();
  }, [steps, markCompleted]);

  return {
    startTour,
    shouldOffer,
    completed,
    declined,
    decline,
    markCompleted,
  };
}
