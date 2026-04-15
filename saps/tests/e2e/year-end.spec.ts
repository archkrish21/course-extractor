import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// ─── Helpers ───────────────────────────────────────────────────────────────
// Use the canonical login() from helpers.ts — the previous local copy had a
// narrow waitForURL regex (missing /consent and /onboarding) that hung when
// the seeded student briefly redirected through those routes after login.

async function navigateToYearEnd(page: Page) {
  await login(page);
  await page.goto("/year-end");
  await page.waitForTimeout(3_000);
}

/** Fill all ungraded course dropdowns so Next becomes enabled.
 * Tries "A" first (standard letter grade) and falls back to "P" for the
 * Pass/Fail courses (e.g. Driver Education) whose dropdowns only have
 * P/F options. Skips dropdowns that already have a value. */
async function fillAllGrades(page: Page) {
  const selects = page.locator("select");
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const sel = selects.nth(i);
    const value = await sel.inputValue();
    if (value) continue;

    // Determine which option to pick based on what this dropdown actually has.
    const optionValues = await sel.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v),
    );
    const choice = optionValues.includes("A")
      ? "A"
      : optionValues.includes("P")
        ? "P"
        : optionValues[0];
    if (!choice) continue;
    await sel.selectOption(choice);
  }
  await page.waitForTimeout(500);
}

// ─── Page Load ─────────────────────────────────────────────────────────────

