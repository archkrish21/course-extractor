import { test, expect, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await waitForHydration(page);
  await page.locator('input[type="email"]').fill("student@test.com");
  await page.locator('input[type="password"]').first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToBilling(page: Page) {
  await login(page);
  await page.goto("/settings/billing");
  await page.waitForTimeout(2000);
}

// NOTE: FREE_LAUNCH_MODE is currently enabled, which collapses the entire
// billing page to a single "Free Early Access" notice. The detailed pricing
// cards, interval toggle, upgrade buttons, and Stripe-aware UI are intentionally
// hidden until FREE_LAUNCH_MODE is turned off. These tests validate the
// simplified view; richer assertions should be added back when paid plans go live.

// ─── Free Launch Mode View ──────────────────────────────────────────────────

test.describe("Billing — Page Load", () => {
  test("billing page loads successfully", async ({ page }) => {
    await navigateToBilling(page);
    await expect(
      page.getByRole("heading", { name: "Billing", exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows Free Early Access notice", async ({ page }) => {
    await navigateToBilling(page);
    await expect(page.locator("text=Free Early Access")).toBeVisible({ timeout: 10_000 });
  });

  test("shows no credit card required messaging", async ({ page }) => {
    await navigateToBilling(page);
    await expect(page.locator("text=/no credit card required/i")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Billing — Navigation", () => {
  test("billing page accessible via /settings/billing URL", async ({ page }) => {
    await navigateToBilling(page);
    await expect(
      page.getByRole("heading", { name: "Billing", exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Back to Settings link is present", async ({ page }) => {
    await navigateToBilling(page);
    await expect(page.getByRole("link", { name: "Back to Settings" })).toBeVisible({ timeout: 10_000 });
  });
});
