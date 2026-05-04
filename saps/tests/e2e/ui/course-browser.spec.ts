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

test("department dropdown is populated from the catalog (DB-driven)", async ({ page }) => {
  // Picking "Applied Arts" should expose every department that has at least
  // one non-summer active course in the latest catalog version, including
  // the Lake County Tech Campus (VOC) department added in the last extractor
  // run. Regression for the "hardcoded DEPARTMENTS_BY_DIVISION" gap.
  const division = page.locator("#division-select");
  await division.selectOption("Applied Arts");

  const department = page.locator("#department-select");
  await expect(department).toBeVisible();
  for (const expected of [
    "Business Education",
    "Driver Education",
    "Family and Consumer Sciences",
    "Lake County Tech Campus",
  ]) {
    await expect(department.locator(`option[value="${expected}"]`)).toHaveCount(1);
  }

  // Filtering by the new department surfaces its courses.
  await department.selectOption("Lake County Tech Campus");
  await expect(page.locator("text=/courses? found/").first()).toBeVisible();
  await expect(page.getByText(/Cosmetology|Welding|Cybersecurity|Automotive/i).first())
    .toBeVisible({ timeout: 5_000 });
});

test("summer-only divisions are hidden from the categorical browse", async ({ page }) => {
  // The /api/v1/divisions endpoint filters out divisions whose every course
  // is summer-only (semesters_offered uses negative values). Those courses
  // remain reachable via the "Summer" semester filter pill, so dropping them
  // here matches the prior hardcoded UX.
  const division = page.locator("#division-select");
  for (const hidden of ["Student Learning Programs", "Student Services", "Special Education"]) {
    await expect(division.locator(`option[value="${hidden}"]`)).toHaveCount(0);
  }
});
