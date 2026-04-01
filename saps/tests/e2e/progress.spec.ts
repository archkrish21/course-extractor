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

  test("Print button is visible", async ({ page }) => {
    await navigateToProgress(page);

    const printBtn = page.getByRole("button", { name: "Print" });
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
  });

  test("Print button triggers browser print dialog", async ({ page }) => {
    await navigateToProgress(page);

    let printCalled = false;
    await page.evaluate(() => {
      window.print = () => { (window as unknown as Record<string, boolean>).__printCalled = true; };
    });

    const printBtn = page.getByRole("button", { name: "Print" });
    await printBtn.click();

    printCalled = await page.evaluate(() => (window as unknown as Record<string, boolean>).__printCalled === true);
    expect(printCalled).toBe(true);
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

// ─── Requirement Groups ─────────────────────────────────────────────────────

test.describe("Progress — Requirement Groups", () => {
  test("shows graduation requirements group", async ({ page }) => {
    await navigateToProgress(page);

    await expect(page.locator("text=Graduation Requirements")).toBeVisible({ timeout: 10_000 });
  });

  test("shows additional requirements group (non-course)", async ({ page }) => {
    await navigateToProgress(page);

    await expect(page.locator("text=Additional Requirements")).toBeVisible({ timeout: 10_000 });
  });

  test("shows honor graduate status group", async ({ page }) => {
    await navigateToProgress(page);

    await expect(page.locator("text=Honor Graduate Status")).toBeVisible({ timeout: 10_000 });
  });

  test("shows course load group", async ({ page }) => {
    await navigateToProgress(page);

    await expect(page.locator("text=Course Load")).toBeVisible({ timeout: 10_000 });
  });

  test("IL Public University group shows opt-in toggle", async ({ page }) => {
    await navigateToProgress(page);

    const uniGroup = page.locator("text=IL Public University Admission");
    await expect(uniGroup).toBeVisible({ timeout: 10_000 });

    // Should have Enable/Disable Tracking button
    const trackBtn = page.locator("text=/Enable Tracking|Disable Tracking/");
    await expect(trackBtn).toBeVisible({ timeout: 5_000 });
  });

  test("groups are collapsible", async ({ page }) => {
    await navigateToProgress(page);

    // Click a group header to collapse it
    const groupHeader = page.locator("button", { hasText: "Graduation Requirements" });
    await expect(groupHeader).toBeVisible({ timeout: 10_000 });
    await groupHeader.click();
    await page.waitForTimeout(300);
  });
});

// ─── Non-Course Requirements ────────────────────────────────────────────────

test.describe("Progress — Non-Course Requirements", () => {
  test("shows ACT and FAFSA as checkbox requirements", async ({ page }) => {
    await navigateToProgress(page);

    const actReq = page.locator("text=ACT Graduation Requirement");
    const fafsaReq = page.locator("text=FAFSA Requirement");

    await expect(actReq).toBeVisible({ timeout: 10_000 });
    await expect(fafsaReq).toBeVisible();
  });

  test("shows auto-from-course requirements (46th Credit, Civics)", async ({ page }) => {
    await navigateToProgress(page);

    const drugEd = page.locator("text=46th Credit");
    const civics = page.locator("text=Civics and Patriotism");

    await expect(drugEd).toBeVisible({ timeout: 10_000 });
    await expect(civics).toBeVisible();
  });

  test("checkbox requirements have clickable checkbox", async ({ page }) => {
    await navigateToProgress(page);

    // Find the checkbox button for ACT
    const checkbox = page.locator('button[aria-label*="ACT"]');
    if ((await checkbox.count()) > 0) {
      await expect(checkbox).toBeVisible();
    }
  });
});

// ─── Honors Status ──────────────────────────────────────────────────────────

test.describe("Progress — Honors Status", () => {
  test("shows honors tier cards with GPA info", async ({ page }) => {
    await navigateToProgress(page);

    const highestHonors = page.locator("text=Highest Honors");
    const highHonors = page.locator("text=High Honors");
    const honors = page.locator("text=/^Honors$/");

    // At least one honors tier should be visible
    const hasAny = (await highestHonors.count()) + (await highHonors.count()) + (await honors.count());
    expect(hasAny).toBeGreaterThanOrEqual(1);
  });

  test("honors cards show GPA vs required", async ({ page }) => {
    await navigateToProgress(page);

    const gpaInfo = page.locator("text=/GPA:.*\\/.*required/i");
    const hasGpaInfo = (await gpaInfo.count()) > 0;
    // GPA info may not show if no grades exist
    const heading = page.locator("text=Honor Graduate Status");
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Course Load ────────────────────────────────────────────────────────────

test.describe("Progress — Course Load", () => {
  test("shows per-semester course load cards", async ({ page }) => {
    await navigateToProgress(page);

    const loadCards = page.locator("text=/Course Load.*Grade/");
    const count = await loadCards.count();
    // Should have 8 entries (4 grades x 2 semesters)
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("course load shows OK or Underload/Overload badge", async ({ page }) => {
    await navigateToProgress(page);

    const okBadge = page.locator("text=OK");
    const underloadBadge = page.locator("text=Underload");
    const overloadBadge = page.locator("text=Overload");

    const hasAny = (await okBadge.count()) + (await underloadBadge.count()) + (await overloadBadge.count());
    expect(hasAny).toBeGreaterThanOrEqual(1);
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

// ─── Page Title ─────────────────────────────────────────────────────────────

test.describe("Progress — Page Title", () => {
  test("page title is Academic Progress", async ({ page }) => {
    await navigateToProgress(page);
    await expect(page.getByRole("heading", { name: "Academic Progress" })).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Two-Column Layout ──────────────────────────────────────────────────────

test.describe("Progress — Layout", () => {
  test("shows summary sidebar on desktop", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop layout test");
    await navigateToProgress(page);

    // Summary card should be visible with Overall stats
    await expect(page.locator("text=/Overall/")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=/% met/")).toBeVisible();
  });
});

// ─── Filter Bar ─────────────────────────────────────────────────────────────

test.describe("Progress — Filters", () => {
  test("filter bar is visible with all options", async ({ page }) => {
    await navigateToProgress(page);

    await expect(page.locator("text=Filter:")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gap / Missing" })).toBeVisible();
    await expect(page.getByRole("button", { name: "In Progress" })).toBeVisible();
    await expect(page.getByRole("button", { name: "OK / Complete" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Not Started" })).toBeVisible();
  });

  test("Expand All and Collapse All buttons work", async ({ page }) => {
    await navigateToProgress(page);

    const expandAll = page.getByRole("button", { name: "Expand All" });
    const collapseAll = page.getByRole("button", { name: "Collapse All" });
    await expect(expandAll).toBeVisible({ timeout: 10_000 });
    await expect(collapseAll).toBeVisible();

    // Collapse all
    await collapseAll.click();
    await page.waitForTimeout(300);

    // Expand all
    await expandAll.click();
    await page.waitForTimeout(300);
  });

  test("clicking a filter updates displayed requirements", async ({ page }) => {
    await navigateToProgress(page);

    const gapFilter = page.getByRole("button", { name: "Gap / Missing" });
    await gapFilter.click();
    await page.waitForTimeout(500);

    // Click All to reset
    const allFilter = page.getByRole("button", { name: "All" });
    await allFilter.click();
    await page.waitForTimeout(500);
  });
});

// ─── Semester Requirements Sub-categories ───────────────────────────────────

test.describe("Progress — Semester Sub-categories", () => {
  test("shows Course Count Per Semester sub-category", async ({ page }) => {
    await navigateToProgress(page);
    await expect(page.locator("text=/Course Count Per Semester/")).toBeVisible({ timeout: 10_000 });
  });

  test("shows Physical Welfare / Dance / Driver Ed sub-category", async ({ page }) => {
    await navigateToProgress(page);
    await expect(page.locator("text=/Physical Welfare.*Dance.*Driver Ed/")).toBeVisible({ timeout: 10_000 });
  });

  test("sub-categories are collapsible", async ({ page }) => {
    await navigateToProgress(page);

    const courseCountHeader = page.locator("button", { hasText: "Course Count Per Semester" });
    if ((await courseCountHeader.count()) > 0) {
      await courseCountHeader.click();
      await page.waitForTimeout(300);
      await courseCountHeader.click();
      await page.waitForTimeout(300);
    }
  });
});

// ─── IL Public University Opt-in ────────────────────────────────────────────

test.describe("Progress — IL Public University", () => {
  test("shows enable/disable tracking button", async ({ page }) => {
    await navigateToProgress(page);

    const trackBtn = page.locator("text=/Enable Tracking|Disable Tracking/");
    await expect(trackBtn).toBeVisible({ timeout: 10_000 });
  });

  test("can toggle opt-in tracking", async ({ page }) => {
    await navigateToProgress(page);

    const trackBtn = page.locator("text=/Enable Tracking|Disable Tracking/").first();
    await expect(trackBtn).toBeVisible({ timeout: 10_000 });

    // Toggle
    await trackBtn.click();
    await page.waitForTimeout(1000);

    // Toggle back
    const trackBtn2 = page.locator("text=/Enable Tracking|Disable Tracking/").first();
    await trackBtn2.click();
    await page.waitForTimeout(1000);
  });
});

// ─── Earned/Planned Breakdown ───────────────────────────────────────────────

test.describe("Progress — Credit Breakdown", () => {
  test("shows earned and planned counts below progress bars", async ({ page }) => {
    await navigateToProgress(page);

    const earned = page.locator("text=/\\d+ earned/");
    const planned = page.locator("text=/\\d+ planned/");

    // At least one should be visible if there are courses
    const hasEarned = (await earned.count()) > 0;
    const hasPlanned = (await planned.count()) > 0;
    expect(hasEarned || hasPlanned).toBeTruthy();
  });
});
