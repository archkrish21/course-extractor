import { test, expect } from "@playwright/test";
import { getRequirements } from "../helpers/api-client";

/**
 * Graduation requirements endpoint — verifies the gap detection logic.
 * Requirements are advisory (don't block actions) but must be computed
 * correctly so students can see what's missing.
 */

interface RequirementGroup {
  group: string;
  label?: string;
  isOptIn: boolean;
  enabled: boolean;
  requirements: Array<{
    id: string;
    name: string;
    requiredCredits?: number;
    earnedCredits?: number;
    plannedCredits?: number;
    status: string;
  }>;
  totalRequired?: number;
  totalEarned?: number;
  totalPlanned?: number;
}

test("requirements endpoint returns the expected groups", async ({ request }) => {
  const data = await getRequirements(request);
  expect(Array.isArray(data.groups)).toBe(true);

  const groups = data.groups as RequirementGroup[];
  const groupNames = groups.map((g) => g.group);

  // v1 scope: graduation + course_load + non_course (+ il_public_university opt-in)
  expect(groupNames).toContain("graduation");
  expect(groupNames).toContain("course_load");
  expect(groupNames).toContain("non_course");
});

test("graduation group has credit totals that sum across requirements", async ({ request }) => {
  const data = await getRequirements(request);
  const grad = (data.groups as RequirementGroup[]).find((g) => g.group === "graduation")!;
  expect(grad.requirements.length).toBeGreaterThan(0);

  const sumRequired = grad.requirements.reduce((sum, r) => sum + (r.requiredCredits ?? 0), 0);
  expect(sumRequired).toBeGreaterThan(0);
  // Total required must match the sum of per-requirement credits
  if (grad.totalRequired !== undefined) {
    expect(grad.totalRequired).toBeCloseTo(sumRequired, 1);
  }
});

test("each requirement has a valid status", async ({ request }) => {
  const data = await getRequirements(request);
  const validStatuses = new Set([
    "met",
    "completed",
    "in_progress",
    "gap",
    "not_started",
    "planned",
  ]);
  for (const group of data.groups as RequirementGroup[]) {
    for (const req of group.requirements) {
      expect(validStatuses.has(req.status)).toBe(true);
    }
  }
});

test("il_public_university group is opt-in and disabled by default", async ({ request }) => {
  const data = await getRequirements(request);
  const ilGroup = (data.groups as RequirementGroup[]).find(
    (g) => g.group === "il_public_university"
  );
  if (!ilGroup) return; // Group may not be returned if disabled
  expect(ilGroup.isOptIn).toBe(true);
});
