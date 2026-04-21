import { test, expect } from "@playwright/test";
import { waitForHydration } from "../helpers/auth";

/**
 * Auth UI tests: signup form, login validation, route protection.
 * All run with empty storageState since they test unauthenticated flows.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login", () => {
  test("login with valid student credentials redirects to app", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
    await waitForHydration(page);

    await page.locator('input[type="email"]').fill("student@test.com");
    await page.locator('input[type="password"]').first().fill("Test1234!");
    await page.locator('form button[type="submit"]').click();

    await page.waitForURL(/\/(dashboard|planner|courses|consent|onboarding)/, {
      timeout: 15_000,
    });
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
    await waitForHydration(page);

    await page.locator('input[type="email"]').fill("nobody@test.com");
    await page.locator('input[type="password"]').first().fill("WrongPassword123!");
    await page.locator('form button[type="submit"]').click();

    const errorAlert = page
      .locator('[role="alert"]')
      .filter({ hasText: /Invalid|Account not found|incorrect/i })
      .first();
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Route Protection", () => {
  test("/dashboard redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });

  test("/planner redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/planner");
    await page.waitForURL(/\/(login|signup)/, { timeout: 10_000 });
  });

  test("/courses redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/courses");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe("Signup", () => {
  test("signup page renders form with age and ToS checkboxes", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "Create your account" })
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator("#age-confirm-checkbox")).toBeVisible();
    await expect(page.locator("#tos-checkbox")).toBeVisible();
  });

  test("Create account button is disabled until ToS is accepted", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "Create your account" })
    ).toBeVisible({ timeout: 10_000 });

    const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /Create account/i });
    await expect(submitBtn).toBeDisabled();
  });
});
