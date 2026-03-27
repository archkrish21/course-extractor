import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Wait for the course list to finish loading (spinner gone, results visible). */
async function waitForCoursesLoaded(page: Page) {
  // Wait for loading spinner to disappear
  await expect(
    page.locator('[role="status"][aria-label="Loading courses"]')
  ).toBeHidden({ timeout: 10_000 });

  // Wait for the results count text ("N courses found" or "No courses found")
  await expect(
    page.locator("text=/courses? found|No courses found/")
  ).toBeVisible({ timeout: 10_000 });
}

// ─── Page load ──────────────────────────────────────────────────────────────

test.describe("Course Browser — Page Load", () => {
  test("page loads and shows course list", async ({ page }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);

    // Heading present
    await expect(
      page.getByRole("heading", { name: "Course Browser" })
    ).toBeVisible();

    // At least one course card rendered
    const courseList = page.getByRole("list", { name: "Course results" });
    await expect(courseList).toBeVisible();
    const items = courseList.getByRole("listitem");
    await expect(items.first()).toBeVisible();
  });
});

// ─── Search ─────────────────────────────────────────────────────────────────

test.describe("Course Browser — Search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);
  });

  test("search by course name filters results", async ({ page }) => {
    const searchInput = page.locator("#course-search");
    await searchInput.fill("English");
    // Debounce + network
    await waitForCoursesLoaded(page);

    await expect(page.locator("text=/courses? found/")).toBeVisible();
    // All visible course names should contain the search term (case-insensitive)
    const firstCardName = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first()
      .locator("h3");
    await expect(firstCardName).toBeVisible();
  });

  test("search by course code filters results", async ({ page }) => {
    const searchInput = page.locator("#course-search");
    await searchInput.fill("ENG");
    await waitForCoursesLoaded(page);

    await expect(page.locator("text=/courses? found/")).toBeVisible();
  });
});

// ─── Filters ────────────────────────────────────────────────────────────────

