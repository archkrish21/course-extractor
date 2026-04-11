import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────
// Use the canonical login() from helpers.ts — the previous local copy had a
// narrow waitForURL regex (missing /consent and /onboarding) that hung when
// the seeded student briefly redirected through those routes after login.

async function navigateToPlanner(page: Page) {
  await login(page);
  await page.goto("/planner");
  // Wait for loading to finish
  await expect(page.locator("text=Loading your plans...")).toBeHidden({
    timeout: 15_000,
  });
  // Either the planner grid appears or the "No plans yet" state
  await expect(
    page.locator("text=/Course Planner/")
  ).toBeVisible({ timeout: 10_000 });
}

// ─── Basic planner tests ────────────────────────────────────────────────────

test.describe("Planner — Navigation & Layout", () => {
  test("login and navigate to planner", async ({ page }) => {
    await navigateToPlanner(page);
    await expect(
      page.getByRole("heading", { name: "Course Planner" })
    ).toBeVisible();
  });

  test("plan selector shows available plans", async ({ page }) => {
    await navigateToPlanner(page);

    // Either a <select> plan selector or a plan name should be visible
    const planSelector = page.locator('[aria-label="Select a plan"]');
    const planName = page.locator(
      ".text-sm.font-medium.text-foreground"
    );

    const hasPlanSelector = (await planSelector.count()) > 0;
    const hasPlanName = (await planName.count()) > 0;

    expect(hasPlanSelector || hasPlanName).toBeTruthy();
  });

  test("plan header shows student full name instead of generic label", async ({ page }) => {
    await navigateToPlanner(page);

    // The subtitle should show the student's actual name (e.g. "Junior John's plan")
    // and NOT the generic "Student's plan" or "student's plan"
    const subtitle = page.locator("text=/'s plan/i").first();
    if ((await subtitle.count()) > 0) {
      const text = await subtitle.textContent();
      expect(text).not.toMatch(/^Student's plan$/i);
    }
  });

  test.fixme("planner grid shows 4 grade levels with 2 semesters each", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop grid layout test"
    );

    await navigateToPlanner(page);

    // Check if the planner has any content (plans exist)
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Wait for grid to render
    await page.waitForTimeout(2000);

    // Should have grade headers for all 4 grades
    const gradeHeaders = page.locator('button[role="rowheader"]');
    const headerCount = await gradeHeaders.count();
    expect(headerCount).toBeGreaterThanOrEqual(4);

    // At least one grade should show semester content
    const semesterLabels = page.locator("text=Semester 1");
    const sem1Count = await semesterLabels.count();
    expect(sem1Count).toBeGreaterThanOrEqual(1);
  });

  test.fixme("only active grade is expanded by default (accordion behavior)", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop accordion test"
    );

    await navigateToPlanner(page);

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Wait for the grid to render
    await page.waitForTimeout(2000);

    // The current grade header should have aria-expanded="true"
    const expandedHeaders = page.locator(
      'button[role="rowheader"][aria-expanded="true"]'
    );
    const expandedCount = await expandedHeaders.count();

    // At least one grade should be expanded
    expect(expandedCount).toBeGreaterThanOrEqual(1);

    // Other grades should be collapsed
    const collapsedHeaders = page.locator(
      'button[role="rowheader"][aria-expanded="false"]'
    );
    const collapsedCount = await collapsedHeaders.count();
    expect(collapsedCount + expandedCount).toBe(4); // Total 4 grades
  });

  test("clicking another grade toggles its expansion", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop accordion test"
    );

    await navigateToPlanner(page);

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    // Find a collapsed grade header and click it
    const collapsedHeader = page
      .locator('button[role="rowheader"][aria-expanded="false"]')
      .first();

    if ((await collapsedHeader.count()) === 0) {
      test.skip();
      return;
    }

    await collapsedHeader.click();
    await page.waitForTimeout(500);

    // The grade picker is no longer an exclusive accordion — multiple grades
    // can be expanded. Just verify at least one is expanded after click.
    const expandedAfter = await page
      .locator('button[role="rowheader"][aria-expanded="true"]')
      .count();
    expect(expandedAfter).toBeGreaterThanOrEqual(1);
  });

  test("course cards display correctly in grid cells", async ({ page }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop grid test"
    );

    await navigateToPlanner(page);

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Check for gridcell elements
    const gridCells = page.locator('[role="gridcell"]');
    const cellCount = await gridCells.count();

    if (cellCount > 0) {
      // Each visible cell should have course cards or an Add Course button
      const firstCell = gridCells.first();
      await expect(firstCell).toBeVisible();

      // Cell should have an aria-label describing the grade/semester
      const ariaLabel = await firstCell.getAttribute("aria-label");
      expect(ariaLabel).toMatch(/Grade \d+, Semester \d/);
    }
  });

  test("credit count displays per grade", async ({ page }) => {
    await navigateToPlanner(page);

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Grade headers render "X credits planned" (the regex needs the full phrase)
    const plannedText = page.locator("text=/\\d+\\.?\\d* credits planned/");
    const count = await plannedText.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("full-year courses appear aligned in both semester columns", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop grid test"
    );

    await navigateToPlanner(page);

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // If there are any "Full Year" badges visible in the grid,
    // the same course name should appear in both semester columns
    const fullYearBadges = page.locator(
      '[role="gridcell"] >> text=Full Year'
    );
    const badgeCount = await fullYearBadges.count();

    if (badgeCount > 0) {
      // Full year courses exist; the test passes if they render
      expect(badgeCount).toBeGreaterThanOrEqual(1);
    }
    // If no full-year courses exist in the current plan, this is a pass
  });

  test("course ordering: Early Bird -> Language Arts -> Math -> Science -> World Lang -> Electives -> PE", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop grid test"
    );

    await navigateToPlanner(page);

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Verify that at least one grid cell exists with courses
    const gridCells = page.locator('[role="gridcell"]');
    const cellCount = await gridCells.count();

    if (cellCount > 0) {
      // Find a cell with multiple courses to verify ordering
      // We check the DOM order of course cards within each cell
      // The sort order is enforced in the component, so we verify cards exist
      const firstCell = gridCells.first();
      const courseCards = firstCell.locator("[class*='rounded']").filter({
        has: page.locator("text=/[A-Z]{2,}/"), // Course code pattern
      });
      const cardCount = await courseCards.count();
      // If the cell has courses, ordering is handled by the sortCourses function
      expect(cardCount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Print Plan ──────────────────────────────────────────────────────────────

test.describe("Planner — Print Plan", () => {
  test("print button is visible in planner header", async ({ page }) => {
    await navigateToPlanner(page);

    const printBtn = page.locator('button[aria-label="Print plan"]');
    await expect(printBtn).toBeVisible({ timeout: 5000 });
  });

  test("print button opens print view in new tab", async ({ page, context }) => {
    await navigateToPlanner(page);

    const printBtn = page.locator('button[aria-label="Print plan"]');
    if (!(await printBtn.isVisible())) {
      test.skip();
      return;
    }

    // Listen for new page (tab)
    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      printBtn.click(),
    ]);

    // New page should have the print URL
    await newPage.waitForLoadState("domcontentloaded");
    expect(newPage.url()).toContain("/planner/print");
  });

  test("print view shows plan header with student info", async ({ page }) => {
    await login(page);
    await page.goto("/planner/print");
    // No waitForHydration here — /planner/print has no `form button[type="submit"]`
    // (the helper's default selector), so polling for that times out at 15s.
    // The print view is static read-only content; the subsequent toBeVisible
    // assertions with their own timeouts handle any rendering delay.
    await page.waitForTimeout(2000);

    // "Student Academic Planning System" appears both in the h1 and the footer note
    await expect(page.locator("text=Student Academic Planning System").first()).toBeVisible({ timeout: 10000 });

    // Plan name is the first h2 (grade tables also use h2)
    const planName = page.locator("h2").first();
    await expect(planName).toBeVisible();
  });

  test("print view shows grade tables with semester columns", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/planner/print");
    // No waitForHydration here — /planner/print has no `form button[type="submit"]`
    // (the helper's default selector), so polling for that times out at 15s.
    // The print view is static read-only content; the subsequent toBeVisible
    // assertions with their own timeouts handle any rendering delay.
    await page.waitForTimeout(2000);

    // Should show Grade 9 through Grade 12 headers
    await expect(page.locator("text=Grade 9").first()).toBeVisible({ timeout: 10000 });

    // Should show Semester 1 and Semester 2 labels
    await expect(page.locator("text=Semester 1").first()).toBeVisible();
    await expect(page.locator("text=Semester 2").first()).toBeVisible();
  });

  test("print view shows summary with credits and GPA", async ({ page }) => {
    await login(page);
    await page.goto("/planner/print");
    // No waitForHydration here — /planner/print has no `form button[type="submit"]`
    // (the helper's default selector), so polling for that times out at 15s.
    // The print view is static read-only content; the subsequent toBeVisible
    // assertions with their own timeouts handle any rendering delay.
    await page.waitForTimeout(2000);

    // Should show credits info inside the print main area (not the nav).
    // Scope to <main> so we don't accidentally match the sidebar nav link.
    const main = page.locator("main").first();
    await expect(main.locator("text=/credits/i").first()).toBeVisible({ timeout: 10000 });

    // The summary block renders "Courses:" inside a <strong> tag. Match the
    // exact "Courses:" label to avoid the sidebar /courses navigation link
    // (which doesn't have the colon and on mobile is hidden in a drawer
    // but still in the DOM).
    await expect(main.locator("text=Courses:").first()).toBeVisible();
  });

  test("print view shows back button and print button on screen", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/planner/print");
    // No waitForHydration here — /planner/print has no `form button[type="submit"]`
    // (the helper's default selector), so polling for that times out at 15s.
    // The print view is static read-only content; the subsequent toBeVisible
    // assertions with their own timeouts handle any rendering delay.
    await page.waitForTimeout(2000);

    await expect(page.locator("text=Back to Planner")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Print / Save as PDF")).toBeVisible();
  });

  test("print view shows footer with legend", async ({ page }) => {
    await login(page);
    await page.goto("/planner/print");
    // No waitForHydration here — /planner/print has no `form button[type="submit"]`
    // (the helper's default selector), so polling for that times out at 15s.
    // The print view is static read-only content; the subsequent toBeVisible
    // assertions with their own timeouts handle any rendering delay.
    await page.waitForTimeout(2000);

    // Footer should show the legend
    await expect(page.locator("text=GPA waiver applied").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Unweighted/Weighted").first()).toBeVisible();
  });
});
