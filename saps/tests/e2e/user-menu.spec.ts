import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function loginAndGoToDashboard(page: Page) {
  await login(page);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
}

// ─── User Menu Visibility ───────────────────────────────────────────────────

test.describe("User Menu — Visibility", () => {
  test("user avatar is visible in top nav after login", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    // Account may be single (User menu) or multi (Switch account)
    const switchAccountBtn = page.locator('button[aria-label="Switch account"]');

    const hasUserMenu = (await userMenuBtn.count()) > 0;
    const hasSwitchAccount = (await switchAccountBtn.count()) > 0;
    expect(hasUserMenu || hasSwitchAccount).toBeTruthy();
  });

  test("clicking avatar opens dropdown menu", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    if ((await userMenuBtn.count()) === 0) {
      test.skip(); // Multi-account switcher, different UI
      return;
    }

    await expect(userMenuBtn).toHaveAttribute("aria-expanded", "false");
    await userMenuBtn.click();
    await expect(userMenuBtn).toHaveAttribute("aria-expanded", "true");
  });

  test("dropdown contains Settings, Billing, and Sign out options", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    // Open user menu (works for both single and multi-account)
    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    const switchAccountBtn = page.locator('button[aria-label="Switch account"]');

    if ((await userMenuBtn.count()) > 0) {
      await userMenuBtn.click();
    } else if ((await switchAccountBtn.count()) > 0) {
      await switchAccountBtn.click();
    } else {
      test.skip();
      return;
    }

    await expect(page.locator('a[href="/settings"]')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('a[href="/settings/billing"]')).toBeVisible();
    await expect(page.locator('button', { hasText: "Sign out" })).toBeVisible();
  });
});

// ─── Navigation From User Menu ──────────────────────────────────────────────

test.describe("User Menu — Navigation", () => {
  test("clicking Settings navigates to /settings", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    const switchAccountBtn = page.locator('button[aria-label="Switch account"]');

    if ((await userMenuBtn.count()) > 0) {
      await userMenuBtn.click();
    } else if ((await switchAccountBtn.count()) > 0) {
      await switchAccountBtn.click();
    } else {
      test.skip();
      return;
    }

    await page.locator('a[href="/settings"]').click();
    await page.waitForURL(/\/settings/, { timeout: 10_000 });
    expect(page.url()).toContain("/settings");
  });

  test("clicking Billing navigates to /settings/billing", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    const switchAccountBtn = page.locator('button[aria-label="Switch account"]');

    if ((await userMenuBtn.count()) > 0) {
      await userMenuBtn.click();
    } else if ((await switchAccountBtn.count()) > 0) {
      await switchAccountBtn.click();
    } else {
      test.skip();
      return;
    }

    await page.locator('a[href="/settings/billing"]').click();
    await page.waitForURL(/\/settings\/billing/, { timeout: 10_000 });
    expect(page.url()).toContain("/settings/billing");
  });
});

// ─── Sign Out Flow ──────────────────────────────────────────────────────────

test.describe("User Menu — Sign Out", () => {
  test("clicking Sign out redirects to /login", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    const switchAccountBtn = page.locator('button[aria-label="Switch account"]');

    if ((await userMenuBtn.count()) > 0) {
      await userMenuBtn.click();
    } else if ((await switchAccountBtn.count()) > 0) {
      await switchAccountBtn.click();
    } else {
      test.skip();
      return;
    }

    await page.locator('button', { hasText: "Sign out" }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("after sign out, navigating to /dashboard redirects to /login (auth guard)", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    // Sign out via user menu
    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    const switchAccountBtn = page.locator('button[aria-label="Switch account"]');

    if ((await userMenuBtn.count()) > 0) {
      await userMenuBtn.click();
    } else if ((await switchAccountBtn.count()) > 0) {
      await switchAccountBtn.click();
    } else {
      test.skip();
      return;
    }

    await page.locator('button', { hasText: "Sign out" }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });

    // Try navigating to a protected route
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
});

// ─── Mobile Sign Out ────────────────────────────────────────────────────────

test.describe("User Menu — Mobile Sign Out", () => {
  test("mobile hamburger menu has a Sign out button that redirects to /login", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Mobile-only test");
    await loginAndGoToDashboard(page);

    // Open hamburger menu
    const hamburgerBtn = page.locator('button[aria-label="Open navigation menu"]');
    await expect(hamburgerBtn).toBeVisible({ timeout: 5_000 });
    await hamburgerBtn.click();

    // Sign out button should be visible in the mobile menu
    const signOutBtn = page.locator('nav[aria-label="Main navigation"] button', { hasText: "Sign out" });
    await expect(signOutBtn).toBeVisible({ timeout: 3_000 });

    // Click sign out
    await signOutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
});

// ─── Settings Not In Main Nav ───────────────────────────────────────────────

test.describe("User Menu — Settings Not In Main Nav", () => {
  test("main navigation bar does NOT contain a Settings link", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    // The desktop main navigation
    const mainNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(mainNav).toBeVisible({ timeout: 5_000 });

    // Settings should NOT be among the main nav links
    const settingsLink = mainNav.locator("a", { hasText: "Settings" });
    expect(await settingsLink.count()).toBe(0);
  });
});
