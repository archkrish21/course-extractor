"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { DriveStep } from "driver.js";
import type { TourStep, WaitForEvent } from "./tour-state";

interface RunTourOptions {
  steps: DriveStep[];
  onComplete?: () => void;
  onNavigate?: (href: string) => void;
}

/**
 * Attaches a single-fire listener for a `waitFor` config and returns a
 * cleanup function. Exported for unit tests; consumers should use `runTour`.
 */
export function attachWaitForListener(wait: WaitForEvent, onTrigger: () => void): () => void {
  if (wait.event === "click") {
    // querySelectorAll handles cases where the selector matches multiple
    // elements (e.g., filter button rows). Any one of them firing wins.
    const targets = document.querySelectorAll(wait.selector);
    if (targets.length === 0) return () => {};
    let fired = false;
    const handler = () => {
      if (fired) return;
      fired = true;
      onTrigger();
    };
    targets.forEach((t) => t.addEventListener("click", handler, { once: true }));
    return () => targets.forEach((t) => t.removeEventListener("click", handler));
  }

  // input event — fires once minLength is reached
  const target = document.querySelector(wait.selector);
  if (!target) return () => {};
  const minLength = wait.minLength ?? 1;
  let fired = false;
  const handler = (e: Event) => {
    if (fired) return;
    const value = (e.target as HTMLInputElement).value ?? "";
    if (value.length >= minLength) {
      fired = true;
      onTrigger();
    }
  };
  target.addEventListener("input", handler);
  return () => target.removeEventListener("input", handler);
}

/**
 * Starts a guided tour with shared behavior: brand-themed popovers,
 * waitFor auto-advance on user interaction, and forward-CTA navigation
 * when the last step has a `finalCta`. Used by both `useTour` (for invite
 * flow) and `<TourButton />` (for manual replay).
 */
export function runTour({ steps, onComplete, onNavigate }: RunTourOptions) {
  if (steps.length === 0) return;

  const lastStep = steps[steps.length - 1] as TourStep;
  const finalCta = lastStep.finalCta;

  let cleanup: (() => void) | null = null;
  let triggered = false;

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
    doneBtnText: finalCta?.label ?? "Done!",
    progressText: "{{current}} of {{total}}",
    steps,
    onHighlightStarted: (_element, step) => {
      cleanup?.();
      cleanup = null;
      const tourStep = step as TourStep;
      const wait = tourStep.waitFor;
      if (!wait) return;
      cleanup = attachWaitForListener(wait, () => {
        // Guard against double-fire — user could interact + click Next quickly
        if (triggered) return;
        triggered = true;
        cleanup?.();
        cleanup = null;
        // Defer one tick so the user sees their action register before the
        // tour advances
        setTimeout(() => {
          triggered = false;
          driverObj.moveNext();
        }, 250);
      });
    },
    onNextClick: (_element, _step, options) => {
      // options.state.activeIndex is the index of the step we're advancing FROM
      const activeIndex = (options as { state?: { activeIndex?: number } }).state?.activeIndex ?? 0;
      const isLastStep = activeIndex === steps.length - 1;
      cleanup?.();
      cleanup = null;
      if (isLastStep && finalCta && onNavigate) {
        driverObj.destroy();
        onNavigate(finalCta.href);
        return;
      }
      driverObj.moveNext();
    },
    onCloseClick: () => {
      cleanup?.();
      cleanup = null;
      driverObj.destroy();
    },
    onDestroyed: () => {
      cleanup?.();
      cleanup = null;
      onComplete?.();
    },
  });

  driverObj.drive();
  return driverObj;
}
