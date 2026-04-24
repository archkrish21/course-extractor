import { test, expect } from "@playwright/test";

/**
 * Counselor journey: verify view-only access. Counselor is linked to the
 * seeded student's account with a shared plan at view permission.
 *
 * Uses counselor storageState.
 */
test.use({ storageState: "./tests/e2e/.auth/counselor.json" });

// v1-hide: counselor role hidden from UI; re-enable by changing `describe.skip` back to `describe`.
test.describe.skip("counselor view-only journey", () => {

test("counselor can see the student's planner grid", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.locator("text=Loading your plans...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator("text=/Course Planner/")).toBeVisible({ timeout: 10_000 });

  // The grade-level grid must render
  await expect(page.locator("text=Grade 10").first()).toBeVisible();
});

test("counselor does NOT see the 'Create new plan' button", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.locator("text=Loading your plans...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator("text=/Course Planner/")).toBeVisible({ timeout: 10_000 });

  const createBtn = page.locator('button[aria-label="Create new plan"]');
  expect(await createBtn.count()).toBe(0);
});

test("counselor's settings page does NOT show the invite form", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({
    timeout: 15_000,
  });
  // Invite email input is gated to non-counselor roles
  const inviteInput = page.locator('input[type="email"][placeholder*="Invite"]');
  expect(await inviteInput.count()).toBe(0);
});

});
