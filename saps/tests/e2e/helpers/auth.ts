import { type Page, expect } from "@playwright/test";
import { TEST_PASSWORD } from "../fixtures/test-users";

/**
 * Wait for React hydration to attach event handlers.
 * networkidle isn't reliable — the most robust signal is the presence of
 * React fiber keys on the actual DOM node.
 */
export async function waitForHydration(
  page: Page,
  selector = 'form button[type="submit"]',
  timeout = 15_000
) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return Object.keys(el).some(
        (k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps")
      );
    },
    selector,
    { timeout }
  );
}

/**
 * Log in via the UI login form. Used by auth.setup.ts to create storageState
 * files. Tests themselves should use the pre-saved storageState (configured
 * per-project in playwright.config.ts) instead of calling login() directly.
 */
export async function loginViaForm(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD
) {
  await page.goto("/login");
  await waitForHydration(page);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses|consent|onboarding)/, {
    timeout: 15_000,
  });
}

/**
 * Assert that a page is already authenticated by visiting /dashboard.
 * Used in tests to confirm storageState is working before proceeding.
 */
export async function assertAuthenticated(page: Page) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/(dashboard|planner|courses)/);
}
