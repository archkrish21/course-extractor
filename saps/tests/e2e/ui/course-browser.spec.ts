import { test, expect } from "@playwright/test";

/**
 * Course browser: search, filter, detail modal. Core v1 feature.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/courses");
  // Wait for courses to finish loading (spinner clears + results text appears)
  await expect(
    page.locator('[role="status"][aria-label="Loading courses"]')
  ).toBeHidden({ timeout: 15_000 });
  await expect(page.locator("text=/courses? found|No courses found/")).toBeVisible({
    timeout: 10_000,
  });
});

test("course search filters results by name", async ({ page }) => {
  const search = page.locator("#course-search");
  await search.fill("Biology");
  // Wait for debounced search and result list to update
  await expect(page.locator("text=/courses? found/").first()).toBeVisible();
  // At least one Biology-related course should appear in the visible results
  await expect(page.getByText(/Biology/i).first()).toBeVisible({ timeout: 5_000 });
});

test("clicking a course card opens the detail modal", async ({ page }) => {
  const firstCard = page
    .getByRole("list", { name: "Course results" })
    .getByRole("listitem")
    .first()
    .getByRole("button")
    .first();
  await firstCard.click();
  const modal = page.locator('[role="dialog"][aria-modal="true"]').last();
  await expect(modal).toBeVisible({ timeout: 5_000 });
});

test("course detail modal closes on Escape", async ({ page }) => {
  const firstCard = page
    .getByRole("list", { name: "Course results" })
    .getByRole("listitem")
    .first()
    .getByRole("button")
    .first();
  await firstCard.click();
  const modal = page.locator('[role="dialog"][aria-modal="true"]').last();
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden({ timeout: 3_000 });
});
