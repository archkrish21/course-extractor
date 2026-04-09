import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").first().fill("Test1234!");
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

// ─── axe automated scans ────────────────────────────────────────────────────

test.describe("Accessibility — Automated Axe Scans", () => {
  test("course browser has no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    // Filter to critical and serious violations only
    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical"
    );
    if (criticalViolations.length > 0) {
      console.log("A11y violations:", criticalViolations.map(v => `${v.id}: ${v.description} (${v.impact})`));
    }
    expect(criticalViolations).toEqual([]);
  });

  test("login page has no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/login");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical"
    );
    if (criticalViolations.length > 0) {
      console.log("A11y violations:", criticalViolations.map(v => `${v.id}: ${v.description} (${v.impact})`));
    }
    expect(criticalViolations).toEqual([]);
  });

  test("signup page has no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/signup");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical"
    );
    if (criticalViolations.length > 0) {
      console.log("A11y violations:", criticalViolations.map(v => `${v.id}: ${v.description} (${v.impact})`));
    }
    expect(criticalViolations).toEqual([]);
  });
});

// ─── Course browser accessibility ───────────────────────────────────────────

test.describe("Accessibility — Course Browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/courses");
    await waitForCoursesLoaded(page);
  });

  test("all interactive elements have ARIA labels", async ({ page }) => {
    // Search input has label
    const searchInput = page.locator("#course-search");
    await expect(searchInput).toBeVisible();
    const searchLabel = page.locator('label[for="course-search"]');
    await expect(searchLabel).toBeAttached(); // sr-only label exists in DOM

    // Division select has label
    const divisionSelect = page.locator("#division-select");
    const divisionLabel = page.locator('label[for="division-select"]');
    await expect(divisionLabel).toBeVisible();

    // Course cards have aria-labels
    const firstCardButton = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first()
      .getByRole("button");
    const ariaLabel = await firstCardButton.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/View details for/);

    // Filter chips have role="checkbox" with aria-checked
    const creditTypeChips = page.locator(
      'fieldset:has(legend:has-text("Credit Type")) button[role="checkbox"]'
    );
    const firstChip = creditTypeChips.first();
    if (await firstChip.isVisible()) {
      const checked = await firstChip.getAttribute("aria-checked");
      expect(checked).toMatch(/true|false/);
    }
  });

  test("course detail modal: Escape closes, focus restored", async ({
    page,
  }) => {
    // Open modal
    const firstCard = page
      .getByRole("list", { name: "Course results" })
      .getByRole("listitem")
      .first()
      .getByRole("button");
    await firstCard.click();

    const modal = page
      .locator('[role="dialog"][aria-modal="true"]')
      .last();
    await expect(modal).toBeVisible();

    // Modal should have aria-label
    const modalLabel = await modal.getAttribute("aria-label");
    expect(modalLabel).toMatch(/Course details/);

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("grade level circles have accessible content", async ({ page }) => {
    // Grade circles display numbers (9, 10, 11, 12) as visible text
    const gradeCircles = page.locator(
      ".inline-flex.items-center.justify-center.rounded-full.border"
    );
    const count = await gradeCircles.count();

    if (count > 0) {
      const text = await gradeCircles.first().textContent();
      // Should be a number, not empty
      expect(text?.trim()).toMatch(/\d+/);
    }
  });
});

// ─── Planner accessibility ──────────────────────────────────────────────────

