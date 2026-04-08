import { type Page } from "@playwright/test";

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
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses|consent)/, {
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
