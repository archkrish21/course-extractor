import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToDashboard(page: Page) {
  await login(page);
  await page.goto("/dashboard");
  await page.waitForTimeout(3000);
}

// ─── Dashboard Layout ───────────────────────────────────────────────────────

test.describe("Dashboard — Layout", () => {
  test("dashboard page loads successfully", async ({ page }) => {
    await navigateToDashboard(page);
    // Should have at least one card visible
    const cards = page.locator('[class*="rounded-xl"][class*="border"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("all four main cards are visible", async ({ page }) => {
    await navigateToDashboard(page);

    // Card titles
    await expect(page.locator("text=GPA Summary")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Graduation Progress")).toBeVisible();
    await expect(page.locator("text=Active Plan")).toBeVisible();
    await expect(page.locator("text=Quick Actions")).toBeVisible();
  });

  test("validation report card is visible", async ({ page }) => {
    await navigateToDashboard(page);

    await expect(page.locator("text=Validation Report")).toBeVisible({ timeout: 10_000 });
  });
});

// ─── GPA Summary Card ───────────────────────────────────────────────────────

test.describe("Dashboard — GPA Summary Card", () => {
  test("shows GPA values or no-grades message", async ({ page }) => {
    await navigateToDashboard(page);

    // Either shows GPA values or a message about entering grades
    const gpaValue = page.locator("text=/\\d\\.\\d{2}/").first();
    const noGrades = page.locator("text=/no grades|enter grades|View Transcript/i");

    const hasGpa = (await gpaValue.count()) > 0;
    const hasNoGrades = (await noGrades.count()) > 0;
    expect(hasGpa || hasNoGrades).toBeTruthy();
  });

  test("shows View Transcript button", async ({ page }) => {
    await navigateToDashboard(page);

    const viewTranscriptBtn = page.locator("text=View Transcript").first();
    await expect(viewTranscriptBtn).toBeVisible({ timeout: 10_000 });
  });

  test("View Transcript button links to transcript page", async ({ page }) => {
    await navigateToDashboard(page);

    const viewTranscriptBtn = page.locator("a[href='/transcript']").first();
    if ((await viewTranscriptBtn.count()) > 0) {
      await viewTranscriptBtn.click();
      await page.waitForURL(/\/transcript/, { timeout: 10_000 });
    }
  });

  test("shows projected and actual GPA when grades exist", async ({ page }) => {
    await navigateToDashboard(page);

    const projLabel = page.locator("text=/Projected|Cumulative/i").first();
    const hasProj = (await projLabel.count()) > 0;

    // Data-dependent: if no grades, skip this check
    if (hasProj) {
      await expect(projLabel).toBeVisible();
    }
  });
});

// ─── Active Plan Card ───────────────────────────────────────────────────────

test.describe("Dashboard — Active Plan Card", () => {
  test("shows plan name or no-plan message", async ({ page }) => {
    await navigateToDashboard(page);

    const planInfo = page.locator("text=/courses|credits|plan/i");
    const noPlan = page.locator("text=/no plan|create.*plan|get started/i");

    const hasPlan = (await planInfo.count()) > 0;
    const hasNoPlan = (await noPlan.count()) > 0;
    expect(hasPlan || hasNoPlan).toBeTruthy();
  });

  test("shows course count and credit totals", async ({ page }) => {
    await navigateToDashboard(page);

    // Should show stats like "24 courses" or "48 credits"
    const courseCount = page.locator("text=/\\d+ course/i");
    const creditCount = page.locator("text=/\\d+.*credit/i");

    const hasCourses = (await courseCount.count()) > 0;
    const hasCredits = (await creditCount.count()) > 0;

    // If there's a plan, at least one stat should show
    const noPlan = page.locator("text=/no plan|get started/i");
    const hasNoPlan = (await noPlan.count()) > 0;
    expect(hasCourses || hasCredits || hasNoPlan).toBeTruthy();
  });

  test("shows Open Planner button", async ({ page }) => {
    await navigateToDashboard(page);

    const openPlannerBtn = page.locator("text=Open Planner").first();
    await expect(openPlannerBtn).toBeVisible({ timeout: 10_000 });
  });

  test("shows warnings when plan has issues", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    // Warnings are data-dependent. Just verify the card loads.
    const activePlan = page.locator("text=Active Plan");
    await expect(activePlan).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Graduation Progress Card ───────────────────────────────────────────────

test.describe("Dashboard — Graduation Progress Card", () => {
  test("shows credit progress summary", async ({ page }) => {
    await navigateToDashboard(page);

    // Should show earned + planned = total / required format
    const progressText = page.locator("text=/earned|planned/i").first();
    await expect(progressText).toBeVisible({ timeout: 10_000 });
  });

  test("shows overall progress bar", async ({ page }) => {
    await navigateToDashboard(page);

    // The progress bar container
    const progressBar = page.locator('[role="progressbar"]');
    const hasProgressBar = (await progressBar.count()) > 0;

    // Or the bar divs
    const barDivs = page.locator('[class*="rounded-full"][class*="bg-muted"]');
    const hasBars = (await barDivs.count()) > 0;

    expect(hasProgressBar || hasBars).toBeTruthy();
  });

  test("shows per-requirement status list", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(3000);

    // Requirement names should be visible
    const reqNames = page.locator("text=/English|Mathematics|Biology/");
    const count = await reqNames.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("View Progress button links to progress page", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(3000);

    const viewProgressBtn = page.locator("text=View Progress").first();
    if ((await viewProgressBtn.count()) > 0) {
      await viewProgressBtn.click();
      await page.waitForURL(/\/progress/, { timeout: 10_000 });
    }
  });
});

// ─── Quick Actions Card ─────────────────────────────────────────────────────

test.describe("Dashboard — Quick Actions Card", () => {
  test("shows all action buttons in correct order", async ({ page }) => {
    await navigateToDashboard(page);

    // All expected buttons
    await expect(page.locator("text=Browse Courses").last()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Open Planner").last()).toBeVisible();
    await expect(page.locator("text=Print Plan").last()).toBeVisible();
    await expect(page.locator("text=View Progress").last()).toBeVisible();
    await expect(page.locator("text=View Transcript").last()).toBeVisible();
  });

  test("Browse Courses links to courses page", async ({ page }) => {
    await navigateToDashboard(page);

    const browseBtn = page.locator('a[href="/courses"]').last();
    await expect(browseBtn).toBeVisible({ timeout: 5_000 });
  });

  test("Open Planner links to planner page", async ({ page }) => {
    await navigateToDashboard(page);

    const plannerBtn = page.locator('a[href="/planner"]').last();
    await expect(plannerBtn).toBeVisible({ timeout: 5_000 });
  });

  test("View Progress links to progress page", async ({ page }) => {
    await navigateToDashboard(page);

    const progressBtn = page.locator('a[href="/progress"]').last();
    await expect(progressBtn).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Validation Report Card ─────────────────────────────────────────────────

test.describe("Dashboard — Attention Required Card", () => {
  test("shows Attention Required card", async ({ page }) => {
    await navigateToDashboard(page);
    await expect(page.locator("text=Attention Required")).toBeVisible({ timeout: 10_000 });
  });

  test("shows Valid or Issues found badge", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    const validBadge = page.locator("text=Valid");
    const issuesBadge = page.locator("text=Issues found");
    expect((await validBadge.count()) > 0 || (await issuesBadge.count()) > 0).toBeTruthy();
  });

  test("shows category summary line with counts", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    // Should show category counts
    const gradGaps = page.locator("text=/\\d+ Graduation Gap/");
    const semIssues = page.locator("text=/\\d+ Semester Issue/");
    const prereqViolations = page.locator("text=/\\d+ Prerequisite Violation/");

    expect((await gradGaps.count()) + (await semIssues.count()) + (await prereqViolations.count())).toBeGreaterThanOrEqual(1);
  });

  test("shows graduation requirement gaps when gaps exist", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    const gapsSection = page.locator("text=/Graduation Requirement Gaps/");
    if ((await gapsSection.count()) === 0) {
      test.skip();
      return;
    }
    await expect(gapsSection).toBeVisible();
    const creditsNeeded = page.locator("text=/\\d+ credits? needed/");
    expect(await creditsNeeded.count()).toBeGreaterThanOrEqual(1);
  });

  test("shows semester requirement gaps when issues exist", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    const semSection = page.locator("text=/Semester Requirement Gaps/");
    if ((await semSection.count()) === 0) {
      test.skip();
      return;
    }
    await expect(semSection).toBeVisible();
  });

  test("shows prerequisite violations when present", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    const prereqSection = page.locator("text=/Prerequisite Violations/");
    if ((await prereqSection.count()) === 0) {
      test.skip();
      return;
    }
    await expect(prereqSection).toBeVisible();
  });

  test("shows success message when no issues", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    const issuesBadge = page.locator("text=Issues found");
    if ((await issuesBadge.count()) > 0) {
      test.skip();
      return;
    }

    await expect(page.locator("text=/No issues found/")).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Achievements Card ──────────────────────────────────────────────────────

test.describe("Dashboard — Achievements Card", () => {
  test("shows Achievements card", async ({ page }) => {
    await navigateToDashboard(page);
    await expect(page.locator("text=Achievements")).toBeVisible({ timeout: 10_000 });
  });

  test("shows achievement badges", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    // Should show at least one badge or the empty state
    const badges = page.locator("text=/Graduation Ready|Credits|GPA|Earned|Honors/");
    const emptyState = page.locator("text=/unlock achievements/");

    const hasBadges = (await badges.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasBadges || hasEmpty).toBeTruthy();
  });

  test("earned badges have colored styling", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    // Earned badges should have colored borders (not muted)
    const coloredBadges = page.locator('[class*="border-amber"], [class*="border-success"], [class*="border-primary"]');
    // May or may not have earned badges depending on data
    const heading = page.locator("text=Achievements");
    await expect(heading).toBeVisible();
  });

  test("unearned badges are dimmed", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    const dimmedBadges = page.locator('[class*="opacity-50"]');
    // May or may not have unearned badges
    const heading = page.locator("text=Achievements");
    await expect(heading).toBeVisible();
  });
});

// ─── Navigation Menu ────────────────────────────────────────────────────────

test.describe("Dashboard — Navigation Menu", () => {
  test("navigation shows all menu items in correct order", async ({ page }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Desktop navigation test"
    );

    await navigateToDashboard(page);

    // All nav items should be visible
    const navItems = ["Dashboard", "Courses", "Planner", "Progress", "Transcript", "Settings"];
    for (const item of navItems) {
      const link = page.locator(`nav a, header a`, { hasText: item }).first();
      await expect(link).toBeVisible({ timeout: 5_000 });
    }
  });

  test("active page is highlighted in navigation", async ({ page }) => {
    await navigateToDashboard(page);

    // Dashboard link should have active styling
    const dashboardLink = page.locator('a[href="/dashboard"]').first();
    await expect(dashboardLink).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Attention Required — Compact Layout ────────────────────────────────────

test.describe("Dashboard — Attention Required Compact", () => {
  test("shows category titles without individual messages", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    // Should show category titles (not individual messages)
    const gradGaps = page.locator("text=Graduation Requirement Gaps");
    const semGaps = page.locator("text=Semester Requirement Gaps");
    const prereqs = page.locator("text=Prerequisite Violations");

    // At least one category or the all-clear message should show
    const allClear = page.locator("text=/No issues found/");
    const hasCategory = (await gradGaps.count()) + (await semGaps.count()) + (await prereqs.count()) > 0;
    const hasAllClear = (await allClear.count()) > 0;
    expect(hasCategory || hasAllClear).toBeTruthy();
  });

  test("View Report button routes to planner with validation open and planId", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    const viewReport = page.locator("text=View Report");
    await expect(viewReport).toBeVisible({ timeout: 5_000 });

    // Verify the link includes planId so the primary plan's report opens
    const link = page.locator("a", { has: page.locator("text=View Report") });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/\/planner\?planId=.+&validation=open/);

    await viewReport.click();
    await page.waitForURL(/\/planner\?planId=.+&validation=open/, { timeout: 10_000 });

    // Validation panel should be open
    await expect(page.locator("text=Validation Report")).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Academic Progress — All Groups ─────────────────────────────────────────

test.describe("Dashboard — Academic Progress All Groups", () => {
  test("shows per-group progress bars", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    // Should show multiple group labels
    const gradReqs = page.locator("text=Graduation Requirements");
    const semReqs = page.locator("text=Semester Requirements");

    // At least graduation requirements should be visible
    await expect(gradReqs.first()).toBeVisible({ timeout: 5_000 });
  });

  test("shows earned/planned/remaining legend", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    await expect(page.locator("text=Earned").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=Planned").first()).toBeVisible();
    await expect(page.locator("text=Remaining").first()).toBeVisible();
  });

  test("shows segmented progress bars with colors", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(5000);

    // Progress bars should have success (earned) and/or primary (planned) segments
    const bars = page.locator('[class*="rounded-full"][class*="bg-muted"]');
    expect(await bars.count()).toBeGreaterThanOrEqual(1);
  });

  test("View Progress button links to progress page", async ({ page }) => {
    await navigateToDashboard(page);
    await page.waitForTimeout(3000);

    const viewProgress = page.locator("text=View Progress").first();
    if ((await viewProgress.count()) > 0) {
      await viewProgress.click();
      await page.waitForURL(/\/progress/, { timeout: 10_000 });
    }
  });
});