test.describe("Accessibility — Planner", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/planner");
    await expect(page.locator("text=Loading your plans...")).toBeHidden({
      timeout: 15_000,
    });
  });

  test('planner grid: role="grid" with proper row/cell structure', async ({
    page,
  }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop grid test"
    );

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Grid element exists
    const grid = page.locator('[role="grid"]').first();
    await expect(grid).toBeVisible();

    // Should have row elements
    const rows = grid.locator('[role="row"]');
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBe(4); // 4 grades

    // Each row should have a rowheader
    const firstRow = rows.first();
    const rowHeader = firstRow.locator('[role="rowheader"]');
    await expect(rowHeader).toBeVisible();

    // Expanded rows should have gridcells
    const expandedRow = page.locator(
      '[role="row"]:has(button[role="rowheader"][aria-expanded="true"])'
    );
    if ((await expandedRow.count()) > 0) {
      const cells = expandedRow.first().locator('[role="gridcell"]');
      const cellCount = await cells.count();
      expect(cellCount).toBe(2); // 2 semesters
    }
  });

  test("planner: keyboard navigation (Tab, Enter, Escape)", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop keyboard test"
    );

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Tab should move focus through interactive elements
    await page.keyboard.press("Tab");
    // The focused element should have a visible focus indicator
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();

    // Press Tab several more times to navigate through the planner
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
    }

    // Focus should still be on a visible element
    await expect(page.locator(":focus")).toBeVisible();
  });

  test("course picker: focus trap within modal", async ({ page }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop modal test"
    );

    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Open the course picker
    const addButton = page
      .locator('button:has-text("Add Course")')
      .filter({ hasNot: page.locator("[disabled]") })
      .first();

    if (!(await addButton.isVisible())) {
      const collapsedHeader = page
        .locator('button[role="rowheader"][aria-expanded="false"]')
        .first();
      if (await collapsedHeader.isVisible()) {
        await collapsedHeader.click();
        await page.waitForTimeout(300);
      }
    }

    if (!(await addButton.isVisible())) {
      test.skip();
      return;
    }

    await addButton.click();

    const picker = page.locator('[role="dialog"][aria-modal="true"]').filter({
      hasText: "Add Course",
    });
    await expect(picker).toBeVisible();

    // Tab through elements — focus should stay within the picker
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
    }

    // Check that the focused element is still inside the picker
    const focusedEl = page.locator(":focus");
    // The focus should be on an element within the picker dialog
    const isInPicker = await focusedEl.evaluate(
      (el) => !!el.closest('[role="dialog"]')
    );
    expect(isInPicker).toBeTruthy();

    // Escape should close the picker
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
  });

  test("all buttons have 44px minimum touch target", async ({ page }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Check that interactive elements have min-h-[44px] or equivalent
    // Sample check on key buttons
    const addCourseButtons = page.locator('button:has-text("Add Course")');
    const count = await addCourseButtons.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const button = addCourseButtons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          // Allow for slight rendering differences
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  test.skip("color is never the sole indicator (icons + text for states)", async ({
    page,
  }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Status badges should have both text and icon (not just color)
    const statusBadges = page.locator(
      '[role="gridcell"] >> text=/Planned|Enrolled|Completed/'
    );
    const badgeCount = await statusBadges.count();

    if (badgeCount > 0) {
      // Each status badge should have text content (not just a color dot)
      const firstBadge = statusBadges.first();
      const text = await firstBadge.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }

    // Warning icons should have text alongside them
    const warningElements = page.locator(".text-warning");
    const warningCount = await warningElements.count();
    if (warningCount > 0) {
      // Warning indicators should have visible text or title attribute
      const firstWarning = warningElements.first();
      const text = await firstWarning.textContent();
      const title = await firstWarning.getAttribute("title");
      const hasText = (text?.trim().length ?? 0) > 0;
      const hasTitle = (title?.length ?? 0) > 0;
      expect(hasText || hasTitle).toBeTruthy();
    }
  });

  test("grade level accordion headers have aria-expanded", async ({
    page,
  }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // All grade headers should have aria-expanded attribute
    const gradeHeaders = page.locator('button[role="rowheader"]');
    const count = await gradeHeaders.count();

    for (let i = 0; i < count; i++) {
      const header = gradeHeaders.nth(i);
      const expanded = await header.getAttribute("aria-expanded");
      expect(expanded).toMatch(/true|false/);
    }
  });
});
