import { test, expect } from "@playwright/test";
import { createPlan, deletePlan, listPlans } from "../helpers/api-client";

/**
 * FREE_LAUNCH_MODE enforces a 3-plan cap via LAUNCH_TIER. This test verifies
 * the limit is enforced at the API level and returns the proper error code
 * (402 UPGRADE_REQUIRED with tier info).
 *
 * Runs serially so it doesn't collide with other plan-creating tests.
 */
test.describe.configure({ mode: "serial" });

test("3-plan launch-tier cap rejects the 4th plan with 402", async ({ request }) => {
  // Seed already has 1 primary plan. Figure out how many slots remain.
  const existing = await listPlans(request);
  const room = 3 - existing.length;

  if (room < 1) {
    // Another test is holding scratch plans — skip rather than fight
    test.skip(true, `Plan count already at ${existing.length}/3 from parallel tests`);
    return;
  }

  // Fill up to the cap
  const created: string[] = [];
  try {
    for (let i = 0; i < room; i++) {
      const plan = await createPlan(request, `E2E Cap Plan ${i + 1}`);
      created.push(plan.id);
    }

    // Any further creation must be rejected with 402 UPGRADE_REQUIRED
    const res = await request.post("/api/v1/plans", {
      data: { name: "E2E Cap Overflow" },
    });
    const body = await res.json();
    expect(res.status(), JSON.stringify(body)).toBe(402);
    expect(body.error?.code).toBe("UPGRADE_REQUIRED");
    expect(body.error?.max).toBe(3);
  } finally {
    for (const id of created) {
      await deletePlan(request, id).catch(() => {});
    }
  }
});
