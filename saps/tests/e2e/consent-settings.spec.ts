import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToSettings(page: Page) {
  await login(page);
  await page.goto("/settings");
  await expect(page.locator("text=Settings")).toBeVisible({ timeout: 10_000 });
}

// ─── Terms Page ─────────────────────────────────────────────────────────────

test.describe("Terms Page", () => {
  test("displays Terms of Service heading", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1", { hasText: "Terms of Service" })).toBeVisible({ timeout: 5_000 });
  });

  test("contains key sections (Acceptance, Description, Disclaimer)", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1", { hasText: "Terms of Service" })).toBeVisible({ timeout: 5_000 });

    await expect(page.locator("text=Acceptance of Terms")).toBeVisible();
    await expect(page.locator("text=Description of Service")).toBeVisible();
    await expect(page.locator("text=Disclaimer of Warranties")).toBeVisible();
  });
});

// ─── Privacy Page ───────────────────────────────────────────────────────────

test.describe("Privacy Page", () => {
  test("displays Privacy Policy heading", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1", { hasText: "Privacy Policy" })).toBeVisible({ timeout: 5_000 });
  });

  test("contains key sections (Information We Collect, COPPA, FERPA)", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1", { hasText: "Privacy Policy" })).toBeVisible({ timeout: 5_000 });

    await expect(page.locator("text=Information We Collect")).toBeVisible();
    await expect(page.locator("text=/COPPA/")).toBeVisible();
    await expect(page.locator("text=/FERPA/")).toBeVisible();
  });
});

// ─── Auth Layout Footer ────────────────────────────────────────────────────

test.describe("Auth Layout Footer", () => {
  test("login page has Terms of Service and Privacy Policy links", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h2", { hasText: "Sign in" })).toBeVisible({ timeout: 5_000 });

    const tosLink = page.locator('a[href="/terms"]', { hasText: "Terms of Service" });
    const privacyLink = page.locator('a[href="/privacy"]', { hasText: "Privacy Policy" });

    await expect(tosLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
  });
});

// ─── Signup ToS Checkbox ───────────────────────────────────────────────────

test.describe("Signup ToS Checkbox", () => {
  test("ToS checkbox exists and Create account button is disabled when unchecked", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("h2", { hasText: "Create your account" })).toBeVisible({ timeout: 5_000 });

    // Verify checkbox label text
    const tosCheckbox = page.locator("#tos-checkbox");
    await expect(tosCheckbox).toBeVisible();

    const tosLabel = page.locator("text=I agree to the Terms of Service and Privacy Policy");
    await expect(tosLabel).toBeVisible();

    // Create account button should be disabled when checkbox is unchecked
    const submitBtn = page.locator('button[type="submit"]', { hasText: "Create account" });
    await expect(submitBtn).toBeDisabled();
  });
});

// ─── Settings Page — Account Card ──────────────────────────────────────────

test.describe("Settings — Account Card", () => {
  test("Account card is expanded by default with profile fields visible", async ({ page }) => {
    await navigateToSettings(page);

    // Account section heading
    await expect(page.locator("button", { hasText: "Account" }).first()).toBeVisible();

    // Verify profile fields are visible (Account is expanded by default)
    await expect(page.locator("text=/^Name$/i").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=/^Email$/i").first()).toBeVisible();
    await expect(page.locator("text=/^Password$/i").first()).toBeVisible();
    await expect(page.locator("text=/^Role$/i").first()).toBeVisible();
    await expect(page.locator("text=/^Grade Level$/i").first()).toBeVisible();
    await expect(page.locator("text=/^Graduation Year$/i").first()).toBeVisible();
  });
});

// ─── Settings — Name Editing ───────────────────────────────────────────────

test.describe("Settings — Name Editing", () => {
  test("clicking name shows edit inputs, cancel reverts", async ({ page }) => {
    await navigateToSettings(page);

    // Click the name value to start editing (the button next to the Name label)
    const nameButton = page.locator("text=/^Name$/i").first().locator("xpath=ancestor::div").locator("button").first();
    await nameButton.click();
    await page.waitForTimeout(500);

    // Verify first/last name inputs appear
    await expect(page.locator("label", { hasText: "First name" })).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("label", { hasText: "Last name" })).toBeVisible();

    // Click Cancel
    const cancelBtn = page.locator("button", { hasText: "Cancel" }).first();
    await cancelBtn.click();
    await page.waitForTimeout(500);

    // Edit form should be gone
    await expect(page.locator("label", { hasText: "First name" })).toBeHidden();
  });
});

// ─── Settings — Family Members ─────────────────────────────────────────────

