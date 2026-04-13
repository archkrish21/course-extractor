import { test, expect } from "@playwright/test";
import { waitForHydration, login } from "./helpers";

/**
 * E2E tests for password reset flows:
 * 1. Forgot password page (unauthenticated)
 * 2. Settings page inline password change (authenticated)
 * 3. Login page "Forgot password?" link
 */

const MAILPIT_URL = "http://127.0.0.1:54324";

/** Fetch the recovery URL from the latest email sent to the given address. */
async function getRecoveryUrl(
  toEmail: string,
  retries = 10,
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const searchRes = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(toEmail)}`,
    );
    const data = await searchRes.json();

    if (data.messages?.length > 0) {
      const msgId = data.messages[0].ID;
      const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${msgId}`);
      const msg = await msgRes.json();
      const html = msg.HTML || "";

      // Recovery emails link to /auth/v1/verify with type=recovery
      const match = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
      if (match) {
        return match[1].replace(/&amp;/g, "&");
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(
    `No recovery email found for ${toEmail} after ${retries} retries`,
  );
}

/** Delete all emails in Mailpit. */
async function purgeAllEmails() {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

// ─── Login page — Forgot password link ────────────────────────────────────

test.describe("Password Reset — Login Page Link", () => {
  test("login page has a 'Forgot password?' link pointing to /forgot-password", async ({
    page,
  }) => {
    await page.goto("/login");
    await waitForHydration(page);

    const forgotLink = page.getByRole("link", { name: "Forgot password?" });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute("href", "/forgot-password");
  });

  test("clicking 'Forgot password?' navigates to the forgot password page", async ({
    page,
  }) => {
    await page.goto("/login");
    await waitForHydration(page);

    await page.getByRole("link", { name: "Forgot password?" }).click();
    await page.waitForURL("**/forgot-password", { timeout: 10_000 });

    await expect(
      page.getByRole("heading", { name: "Reset your password" }),
    ).toBeVisible();
  });
});

// ─── Forgot password page ─────────────────────────────────────────────────

test.describe("Password Reset — Forgot Password Page", () => {
  test("shows validation error for empty email", async ({ page }) => {
    await page.goto("/forgot-password");
    await waitForHydration(page);

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("Email is required")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("shows validation error for invalid email format", async ({ page }) => {
    await page.goto("/forgot-password");
    await waitForHydration(page);

    await page.locator('input[type="email"]').fill("not-an-email");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("Enter a valid email")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("has a 'Sign in' link back to login", async ({ page }) => {
    await page.goto("/forgot-password");
    await waitForHydration(page);

    const signInLink = page.getByRole("link", { name: "Sign in" });
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute("href", "/login");
  });

  test("shows 'Check your email' screen after submitting valid email", async ({
    page,
  }) => {
    await purgeAllEmails();
    await page.goto("/forgot-password");
    await waitForHydration(page);

    await page.locator('input[type="email"]').fill("student@test.com");
    await page.locator('button[type="submit"]').click();

    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("student@test.com")).toBeVisible();
    await expect(page.getByText("Try again")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
  });
});

// ─── Full forgot password flow ────────────────────────────────────────────

test.describe("Password Reset — Full Forgot Password Flow", () => {
  test.beforeAll(async () => {
    await purgeAllEmails();
  });

  test("forgot password sends recovery email and clicking link lands on update-password page", async ({
    page,
  }) => {
    // Step 1: Request password reset
    await page.goto("/forgot-password");
    await waitForHydration(page);

    await page.locator('input[type="email"]').fill("student@test.com");
    await page.locator('button[type="submit"]').click();

    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible({ timeout: 15_000 });

    // Step 2: Fetch recovery URL from Mailpit
    const recoveryUrl = await getRecoveryUrl("student@test.com");
    expect(recoveryUrl).toBeTruthy();

    // Step 3: Navigate to recovery link
    // Supabase verifies the token and redirects to our /auth/confirm?type=recovery
    await page.goto(recoveryUrl);

    // Should land on the update-password page
    await page.waitForURL("**/update-password", { timeout: 15_000 });

    await expect(
      page.getByRole("heading", { name: "Set new password" }),
    ).toBeVisible();
  });
});

// ─── Update password page ─────────────────────────────────────────────────

test.describe("Password Reset — Update Password Page", () => {
  test("shows password strength validation as user types", async ({
    page,
  }) => {
    // We need a session to use updateUser — log in first, then navigate
    await login(page);
    await page.goto("/update-password");
    await waitForHydration(page);

    // Type a weak password
    await page.locator('input[type="password"]').first().fill("ab");

    // Should show validation indicators
    await expect(page.getByText("At least 8 characters")).toBeVisible();
    await expect(page.getByText("One uppercase letter")).toBeVisible();
    await expect(page.getByText("One number")).toBeVisible();
    await expect(page.getByText("One special character")).toBeVisible();
  });

  test("shows mismatch error when passwords don't match", async ({ page }) => {
    await login(page);
    await page.goto("/update-password");
    await waitForHydration(page);

    await page.locator('input[type="password"]').first().fill("NewPass123!");
    await page.locator('input[type="password"]').last().fill("Different456!");

    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });
});

// ─── Settings page — inline password change ───────────────────────────────

test.describe("Password Reset — Settings Inline Change", () => {
  test("clicking password edit shows change form and Cancel hides it", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    // Find and click the password edit pencil button
    const passwordSection = page.locator("text=Password").first();
    await expect(passwordSection).toBeVisible();

    // Click the password row edit button (the pencil icon next to "--------")
    const editButton = page
      .locator("button")
      .filter({ hasText: "--------" });
    await editButton.click();

    // Should show the password form card with inputs
    await expect(
      page.getByPlaceholder("Enter new password"),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByPlaceholder("Confirm new password"),
    ).toBeVisible();

    // Both inputs should have show/hide toggle (eye icon)
    const passwordInputWrappers = page.locator(
      'input[autocomplete="new-password"]',
    );
    await expect(passwordInputWrappers).toHaveCount(2);

    // Cancel button should hide the form
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(
      page.getByPlaceholder("Enter new password"),
    ).not.toBeVisible();
  });

  test("shows 'Editing...' text in the card when password form is open", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    // Open the password form
    const editButton = page
      .locator("button")
      .filter({ hasText: "--------" });
    await editButton.click();

    // The password row in the main card should show "Editing..."
    await expect(page.getByText("Editing...").last()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("successfully changes password via settings page", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForTimeout(2_000);

    // Open password form
    const editButton = page
      .locator("button")
      .filter({ hasText: "--------" });
    await editButton.click();

    // Fill in new password (same as current to keep test account working)
    await page.getByPlaceholder("Enter new password").fill("Test1234!");
    await page.getByPlaceholder("Confirm new password").fill("Test1234!");

    // Click Save
    await page.getByRole("button", { name: "Save" }).click();

    // Should show success toast
    await expect(page.getByText("Password updated successfully")).toBeVisible({
      timeout: 10_000,
    });

    // Form should close
    await expect(
      page.getByPlaceholder("Enter new password"),
    ).not.toBeVisible();
  });
});

// ─── Login page — password_updated banner ─────────────────────────────────

test.describe("Password Reset — Login Page Banners", () => {
  test("shows success banner when redirected with password_updated=true", async ({
    page,
  }) => {
    await page.goto("/login?password_updated=true");

    await expect(
      page.getByText("Password updated successfully"),
    ).toBeVisible({ timeout: 10_000 });
  });
});
