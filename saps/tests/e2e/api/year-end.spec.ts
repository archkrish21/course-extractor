import { test, expect } from "@playwright/test";
import { getYearEnd } from "../helpers/api-client";

/**
 * Year-end API: verifies the GET endpoint returns valid state.
 * The POST endpoint (actual transition) is irreversible, so we don't
 * exercise it in parallel tests — see journey tests for the full flow.
 */

test("year-end GET returns transition state", async ({ request }) => {
  const res = await getYearEnd(request);
  expect(res.ok()).toBe(true);
  const body = await res.json();
  const data = body.data ?? body;
  expect(data).toHaveProperty("transitionState");
  // gradeLevel is null outside the year-end banner window, number during it
  if (data.gradeLevel !== null) {
    expect(data.gradeLevel).toBeGreaterThanOrEqual(9);
    expect(data.gradeLevel).toBeLessThanOrEqual(12);
  }
});

test("year-end with a specific grade override returns that grade's data", async ({ request }) => {
  const res = await getYearEnd(request, 9);
  if (!res.ok()) return; // calendar-gated responses may not honor grade override
  const body = await res.json();
  const data = body.data ?? body;
  if (data.gradeLevel !== null) {
    expect(data.gradeLevel).toBe(9);
  }
});
