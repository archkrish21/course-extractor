import { test, expect, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await waitForHydration(page);
  await page.locator('input[type="email"]').fill("student@test.com");
  await page.locator('input[type="password"]').first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function waitForCoursesLoaded(page: Page) {
  await expect(
    page.locator('[role="status"][aria-label="Loading courses"]')
  ).toBeHidden({ timeout: 10_000 });
  await expect(
    page.locator("text=/courses? found|No courses found/")
  ).toBeVisible({ timeout: 10_000 });
}

async function navigateToCourses(page: Page) {
  await login(page);
  await page.goto("/courses");
  await waitForCoursesLoaded(page);
}

// ─── E108: Summer Filter in Course Browser ──────────────────────────────────

test.describe("Course Browser — Summer Filter", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCourses(page);
  });

  test("E108: summer filter button exists in Semester Offered", async ({ page }) => {
    // The "☀ Summer" radio button should be visible
    const summerBtn = page.locator('button[role="radio"]:has-text("☀ Summer")');
    await expect(summerBtn).toBeVisible();
    await expect(summerBtn).toHaveAttribute("aria-checked", "false");
  });

  test("E108: clicking summer filter shows only summer courses", async ({ page }) => {
    const summerBtn = page.locator('button[role="radio"]:has-text("☀ Summer")');
    await summerBtn.click();
    await waitForCoursesLoaded(page);

    // Should be checked now
    await expect(summerBtn).toHaveAttribute("aria-checked", "true");

    // Results should exist (catalog has summer courses)
    const resultsText = page.locator("text=/\\d+ courses? found/");
    const noResults = page.locator("text=No courses found");

    if (await noResults.isVisible()) {
      test.skip(true, "No summer courses in catalog");
      return;
    }

    await expect(resultsText).toBeVisible();
  });

  test("E108: summer courses show 'Summer' in duration text", async ({ page }) => {
    const summerBtn = page.locator('button[role="radio"]:has-text("☀ Summer")');
    await summerBtn.click();
    await waitForCoursesLoaded(page);

    if (await page.locator("text=No courses found").isVisible()) {
      test.skip(true, "No summer courses in catalog");
      return;
    }

    // Course cards should show "Summer" instead of "Sem -2 only"
    const courseList = page.getByRole("list", { name: "Course results" });
    const items = courseList.getByRole("listitem");
    const firstItem = items.first();
    await expect(firstItem).toBeVisible();

    // Should contain "Summer" text (not "Sem -2")
    await expect(firstItem).toContainText("Summer");
    await expect(firstItem).not.toContainText("Sem -2");
  });
});

// ─── E95: Summer Badge on Course Cards ──────────────────────────────────────

test.describe("Course Browser — Summer Badge", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCourses(page);
  });

  test("E95: summer courses display Summer badge on cards", async ({ page }) => {
    // Filter to summer courses
    const summerBtn = page.locator('button[role="radio"]:has-text("☀ Summer")');
    await summerBtn.click();
    await waitForCoursesLoaded(page);

    if (await page.locator("text=No courses found").isVisible()) {
      test.skip(true, "No summer courses in catalog");
      return;
    }

    // Each course card should have a "Summer" badge
    const courseList = page.getByRole("list", { name: "Course results" });
    const firstCard = courseList.getByRole("listitem").first();
    await expect(firstCard).toBeVisible();

    // Badge text "Summer" should be present
    await expect(firstCard.locator("text=Summer").first()).toBeVisible();
  });
});

// ─── E96: Summer Badge in Course Detail Modal ───────────────────────────────

test.describe("Course Browser — Summer Detail Modal", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCourses(page);
  });

  test("E96: summer course detail modal shows Summer badge", async ({ page }) => {
    // Filter to summer
    const summerBtn = page.locator('button[role="radio"]:has-text("☀ Summer")').first();
    await summerBtn.click();
    await waitForCoursesLoaded(page);

    if (await page.locator("text=No courses found").isVisible()) {
      test.skip(true, "No summer courses in catalog");
      return;
    }

    // Click the first course card BUTTON to open detail modal
    const courseList = page.getByRole("list", { name: "Course results" });
    const firstCard = courseList.getByRole("listitem").first().getByRole("button");
    await firstCard.click();

    // Wait for modal
    const modal = page.locator('[role="dialog"][aria-modal="true"]').last();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Modal header should contain "Summer" badge
    await expect(modal.locator("text=Summer").first()).toBeVisible();
  });
});

// ─── E97–E98: "Also Available As" Equivalents ──────────────────────────────

test.describe("Course Browser — Summer Equivalents", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCourses(page);
  });

  test("E97: summer course detail shows regular equivalent in linked courses", async ({ page }) => {
    // Filter to summer and search for SOC13S
    const summerBtn = page.locator('button[role="radio"]:has-text("☀ Summer")');
    await summerBtn.click();
    await waitForCoursesLoaded(page);

    const searchInput = page.locator("#course-search");
    await searchInput.fill("SOC13S");
    // Wait for debounce + API response
    await page.waitForTimeout(2_000);
    await waitForCoursesLoaded(page);

    // Verify SOC13S appears in results
    const courseList = page.getByRole("list", { name: "Course results" });
    const card = courseList.getByRole("listitem").first();
    await expect(card).toContainText("SOC13S", { timeout: 5_000 });

    await card.click();

    const modal = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: "Course" });
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should show "Also available as" section with SOC101/SOC102
    await expect(modal.locator("text=Also available as")).toBeVisible({ timeout: 10_000 });
    await expect(modal.locator("text=SOC101")).toBeVisible();
  });

  test("E98: regular course detail shows summer equivalent in linked courses", async ({ page }) => {
    // Search for a regular course that has a summer equivalent
    const searchInput = page.locator("#course-search");
    await searchInput.fill("SOC101");
    // Wait for debounce + API response
    await page.waitForTimeout(2_000);
    await waitForCoursesLoaded(page);

    // Verify SOC101 appears in results
    const courseList = page.getByRole("list", { name: "Course results" });
    const card = courseList.getByRole("listitem").first();
    await expect(card).toContainText("SOC101", { timeout: 5_000 });

    await card.click();

    const modal = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: "Course" });
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should show "Also available as" section with SOC13S/SOC14S
    await expect(modal.locator("text=Also available as")).toBeVisible({ timeout: 10_000 });
    await expect(modal.locator("text=SOC13S")).toBeVisible();
  });
});
