import { type Page } from "@playwright/test";

/**
 * Wait for React hydration to attach event handlers to the given element.
 * networkidle isn't reliable on mobile — lazy JS chunks load in waves and
 * networkidle's 500ms gap can fire between bursts before hydration finishes.
 * The most reliable signal is the presence of a React fiber/props key on the
 * actual DOM node. Until that exists, click events fall through to native
 * form submission (which loses field values and stays on the same page).
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
 * Log in as a test user.
 * Defaults to student@test.com / Test1234!
 */
export async function login(
  page: Page,
  email = "student@test.com",
  password = "Test1234!"
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

/** Log in and navigate to a specific page. */
export async function loginAndGoTo(
  page: Page,
  path: string,
  waitMs = 2_000
) {
  await login(page);
  await page.goto(path);
  await page.waitForTimeout(waitMs);
}