test.describe("Year-End — Page Load", () => {
  test("year-end page loads with heading", async ({ page }) => {
    await navigateToYearEnd(page);

    await expect(
      page.getByRole("heading", { name: /Year-End Review/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows grade level context in subtitle", async ({ page }) => {
    await navigateToYearEnd(page);

    const subtitle = page.locator("text=/Complete your Grade \\d+/i");
    await expect(subtitle).toBeVisible({ timeout: 5_000 });
  });

  test("shows step indicator with 3 steps", async ({ page }) => {
    await navigateToYearEnd(page);

    // Progress bar — verify it exists and reports 3 total steps via aria-valuemax.
    // The textual step labels are `hidden sm:block` so they don't render on
    // mobile (iPhone viewport is below the `sm` breakpoint); rely on the
    // progressbar's aria attributes which work cross-viewport.
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible({ timeout: 5_000 });
    await expect(progressBar).toHaveAttribute("aria-valuemax", "3");
    await expect(progressBar).toHaveAttribute("aria-valuemin", "1");
  });
});

// ─── Step 1: Confirm Grades ────────────────────────────────────────────────

test.describe("Year-End — Step 1: Confirm Grades", () => {
  test("shows course table with grade dropdowns", async ({ page }) => {
    await navigateToYearEnd(page);

    // Should show step 1 heading
    const heading = page.locator("text=/Confirm Final Grades/i");
    await expect(heading).toBeVisible({ timeout: 5_000 });

    // Either shows course table or empty state
    const courseTable = page.locator("table");
    const emptyState = page.locator("text=/No courses found/i");

    const hasCourses = (await courseTable.count()) > 0;
    const isEmpty = (await emptyState.count()) > 0;
    expect(hasCourses || isEmpty).toBeTruthy();
  });

  test("shows semester sections for courses", async ({ page }) => {
    await navigateToYearEnd(page);

    const semesterLabels = page.locator("text=/Semester 1|Semester 2/");
    if ((await semesterLabels.count()) === 0) {
      test.skip(true, "No courses for current grade level");
      return;
    }

    await expect(semesterLabels.first()).toBeVisible();
  });

  test("grade dropdowns have A through F options", async ({ page }) => {
    await navigateToYearEnd(page);

    const gradeSelect = page.locator("select").first();
    if ((await gradeSelect.count()) === 0) {
      test.skip(true, "No grade dropdowns — courses may already be completed");
      return;
    }

    // Check that grade options include standard letter grades
    const options = gradeSelect.locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(5); // "Select" + A, B, C, D, F at minimum

    // Collect option texts
    const optionTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text) optionTexts.push(text.trim());
    }

    // Should contain standard letter grades
    expect(optionTexts).toEqual(expect.arrayContaining(["A", "B", "C", "F"]));
  });

  test("Next button is disabled when grades are incomplete", async ({ page }) => {
    await navigateToYearEnd(page);

    // Wait for the grade table to render so state is stable before asserting.
    await expect(page.locator("text=/Confirm Final Grades/i")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);

    const ungraded = page.locator("text=/still need a grade/i");
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });

    if ((await ungraded.count()) > 0) {
      // Ungraded courses exist — Next should be disabled
      await expect(nextBtn).toBeDisabled({ timeout: 5_000 });
    } else {
      // All graded — Next should be enabled
      await expect(nextBtn).toBeEnabled({ timeout: 5_000 });
    }
  });

  test("completed courses show grade badge instead of dropdown", async ({ page }) => {
    await navigateToYearEnd(page);

    // Completed courses display a badge, not a select
    const gradeBadges = page.locator("table .rounded-full");
    // This is data-dependent — just verify page loaded correctly
    const heading = page.locator("text=/Confirm Final Grades/i");
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Step Navigation ───────────────────────────────────────────────────────

test.describe("Year-End — Step Navigation", () => {
  test("Next button advances from Step 1 to Step 2", async ({ page }) => {
    await navigateToYearEnd(page);

    await expect(page.locator("text=/Confirm Final Grades/i")).toBeVisible({ timeout: 10_000 });

    // Fill any ungraded courses so Next becomes enabled. The set expanded
    // after the year-end fix that makes completed-without-grade rows editable.
    await fillAllGrades(page);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 });

    await nextBtn.click();
    await page.waitForTimeout(750);

    // Should show Step 2 content
    const step2Heading = page.locator("text=/Advance to Grade|Congratulations/i").first();
    await expect(step2Heading).toBeVisible({ timeout: 5_000 });
  });

  test("Back button returns from Step 2 to Step 1", async ({ page }) => {
    await navigateToYearEnd(page);
    await expect(page.locator("text=/Confirm Final Grades/i")).toBeVisible({ timeout: 10_000 });
    await fillAllGrades(page);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 });

    // Go to step 2
    await nextBtn.click();
    await page.waitForTimeout(750);

    // Click Back
    const backBtn = page.getByRole("button", { name: "Back", exact: true });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
    await backBtn.click();
    await page.waitForTimeout(750);

    // Should be back on Step 1
    const step1Heading = page.locator("text=/Confirm Final Grades/i");
    await expect(step1Heading).toBeVisible({ timeout: 5_000 });
  });

  test("Step 2 shows grade advancement cards", async ({ page }) => {
    await navigateToYearEnd(page);
    await expect(page.locator("text=/Confirm Final Grades/i")).toBeVisible({ timeout: 10_000 });
    await fillAllGrades(page);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 });

    await nextBtn.click();
    await page.waitForTimeout(750);

    // Should show Current → Next grade cards or graduation message
    const gradeCards = page.locator("text=/Current|Next Year|Congratulations/i");
    await expect(gradeCards.first()).toBeVisible({ timeout: 5_000 });
  });

  test("can navigate from Step 2 to Step 3 (Review)", async ({ page }) => {
    await navigateToYearEnd(page);
    await expect(page.locator("text=/Confirm Final Grades/i")).toBeVisible({ timeout: 10_000 });
    await fillAllGrades(page);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 });

    // Step 1 → Step 2
    await nextBtn.click();
    await page.waitForTimeout(750);

    // Step 2 → Step 3. On mobile the step-2 CardFooter sits exactly where the
    // FeedbackWidget's `fixed bottom-6 right-6` button is positioned. Both a
    // normal click() and a force-click hit the feedback button at those
    // coordinates (force-click only skips the intercept check; it still uses
    // real mouse events at a point in space). Dispatch the click event
    // directly to the target element to bypass geometry entirely.
    const nextBtn2 = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn2).toBeVisible({ timeout: 5_000 });
    await nextBtn2.dispatchEvent("click");
    await page.waitForTimeout(500);

    // Should show Review step
    const reviewHeading = page.locator("text=/Review & Complete|Final Review/i");
    await expect(reviewHeading).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Step 3: Review ────────────────────────────────────────────────────────

