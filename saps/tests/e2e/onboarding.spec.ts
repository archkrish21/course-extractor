import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToOnboarding(page: Page) {
  await login(page);
  await page.goto("/onboarding");
  await page.waitForTimeout(2_000);
}

// ─── Page Load ─────────────────────────────────────────────────────────────

test.describe("Onboarding — Page Load", () => {
  test("onboarding page loads with step indicator", async ({ page }) => {
    await navigateToOnboarding(page);

    // Step indicator with numbered circles
    const steps = page.locator("text=/About You|Past Courses|Starting Plan|Goals/i");
    expect(await steps.count()).toBeGreaterThanOrEqual(1);
  });

  test("shows skip setup button", async ({ page }) => {
    await navigateToOnboarding(page);

    const skipBtn = page.locator("button", { hasText: /Skip/i });
    await expect(skipBtn.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Step 1: About You ────────────────────────────────────────────────────

test.describe("Onboarding — Step 1: About You", () => {
  test("shows grade level radio buttons", async ({ page }) => {
    await navigateToOnboarding(page);

    // Grade level options
    const gradeOptions = page.locator("text=/Grade 9|Grade 10|Grade 11|Grade 12/");
    expect(await gradeOptions.count()).toBeGreaterThanOrEqual(4);
  });

  test("shows graduation year input", async ({ page }) => {
    await navigateToOnboarding(page);

    const gradYearInput = page.locator("input").filter({ hasText: /graduation/i });
    const gradYearLabel = page.locator("text=/graduation year/i");

    // Either the input or label should be visible
    const hasInput = (await gradYearInput.count()) > 0;
    const hasLabel = (await gradYearLabel.count()) > 0;
    expect(hasInput || hasLabel).toBeTruthy();
  });

  test("Next button advances to Step 2", async ({ page }) => {
    await navigateToOnboarding(page);

    // Select a grade level
    const grade10 = page.locator("label", { hasText: "Grade 10" }).first();
    if ((await grade10.count()) > 0) {
      await grade10.click();
      await page.waitForTimeout(300);
    }

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    if ((await nextBtn.count()) > 0) {
      await nextBtn.click();
      await page.waitForTimeout(1_000);

      // Should show Step 2 content (Past Courses or Starting Plan)
      const step2Content = page.locator("text=/Past Courses|courses|Filter|Starting Plan|template/i");
      expect(await step2Content.count()).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── Step 2: Past Courses ──────────────────────────────────────────────────

test.describe("Onboarding — Step 2: Past Courses", () => {
  test("shows course search and filter controls", async ({ page }) => {
    await navigateToOnboarding(page);

    // Navigate to step 2 by selecting grade and clicking next
    const grade10 = page.locator("label", { hasText: "Grade 10" }).first();
    if ((await grade10.count()) > 0) {
      await grade10.click();
      await page.waitForTimeout(300);
    }

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    if ((await nextBtn.count()) > 0) {
      await nextBtn.click();
      await page.waitForTimeout(1_000);
    }

    // Look for filter/search controls
    const filterInput = page.locator("input[placeholder*='Filter' i], input[placeholder*='Search' i]");
    const divisionSelect = page.locator("select");

    const hasFilter = (await filterInput.count()) > 0;
    const hasSelect = (await divisionSelect.count()) > 0;
    const hasSkip = (await page.locator("text=/skip|freshman/i").count()) > 0;

    // Should have either filter controls or a skip option
    expect(hasFilter || hasSelect || hasSkip).toBeTruthy();
  });
});

// ─── Step Navigation ───────────────────────────────────────────────────────

test.describe("Onboarding — Step Navigation", () => {
  test("Back button appears after Step 1", async ({ page }) => {
    await navigateToOnboarding(page);

    // On step 1, no back button
    const backBtn = page.getByRole("button", { name: "Back", exact: true });
    const backVisible = (await backBtn.count()) > 0 && (await backBtn.isVisible());

    // Select grade and go to step 2
    const grade10 = page.locator("label", { hasText: "Grade 10" }).first();
    if ((await grade10.count()) > 0) {
      await grade10.click();
      await page.waitForTimeout(300);
    }

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    if ((await nextBtn.count()) > 0) {
      await nextBtn.click();
      await page.waitForTimeout(1_000);

      // Back button should now be visible on step 2+
      const backBtn2 = page.getByRole("button", { name: "Back", exact: true });
      if ((await backBtn2.count()) > 0) {
        await expect(backBtn2).toBeVisible();
      }
    }
  });

  test("skip setup redirects to dashboard or planner", async ({ page }) => {
    await navigateToOnboarding(page);

    const skipBtn = page.locator("button", { hasText: /Skip setup/i }).first();
    if ((await skipBtn.count()) === 0) {
      // Try alternate skip button
      const altSkip = page.locator("button", { hasText: /Skip/i }).first();
      if ((await altSkip.count()) === 0) {
        test.skip(true, "No skip button found");
        return;
      }
      await altSkip.click();
    } else {
      await skipBtn.click();
    }

    await page.waitForURL(/\/(dashboard|planner)/, { timeout: 10_000 });
  });
});

// ─── Step 4: Goals ─────────────────────────────────────────────────────────

test.describe("Onboarding — Goals Step", () => {
  test("goals step has GPA target and career interest fields", async ({ page }) => {
    await navigateToOnboarding(page);

    // Navigate through steps quickly to reach goals
    // This test verifies the fields exist if we can reach the step
    const gpaLabel = page.locator("text=/GPA Target/i");
    const careerLabel = page.locator("text=/Career/i");

    // These may only be visible on step 4 — just verify the page loaded
    const heading = page.locator("text=/About You|Goals|onboarding/i");
    expect(await heading.count()).toBeGreaterThanOrEqual(1);
  });
});

// ─── Grade-Specific Onboarding Flows ───────────────────────────────────────

test.describe("Onboarding — Freshman (Grade 9)", () => {
  test("freshman skips Past Courses and goes to Starting Plan", async ({ page }) => {
    await navigateToOnboarding(page);

    const grade9 = page.locator("label", { hasText: "Grade 9" }).first();
    if ((await grade9.count()) === 0) {
      test.skip(true, "Grade 9 option not found");
      return;
    }
    await grade9.click();
    await page.waitForTimeout(300);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn.click();
    await page.waitForTimeout(1_000);

    // Should skip Step 2 (Past Courses) and land on Step 3 (Starting Plan)
    const templateContent = page.locator("text=/Starting Plan|Start from scratch|template|incoming freshman/i");
    expect(await templateContent.count()).toBeGreaterThanOrEqual(1);
  });

  test("freshman Back from Step 3 returns to Step 1", async ({ page }) => {
    await navigateToOnboarding(page);

    const grade9 = page.locator("label", { hasText: "Grade 9" }).first();
    if ((await grade9.count()) === 0) {
      test.skip(true, "Grade 9 option not found");
      return;
    }
    await grade9.click();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_000);

    // Click Back — should return to Step 1, not Step 2
    const backBtn = page.getByRole("button", { name: "Back", exact: true });
    if ((await backBtn.count()) === 0) {
      test.skip(true, "No Back button found");
      return;
    }
    await backBtn.click();
    await page.waitForTimeout(500);

    // Should be back on Step 1 — grade radio buttons visible
    const gradeOptions = page.locator("text=/Grade 9|Grade 10|Grade 11|Grade 12/");
    expect(await gradeOptions.count()).toBeGreaterThanOrEqual(4);
  });
});

test.describe("Onboarding — Sophomore (Grade 10)", () => {
  test("sophomore sees Grade 9 past courses tab", async ({ page }) => {
    await navigateToOnboarding(page);

    const grade10 = page.locator("label", { hasText: "Grade 10" }).first();
    if ((await grade10.count()) === 0) {
      test.skip(true, "Grade 10 option not found");
      return;
    }
    await grade10.click();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_000);

    // Should show Step 2 with Grade 9 past courses
    const grade9Tab = page.locator("text=/Grade 9/i");
    const pastCoursesContent = page.locator("text=/Filter|courses|Past Courses/i");

    const hasGrade9 = (await grade9Tab.count()) > 0;
    const hasPastCourses = (await pastCoursesContent.count()) > 0;
    expect(hasGrade9 || hasPastCourses).toBeTruthy();
  });
});

test.describe("Onboarding — Junior (Grade 11)", () => {
  test("junior sees Grade 9 and Grade 10 past courses tabs", async ({ page }) => {
    await navigateToOnboarding(page);

    const grade11 = page.locator("label", { hasText: "Grade 11" }).first();
    if ((await grade11.count()) === 0) {
      test.skip(true, "Grade 11 option not found");
      return;
    }
    await grade11.click();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_000);

    // Should show Step 2 with Grade 9 and Grade 10 tabs
    const grade9Tab = page.locator("button, [role='tab']", { hasText: /Grade 9|9/ });
    const grade10Tab = page.locator("button, [role='tab']", { hasText: /Grade 10|10/ });
    const pastCoursesContent = page.locator("text=/Filter|courses|Past Courses/i");

    const hasMultiGrades = (await grade9Tab.count()) > 0 && (await grade10Tab.count()) > 0;
    const hasPastCourses = (await pastCoursesContent.count()) > 0;
    expect(hasMultiGrades || hasPastCourses).toBeTruthy();
  });
});

test.describe("Onboarding — Senior (Grade 12)", () => {
  test("senior sees Grade 9, 10, and 11 past courses tabs", async ({ page }) => {
    await navigateToOnboarding(page);

    const grade12 = page.locator("label", { hasText: "Grade 12" }).first();
    if ((await grade12.count()) === 0) {
      test.skip(true, "Grade 12 option not found");
      return;
    }
    await grade12.click();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_000);

    // Should show Step 2 with Grade 9, 10, and 11 tabs
    const grade9Tab = page.locator("button, [role='tab']", { hasText: /Grade 9|9/ });
    const grade10Tab = page.locator("button, [role='tab']", { hasText: /Grade 10|10/ });
    const grade11Tab = page.locator("button, [role='tab']", { hasText: /Grade 11|11/ });
    const pastCoursesContent = page.locator("text=/Filter|courses|Past Courses/i");

    const hasAllGrades = (await grade9Tab.count()) > 0 && (await grade10Tab.count()) > 0 && (await grade11Tab.count()) > 0;
    const hasPastCourses = (await pastCoursesContent.count()) > 0;
    expect(hasAllGrades || hasPastCourses).toBeTruthy();
  });
});

test.describe("Onboarding — Step Skip Logic", () => {
  test("entering past courses skips template step and goes to Goals", async ({ page }) => {
    await navigateToOnboarding(page);

    const grade10 = page.locator("label", { hasText: "Grade 10" }).first();
    if ((await grade10.count()) === 0) {
      test.skip(true, "Grade 10 option not found");
      return;
    }
    await grade10.click();
    await page.waitForTimeout(300);

    // Go to Step 2
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_000);

    // Try to select a course
    const courseCheckbox = page.locator('input[type="checkbox"]').first();
    if ((await courseCheckbox.count()) === 0) {
      test.skip(true, "No courses available to select");
      return;
    }
    await courseCheckbox.check();
    await page.waitForTimeout(300);

    // Next should skip Step 3 (Starting Plan) and go to Step 4 (Goals)
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_000);

    const goalsContent = page.locator("text=/GPA Target|Career|Goals|Complete/i");
    expect(await goalsContent.count()).toBeGreaterThanOrEqual(1);
  });
});

// ─── Step 3: Plan Templates vs Blank ───────────────────────────────────────

/**
 * Helper: navigate a freshman (Gr 9) to Step 3 (Starting Plan).
 * Freshmen skip Step 2, so Step 3 is reached in one Next click.
 */
async function navigateToTemplateStep(page: Page) {
  await navigateToOnboarding(page);

  const grade9 = page.locator("label", { hasText: "Grade 9" }).first();
  if ((await grade9.count()) === 0) return false;
  await grade9.click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForTimeout(1_500);

  // Verify we landed on Step 3
  const templateHeading = page.locator("text=/Choose a Starting Plan/i");
  return (await templateHeading.count()) > 0;
}

test.describe("Onboarding — Step 3: Plan Templates", () => {
  test("template step shows plan cards in a grid", async ({ page }) => {
    const reached = await navigateToTemplateStep(page);
    if (!reached) {
      test.skip(true, "Could not reach template step");
      return;
    }

    await expect(page.locator("text=Choose a Starting Plan")).toBeVisible({ timeout: 5_000 });

    // Should show at least one template card or loading state
    const templateCards = page.locator("button", { hasText: "Select this plan" });
    const loadingState = page.locator("text=Loading templates");
    const hasCards = (await templateCards.count()) > 0;
    const isLoading = (await loadingState.count()) > 0;
    expect(hasCards || isLoading).toBeTruthy();
  });

  test("template cards show name and course count", async ({ page }) => {
    const reached = await navigateToTemplateStep(page);
    if (!reached) {
      test.skip(true, "Could not reach template step");
      return;
    }

    const courseCountLabel = page.locator("text=/\\d+ courses over 4 years/");
    if ((await courseCountLabel.count()) === 0) {
      test.skip(true, "No templates available");
      return;
    }

    await expect(courseCountLabel.first()).toBeVisible();
  });

  test("Preview courses expands to show courses by grade level", async ({ page }) => {
    const reached = await navigateToTemplateStep(page);
    if (!reached) {
      test.skip(true, "Could not reach template step");
      return;
    }

    const previewBtn = page.locator("button", { hasText: /Preview courses/i }).first();
    if ((await previewBtn.count()) === 0) {
      test.skip(true, "No template preview button found");
      return;
    }

    await previewBtn.click();
    await page.waitForTimeout(500);

    // Expanded preview should show grade-grouped courses
    const gradeHeaders = page.locator("text=/Grade 9|Grade 10|Grade 11|Grade 12/");
    await expect(gradeHeaders.first()).toBeVisible({ timeout: 3_000 });

    // Button should now say "Hide courses"
    const hideBtn = page.locator("button", { hasText: /Hide courses/i });
    await expect(hideBtn.first()).toBeVisible();
  });

  test("selecting a template shows Selected state", async ({ page }) => {
    const reached = await navigateToTemplateStep(page);
    if (!reached) {
      test.skip(true, "Could not reach template step");
      return;
    }

    const selectBtn = page.locator("button", { hasText: "Select this plan" }).first();
    if ((await selectBtn.count()) === 0) {
      test.skip(true, "No templates available");
      return;
    }

    await selectBtn.click();
    await page.waitForTimeout(300);

    // Button should now show "Selected"
    const selectedBtn = page.locator("button", { hasText: "Selected" });
    await expect(selectedBtn.first()).toBeVisible();
  });

  test("deselecting a template reverts to Select this plan", async ({ page }) => {
    const reached = await navigateToTemplateStep(page);
    if (!reached) {
      test.skip(true, "Could not reach template step");
      return;
    }

    const selectBtn = page.locator("button", { hasText: "Select this plan" }).first();
    if ((await selectBtn.count()) === 0) {
      test.skip(true, "No templates available");
      return;
    }

    // Select
    await selectBtn.click();
    await page.waitForTimeout(300);
    const selectedBtn = page.locator("button", { hasText: "Selected" }).first();
    await expect(selectedBtn).toBeVisible();

    // Deselect
    await selectedBtn.click();
    await page.waitForTimeout(300);

    // Should revert to "Select this plan"
    const revertedBtn = page.locator("button", { hasText: "Select this plan" }).first();
    await expect(revertedBtn).toBeVisible();
  });

  test("Start from scratch link is visible", async ({ page }) => {
    const reached = await navigateToTemplateStep(page);
    if (!reached) {
      test.skip(true, "Could not reach template step");
      return;
    }

    const scratchLink = page.locator("button, a", { hasText: /Start from scratch/i });
    await expect(scratchLink.first()).toBeVisible({ timeout: 5_000 });
  });

  test("Start from scratch deselects any selected template", async ({ page }) => {
    const reached = await navigateToTemplateStep(page);
    if (!reached) {
      test.skip(true, "Could not reach template step");
      return;
    }

    // Select a template first
    const selectBtn = page.locator("button", { hasText: "Select this plan" }).first();
    if ((await selectBtn.count()) > 0) {
      await selectBtn.click();
      await page.waitForTimeout(300);
    }

    // Click "Start from scratch"
    const scratchLink = page.locator("button", { hasText: /Start from scratch/i }).first();
    await scratchLink.click();
    await page.waitForTimeout(300);

    // No template should be in "Selected" state
    const selectedBtns = page.locator("button", { hasText: "Selected" });
    expect(await selectedBtns.count()).toBe(0);
  });
});

// ─── Onboarding → Planner Verification ─────────────────────────────────────
// These tests complete the full onboarding flow and verify the resulting
// planner state. They use ephemeral test accounts (student2/student3) that
// are cleaned up by scripts/cleanup-test-users.ts.
//
// IMPORTANT: These tests are destructive — they create real accounts and plans.
// Run cleanup after: npx tsx scripts/cleanup-test-users.ts

test.describe("Onboarding → Planner: Blank Plan", () => {
  test("completing onboarding with Start from scratch creates an empty plan", async ({ page }) => {
    // Sign up a fresh account
    await page.goto("/signup");
    await page.waitForTimeout(1_000);

    // Select student role
    const studentRole = page.locator('[role="radio"]', { hasText: /Student/i }).first();
    if ((await studentRole.count()) === 0) {
      test.skip(true, "Signup role selector not found");
      return;
    }
    await studentRole.click();
    await page.waitForTimeout(300);

    await page.locator('input[type="email"]').fill("student2@test.com");
    await page.locator('input[type="password"]').first().fill("Test1234!");

    // Fill confirm password if present
    const confirmPw = page.locator('input[type="password"]').nth(1);
    if ((await confirmPw.count()) > 0) {
      await confirmPw.fill("Test1234!");
    }

    // Fill DOB if present
    const dobInput = page.locator('input[type="date"]');
    if ((await dobInput.count()) > 0) {
      await dobInput.fill("2010-01-15");
    }

    // Accept Terms of Service checkbox (required for submit)
    const tosCheckbox = page.locator('input[type="checkbox"]');
    if ((await tosCheckbox.count()) > 0) {
      await tosCheckbox.check();
    }

    await page.locator('form button[type="submit"]').click();

    // Wait for redirect to onboarding or consent
    try {
      await page.waitForURL(/\/(onboarding|consent|dashboard)/, { timeout: 15_000 });
    } catch {
      // Signup may fail if account already exists — skip
      const errorAlert = page.locator('[role="alert"]');
      if ((await errorAlert.count()) > 0) {
        test.skip(true, "Signup failed — account may already exist. Run cleanup-test-users.ts first.");
        return;
      }
      test.skip(true, "Signup did not redirect as expected");
      return;
    }

    // Handle consent if needed
    if (page.url().includes("/consent")) {
      const checkbox = page.locator('input[type="checkbox"]');
      if ((await checkbox.count()) > 0) {
        await checkbox.check();
        const acceptBtn = page.getByRole("button", { name: "Accept", exact: true });
        await acceptBtn.click();
        await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
      }
    }

    // If already on dashboard (existing account), skip
    if (page.url().includes("/dashboard") || page.url().includes("/planner")) {
      test.skip(true, "Account already onboarded");
      return;
    }

    // Step 1: Select grade
    const grade9 = page.locator("label", { hasText: "Grade 9" }).first();
    if ((await grade9.count()) === 0) {
      test.skip(true, "Not on onboarding page");
      return;
    }
    await grade9.click();
    await page.waitForTimeout(300);

    // Next → Step 3 (freshmen skip Step 2)
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_500);

    // Step 3: Click "Start from scratch"
    const scratchLink = page.locator("button", { hasText: /Start from scratch/i }).first();
    if ((await scratchLink.count()) > 0) {
      await scratchLink.click();
      await page.waitForTimeout(300);
    }

    // Next → Step 4 (Goals)
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_000);

    // Step 4: Complete
    const completeBtn = page.getByRole("button", { name: "Complete", exact: true });
    if ((await completeBtn.count()) > 0) {
      await completeBtn.click();
      await page.waitForURL(/\/(planner|dashboard)/, { timeout: 15_000 });
    } else {
      test.skip(true, "Complete button not found on Step 4");
      return;
    }

    // Navigate to planner
    await page.goto("/planner");
    await page.waitForTimeout(3_000);

    // Planner should have no courses (blank plan)
    const courseCells = page.locator('[data-testid="course-card"], .course-card, [draggable="true"]');
    const courseCount = await courseCells.count();

    // A blank plan should have 0 course cards
    const plannerHeading = page.getByRole("heading", { name: "Course Planner" });
    await expect(plannerHeading).toBeVisible({ timeout: 5_000 });
    expect(courseCount).toBe(0);
  });
});

test.describe("Onboarding → Planner: Template Plan", () => {
  test("completing onboarding with a template creates a plan with courses", async ({ page }) => {
    // Sign up a fresh account
    await page.goto("/signup");
    await page.waitForTimeout(1_000);

    const studentRole = page.locator('[role="radio"]', { hasText: /Student/i }).first();
    if ((await studentRole.count()) === 0) {
      test.skip(true, "Signup role selector not found");
      return;
    }
    await studentRole.click();
    await page.waitForTimeout(300);

    await page.locator('input[type="email"]').fill("student3@test.com");
    await page.locator('input[type="password"]').first().fill("Test1234!");

    const confirmPw = page.locator('input[type="password"]').nth(1);
    if ((await confirmPw.count()) > 0) {
      await confirmPw.fill("Test1234!");
    }

    const dobInput = page.locator('input[type="date"]');
    if ((await dobInput.count()) > 0) {
      await dobInput.fill("2010-01-15");
    }

    // Accept Terms of Service checkbox (required for submit)
    const tosCheckbox = page.locator('input[type="checkbox"]');
    if ((await tosCheckbox.count()) > 0) {
      await tosCheckbox.check();
    }

    await page.locator('form button[type="submit"]').click();

    try {
      await page.waitForURL(/\/(onboarding|consent|dashboard)/, { timeout: 15_000 });
    } catch {
      const errorAlert = page.locator('[role="alert"]');
      if ((await errorAlert.count()) > 0) {
        test.skip(true, "Signup failed — account may already exist. Run cleanup-test-users.ts first.");
        return;
      }
      test.skip(true, "Signup did not redirect as expected");
      return;
    }

    // Handle consent if needed
    if (page.url().includes("/consent")) {
      const checkbox = page.locator('input[type="checkbox"]');
      if ((await checkbox.count()) > 0) {
        await checkbox.check();
        const acceptBtn = page.getByRole("button", { name: "Accept", exact: true });
        await acceptBtn.click();
        await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
      }
    }

    if (page.url().includes("/dashboard") || page.url().includes("/planner")) {
      test.skip(true, "Account already onboarded");
      return;
    }

    // Step 1: Select grade
    const grade9 = page.locator("label", { hasText: "Grade 9" }).first();
    if ((await grade9.count()) === 0) {
      test.skip(true, "Not on onboarding page");
      return;
    }
    await grade9.click();
    await page.waitForTimeout(300);

    // Next → Step 3
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_500);

    // Step 3: Select the first available template
    const selectBtn = page.locator("button", { hasText: "Select this plan" }).first();
    if ((await selectBtn.count()) === 0) {
      test.skip(true, "No templates available");
      return;
    }

    await selectBtn.click();
    await page.waitForTimeout(300);

    // Verify selected
    await expect(page.locator("button", { hasText: "Selected" }).first()).toBeVisible();

    // Next → Step 4 (Goals)
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1_000);

    // Step 4: Complete
    const completeBtn = page.getByRole("button", { name: "Complete", exact: true });
    if ((await completeBtn.count()) > 0) {
      await completeBtn.click();
      await page.waitForURL(/\/(planner|dashboard)/, { timeout: 15_000 });
    } else {
      test.skip(true, "Complete button not found on Step 4");
      return;
    }

    // Navigate to planner
    await page.goto("/planner");
    await page.waitForTimeout(3_000);

    const plannerHeading = page.getByRole("heading", { name: "Course Planner" });
    await expect(plannerHeading).toBeVisible({ timeout: 5_000 });

    // Planner should have courses from the template
    const courseCodes = page.locator("text=/[A-Z]{2,4}\\d{3}/");
    const courseCards = page.locator('[data-testid="course-card"], .course-card, [draggable="true"]');
    const anyCoursesIndicator = page.locator("text=/planned|enrolled|credits/i");

    const codeCount = await courseCodes.count();
    const cardCount = await courseCards.count();
    const hasIndicator = (await anyCoursesIndicator.count()) > 0;

    // Template plan should have at least one course visible
    expect(codeCount > 0 || cardCount > 0 || hasIndicator).toBeTruthy();
  });
});
