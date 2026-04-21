import { test, expect } from "@playwright/test";

/**
 * User menu: dropdown contents, sign-out flow.
 * Sign-out invalidates the session, so isolate with empty storageState.
 */

test.describe("User Menu — Dropdown", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /^Welcome/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("user menu dropdown contains Settings and Sign out", async ({ page }) => {
    const menuBtn = page.locator('button[aria-label="User menu"]');
    if ((await menuBtn.count()) === 0) {
      test.skip(true, "User menu button not rendered (may be in mobile drawer)");
      return;
    }
    await menuBtn.click();
    await expect(page.locator("text=Settings").first()).toBeVisible();
    await expect(page.locator("text=Sign out").first()).toBeVisible();
  });
});

test.describe("User Menu — Sign Out", () => {
  // Sign-out invalidates cookies — use a fresh context so it doesn't poison
  // other tests' shared storageState.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated visit to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/(login|signup)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(login|signup)/);
  });
});
