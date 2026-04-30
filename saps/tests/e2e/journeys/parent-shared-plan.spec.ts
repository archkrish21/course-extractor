import { test, expect } from "@playwright/test";

/**
 * Parent journey: verify parent sees the shared student plan and has
 * edit permission (global-setup grants parent edit share on the primary plan).
 *
 * Uses parent storageState.
 */
test.use({ storageState: "./tests/e2e/.auth/parent.json" });

test("parent sees the student's plan in the planner", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.locator("text=Loading your plans...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator("text=/Course planner/")).toBeVisible({ timeout: 10_000 });

  // At least one grade row must render (parent has edit on a shared plan)
  await expect(page.locator("text=Grade 10").first()).toBeVisible();
});

test("parent settings page shows Shared With section", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { name: "Shared With" })
  ).toBeVisible();
});
