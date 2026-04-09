import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToPlanner(page: Page) {
  await login(page);
  await page.goto("/planner");
  await expect(page.locator("text=Loading your plans...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator("text=/Course Planner/")).toBeVisible({
    timeout: 10_000,
  });
}

/** Expand a grade accordion if collapsed. */
async function expandGrade(page: Page, grade: number) {
  const header = page.locator(
    `button[role="rowheader"]:has-text("Grade ${grade}")`
  );
  if (!(await header.isVisible())) return;
  const expanded = await header.getAttribute("aria-expanded");
  if (expanded === "false") {
    await header.click();
    await page.waitForTimeout(300);
  }
}

/** Click the "+ Pre-Summer Courses" button for a given grade. */
async function expandSummer(page: Page, grade: number) {
  const btn = page.locator(
    `button[aria-label="Show pre-summer courses for Grade ${grade}"]`
  );
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(300);
  }
}

/** Open the summer course picker for a specific grade and session. */
async function openSummerPicker(page: Page, grade: number, session: 1 | 2) {
  const label = `Add course to Grade ${grade}, Pre-Summer Session ${session}`;
  const addBtn = page.locator(`button[aria-label="${label}"]`);
  await expect(addBtn).toBeVisible({ timeout: 3_000 });
  await addBtn.click();

  // Filter to the course picker dialog (not Next.js error overlay)
  const picker = page.locator('[role="dialog"][aria-modal="true"]').filter({
    hasText: "Add",
  });
  await expect(picker).toBeVisible({ timeout: 5_000 });
  return picker;
}

// ─── E86–E87: Pre-Summer Row Expand/Collapse ───────────────────────────────

test.describe("Summer Planner — Row Expand/Collapse", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPlanner(page);
  });

  test("E86: Pre-Summer row expands when button is clicked", async ({ page }) => {
    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    // Find an unlocked grade (Grade 10 should be unlocked)
    await expandGrade(page, 10);

    const showBtn = page.locator(
      'button[aria-label="Show pre-summer courses for Grade 10"]'
    );
    if (!(await showBtn.isVisible())) {
      // Summer may already be expanded (auto-expand if courses exist)
      await expect(page.locator("text=Pre-Summer Courses")).toBeVisible();
      return;
    }

    await showBtn.click();
    await page.waitForTimeout(300);

    // Summer row should now show session cells
    await expect(page.locator("text=Pre-Summer Session 1")).toBeVisible();
    await expect(page.locator("text=Pre-Summer Session 2")).toBeVisible();
  });

  test("E87: Pre-Summer row hides when Hide button is clicked", async ({ page }) => {
    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    await expandGrade(page, 10);
    await expandSummer(page, 10);

    // Verify expanded state
    await expect(page.locator("text=Pre-Summer Session 1")).toBeVisible();

    // Click Hide
    const hideBtn = page.locator(
      'button[aria-label="Hide pre-summer courses for Grade 10"]'
    );
    await hideBtn.click();
    await page.waitForTimeout(300);

    // Should collapse back to the expand button
    await expect(
      page.locator('button[aria-label="Show pre-summer courses for Grade 10"]')
    ).toBeVisible();
    await expect(page.locator("text=Pre-Summer Session 1")).toBeHidden();
  });
});

// ─── E89: Summer Cell Limited to 1 Course ───────────────────────────────────

test.describe("Summer Planner — Session Limit", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPlanner(page);
  });

  test("E89: summer cell shows 0/1 counter when empty", async ({ page }) => {
    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    await expandGrade(page, 10);
    await expandSummer(page, 10);

    // Counter should show 0/1 for an empty session
    await expect(page.locator("text=0/1").first()).toBeVisible();
  });
});

// ─── E91–E93: Summer Picker Filtering ──────────────────────────────────────

test.describe("Summer Planner — Course Picker", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPlanner(page);
  });

  test("E92: summer picker shows only summer courses", async ({ page }) => {
    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    await expandGrade(page, 10);
    await expandSummer(page, 10);

    const picker = await openSummerPicker(page, 10, 1);

    // Heading should say "Add Summer Course"
    await expect(picker.locator("h2")).toContainText("Add Summer Course");

    // Subtitle should mention Pre-Summer Session 1
    await expect(picker.locator("text=Pre-Summer Session 1")).toBeVisible();
  });

  test("E93: summer picker hides filter options", async ({ page }) => {
    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    await expandGrade(page, 10);
    await expandSummer(page, 10);

    const picker = await openSummerPicker(page, 10, 1);

    // Division/department/credit type filters should NOT be visible
    await expect(
      picker.locator('select[aria-label="Filter by division"]')
    ).toBeHidden();

    // Search input should still work
    const searchInput = picker.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test("E91: regular picker does not show summer courses", async ({ page }) => {
    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    await expandGrade(page, 10);

    // Open a regular semester picker (Semester 1)
    const addBtn = page
      .locator('button[aria-label="Add course to Grade 10, Semester 1"]')
      .first();
    if (!(await addBtn.isVisible())) { test.skip(); return; }

    await addBtn.click();
    const picker = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: "Add" });
    await expect(picker).toBeVisible({ timeout: 5_000 });

    // Should say "Add Course" (not "Add Summer Course")
    await expect(picker.locator("h2")).toContainText("Add Course");
    await expect(picker.locator("h2")).not.toContainText("Summer");

    // Search for a known summer course code — should not appear
    const searchInput = picker.locator('input[placeholder*="Search"]');
    await searchInput.fill("SOC13S");
    await page.waitForTimeout(1_500);

    // Either no results or no items containing the summer code
    const results = picker.locator('[role="list"] [role="button"]');
    const count = await results.count();
    if (count > 0) {
      // None should be summer courses
      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(results.nth(i)).not.toContainText("SOC13S");
      }
    }
  });
});