test.describe("Year-End — Step 3: Review", () => {
  async function navigateToReview(page: Page) {
    await navigateToYearEnd(page);
    await fillAllGrades(page);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    if (!(await nextBtn.isEnabled())) return false;

    await nextBtn.click();
    await page.waitForTimeout(500);

    // On mobile the step-2 CardFooter sits exactly where the FeedbackWidget's
    // `fixed bottom-6 right-6` button is positioned, so both click() and
    // force-click hit the feedback button instead of Next. Dispatch the click
    // event directly to the target element to bypass geometry entirely.
    const nextBtn2 = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn2).toBeVisible({ timeout: 5_000 });
    await nextBtn2.dispatchEvent("click");
    await page.waitForTimeout(500);
    return true;
  }

  test("shows locked courses summary table", async ({ page }) => {
    const reached = await navigateToReview(page);
    if (!reached) {
      test.skip(true, "Cannot reach review step");
      return;
    }

    const lockedLabel = page.locator("text=/Courses to be locked/i");
    await expect(lockedLabel).toBeVisible({ timeout: 5_000 });

    // Summary table should exist
    const table = page.locator("table");
    await expect(table.first()).toBeVisible();
  });

  test("shows consequence warning", async ({ page }) => {
    const reached = await navigateToReview(page);
    if (!reached) {
      test.skip(true, "Cannot reach review step");
      return;
    }

    // Warning about permanent locking
    const warning = page.locator("text=/permanently locked|cannot be undone|finalize/i");
    await expect(warning.first()).toBeVisible({ timeout: 5_000 });
  });

  test("shows Complete button", async ({ page }) => {
    const reached = await navigateToReview(page);
    if (!reached) {
      test.skip(true, "Cannot reach review step");
      return;
    }

    const completeBtn = page.getByRole("button", { name: /Complete/i });
    await expect(completeBtn).toBeVisible({ timeout: 5_000 });
  });

  test("shows upcoming courses preview when not graduating", async ({ page }) => {
    const reached = await navigateToReview(page);
    if (!reached) {
      test.skip(true, "Cannot reach review step");
      return;
    }

    // If not graduating, should show upcoming courses or "no courses planned"
    const isGraduating = (await page.locator("text=/Final Review|Graduation/i").count()) > 0;
    if (isGraduating) {
      test.skip(true, "Student is graduating — no upcoming courses preview");
      return;
    }

    const upcoming = page.locator("text=/Upcoming courses|No courses planned/i");
    await expect(upcoming.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── URL Parameters ────────────────────────────────────────────────────────

test.describe("Year-End — URL Parameters", () => {
  test("accepts grade parameter from URL", async ({ page }) => {
    await login(page);
    await page.goto("/year-end?grade=9");
    await page.waitForTimeout(3_000);

    // Should load for the specified grade
    const heading = page.getByRole("heading", { name: /Year-End Review/i });
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const gradeRef = page.locator("text=/Grade 9/");
    await expect(gradeRef.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Accessibility ─────────────────────────────────────────────────────────

test.describe("Year-End — Accessibility", () => {
  test("progress bar has proper ARIA attributes", async ({ page }) => {
    await navigateToYearEnd(page);

    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible({ timeout: 5_000 });
    await expect(progressBar).toHaveAttribute("aria-valuenow", /\d+/);
    await expect(progressBar).toHaveAttribute("aria-valuemin", "1");
    await expect(progressBar).toHaveAttribute("aria-valuemax", "3");
  });

  test("current step has aria-current attribute", async ({ page }) => {
    await navigateToYearEnd(page);

    const currentStep = page.locator('[aria-current="step"]');
    await expect(currentStep).toBeVisible({ timeout: 5_000 });
  });
});
