// Tour-state value shape and readers. Kept separate from use-tour.ts so the
// pure logic can be unit-tested without React.

import type { DriveStep } from "driver.js";

export type TourValue = boolean | { completed?: boolean; declined?: boolean; lastStep?: number };
export type TourStateMap = Record<string, TourValue>;

/**
 * Normalizes a tour-state value across the legacy `true = completed` form and
 * the object form `{ completed, declined, lastStep }`. Missing entries return
 * neither completed nor declined.
 */
export function readTourValue(value: TourValue | undefined): { completed: boolean; declined: boolean } {
  if (value === undefined) return { completed: false, declined: false };
  if (typeof value === "boolean") return { completed: value, declined: false };
  return { completed: !!value.completed, declined: !!value.declined };
}

// Optional auto-advance trigger for a step. The user can still click Next
// manually; the listener just nudges the tour forward when they interact.
export type WaitForEvent =
  | { event: "click"; selector: string }
  | { event: "input"; selector: string; minLength?: number };

// Replaces the default "Done!" button on the last step with a labelled CTA
// that navigates to the next page in the tour journey.
export interface FinalCta {
  label: string;
  href: string;
}

export interface TourStep extends DriveStep {
  waitFor?: WaitForEvent;
  finalCta?: FinalCta;
}