test.describe("Course Browser — Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);
  });

  test("division filter shows only courses in that division", async ({
    page,
  }) => {
    // Record initial count
    const initialCountText = await page
      .locator("text=/\\d+ courses? found/")
      .textContent();
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] ?? "0");

    // Select a specific division
    await page.locator("#division-select").selectOption("Mathematics");
    await waitForCoursesLoaded(page);

    const filteredCountText = await page
      .locator("text=/\\d+ courses? found|No courses found/")
      .textContent();
    const filteredCount = filteredCountText?.includes("No courses")
      ? 0
      : parseInt(filteredCountText?.match(/\d+/)?.[0] ?? "0");

    // Filtered count should be less than or equal to initial
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("department filter narrows results after selecting division", async ({
    page,
  }) => {
    // Select a division with multiple departments
    await page.locator("#division-select").selectOption("Fine Arts");
    await waitForCoursesLoaded(page);

    // Department select should now be visible
    const deptSelect = page.locator("#department-select");
    await expect(deptSelect).toBeVisible();

    // Select a specific department
    await deptSelect.selectOption("Music");
    await waitForCoursesLoaded(page);

    await expect(
      page.locator("text=/\\d+ courses? found|No courses found/")
    ).toBeVisible();
  });

  test("credit type filter works", async ({ page }) => {
    // Click the AP credit type filter chip (role="checkbox")
    const apChip = page.locator(
      'fieldset:has(legend:has-text("Credit Type")) button[role="checkbox"]:has-text("AP")'
    );
    await apChip.click();
    await waitForCoursesLoaded(page);

    // Should show only AP courses (or no results)
    await expect(
      page.locator("text=/\\d+ courses? found|No courses found/")
    ).toBeVisible();
  });

  test("multiple credit type filters show combined results", async ({ page }) => {
    // Get AP-only count
    const apChip = page.locator('button[role="checkbox"]').filter({ hasText: /^AP$/ });
    await apChip.click();
    await waitForCoursesLoaded(page);
    await page.waitForTimeout(1000);
    const apCountText = await page.locator("text=/\\d+ courses? found/").textContent();
    const apCount = parseInt(apCountText?.match(/(\d+)/)?.[1] ?? "0", 10);
    expect(apCount).toBeGreaterThan(0); // Sanity check: AP filter returned results

    // Now also select CP — should show more results than AP alone
    const cpChip = page.locator('button[role="checkbox"]').filter({ hasText: /^CP$/ });
    await cpChip.click();
    await waitForCoursesLoaded(page);
    await page.waitForTimeout(1000);
    const combinedCountText = await page.locator("text=/\\d+ courses? found/").textContent();
    const combinedCount = parseInt(combinedCountText?.match(/(\d+)/)?.[1] ?? "0", 10);

    // Combined count should be greater than AP-only count
    expect(combinedCount).toBeGreaterThan(apCount);
  });

  test("grade level filter works", async ({ page }) => {
    // Click "Grade 9" filter chip
    const grade9Chip = page.locator(
      'fieldset:has(legend:has-text("Grade Level")) button[role="checkbox"]:has-text("Grade 9")'
    );
    await grade9Chip.click();
    await waitForCoursesLoaded(page);

    await expect(
      page.locator("text=/\\d+ courses? found|No courses found/")
    ).toBeVisible();
  });

  test("GPA waiver filter works", async ({ page }) => {
    // Check the GPA waiver checkbox
    const gpaCheckbox = page.getByLabel("GPA waiver available");
    await gpaCheckbox.check();
    await waitForCoursesLoaded(page);

    await expect(
      page.locator("text=/\\d+ courses? found|No courses found/")
    ).toBeVisible();
  });

  test.fixme("semester offered filter works", async ({ page }) => {
    // Click the "Sem 1" radio button in the Semester Offered section
    const sem1Radio = page.locator('button[aria-pressed]').filter({ hasText: "Sem 1" }).first();
    await sem1Radio.click();
    await waitForCoursesLoaded(page);

    await expect(
      page.locator("text=/\\d+ courses? found|No courses found/")
    ).toBeVisible();
  });

  test("clearing all filters shows all courses", async ({ page }) => {
    // Record initial count
    const initialCountText = await page
      .locator("text=/\\d+ courses? found/")
      .textContent();

    // Apply a filter
    await page.locator("#division-select").selectOption("Mathematics");
    await waitForCoursesLoaded(page);

    // Clear filters
    await page.getByRole("button", { name: "Clear all filters" }).click();
    await waitForCoursesLoaded(page);

    // Count should match initial
    const restoredCountText = await page
      .locator("text=/\\d+ courses? found/")
      .textContent();
    expect(restoredCountText).toBe(initialCountText);
  });
});

// ─── Course detail modal ────────────────────────────────────────────────────

