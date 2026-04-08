import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses|consent)/, { timeout: 15_000 });
}

// ─── Page Load ─────────────────────────────────────────────────────────────

test.describe("Consent — Page Load", () => {
  test("consent page loads after login", async ({ page }) => {
    await login(page);
    await page.goto("/consent");
    await page.waitForTimeout(2_000);

    // Either shows consent form or redirects (if already accepted)
    const heading = page.locator("text=/Review Our Terms|Updated Our Terms/i");
    const dashboard = page.locator("text=/Welcome|Dashboard/i");

    const hasConsent = (await heading.count()) > 0;
    const redirected = (await dashboard.count()) > 0;
    expect(hasConsent || redirected).toBeTruthy();
  });
});

// ─── Consent Form ──────────────────────────────────────────────────────────

test.describe("Consent — Form Elements", () => {
  test("shows Terms of Service and Privacy Policy documents", async ({ page }) => {
    await login(page);
    await page.goto("/consent");
    await page.waitForTimeout(2_000);

    const heading = page.locator("text=/Review Our Terms|Updated Our Terms/i");
    if ((await heading.count()) === 0) {
      test.skip(true, "Consent already accepted — form not shown");
      return;
    }

    await expect(page.locator("text=Terms of Service")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=Privacy Policy")).toBeVisible();
  });

  test("shows View links for each document", async ({ page }) => {
    await login(page);
    await page.goto("/consent");
    await page.waitForTimeout(2_000);

    const heading = page.locator("text=/Review Our Terms|Updated Our Terms/i");
    if ((await heading.count()) === 0) {
      test.skip(true, "Consent already accepted");
      return;
    }

    const viewLinks = page.locator("a", { hasText: "View" });
    expect(await viewLinks.count()).toBeGreaterThanOrEqual(2);
  });

  test("Accept button is disabled until checkbox is checked", async ({ page }) => {
    await login(page);
    await page.goto("/consent");
    await page.waitForTimeout(2_000);

    const heading = page.locator("text=/Review Our Terms|Updated Our Terms/i");
    if ((await heading.count()) === 0) {
      test.skip(true, "Consent already accepted");
      return;
    }

    const acceptBtn = page.getByRole("button", { name: /Accept/i });
    await expect(acceptBtn).toBeVisible({ timeout: 5_000 });
    await expect(acceptBtn).toBeDisabled();

    // Check the consent checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    await checkbox.check();

    // Accept should now be enabled
    await expect(acceptBtn).toBeEnabled();
  });

  test("Decline button is visible", async ({ page }) => {
    await login(page);
    await page.goto("/consent");
    await page.waitForTimeout(2_000);

    const heading = page.locator("text=/Review Our Terms|Updated Our Terms/i");
    if ((await heading.count()) === 0) {
      test.skip(true, "Consent already accepted");
      return;
    }

    const declineBtn = page.getByRole("button", { name: /Decline/i });
    await expect(declineBtn).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Auto-Redirect ─────────────────────────────────────────────────────────

test.describe("Consent — Auto-Redirect", () => {
  test("redirects to dashboard if consent already given", async ({ page }) => {
    await login(page);

    // If user has already consented, /consent should redirect
    await page.goto("/consent");
    await page.waitForTimeout(3_000);

    const heading = page.locator("text=/Review Our Terms|Updated Our Terms/i");
    if ((await heading.count()) > 0) {
      test.skip(true, "Consent not yet given — cannot test redirect");
      return;
    }

    // Should have redirected away from /consent
    expect(page.url()).not.toContain("/consent");
  });
});
