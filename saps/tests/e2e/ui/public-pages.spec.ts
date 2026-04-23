import { test, expect } from "@playwright/test";

/**
 * Public pages: homepage hero, legal pages. No auth required.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("homepage shows hero heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your four-year plan\.\s*Granted\./i })
  ).toBeVisible({ timeout: 10_000 });
});

test("terms of service page shows heading and key sections", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.locator("h1", { hasText: "Terms of Service" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("text=Acceptance of Terms")).toBeVisible();
});

test("privacy policy page shows heading and COPPA/FERPA sections", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator("h1", { hasText: "Privacy Policy" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("text=/COPPA/").first()).toBeVisible();
  await expect(page.locator("text=/FERPA/").first()).toBeVisible();
});