test.describe("Settings — Family Members", () => {
  test("Family Members section exists with member count badge", async ({ page }) => {
    await navigateToSettings(page);

    const familyHeader = page.locator("button", { hasText: "Family Members" });
    await expect(familyHeader).toBeVisible();

    // Badge showing member count should be in the header
    const badge = familyHeader.locator("span").filter({ hasText: /^\d+$/ });
    await expect(badge).toBeVisible();
  });
});

// ─── Settings — Collapsible Cards ──────────────────────────────────────────

test.describe("Settings — Collapsible Cards", () => {
  test("clicking card headers toggles content visibility", async ({ page }) => {
    await navigateToSettings(page);

    // Billing card should be collapsed by default
    const billingHeader = page.locator("button", { hasText: "Billing & Subscription" });
    await expect(billingHeader).toBeVisible();

    // Content should not be visible initially
    const manageBillingBtn = page.locator("button", { hasText: "Manage Billing" });
    await expect(manageBillingBtn).toBeHidden();

    // Click to expand
    await billingHeader.click();
    await page.waitForTimeout(500);
    await expect(manageBillingBtn).toBeVisible({ timeout: 3_000 });

    // Click again to collapse
    await billingHeader.click();
    await page.waitForTimeout(500);
    await expect(manageBillingBtn).toBeHidden();
  });
});

// ─── Settings — Legal Section ──────────────────────────────────────────────

test.describe("Settings — Legal Section", () => {
  test("expanding Legal card shows Terms and Privacy links", async ({ page }) => {
    await navigateToSettings(page);

    // Legal card should be collapsed by default
    const legalHeader = page.locator("button", { hasText: "Legal" });
    await expect(legalHeader).toBeVisible();

    // Expand
    await legalHeader.click();
    await page.waitForTimeout(500);

    // Verify links
    const tosLink = page.locator('a[href="/terms"]', { hasText: "Terms of Service" });
    const privacyLink = page.locator('a[href="/privacy"]', { hasText: "Privacy Policy" });
    await expect(tosLink).toBeVisible({ timeout: 3_000 });
    await expect(privacyLink).toBeVisible();
  });
});

// ─── Settings — Delete Account ─────────────────────────────────────────────

test.describe("Settings — Delete Account", () => {
  test("Delete Account card has button and confirmation dialog", async ({ page }) => {
    await navigateToSettings(page);

    // Expand Delete Account card
    const deleteHeader = page.locator("button", { hasText: "Delete Account" });
    await expect(deleteHeader).toBeVisible();
    await deleteHeader.click();
    await page.waitForTimeout(500);

    // Verify "Delete my account" button
    const deleteBtn = page.locator("button", { hasText: "Delete my account" }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 3_000 });

    // Click to open confirmation dialog
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Verify confirmation dialog elements
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // "type DELETE" input
    const deleteInput = page.locator("#delete-confirm");
    await expect(deleteInput).toBeVisible();
    await expect(page.locator("text=/Type.*DELETE.*confirm/i")).toBeVisible();

    // Data export checkbox
    await expect(page.locator("text=Download a copy of my data before deleting")).toBeVisible();

    // Close dialog by clicking Cancel
    const cancelBtn = dialog.locator("button", { hasText: "Cancel" });
    await cancelBtn.click();
    await page.waitForTimeout(300);
    await expect(dialog).toBeHidden();
  });
});

// ─── Settings — Billing Section ────────────────────────────────────────────

test.describe("Settings — Billing Section", () => {
  test("Billing card shows current plan badge and Manage Billing button", async ({ page }) => {
    await navigateToSettings(page);

    // Expand Billing card
    const billingHeader = page.locator("button", { hasText: "Billing & Subscription" });
    await billingHeader.click();
    await page.waitForTimeout(500);

    // Current plan badge
    await expect(page.locator("text=Current plan")).toBeVisible({ timeout: 3_000 });

    // Manage Billing button
    const manageBillingBtn = page.locator("button", { hasText: "Manage Billing" });
    await expect(manageBillingBtn).toBeVisible();
  });
});

// ─── Password Show/Hide Toggle ─────────────────────────────────────────────

test.describe("Password Show/Hide Toggle", () => {
  test("login page password field has show/hide toggle button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h2", { hasText: "Sign in" })).toBeVisible({ timeout: 5_000 });

    // Password input should exist
    const passwordInput = page.getByLabel("Password");
    await expect(passwordInput).toBeVisible();

    // Show password toggle button
    const toggleBtn = page.locator('button[aria-label="Show password"]');
    await expect(toggleBtn).toBeVisible();

    // Click to show password
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Now the button label should change to "Hide password"
    const hideBtn = page.locator('button[aria-label="Hide password"]');
    await expect(hideBtn).toBeVisible();

    // Click again to hide
    await hideBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator('button[aria-label="Show password"]')).toBeVisible();
  });
});