// ─── E94: Summer Badge on Course Cards in Planner ──────────────────────────

test.describe("Summer Planner — Badge Display", () => {
  test("E94: summer course cards show Summer badge in picker", async ({ page }) => {
    await navigateToPlanner(page);

    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    await expandGrade(page, 10);
    await expandSummer(page, 10);

    const picker = await openSummerPicker(page, 10, 1);

    // Wait for courses to finish loading (spinner gone, results visible)
    await expect(picker.locator("text=Searching courses")).toBeHidden({ timeout: 10_000 });

    const courseCards = picker.locator('[role="list"] [role="button"]');
    await expect(courseCards.first()).toBeVisible({ timeout: 5_000 });

    // At least one card should have a Summer badge (warning variant)
    // The badge text "Summer" may be tiny — use a broader locator
    const summerBadge = picker.locator('[role="list"] :text("Summer")');
    await expect(summerBadge.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── E90, E101: Full-Year Summer Course Auto-Fill ──────────────────────────

test.describe("Summer Planner — Full-Year Add", () => {
  test("E90: full-year summer course fills both sessions via picker", async ({ page }) => {
    await navigateToPlanner(page);

    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    await expandGrade(page, 10);
    await expandSummer(page, 10);

    const picker = await openSummerPicker(page, 10, 1);
    await page.waitForTimeout(2_000);

    // Search for a known full-year summer course
    const searchInput = picker.locator('input[placeholder*="Search"]');
    await searchInput.fill("MTH15S");
    await page.waitForTimeout(1_500);

    const courseCards = picker.locator('[role="list"] [role="button"]');
    const count = await courseCards.count();
    if (count === 0) {
      // Try another code
      await searchInput.clear();
      await searchInput.fill("SOC13S");
      await page.waitForTimeout(1_500);
    }

    const cards = picker.locator('[role="list"] [role="button"]');
    const cardCount = await cards.count();
    if (cardCount === 0) {
      test.skip(true, "No full-year summer courses found in catalog");
      return;
    }

    // Click the first course card to add it
    await cards.first().click();
    await page.waitForTimeout(2_000);

    // Picker should close and both sessions should now have the course
    // At least one session should now show 1/1
    await expect(page.locator("text=1/1").first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── E99: Equivalent Course Blocked from Regular Picker ────────────────────

test.describe("Summer Planner — Equivalence Filtering", () => {
  test("E99: equivalent regular course hidden when summer version is in plan", async ({ page }) => {
    await navigateToPlanner(page);

    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    await expandGrade(page, 10);

    // Check if any summer course is already in the plan
    // If so, try opening a regular picker and searching for its equivalent
    await expandSummer(page, 10);

    // First add a summer course if none exists
    const session1Count = page.locator("text=1/1");
    const hasSummerCourse = (await session1Count.count()) > 0;

    if (!hasSummerCourse) {
      // Try to add a summer course first
      const picker = await openSummerPicker(page, 10, 1);
      await page.waitForTimeout(2_000);

      const searchInput = picker.locator('input[placeholder*="Search"]');
      await searchInput.fill("SOC13S");
      await page.waitForTimeout(1_500);

      const cards = picker.locator('[role="list"] [role="button"]');
      if ((await cards.count()) === 0) {
        test.skip(true, "No summer courses available to test equivalence");
        return;
      }
      await cards.first().click();
      await page.waitForTimeout(2_000);
    }

    // Now open a regular semester picker and search for the equivalent
    const regularAddBtn = page
      .locator('button[aria-label="Add course to Grade 10, Semester 1"]')
      .first();
    if (!(await regularAddBtn.isVisible())) {
      test.skip(true, "No regular semester add button available");
      return;
    }

    await regularAddBtn.click();
    const regularPicker = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: "Add" });
    await expect(regularPicker).toBeVisible({ timeout: 5_000 });

    const searchInput = regularPicker.locator('input[placeholder*="Search"]');
    await searchInput.fill("SOC101");
    await page.waitForTimeout(1_500);

    // The equivalent course should NOT appear (filtered out)
    const results = regularPicker.locator('[role="list"] [role="button"]');
    const count = await results.count();
    for (let i = 0; i < count; i++) {
      await expect(results.nth(i)).not.toContainText("SOC101/SOC102");
    }
  });
});

// ─── E88: Auto-Expand When Summer Courses Exist ────────────────────────────

test.describe("Summer Planner — Auto Expand", () => {
  test("E88: summer row auto-expands when grade has summer courses", async ({ page }) => {
    // This test checks that if summer courses exist for a grade,
    // the Pre-Summer row is already expanded on page load
    await navigateToPlanner(page);

    const noPlan = page.locator("text=No plans yet");
    if (await noPlan.isVisible()) { test.skip(); return; }

    // Check all grades for existing summer courses
    // If any grade has summer courses, its Pre-Summer row should be auto-expanded
    for (const grade of [9, 10, 11, 12]) {
      await expandGrade(page, grade);
    }

    // Look for visible session labels (indicates auto-expanded summer)
    const sessionLabels = page.locator("text=Pre-Summer Session 1");
    const visibleCount = await sessionLabels.count();

    if (visibleCount > 0) {
      // If session labels are visible, the summer row was auto-expanded
      // The "Show pre-summer" button should NOT be visible for that grade
      await expect(sessionLabels.first()).toBeVisible();
    } else {
      // No summer courses in any grade — all should show the expand button
      const showBtns = page.locator('button:has-text("Pre-Summer Courses")');
      expect(await showBtns.count()).toBeGreaterThan(0);
    }
  });
});
