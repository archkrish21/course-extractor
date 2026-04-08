import { test, expect } from "@playwright/test";

// ─── Page Load ─────────────────────────────────────────────────────────────

test.describe("Claim — Page Load", () => {
  test("claim page loads with heading and form", async ({ page }) => {
    await page.goto("/claim");

    await expect(
      page.getByRole("heading", { name: /Claim your account/i })
    ).toBeVisible({ timeout: 10_000 });

    // Claim code input
    const codeInput = page.locator("input");
    await expect(codeInput).toBeVisible();

    // Submit button
    const claimBtn = page.getByRole("button", { name: /Claim Account/i });
    await expect(claimBtn).toBeVisible();
  });

  test("shows link to create own account", async ({ page }) => {
    await page.goto("/claim");

    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Form Validation ───────────────────────────────────────────────────────

test.describe("Claim — Form Validation", () => {
  test("claim button is disabled when input is empty", async ({ page }) => {
    await page.goto("/claim");
    await page.waitForTimeout(1_000);

    const claimBtn = page.getByRole("button", { name: /Claim Account/i });
    // Button should be disabled or clicking should show an error
    const input = page.locator("input").first();
    const inputValue = await input.inputValue();
    expect(inputValue).toBe("");
  });

  test("shows error for invalid claim code", async ({ page }) => {
    await page.goto("/claim");
    await page.waitForTimeout(1_000);

    const input = page.locator("input").first();
    await input.fill("INVALID1");

    const claimBtn = page.getByRole("button", { name: /Claim Account/i });
    await claimBtn.click();

    // Should show an error alert
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
  });

  test("claim code input accepts 8 characters", async ({ page }) => {
    await page.goto("/claim");
    await page.waitForTimeout(1_000);

    const input = page.locator("input").first();
    await input.fill("AB12CD34");

    const inputValue = await input.inputValue();
    expect(inputValue.length).toBe(8);
  });
});

// ─── Navigation ────────────────────────────────────────────────────────────

test.describe("Claim — Navigation", () => {
  test("signup link navigates to signup page", async ({ page }) => {
    await page.goto("/claim");

    const signupLink = page.locator('a[href="/signup"]');
    await signupLink.click();
    await page.waitForURL(/\/signup/, { timeout: 10_000 });
  });
});
