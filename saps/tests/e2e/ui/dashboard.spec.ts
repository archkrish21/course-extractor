import { test, expect } from "@playwright/test";

/**
 * Dashboard: verify the 4 main cards render with real data.
 * Uses student storageState, so no login needed.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/dashboard");
  // Wait for the dashboard's "Welcome" heading which renders after auth context loads
  await expect(page.getByRole("heading", { name: /^Welcome/i })).toBeVisible({
    timeout: 15_000,
  });
});

test("dashboard shows GPA Summary card with numeric GPA", async ({ page }) => {
  await expect(page.locator("text=GPA Summary")).toBeVisible();
  // GPA data loads async — poll for either a numeric value or a no-grades message
  await expect
    .poll(async () => {
      const gpaValue = await page.locator("text=/\\d+\\.\\d{2}/").count();
      const noGrades = await page.locator("text=/no grades/i").count();
      return gpaValue + noGrades;
    }, { timeout: 10_000 })
    .toBeGreaterThan(0);
});

test("dashboard shows Academic Progress card", async ({ page }) => {
  await expect(page.locator("text=Academic Progress").first()).toBeVisible();
});

test("dashboard shows Attention Required card with status", async ({ page }) => {
  await expect(page.locator("text=Attention Required").first()).toBeVisible();
  // Either no-issues or category header must appear
  await expect
    .poll(async () => {
      const noIssues = await page.locator("text=/No issues found/").count();
      const categoryHeader = await page
        .locator("text=/Graduation Requirement|Semester Requirement|Prerequisite Violations/")
        .count();
      const noPrimary = await page.locator("text=/Create a plan/").count();
      return noIssues + categoryHeader + noPrimary;
    })
    .toBeGreaterThanOrEqual(1);
});

test("dashboard quick actions link to the planner", async ({ page }) => {
  const plannerLink = page.locator('a[href="/planner"]').last();
  await expect(plannerLink).toBeVisible();
  await plannerLink.click();
  await page.waitForURL(/\/planner/);
});