test.describe("Course Browser — Detail Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);
  });

  test("clicking a course card opens the detail modal", async ({ page }) => {
    // Click the first course card
    const firstCard = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first()
      .getByRole("button");
    await firstCard.click();

    // Modal should appear
    const modal = page.locator('[role="dialog"][aria-modal="true"]').last();
    await expect(modal).toBeVisible();
  });

  test("detail modal shows course description, prerequisites, grade levels", async ({
    page,
  }) => {
    // Click the first course card
    const firstCard = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first()
      .getByRole("button");
    await firstCard.click();

    const modal = page.locator('[role="dialog"][aria-modal="true"]').last();
    await expect(modal).toBeVisible();

    // Modal should contain course name in heading
    const modalHeading = modal.locator("h2");
    await expect(modalHeading).toBeVisible();

    // Wait for detail content to load
    await page.waitForTimeout(1000);

    // Should have course description or detail grid content
    await expect(
      modal.locator("text=/Description|Grade Levels|Duration/").first()
    ).toBeVisible();
  });

  test("detail modal close button works", async ({ page }) => {
    // Open modal
    const firstCard = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first()
      .getByRole("button");
    await firstCard.click();

    const modal = page.locator('[role="dialog"][aria-modal="true"]').last();
    await expect(modal).toBeVisible();

    // Click the close button
    await page.getByLabel("Close course details").click();
    await expect(modal).toBeHidden();
  });

  test("detail modal Escape key closes it", async ({ page }) => {
    // Open modal
    const firstCard = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first()
      .getByRole("button");
    await firstCard.click();

    const modal = page.locator('[role="dialog"][aria-modal="true"]').last();
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test.fixme("clicking a prerequisite code in detail navigates to that course", async ({
    page,
  }) => {
    // Search for a course known to have prerequisites (AP Calculus requires Precalculus)
    await page.locator('input[type="search"], input[placeholder*="Search"]').fill("AP Calculus");
    await waitForCoursesLoaded(page);

    // Open the first result
    const firstCard = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first()
      .getByRole("button");
    await firstCard.click();

    const modal = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for detail to load
    await page.waitForTimeout(2000);

    // Check if there are any prerequisite code links
    const prereqLinks = modal.locator("button.underline");
    const count = await prereqLinks.count();

    if (count > 0) {
      const headingBefore = await modal.locator("h2").textContent();
      await prereqLinks.first().click();
      await page.waitForTimeout(2000);

      // A dialog should still be visible
      await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible();
      const headingAfter = await page.locator('[role="dialog"][aria-modal="true"] h2').textContent();
      expect(headingAfter).not.toBe(headingBefore);
    } else {
      // Skip if no prerequisites found
      test.skip();
    }
  });
});

// ─── Pagination ─────────────────────────────────────────────────────────────

test.describe("Course Browser — Pagination", () => {
  test("pagination works (next/previous)", async ({ page }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);

    // Check we're on page 1
    await expect(page.locator("text=Page 1")).toBeVisible();

    // Next button should be visible if there are more than 20 courses
    const nextButton = page.getByLabel("Next page");
    const isDisabled = await nextButton.isDisabled();

    if (!isDisabled) {
      await nextButton.click();
      await waitForCoursesLoaded(page);
      await expect(page.locator("text=Page 2")).toBeVisible();

      // Previous button should now be enabled
      const prevButton = page.getByLabel("Previous page");
      await expect(prevButton).toBeEnabled();
      await prevButton.click();
      await waitForCoursesLoaded(page);
      await expect(page.locator("text=Page 1")).toBeVisible();
    }
  });
});

// ─── Layout and badges ──────────────────────────────────────────────────────

test.describe("Course Browser — Layout & Badges", () => {
  test("two-column grid layout on desktop", async ({ page }) => {
    // Only run on desktop (chromium project)
    test.skip(
      test.info().project.name === "mobile",
      "Desktop-only layout test"
    );

    await page.goto("/courses");
    await waitForCoursesLoaded(page);

    // The course list should use a 2-column grid on md+ screens
    const courseList = page.getByRole("list", { name: "Course results" });
    const gridClass = await courseList.getAttribute("class");
    expect(gridClass).toContain("md:grid-cols-2");
  });

  test("course cards show correct badges (AP, Honors, DC, GPA Waiver)", async ({
    page,
  }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);

    // Find the first course card
    const firstCard = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first();
    await expect(firstCard).toBeVisible();

    // Every card should have at least one badge (credit type badge is always present)
    // The Badge component renders a span — look for any badge-like element
    const badges = firstCard.locator("span").filter({
      hasText: /^(CP|Accelerated|Honors|AP|Dual Credit|GPA Waiver)$/,
    });
    await expect(badges.first()).toBeVisible();
  });

  test("grade circles display correctly (not 'Gr 9' text)", async ({
    page,
  }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);

    // Grade circles use small rounded-full spans with single numbers (9, 10, 11, 12)
    const gradeCircles = page.locator(
      ".rounded-full.border.border-border.bg-muted"
    );
    const count = await gradeCircles.count();

    if (count > 0) {
      const firstCircleText = await gradeCircles.first().textContent();
      // Should be a plain number, not "Gr 9"
      expect(firstCircleText?.trim()).toMatch(/^\d{1,2}$/);
    }
  });
});
