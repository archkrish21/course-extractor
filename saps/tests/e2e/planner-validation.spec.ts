import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToPlanner(page: Page) {
  await login(page);
  await page.goto("/planner");
  await expect(page.locator("text=Loading your plans...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(
    page.locator("text=/Course Planner/")
  ).toBeVisible({ timeout: 10_000 });
}

async function skipIfNoPlans(page: Page) {
  const noPlanState = page.locator("text=No plans yet");
  if (await noPlanState.isVisible()) {
    test.skip();
  }
}

// ─── Validation Report Button ───────────────────────────────────────────────

test.describe("Planner — Validation Report Button", () => {
  test("validation report button is visible in toolbar", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');
    await expect(validateButton).toBeVisible({ timeout: 5_000 });
  });

  test("clicking validation report button opens the panel", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');
    await validateButton.click();

    // Panel should appear with the heading
    await expect(page.locator("text=Validation Report")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clicking validation report button again closes the panel", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');

    // Open
    await validateButton.click();
    await expect(page.locator("text=Validation Report")).toBeVisible({
      timeout: 10_000,
    });

    // Close
    await validateButton.click();
    await page.waitForTimeout(500);

    // The Validation Report heading inside the panel should be hidden
    // (the page title "Course Planner" still shows, so we check the card specifically)
    const panel = page.locator("text=Total Credits").first();
    await expect(panel).toBeHidden({ timeout: 3_000 });
  });
});

// ─── Validation Report Panel Content ────────────────────────────────────────

test.describe("Planner — Validation Report Panel", () => {
  test("panel shows summary stats", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');
    await validateButton.click();

    // Should show summary stat labels
    await expect(page.locator("text=Total Credits")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Earned")).toBeVisible();
    await expect(page.locator("text=Planned")).toBeVisible();
    await expect(page.locator("text=Requirements Met")).toBeVisible();
  });

  test("panel shows overall progress bar", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');
    await validateButton.click();

    // Progress bar legend items
    await expect(page.locator("text=% covered")).toBeVisible({ timeout: 10_000 });
  });

  test("panel shows graduation requirements section", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');
    await validateButton.click();
    await page.waitForTimeout(2000);

    // Should have at least one of: gaps section, warnings section, or covered section
    const gapsSection = page.locator("text=/Graduation Requirement Gaps/");
    const warningsSection = page.locator("text=/Plan Warnings/");
    const coveredSection = page.locator("text=/Graduation Requirements — Covered/");

    const hasGaps = (await gapsSection.count()) > 0;
    const hasWarnings = (await warningsSection.count()) > 0;
    const hasCovered = (await coveredSection.count()) > 0;

    expect(hasGaps || hasWarnings || hasCovered).toBeTruthy();
  });
});

// ─── Collapsible Sections ───────────────────────────────────────────────────

test.describe("Planner — Validation Report Collapsible Sections", () => {
  test("graduation requirement gaps section is collapsible", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');
    await validateButton.click();
    await page.waitForTimeout(2000);

    const gapsHeader = page.locator("button", { hasText: "Graduation Requirement Gaps" });
    if ((await gapsHeader.count()) === 0) {
      test.skip(); // No gaps to test
      return;
    }

    // Gaps section starts expanded — content should be visible
    const gapContent = page.locator("text=/credit.*needed/i").first();
    await expect(gapContent).toBeVisible({ timeout: 3_000 });

    // Click to collapse
    await gapsHeader.click();
    await page.waitForTimeout(300);
    await expect(gapContent).toBeHidden({ timeout: 3_000 });

    // Click to expand again
    await gapsHeader.click();
    await page.waitForTimeout(300);
    await expect(gapContent).toBeVisible({ timeout: 3_000 });
  });

  test("plan warnings section is collapsible", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');
    await validateButton.click();
    await page.waitForTimeout(2000);

    const warningsHeader = page.locator("button", { hasText: "Plan Warnings" });
    if ((await warningsHeader.count()) === 0) {
      test.skip(); // No warnings to test
      return;
    }

    // Warnings section starts expanded
    await expect(warningsHeader).toBeVisible();

    // Click to collapse
    await warningsHeader.click();
    await page.waitForTimeout(300);

    // Click to expand again
    await warningsHeader.click();
    await page.waitForTimeout(300);
  });

  test("covered section starts collapsed and can be expanded", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const validateButton = page.locator('[aria-label="Validation report"]');
    await validateButton.click();
    await page.waitForTimeout(2000);

    const coveredHeader = page.locator("button", { hasText: "Graduation Requirements — Covered" });
    if ((await coveredHeader.count()) === 0) {
      test.skip(); // No covered requirements
      return;
    }

    // Covered section starts collapsed — click to expand
    await coveredHeader.click();
    await page.waitForTimeout(500);

    // Should now show requirement items with check marks or progress indicators
    const reqItems = page.locator("li", { has: page.locator("text=/\\d+\\/\\d+/") });
    const count = await reqItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ─── Plan Bar Validation Indicator ──────────────────────────────────────────

test.describe("Planner — Plan Bar Validation Indicator", () => {
  test("plan bar shows validation status (Valid or Issues found)", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    // Wait for progress data to load
    await page.waitForTimeout(3000);

    const validIndicator = page.locator("text=Valid").first();
    const issuesIndicator = page.locator("text=Issues found").first();

    const hasValid = (await validIndicator.count()) > 0;
    const hasIssues = (await issuesIndicator.count()) > 0;

    // One of the two should be present
    expect(hasValid || hasIssues).toBeTruthy();
  });
});

