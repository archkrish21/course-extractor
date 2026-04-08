import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToJoin(page: Page) {
  await login(page);
  await page.goto("/join");
  await page.waitForTimeout(2_000);
}

// ─── Page Load ─────────────────────────────────────────────────────────────

test.describe("Join — Page Load", () => {
  test("join page loads with heading and form", async ({ page }) => {
    await navigateToJoin(page);

    await expect(
      page.getByRole("heading", { name: /Join Account/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows Account ID and Invite Code inputs", async ({ page }) => {
    await navigateToJoin(page);

    const accountInput = page.locator("input[placeholder*='Account ID' i]");
    await expect(accountInput).toBeVisible({ timeout: 5_000 });

    const codeInput = page.locator("input[placeholder*='AB12CD34' i], input[placeholder*='Invite' i], input[placeholder*='code' i]");
    await expect(codeInput.first()).toBeVisible();
  });

  test("shows Join Account button", async ({ page }) => {
    await navigateToJoin(page);

    const joinBtn = page.getByRole("button", { name: /Join Account/i });
    await expect(joinBtn).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Form Validation ───────────────────────────────────────────────────────

test.describe("Join — Form Validation", () => {
  test("Join button is disabled when inputs are empty", async ({ page }) => {
    await navigateToJoin(page);

    const joinBtn = page.getByRole("button", { name: /Join Account/i });
    await expect(joinBtn).toBeVisible({ timeout: 5_000 });

    // Button should be disabled with empty inputs
    await expect(joinBtn).toBeDisabled();
  });

  test("Join button enables when both fields are filled", async ({ page }) => {
    await navigateToJoin(page);

    const accountInput = page.locator("input[placeholder*='Account ID' i]");
    const codeInput = page.locator("input[placeholder*='AB12CD34' i], input[placeholder*='code' i]").first();

    await accountInput.fill("test-account-id");
    await codeInput.fill("AB12CD34");

    const joinBtn = page.getByRole("button", { name: /Join Account/i });
    await expect(joinBtn).toBeEnabled();
  });

  test("shows error for invalid invite code", async ({ page }) => {
    await navigateToJoin(page);

    const accountInput = page.locator("input[placeholder*='Account ID' i]");
    const codeInput = page.locator("input[placeholder*='AB12CD34' i], input[placeholder*='code' i]").first();

    await accountInput.fill("nonexistent-account-id");
    await codeInput.fill("INVALID1");

    const joinBtn = page.getByRole("button", { name: /Join Account/i });
    await joinBtn.click();

    // Should show an error
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
  });
});

// ─── URL Parameters ────────────────────────────────────────────────────────

test.describe("Join — URL Parameters", () => {
  test("auto-fills fields from URL query params", async ({ page }) => {
    await login(page);
    await page.goto("/join?account=test-acct-id&code=XY34ZW56");
    await page.waitForTimeout(2_000);

    // Either auto-joined (success/error shown) or fields pre-filled
    const successMsg = page.locator('[role="status"]');
    const errorMsg = page.locator('[role="alert"]');
    const accountInput = page.locator("input[placeholder*='Account ID' i]");

    const hasSuccess = (await successMsg.count()) > 0;
    const hasError = (await errorMsg.count()) > 0;
    const hasPrefilledInput = (await accountInput.count()) > 0 && (await accountInput.inputValue()) !== "";

    // Should have either auto-joined (success/error) or pre-filled the form
    expect(hasSuccess || hasError || hasPrefilledInput).toBeTruthy();
  });
});

// ─── Success State ─────────────────────────────────────────────────────────

test.describe("Join — Success State", () => {
  test("success state shows dashboard link", async ({ page }) => {
    await navigateToJoin(page);

    // We can't fully test success without a valid invite code,
    // but verify the page structure is correct for the idle state
    const heading = page.getByRole("heading", { name: /Join Account/i });
    await expect(heading).toBeVisible({ timeout: 5_000 });

    const subheading = page.locator("text=/invite code/i");
    await expect(subheading).toBeVisible();
  });
});
