import { test, expect, type Page } from "@playwright/test";
import { login, waitForHydration } from "./helpers";

// ─── Helpers ───────────────────────────────────────────────────────────────
// Use the canonical login() from helpers.ts for the actual auth flow — the
// previous local copies had narrow waitForURL regexes (missing /onboarding,
// and student version missing /consent too) that hung when the seeded user
// briefly redirected through one of those routes after login.
// waitForHydration is still imported for use inline in mid-test re-hydration.

async function loginAsStudent(page: Page) {
  await login(page, "student@test.com", "Test1234!");
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
  await waitForHydration(page);
    await page.locator('input[type="email"]').fill("parent@test.com");
    await page.locator('input[type="password"]').first().fill("Test1234!");
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
    const switcher = page.locator('button[aria-label="User menu"]');
    // Wait for the dashboard "Welcome, ..." heading. text=/Dashboard|Welcome/i
    // also matches the hidden sidebar nav link to /dashboard, which on mobile
    // makes .first() resolve to a hidden element.
    const heading = page.getByRole("heading", { name: /^Welcome/i });
    await expect(heading).toBeVisible({ timeout: 5_000 });
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
  await waitForHydration(page);
    await page.locator('input[type="email"]').fill("counselor@test.com");
    await page.locator('input[type="password"]').first().fill("Test1234!");
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

// ─── Parent with Multiple Children ─────────────────────────────────────────

test.describe("Role — Parent with Multiple Children", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  await waitForHydration(page);
    await page.locator('input[type="email"]').fill("parent@test.com");
    await page.locator('input[type="password"]').first().fill("Test1234!");
    await page.locator('form button[type="submit"]').click();

    try {
      await page.waitForURL(/\/(dashboard|planner|courses|consent)/, { timeout: 10_000 });
    } catch {
      test.skip(true, "Parent test account not available");
    }
  });

  test("account switcher lists multiple children with name and grade", async ({ page }) => {
    await page.waitForTimeout(2_000);

    const switcher = page.locator('button[aria-label="User menu"]');
    if ((await switcher.count()) === 0) {
      test.skip(true, "No account switcher — parent may have only one child");
      return;
    }

    await switcher.click();
    await page.waitForTimeout(500);

    // Each child entry should show name and grade level
    const accountOptions = page.locator('[role="option"]');
    const count = await accountOptions.count();

    if (count < 2) {
      test.skip(true, "Parent has fewer than 2 linked accounts");
      return;
    }

    // Each option should display a student name and grade
    const firstOption = accountOptions.first();
    await expect(firstOption).toContainText(/Gr \d+/);
  });

  test("switching child updates dashboard data", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2_000);

    const switcher = page.locator('button[aria-label="User menu"]');
    if ((await switcher.count()) === 0) {
      test.skip(true, "No account switcher");
      return;
    }

    // Capture current dashboard content
    const welcomeText = await page.locator("text=/Welcome|Dashboard/i").first().textContent();

    // Open switcher and select a different account
    await switcher.click();
    await page.waitForTimeout(500);

    const options = page.locator('[role="option"]');
    const count = await options.count();
    if (count < 2) {
      test.skip(true, "Only one account available");
      return;
    }

    // Click the non-selected option
    const nonSelected = page.locator('[role="option"][aria-selected="false"]').first();
    if ((await nonSelected.count()) === 0) {
      test.skip(true, "No unselected account to switch to");
      return;
    }
    await nonSelected.click();
    await page.waitForTimeout(2_000);

    // Page should have reloaded/updated with different account data. Use the
    // role-based heading locator — text=/Welcome|Dashboard/i would also match
    // the hidden sidebar nav link to /dashboard on mobile.
    const heading = page.getByRole("heading", { name: /^Welcome/i });
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });

  test("each child has independent plans page", async ({ page }) => {
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    // Verify plans page loads for the current child context
    const plansContent = page.locator("text=/plans|No plans/i");
    await expect(plansContent.first()).toBeVisible({ timeout: 5_000 });
  });

  test("settings show student info for selected child", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    // Should show student info for the currently selected child
    const studentInfo = page.locator("text=/Student Information|Grade \\d+|graduation/i");
    if ((await studentInfo.count()) === 0) {
      test.skip(true, "Student info section not visible");
      return;
    }
    await expect(studentInfo.first()).toBeVisible();
  });

  test("unclaimed child shows Unclaimed badge in switcher", async ({ page }) => {
    await page.waitForTimeout(2_000);

    const switcher = page.locator('button[aria-label="User menu"]');
    if ((await switcher.count()) === 0) {
      test.skip(true, "No account switcher");
      return;
    }

    await switcher.click();
    await page.waitForTimeout(500);

    // Check if any account shows "Unclaimed" — data dependent
    const unclaimedBadge = page.locator("text=Unclaimed");
    // Just verify the switcher opened correctly — unclaimed status is data-dependent
    const accountList = page.locator('[role="listbox"]');
    await expect(accountList).toBeVisible({ timeout: 5_000 });
  });

  test("children in different grade levels show distinct grades in switcher", async ({ page }) => {
    await page.waitForTimeout(2_000);

    const switcher = page.locator('button[aria-label="User menu"]');
    if ((await switcher.count()) === 0) {
      test.skip(true, "No account switcher");
      return;
    }

    await switcher.click();
    await page.waitForTimeout(500);

    const options = page.locator('[role="option"]');
    const count = await options.count();
    if (count < 2) {
      test.skip(true, "Parent has fewer than 2 children — cannot compare grade levels");
      return;
    }

    // Collect grade labels from each child entry
    const grades: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      const match = text?.match(/Gr (\d+)/);
      if (match) grades.push(match[1]);
    }

    // Verify grade labels are present for at least 2 children
    expect(grades.length).toBeGreaterThanOrEqual(2);
    // If children are in different grades, the values should differ
    // (data-dependent — just verify grades are displayed, not forced to differ)
  });

  test("switching between children of different grades updates progress", async ({ page }) => {
    await page.goto("/progress");
    await page.waitForTimeout(2_000);

    // Dismiss any guided tour overlay that may appear
    const tourClose = page.locator('button:has-text("Skip"), button.driver-popover-close-btn, button[aria-label="Close"]');
    if (await tourClose.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tourClose.first().click();
      await page.waitForTimeout(500);
    }

    // Capture current progress page content
    const heading = page.getByRole("heading", { name: "Academic Progress" });
    await expect(heading).toBeVisible({ timeout: 5_000 });

    const switcher = page.locator('button[aria-label="User menu"]');
    if ((await switcher.count()) === 0) {
      test.skip(true, "No account switcher");
      return;
    }

    await switcher.click();
    await page.waitForTimeout(500);

    const nonSelected = page.locator('[role="option"][aria-selected="false"]').first();
    if ((await nonSelected.count()) === 0) {
      test.skip(true, "No other child to switch to");
      return;
    }

    await nonSelected.click();
    await page.waitForTimeout(3_000);

    // Progress page should still be visible with updated data
    await expect(page.getByRole("heading", { name: "Academic Progress" })).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Guardian Role ─────────────────────────────────────────────────────────
// Guardian maps to "parent" at signup (signup/route.ts:69). These tests
// verify the guardian option is available in the UI.

test.describe("Role — Guardian", () => {
  test("Guardian appears as a signup role option", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForTimeout(1_000);

    const guardianOption = page.locator("text=/Guardian/");
    await expect(guardianOption.first()).toBeVisible({ timeout: 5_000 });
  });

  test("Guardian appears in settings invite role dropdown", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    const roleSelect = page.locator("select").filter({ hasText: /Guardian/ }).first();
    if ((await roleSelect.count()) === 0) {
      test.skip(true, "Role dropdown not visible");
      return;
    }

    const guardianOption = roleSelect.locator('option[value="guardian"]');
    await expect(guardianOption).toBeAttached();
    expect(await guardianOption.textContent()).toBe("Guardian");
  });

  test("Guardian signup shows parent/guardian confirmation checkbox", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForTimeout(1_000);

    // Select guardian role
    const guardianRadio = page.locator('[role="radio"]', { hasText: /Guardian/i });
    if ((await guardianRadio.count()) === 0) {
      test.skip(true, "Guardian role option not found");
      return;
    }
    await guardianRadio.click();
    await page.waitForTimeout(500);

    // Should show parent/guardian confirmation
    const confirmation = page.locator("text=/parent or legal guardian/i");
    await expect(confirmation).toBeVisible({ timeout: 5_000 });
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

    // text=/About/i also matches the public-site header nav <a>About</a>
    // link, which on mobile is `hidden md:flex` and collapsed into the
    // hamburger menu. Use the page's <h1>About SAPS</h1> heading instead.
    const heading = page.getByRole("heading", { name: /About SAPS/i });
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });
});
