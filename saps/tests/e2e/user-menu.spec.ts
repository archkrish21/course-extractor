import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────
// Use the canonical login() from helpers.ts — the previous local copy had a
// narrow waitForURL regex (missing /consent and /onboarding) that hung when
// the seeded student briefly redirected through those routes after login.

async function loginAndGoToDashboard(page: Page) {
  await login(page);
  await page.goto("/dashboard");
  // The user menu button only mounts after AccountContext finishes loading
  // (the layout shows a placeholder with no aria-label="User menu" until then),
  // so we can't use waitForHydration with that selector. Wait for the
  // dashboard's "Welcome, ..." heading instead — it's rendered by the page
  // body once hydration and the initial data fetch complete.
  await expect(page.getByRole("heading", { name: /^Welcome/i })).toBeVisible({
    timeout: 15_000,
  });
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

  test("dropdown contains Settings and Sign out options", async ({ page }) => {
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

    await expect(page.locator('a[href="/settings"]').first()).toBeVisible({ timeout: 3_000 });
    // Billing link is hidden in FREE_LAUNCH_MODE (current state). Test it conditionally.
    const billingLink = page.locator('a[href="/settings/billing"]');
    if ((await billingLink.count()) > 0) {
      await expect(billingLink.first()).toBeVisible();
    }
    await expect(page.locator('button', { hasText: "Sign out" }).first()).toBeVisible();
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

    const billingLink = page.locator('a[href="/settings/billing"]');
    if ((await billingLink.count()) === 0) {
      // Billing link is hidden in FREE_LAUNCH_MODE — skip navigation check
      test.skip();
      return;
    }
    await billingLink.first().click();
    await page.waitForURL(/\/settings\/billing/, { timeout: 10_000 });
    expect(page.url()).toContain("/settings/billing");
  });
});

// ─── Sign Out Flow ──────────────────────────────────────────────────────────

test.describe("User Menu — Sign Out", () => {
  test("clicking Sign out redirects to home", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    if ((await userMenuBtn.count()) === 0) {
      test.skip();
      return;
    }
    await userMenuBtn.click();

    // The app's handleSignOut clears the session then sets
    // window.location.href = "/" — it does NOT go directly to /login.
    await page.locator('button', { hasText: "Sign out" }).first().click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("after sign out, navigating to /dashboard redirects to /login (auth guard)", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await loginAndGoToDashboard(page);

    // Sign out via user menu
    const userMenuBtn = page.locator('button[aria-label="User menu"]');
    if ((await userMenuBtn.count()) === 0) {
      test.skip();
      return;
    }
    await userMenuBtn.click();

    // Sign out lands on the public home page, not /login.
    await page.locator('button', { hasText: "Sign out" }).first().click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });

    // Try navigating to a protected route — auth middleware should redirect to /login
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
});

// ─── Mobile Sign Out ────────────────────────────────────────────────────────

test.describe("User Menu — Mobile Sign Out", () => {
  test("mobile hamburger menu has a Sign out button that redirects to home", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Mobile-only test");
    await loginAndGoToDashboard(page);

    // Open hamburger menu
    const hamburgerBtn = page.locator('button[aria-label="Open navigation menu"]');
    await expect(hamburgerBtn).toBeVisible({ timeout: 5_000 });
    await hamburgerBtn.click();

    // Sign out button should be visible in the mobile menu
    const signOutBtn = page.locator('nav[aria-label="Main navigation"] button', { hasText: "Sign out" });
    await expect(signOutBtn).toBeVisible({ timeout: 3_000 });

    // Click sign out — handleSignOut sets window.location.href = "/" then the
    // user can navigate to a protected route to be bounced to /login.
    await signOutBtn.click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/");
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
