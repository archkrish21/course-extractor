import { test, expect } from "@playwright/test";

/**
 * Transcript page: verify GPA cards and completed courses render.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/transcript");
  await expect(
    page.getByRole("heading", { name: "Transcript", exact: true })
  ).toBeVisible({ timeout: 15_000 });
});

test("transcript shows unweighted and weighted GPA", async ({ page }) => {
  const gpaLabels = page.locator("text=/Unweighted GPA|Weighted GPA/i");
  await expect(gpaLabels.first()).toBeVisible({ timeout: 10_000 });
  // At least one numeric GPA value
  await expect(page.locator("text=/\\d+\\.\\d{2,3}/").first()).toBeVisible();
});

test("transcript shows at least one Grade section header", async ({ page }) => {
  const gradeHeading = page.getByRole("heading", { name: /Grade \d+/ }).first();
  await expect(gradeHeading).toBeVisible({ timeout: 10_000 });
});
