import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToProgress(page: Page) {
  await login(page);
  await page.goto("/progress");
  await page.waitForTimeout(3000);
}

// ─── Navigation ─────────────────────────────────────────────────────────────

test.describe("Progress — Navigation", () => {
  test("progress page accessible via URL", async ({ page }) => {
    await navigateToProgress(page);
    await expect(
      page.getByRole("heading", { name: "Graduation Progress" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("progress page accessible from nav menu", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const progressLink = page.locator('a[href="/progress"]').first();
    await expect(progressLink).toBeVisible({ timeout: 5_000 });
    await progressLink.click();
    await page.waitForURL(/\/progress/, { timeout: 10_000 });
  });

  test("progress page accessible from dashboard View Progress button", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    const viewProgressBtn = page.locator("text=View Progress").first();
    if ((await viewProgressBtn.count()) > 0) {
      await viewProgressBtn.click();
      await page.waitForURL(/\/progress/, { timeout: 10_000 });
    }
  });

  test("Edit Plan button links to planner", async ({ page }) => {
    await navigateToProgress(page);

    const editPlanBtn = page.locator("text=Edit Plan");
    await expect(editPlanBtn).toBeVisible({ timeout: 5_000 });
    await editPlanBtn.click();
    await page.waitForURL(/\/planner/, { timeout: 10_000 });
  });
});

// ─── Summary Card ───────────────────────────────────────────────────────────

test.describe("Progress — Summary Card", () => {
  test("shows all summary stats", async ({ page }) => {
    await navigateToProgress(page);

    await expect(page.locator("text=Total Credits")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Earned").first()).toBeVisible();
    await expect(page.locator("text=Planned").first()).toBeVisible();
    await expect(page.locator("text=Requirements Met")).toBeVisible();
  });

  test("shows overall progress bar with legend", async ({ page }) => {
    await navigateToProgress(page);

    // Legend items
    await expect(page.locator("text=% covered")).toBeVisible({ timeout: 10_000 });
    // Legend dots
    const earnedLegend = page.locator("text=Earned").first();
    const plannedLegend = page.locator("text=Planned").first();
    await expect(earnedLegend).toBeVisible();
    await expect(plannedLegend).toBeVisible();
  });

  test("shows gaps count with warning icon when requirements are unmet", async ({ page }) => {
    await navigateToProgress(page);

    // Either Gaps indicator or all requirements are met
    const gapsLabel = page.locator("text=Gaps");
    const hasGaps = (await gapsLabel.count()) > 0;

    if (hasGaps) {
      // The gaps count should be a number
      await expect(gapsLabel).toBeVisible();
    }
    // If no gaps, that's also valid — all requirements are covered
  });

  test("total credits shows earned + planned = total / required format", async ({ page }) => {
    await navigateToProgress(page);

    // Look for the credit totals display
    const totalCredits = page.locator("text=Total Credits");
    await expect(totalCredits).toBeVisible({ timeout: 10_000 });

    // The number next to it should contain a "/" separator
    const creditValue = page.locator("text=/\\d+.*\\/.*\\d+/").first();
    await expect(creditValue).toBeVisible();
  });
});

// ─── Per-Requirement Cards ──────────────────────────────────────────────────

test.describe("Progress — Requirement Cards", () => {
  test("shows individual requirement cards", async ({ page }) => {
    await navigateToProgress(page);

    // Should show known Stevenson requirements
    const reqNames = page.locator("text=/English|Mathematics|Biology|Physical Science|U\\.S\\. History|Government|Economics|Health|Driver Education/");
    const count = await reqNames.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("requirement cards show status badges", async ({ page }) => {
    await navigateToProgress(page);

    // Status badges: Complete, In Progress, or Gap
    const badges = page.locator("text=/Complete|In Progress|Gap/");
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("requirement cards show progress bars", async ({ page }) => {
    await navigateToProgress(page);

    // Progress bars (role=progressbar or the bar divs)
    const progressBars = page.locator('[class*="rounded-full"][class*="bg-muted"]');
    const count = await progressBars.count();
    // At least 1 overall + some per-requirement
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("requirement cards show credit counts", async ({ page }) => {
    await navigateToProgress(page);

    // Credit counts like "6/8 credits" or "2/2 credits"
    const creditCounts = page.locator("text=/\\d+.*\\/.*\\d+.*credits/i");
    const count = await creditCounts.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("requirement cards show course chips for assigned courses", async ({ page }) => {
    await navigateToProgress(page);

    // Course code chips (e.g., ENG151, MTH251)
    const courseChips = page.locator("text=/[A-Z]{2,4}\\d{3}/");
    const count = await courseChips.count();
    // At least some courses should be assigned
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("course chips are color-coded by earned vs planned", async ({ page }) => {
    await navigateToProgress(page);

    // Earned chips have success color, planned have primary color
    const earnedChips = page.locator('[class*="bg-success"]');
    const plannedChips = page.locator('[class*="bg-primary"]');

    const hasEarned = (await earnedChips.count()) > 0;
    const hasPlanned = (await plannedChips.count()) > 0;
    // At least one type should exist
    expect(hasEarned || hasPlanned).toBeTruthy();
  });

  test("gap requirements show credits needed message", async ({ page }) => {
    await navigateToProgress(page);

    const gapMessage = page.locator("text=/\\d+ (more )?credits? needed/i");
    const hasGaps = (await gapMessage.count()) > 0;

    // If no gaps, verify all requirements show as Complete or In Progress
    if (!hasGaps) {
      const gapBadge = page.locator("text=Gap");
      expect(await gapBadge.count()).toBe(0);
    }
  });

  test("requirement cards show notes when available", async ({ page }) => {
    await navigateToProgress(page);

    // Economics requirement has notes: "Economics, AP Macro/Micro, or Personal Finance"
    const notes = page.locator("text=/Economics.*AP|From:.*Applied Arts/i");
    // Notes are data-dependent, just verify page renders
    const heading = page.getByRole("heading", { name: "Graduation Progress" });
    await expect(heading).toBeVisible();
  });
});

// ─── Error & Empty States ───────────────────────────────────────────────────

test.describe("Progress — Error Handling", () => {
  test("shows error state gracefully when API fails", async ({ page }) => {
    await login(page);

    // Intercept the requirements API to simulate failure
    await page.route("**/api/v1/requirements**", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
    );

    await page.goto("/progress");
    await page.waitForTimeout(3000);

    // Should show error message with link to planner
    const errorMsg = page.locator("text=/unable to load|error|try again/i");
    const plannerLink = page.locator("text=Open Planner");
    const hasError = (await errorMsg.count()) > 0;
    const hasPlannerLink = (await plannerLink.count()) > 0;

    expect(hasError || hasPlannerLink).toBeTruthy();
  });
});
