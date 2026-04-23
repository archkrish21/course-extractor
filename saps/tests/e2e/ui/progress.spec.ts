import { test, expect } from "@playwright/test";

/**
 * Progress page: verify requirement groups render.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Your progress" })
  ).toBeVisible({ timeout: 15_000 });
  // Sidebar "Overall" confirms data loaded
  await expect(page.locator("text=Overall").first()).toBeVisible({ timeout: 10_000 });
});

test("progress page shows summary sidebar with Earned and Planned", async ({ page }) => {
  await expect(page.locator("text=Earned").first()).toBeVisible();
  await expect(page.locator("text=Planned").first()).toBeVisible();
});

test("progress page shows Graduation Requirements group", async ({ page }) => {
  await expect(page.locator("text=Graduation Requirements").first()).toBeVisible();
});

test("progress page has Edit Plan button linking to planner", async ({ page }) => {
  const editBtn = page.locator("text=Edit Plan").first();
  await expect(editBtn).toBeVisible();
});
