"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { DriveStep } from "driver.js";
import { apiFetch } from "@/lib/api-client";

interface UseTourOptions {
  tourId: string;
  steps: DriveStep[];
  autoStart?: boolean; // Auto-start on first visit
  delay?: number; // Delay before starting (ms)
}

/**
 * Hook to manage guided tours.
 * Checks tour state from server, starts tour if not completed, and marks as completed.
 */
export function useTour({ tourId, steps, autoStart = true, delay = 500 }: UseTourOptions) {
  const [completed, setCompleted] = useState<boolean | null>(null);
  const startedRef = useRef(false);

  // Check tour state on mount
  useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const tourState = json?.data?.tour_state ?? json?.tour_state ?? {};
        setCompleted(!!tourState[tourId]);
      })
      .catch(() => setCompleted(true)); // On error, assume completed (don't annoy user)
  }, [tourId]);

  const markCompleted = useCallback(async () => {
    setCompleted(true);
    try {
      // Get current tour state first
      const res = await apiFetch("/api/v1/auth/me");
      if (res.ok) {
        const json = await res.json();
        const currentState = json?.data?.tour_state ?? json?.tour_state ?? {};
        await apiFetch("/api/v1/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tour_state: { ...currentState, [tourId]: true },
          }),
        });
      }
    } catch { /* silent */ }
  }, [tourId]);

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

  // Reset started flag when steps change (e.g., plans loaded, different step count)
  const stepCountRef = useRef(steps.length);
  useEffect(() => {
    if (steps.length !== stepCountRef.current) {
      stepCountRef.current = steps.length;
      startedRef.current = false;
    }
  }, [steps.length]);

  // Auto-start tour after delay if not completed
  useEffect(() => {
    if (!autoStart || completed !== false || startedRef.current) return;
    startedRef.current = true;
    const timer = setTimeout(startTour, delay);
    return () => clearTimeout(timer);
  }, [autoStart, completed, delay, startTour]);

  return {
    startTour,
    completed,
    markCompleted,
  };
}
