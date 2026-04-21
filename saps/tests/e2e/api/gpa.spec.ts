import { test, expect } from "@playwright/test";
import { getGpa } from "../helpers/api-client";

/**
 * GPA calculation correctness (read-only). Asserts on the seeded student's
 * primary plan GPA without mutations. Mutation-based GPA tests live in
 * plan-mutations.spec.ts (single file to avoid plan-count races).
 */

test("cumulative GPA reflects completed courses with grades", async ({ request }) => {
  const gpa = await getGpa(request);
  expect(gpa.hasGrades).toBe(true);
  expect(gpa.cumulative.credits).toBeGreaterThan(0);
  expect(gpa.cumulative.unweighted).toBeGreaterThanOrEqual(0);
  expect(gpa.cumulative.unweighted).toBeLessThanOrEqual(4);
  expect(gpa.cumulative.weighted).toBeGreaterThanOrEqual(gpa.cumulative.unweighted);
});

test("projected GPA includes planned/enrolled courses (>= cumulative)", async ({ request }) => {
  const gpa = await getGpa(request);
  expect(gpa.projected.courses).toBeGreaterThanOrEqual(gpa.cumulative.courses);
  expect(gpa.projected.credits).toBeGreaterThanOrEqual(gpa.cumulative.credits);
});

test("weighted GPA is >= unweighted (weight bonus is non-negative)", async ({ request }) => {
  const gpa = await getGpa(request);
  expect(gpa.cumulative.weighted).toBeGreaterThanOrEqual(gpa.cumulative.unweighted);
  expect(gpa.projected.weighted).toBeGreaterThanOrEqual(gpa.projected.unweighted);
});
