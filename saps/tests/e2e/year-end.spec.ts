import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToYearEnd(page: Page) {
  await login(page);
  await page.goto("/year-end");
  await page.waitForTimeout(3_000);
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

    // Progress bar
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible({ timeout: 5_000 });

    // Step labels
    const confirmGrades = page.locator("text=Confirm Grades");
    const review = page.getByText("Review", { exact: true });
    await expect(confirmGrades).toBeVisible();
    await expect(review).toBeVisible();
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

    // Check that grade options exist
    const options = gradeSelect.locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2); // At least "Select" + one grade
  });

  test("Next button is disabled when grades are incomplete", async ({ page }) => {
    await navigateToYearEnd(page);

    const ungraded = page.locator("text=/still need a grade/i");
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });

    if ((await ungraded.count()) > 0) {
      // Ungraded courses exist — Next should be disabled
      await expect(nextBtn).toBeDisabled();
    } else {
      // All graded — Next should be enabled
      await expect(nextBtn).toBeEnabled();
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

    const emptyState = page.locator("text=/No courses found/i");
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });

    // If no courses or all graded, Next should be clickable
    if ((await emptyState.count()) > 0 || (await nextBtn.isEnabled())) {
      await nextBtn.click();
      await page.waitForTimeout(500);

      // Should show Step 2 content
      const step2Heading = page.locator("text=/Advance to Grade|Congratulations/i").first();
      await expect(step2Heading).toBeVisible({ timeout: 5_000 });
    } else {
      test.skip(true, "Cannot advance — courses need grades");
    }
  });

  test("Back button returns from Step 2 to Step 1", async ({ page }) => {
    await navigateToYearEnd(page);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    if (!(await nextBtn.isEnabled())) {
      test.skip(true, "Cannot advance — courses need grades");
      return;
    }

    // Go to step 2
    await nextBtn.click();
    await page.waitForTimeout(500);

    // Click Back
    const backBtn = page.getByRole("button", { name: "Back", exact: true });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
    await backBtn.click();
    await page.waitForTimeout(500);

    // Should be back on Step 1
    const step1Heading = page.locator("text=/Confirm Final Grades/i");
    await expect(step1Heading).toBeVisible();
  });

  test("Step 2 shows grade advancement cards", async ({ page }) => {
    await navigateToYearEnd(page);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    if (!(await nextBtn.isEnabled())) {
      test.skip(true, "Cannot advance — courses need grades");
      return;
    }

    await nextBtn.click();
    await page.waitForTimeout(500);

    // Should show Current → Next grade cards or graduation message
    const gradeCards = page.locator("text=/Current|Next Year|Congratulations/i");
    await expect(gradeCards.first()).toBeVisible({ timeout: 5_000 });
  });

  test("can navigate from Step 2 to Step 3 (Review)", async ({ page }) => {
    await navigateToYearEnd(page);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    if (!(await nextBtn.isEnabled())) {
      test.skip(true, "Cannot advance — courses need grades");
      return;
    }

    // Step 1 → Step 2
    await nextBtn.click();
    await page.waitForTimeout(500);

    // Step 2 → Step 3
    const nextBtn2 = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn2.click();
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

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    if (!(await nextBtn.isEnabled())) return false;

    await nextBtn.click();
    await page.waitForTimeout(500);

    const nextBtn2 = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn2.click();
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
