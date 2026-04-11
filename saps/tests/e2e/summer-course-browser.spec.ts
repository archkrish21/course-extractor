import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────
// Use the canonical login() from helpers.ts — the previous local copy had a
// narrow waitForURL regex (missing /consent and /onboarding) that hung when
// the seeded student briefly redirected through those routes after login.

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

  // The desktop filter sidebar is `hidden lg:block` (≥1024px). On viewports
  // smaller than that (e.g. iPhone 13 at 390px) the filter UI lives in a
  // slide-over drawer that opens via the "Open filters" button. Open it so
  // tests can interact with the filter radios uniformly across viewports.
  const vp = page.viewportSize();
  const isMobile = vp ? vp.width < 1024 : false;
  if (isMobile) {
    const openFiltersBtn = page.locator('button[aria-label="Open filters"]');
    if ((await openFiltersBtn.count()) > 0 && (await openFiltersBtn.isVisible())) {
      await openFiltersBtn.click();
      // Wait for the drawer to mount
      await expect(
        page.locator('[role="dialog"][aria-label="Course filters"]')
      ).toBeVisible({ timeout: 5_000 });
    }
  }
}

/**
 * Returns the visible "☀ Summer" filter radio. The page renders the filter UI
 * twice — once in the desktop sidebar (`hidden lg:block`) and once in the
 * mobile drawer — so a naked locator can match both elements. This filters to
 * the one currently rendered for the active viewport.
 */
function summerFilterButton(page: Page) {
  return page
    .locator('button[role="radio"]:has-text("☀ Summer")')
    .filter({ visible: true })
    .first();
}

/**
 * On mobile, navigateToCourses leaves the filter drawer open so tests can
 * interact with filter radios. Once filters are set (or if a test only needs
 * to click a course card), the drawer must be dismissed — otherwise its
 * backdrop intercepts pointer events and card clicks time out.
 */
async function closeMobileFilterDrawer(page: Page) {
  const drawer = page.locator('[role="dialog"][aria-label="Course filters"]');
  if ((await drawer.count()) === 0) return;
  if (!(await drawer.isVisible())) return;
  // The drawer's "Done" / "Apply" button closes it; fall back to Escape if
  // neither button label exists.
  const doneBtn = drawer.getByRole("button", { name: /^(Done|Apply|Close)$/i }).first();
  if ((await doneBtn.count()) > 0 && (await doneBtn.isVisible())) {
    await doneBtn.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(drawer).toBeHidden({ timeout: 5_000 });
}

// ─── E108: Summer Filter in Course Browser ──────────────────────────────────

test.describe("Course Browser — Summer Filter", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCourses(page);
  });

  test("E108: summer filter button exists in Semester Offered", async ({ page }) => {
    // The "☀ Summer" radio button should be visible
    const summerBtn = summerFilterButton(page);
    await expect(summerBtn).toBeVisible();
    await expect(summerBtn).toHaveAttribute("aria-checked", "false");
  });

  test("E108: clicking summer filter shows only summer courses", async ({ page }) => {
    const summerBtn = summerFilterButton(page);
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
    const summerBtn = summerFilterButton(page);
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
    const summerBtn = summerFilterButton(page);
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
    // Search for a known summer course code instead of relying on the
    // filter chip — the previous version filtered to summer courses and
    // clicked the first card, but the filter could race with page render
    // and pick a non-summer card whose modal then shows no Summer badge.
    // SOC13S is a seeded summer course (see tests/e2e/global-setup.ts).
    const searchInput = page.locator("#course-search");
    await searchInput.fill("SOC13S");
    await page.waitForTimeout(2_000);
    await waitForCoursesLoaded(page);

    if (await page.locator("text=No courses found").isVisible()) {
      test.skip(true, "Summer course SOC13S not in catalog");
      return;
    }

    // On mobile, the filter drawer left open by navigateToCourses intercepts
    // pointer events on the underlying course card. Dismiss it before clicking.
    await closeMobileFilterDrawer(page);

    // Click the first matching course card
    const courseList = page.getByRole("list", { name: "Course results" });
    const firstCard = courseList.getByRole("listitem").first().getByRole("button");
    await expect(firstCard).toContainText("SOC13S", { timeout: 5_000 });
    await firstCard.click();

    // Wait for modal
    const modal = page.locator('[role="dialog"][aria-modal="true"]').last();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Modal header should contain "Summer" badge
    await expect(modal.locator("text=Summer").first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── E97–E98: "Also Available As" Equivalents ──────────────────────────────

test.describe("Course Browser — Summer Equivalents", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCourses(page);
  });

  test("E97: summer course detail shows regular equivalent in linked courses", async ({ page }) => {
    // Filter to summer and search for SOC13S
    const summerBtn = summerFilterButton(page);
    await summerBtn.click();
    await waitForCoursesLoaded(page);

    const searchInput = page.locator("#course-search");
    await searchInput.fill("SOC13S");
    // Wait for debounce + API response
    await page.waitForTimeout(2_000);
    await waitForCoursesLoaded(page);

    // Dismiss the mobile filter drawer (left open by navigateToCourses) so
    // its backdrop doesn't intercept the upcoming card click.
    await closeMobileFilterDrawer(page);

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

    // Dismiss the mobile filter drawer (left open by navigateToCourses) so
    // its backdrop doesn't intercept the upcoming card click.
    await closeMobileFilterDrawer(page);

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
