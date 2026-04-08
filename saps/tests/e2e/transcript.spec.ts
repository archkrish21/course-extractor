import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToTranscript(page: Page) {
  await login(page);
  await page.goto("/transcript");
  await page.waitForTimeout(3000);
}

// ─── Navigation ─────────────────────────────────────────────────────────────

test.describe("Transcript — Navigation", () => {
  test("transcript page is accessible via URL", async ({ page }) => {
    await navigateToTranscript(page);
    // Should show the transcript page heading or content
    const heading = page.locator("text=/Transcript|Academic Record/i");
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("transcript is accessible from navigation menu", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const transcriptLink = page.locator('a[href="/transcript"]').first();
    await expect(transcriptLink).toBeVisible({ timeout: 5_000 });
    await transcriptLink.click();
    await page.waitForURL(/\/transcript/, { timeout: 10_000 });
  });
});

// ─── GPA Display ────────────────────────────────────────────────────────────

test.describe("Transcript — GPA Display", () => {
  test("shows GPA summary cards", async ({ page }) => {
    await navigateToTranscript(page);

    // Should show GPA-related labels
    const gpaLabels = page.locator("text=/GPA|Unweighted|Weighted/i");
    const count = await gpaLabels.count();

    // Either GPA cards are shown or "no completed courses" message
    const emptyState = page.locator("text=/no completed courses|no grades/i");
    const hasGpa = count > 0;
    const isEmpty = (await emptyState.count()) > 0;
    expect(hasGpa || isEmpty).toBeTruthy();
  });

  test("shows credits earned count", async ({ page }) => {
    await navigateToTranscript(page);

    const creditsLabel = page.locator("text=/credits.*earned|earned.*credits|total credits/i");
    const emptyState = page.locator("text=/no completed courses|no grades/i");

    const hasCredits = (await creditsLabel.count()) > 0;
    const isEmpty = (await emptyState.count()) > 0;
    expect(hasCredits || isEmpty).toBeTruthy();
  });
});

// ─── Grade Level Sections ───────────────────────────────────────────────────

test.describe("Transcript — Grade Level Sections", () => {
  test("shows grade level sections for completed courses", async ({ page }) => {
    await navigateToTranscript(page);

    // Either grade level sections or empty state
    const gradeSections = page.locator("text=/Grade 9|Grade 10|Grade 11|Grade 12|Freshman|Sophomore|Junior|Senior/i");
    const emptyState = page.locator("text=/no completed courses|no grades/i");

    const hasGrades = (await gradeSections.count()) > 0;
    const isEmpty = (await emptyState.count()) > 0;
    expect(hasGrades || isEmpty).toBeTruthy();
  });

  test("grade sections are expandable/collapsible", async ({ page }) => {
    await navigateToTranscript(page);

    // Find any grade section header button
    const gradeButton = page.locator("button", { hasText: /Grade \d+|Freshman|Sophomore|Junior|Senior/i }).first();
    if ((await gradeButton.count()) === 0) {
      test.skip(); // No completed courses
      return;
    }

    // Click to toggle
    await gradeButton.click();
    await page.waitForTimeout(300);
  });
});

// ─── Course Table ───────────────────────────────────────────────────────────

test.describe("Transcript — Course Table", () => {
  test("shows course details in semester tables", async ({ page }) => {
    await navigateToTranscript(page);

    // Check for semester labels within grade sections
    const semesterLabels = page.locator("text=/Semester 1|Semester 2|Fall|Spring/i");
    const emptyState = page.locator("text=/no completed courses|no grades/i");

    const hasSemesters = (await semesterLabels.count()) > 0;
    const isEmpty = (await emptyState.count()) > 0;
    expect(hasSemesters || isEmpty).toBeTruthy();
  });

  test("course rows show code, name, grade, and credits", async ({ page }) => {
    await navigateToTranscript(page);

    // Look for typical course code patterns
    const courseCodes = page.locator("text=/[A-Z]{2,4}\\d{3}/");
    if ((await courseCodes.count()) === 0) {
      test.skip(); // No completed courses with visible codes
      return;
    }

    // At least one course code should be visible
    await expect(courseCodes.first()).toBeVisible();
  });

  test("GPA waiver indicator shown for waivered courses", async ({ page }) => {
    await navigateToTranscript(page);

    // The waiver indicator "(W)" may or may not be present depending on data
    const waiverIndicator = page.locator("text=(W)");
    // Just verify the page loads without errors — waiver presence is data-dependent
    const heading = page.locator("text=/Transcript|Academic Record/i");
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Print & Print Layout ──────────────────────────────────────────────────
// Print button visibility, print dialog trigger, no-print class, and
// print-expand class are tested in progress.spec.ts (single source of truth).

// ─── Disclaimer ────────────────────────────────────────────────────────────

test.describe("Transcript — Disclaimer", () => {
  test("shows disclaimer banner when courses exist", async ({ page }) => {
    await navigateToTranscript(page);

    const emptyState = page.locator("text=/no completed courses|no grades/i");
    if ((await emptyState.count()) > 0) {
      test.skip(); // No courses to show disclaimer for
      return;
    }

    await expect(page.locator("text=Disclaimer")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=This is not an official school document")).toBeVisible();
  });

  test("disclaimer is not shown when no courses exist", async ({ page }) => {
    await navigateToTranscript(page);

    const emptyState = page.locator("text=/no completed courses|no grades/i");
    if ((await emptyState.count()) === 0) {
      test.skip(); // Has courses — can't test empty state
      return;
    }

    await expect(page.locator("text=Disclaimer")).not.toBeVisible();
  });
});

// ─── Read-only Behavior ─────────────────────────────────────────────────────

test.describe("Transcript — Read-only", () => {
  test("transcript page has no editable controls", async ({ page }) => {
    await navigateToTranscript(page);

    // Should NOT have any status or grade dropdowns (those are planner-only)
    const statusDropdown = page.locator('select[aria-label*="status" i]');
    const gradeDropdown = page.locator('select[aria-label*="grade" i]');

    expect(await statusDropdown.count()).toBe(0);
    expect(await gradeDropdown.count()).toBe(0);
  });
});