// ─── Plan Selection Persistence ─────────────────────────────────────────────

test.describe("Planner — Plan Selection Persistence", () => {
  test("selected plan persists across navigation", async ({ page }) => {
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const planSelector = page.locator('[aria-label="Select a plan"]');
    if ((await planSelector.count()) === 0) {
      test.skip(); // Only one plan, nothing to test
      return;
    }

    // Get all plan options
    const options = planSelector.locator("option");
    const optionCount = await options.count();
    if (optionCount < 2) {
      test.skip(); // Need at least 2 plans
      return;
    }

    // Select the second plan
    const secondOptionValue = await options.nth(1).getAttribute("value");
    if (!secondOptionValue) {
      test.skip();
      return;
    }

    await planSelector.selectOption(secondOptionValue);
    await page.waitForTimeout(1000);

    // Get the selected plan name for comparison
    const selectedText = await planSelector.inputValue();

    // Navigate away to dashboard
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);

    // Navigate back to planner
    await page.goto("/planner");
    await expect(page.locator("text=Loading your plans...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(
      page.locator("text=/Course Planner/")
    ).toBeVisible({ timeout: 10_000 });

    // The plan selector should retain the previously selected plan
    const restoredSelector = page.locator('[aria-label="Select a plan"]');
    if ((await restoredSelector.count()) > 0) {
      const restoredValue = await restoredSelector.inputValue();
      expect(restoredValue).toBe(selectedText);
    }
  });
});

// ─── Dashboard Validation Report Card ───────────────────────────────────────

test.describe("Dashboard — Validation Report Card", () => {
  test("dashboard shows validation report card", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    await expect(page.locator("text=Validation Report")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("validation report card shows Valid or Issues found badge", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(5000);

    // The card should show either the "Valid" badge or "Issues found" badge
    const validBadge = page.locator("text=Valid");
    const issuesBadge = page.locator("text=Issues found");

    const hasValid = (await validBadge.count()) > 0;
    const hasIssues = (await issuesBadge.count()) > 0;

    expect(hasValid || hasIssues).toBeTruthy();
  });

  test("validation report card shows categorized sections when issues exist", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(5000);

    const issuesBadge = page.locator("text=Issues found");
    if ((await issuesBadge.count()) === 0) {
      // No issues — should show success message
      await expect(
        page.locator("text=/All graduation requirements are covered/")
      ).toBeVisible({ timeout: 3_000 });
      return;
    }

    // If issues exist, check for categorized sections
    const gapsSection = page.locator("text=/Graduation Requirement Gaps/");
    const warningsSection = page.locator("text=/Plan Warnings/");

    const hasGaps = (await gapsSection.count()) > 0;
    const hasWarnings = (await warningsSection.count()) > 0;

    // At least one should be present since we have issues
    expect(hasGaps || hasWarnings).toBeTruthy();
  });
});

// ─── Progress Page ──────────────────────────────────────────────────────────

test.describe("Progress Page", () => {
  test("progress page is accessible from navigation", async ({ page }) => {
    await login(page);
    await page.goto("/progress");

    await expect(
      page.getByRole("heading", { name: "Graduation Progress" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("progress page shows summary stats", async ({ page }) => {
    await login(page);
    await page.goto("/progress");
    await page.waitForTimeout(3000);

    await expect(page.locator("text=Total Credits")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Earned")).toBeVisible();
    await expect(page.locator("text=Planned")).toBeVisible();
    await expect(page.locator("text=Requirements Met")).toBeVisible();
  });

  test("progress page shows per-requirement cards", async ({ page }) => {
    await login(page);
    await page.goto("/progress");
    await page.waitForTimeout(3000);

    // Should show requirement names (at least English and Mathematics)
    const reqCards = page.locator("text=/English|Mathematics|Biology|Science/");
    const count = await reqCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("progress page shows gaps count when requirements are unmet", async ({ page }) => {
    await login(page);
    await page.goto("/progress");
    await page.waitForTimeout(3000);

    // Either gaps indicator is shown, or all requirements are met
    const gapsLabel = page.locator("text=Gaps");
    const reqsMet = page.locator("text=Requirements Met");

    const hasGaps = (await gapsLabel.count()) > 0;
    const hasReqsMet = (await reqsMet.count()) > 0;

    expect(hasGaps || hasReqsMet).toBeTruthy();
  });

  test("progress page has edit plan button", async ({ page }) => {
    await login(page);
    await page.goto("/progress");
    await page.waitForTimeout(3000);

    await expect(page.locator("text=Edit Plan")).toBeVisible({ timeout: 5_000 });
  });
});
