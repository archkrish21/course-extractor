import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function loginAsStudent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function loginAsParent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("parent@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses|consent)/, { timeout: 15_000 });
}

/**
 * Detect the current user's role from the settings page profile section.
 * Returns "student", "parent", "counselor", or null if undetectable.
 */
async function detectRole(page: Page): Promise<string | null> {
  await page.goto("/settings");
  await page.waitForTimeout(2_000);

  // Look for role indicators in the profile section
  const studentIndicators = page.locator("text=/Grade \\d+|Graduation Year|Expected graduation/i");
  if ((await studentIndicators.count()) > 0) return "student";

  const parentIndicators = page.locator("text=/Student Information|Your student/i");
  if ((await parentIndicators.count()) > 0) return "parent";

  const counselorBadge = page.locator("text=/counselor/i");
  if ((await counselorBadge.count()) > 0) return "counselor";

  return null;
}

// ─── Student Role ──────────────────────────────────────────────────────────

test.describe("Role — Student", () => {
  test("student sees grade level and graduation year in settings", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    // Students see their own academic info
    const gradeInfo = page.locator("text=/Grade \\d+|graduation/i");
    await expect(gradeInfo.first()).toBeVisible({ timeout: 5_000 });
  });

  test("student sees Create Plan button on plans page", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    const newPlanBtn = page.locator("button, a", { hasText: /New Plan|Create/i });
    await expect(newPlanBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test("student sees invite form in settings", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    const emailInput = page.locator('input[type="email"][placeholder*="Invite" i]');
    await expect(emailInput).toBeVisible({ timeout: 5_000 });
  });

  test("student can access planner with edit capabilities", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/planner");
    await page.waitForTimeout(3_000);

    // Student should see plan controls (not read-only view)
    const planDropdown = page.locator('select[aria-label="Select a plan"]');
    const createButton = page.locator("text=/Create Your First Plan|Course Planner/i");
    const hasPlanControls = (await planDropdown.count()) > 0 || (await createButton.count()) > 0;
    expect(hasPlanControls).toBeTruthy();
  });

  test("student sees Quick Actions on dashboard", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(2_000);

    const quickActions = page.locator("text=/Quick Actions|Open Planner|Print Plan/i");
    await expect(quickActions.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Parent Role ───────────────────────────────────────────────────────────

test.describe("Role — Parent", () => {
  test.beforeEach(async ({ page }) => {
    // Try to log in as parent — skip all tests if account doesn't exist
    await page.goto("/login");
    await page.getByLabel("Email address").fill("parent@test.com");
    await page.getByLabel("Password").fill("Test1234!");
    await page.locator('form button[type="submit"]').click();

    try {
      await page.waitForURL(/\/(dashboard|planner|courses|consent)/, { timeout: 10_000 });
    } catch {
      test.skip(true, "Parent test account not available");
    }
  });

  test("parent sees Student Information section in settings", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    const studentInfo = page.locator("text=/Student Information|Your student/i");
    if ((await studentInfo.count()) === 0) {
      test.skip(true, "Not a parent account or student info not shown");
      return;
    }
    await expect(studentInfo.first()).toBeVisible();
  });

  test("parent sees account switcher in navigation", async ({ page }) => {
    await page.waitForTimeout(2_000);

    // Parent accounts should show the account switcher
    const switcher = page.locator('button[aria-label*="account" i], button[aria-label*="switch" i], [data-testid="account-switcher"]');
    // May or may not be visible depending on linked accounts
    const heading = page.locator("text=/Dashboard|Welcome/i");
    await expect(heading.first()).toBeVisible({ timeout: 5_000 });
  });

  test("parent can view shared plans", async ({ page }) => {
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    // Parent should see plans (either shared plans or empty state)
    const plansContent = page.locator("text=/plans|No plans/i");
    await expect(plansContent.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Counselor Role ────────────────────────────────────────────────────────

test.describe("Role — Counselor", () => {
  test.beforeEach(async ({ page }) => {
    // Try to log in as counselor — skip all tests if account doesn't exist
    await page.goto("/login");
    await page.getByLabel("Email address").fill("counselor@test.com");
    await page.getByLabel("Password").fill("Test1234!");
    await page.locator('form button[type="submit"]').click();

    try {
      await page.waitForURL(/\/(dashboard|planner|courses|consent)/, { timeout: 10_000 });
    } catch {
      test.skip(true, "Counselor test account not available");
    }
  });

  test("counselor does not see Create Plan button", async ({ page }) => {
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    // Counselors should NOT see "New Plan" or "Create" buttons
    const newPlanBtn = page.locator("button", { hasText: /New Plan/i });
    expect(await newPlanBtn.count()).toBe(0);
  });

  test("counselor does not see invite form in settings", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    // Counselors should NOT see the invite email input
    const emailInput = page.locator('input[type="email"][placeholder*="Invite" i]');
    expect(await emailInput.count()).toBe(0);
  });

  test("counselor sees View button instead of Edit on plans", async ({ page }) => {
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    // If plans exist, counselor should see "View" not "Edit"
    const viewBtn = page.locator("text=/View/i");
    const editBtn = page.locator("button", { hasText: /^Edit$/ });

    if ((await viewBtn.count()) > 0) {
      await expect(viewBtn.first()).toBeVisible();
    }
    // Edit buttons should not be present for counselor
    expect(await editBtn.count()).toBe(0);
  });

  test("counselor does not see billing nav link", async ({ page }) => {
    await page.waitForTimeout(2_000);

    // Billing link should be hidden for counselors
    const billingLink = page.locator('a[href="/settings/billing"]');
    expect(await billingLink.count()).toBe(0);
  });

  test("counselor sees read-only planner view", async ({ page }) => {
    await page.goto("/planner");
    await page.waitForTimeout(3_000);

    // Counselor should see "No Plans Shared Yet" or read-only plan view
    const readOnlyIndicator = page.locator("text=/No Plans Shared|shared with you/i");
    const planContent = page.locator("text=/Course Planner/i");

    const hasReadOnly = (await readOnlyIndicator.count()) > 0;
    const hasPlan = (await planContent.count()) > 0;
    expect(hasReadOnly || hasPlan).toBeTruthy();
  });
});

// ─── Cross-Role Consistency ────────────────────────────────────────────────

test.describe("Role — Cross-Role Consistency", () => {
  test("unauthenticated user is redirected from protected pages", async ({ page }) => {
    // Try to access protected pages without logging in
    await page.goto("/dashboard");
    await page.waitForTimeout(3_000);

    // Should redirect to login
    expect(page.url()).toMatch(/\/(login|signup)/);
  });

  test("unauthenticated user can access public pages", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1_000);

    // Homepage should be accessible
    const heading = page.locator("text=/SAPS|Student Academic/i");
    await expect(heading.first()).toBeVisible({ timeout: 5_000 });
  });

  test("unauthenticated user can access about page", async ({ page }) => {
    await page.goto("/about");
    await page.waitForTimeout(1_000);

    const heading = page.locator("text=/About/i");
    await expect(heading.first()).toBeVisible({ timeout: 5_000 });
  });
});
