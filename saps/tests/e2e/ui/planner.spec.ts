import { test, expect } from "@playwright/test";

/**
 * Planner grid UI: verify the grid renders and common toolbar actions work.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/planner");
  await expect(page.locator("text=Loading your plans...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator("text=/Course Planner/")).toBeVisible({
    timeout: 10_000,
  });
});

test("planner grid renders with 4 grade rows", async ({ page }) => {
  // Grade 9 through Grade 12 headers must all be visible
  for (const grade of [9, 10, 11, 12]) {
    await expect(page.locator(`text=Grade ${grade}`).first()).toBeVisible();
  }
});

test("plan selector shows current plan name", async ({ page }) => {
  const selector = page.locator('[aria-label="Select a plan"]');
  await expect(selector).toBeVisible({ timeout: 5_000 });
  const value = await selector.inputValue();
  expect(value).toBeTruthy();
});

test("validation report button opens the validation panel", async ({ page }) => {
  const validateBtn = page.locator('[aria-label="Validation report"]');
  await validateBtn.click();
  await expect(page.locator("text=Validation Report")).toBeVisible({
    timeout: 10_000,
  });
});

test("new plan button opens the create-plan modal", async ({ page }) => {
  const newPlanBtn = page.locator('button[aria-label="Create new plan"]');
  await newPlanBtn.click();
  const modal = page.locator('[role="dialog"][aria-label="Create new plan"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });
  // Close it without creating (cancel)
  await modal.getByRole("button", { name: /Cancel/i }).click();
  await expect(modal).toBeHidden();
});
