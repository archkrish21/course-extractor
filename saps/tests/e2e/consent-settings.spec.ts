import { test, expect, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await waitForHydration(page);
  await page.locator('input[type="email"]').fill("student@test.com");
  await page.locator('input[type="password"]').first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  // Include /consent and /onboarding so login completes even if the user lands
  // there (e.g., if global-setup didn't seed consent records). Tests gate on
  // the destination after the fact.
  await page.waitForURL(/\/(dashboard|planner|courses|consent|onboarding)/, { timeout: 15_000 });
}

async function navigateToSettings(page: Page) {
  await login(page);
  // If the user landed on /consent due to missing seed records, skip cleanly
  // rather than timing out on /settings (which redirects right back to /consent).
  if (page.url().includes("/consent") || page.url().includes("/onboarding")) {
    test.skip(true, `Test user landed on ${new URL(page.url()).pathname} — global-setup state issue`);
    return;
  }
  await page.goto("/settings");
  // The h1 shows the user's name when present, falling back to "Settings"
  // only for nameless accounts. Anchor on the always-rendered "Profile"
  // section heading instead.
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({ timeout: 10_000 });
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
    await expect(page.locator("text=/COPPA/").first()).toBeVisible();
    await expect(page.locator("text=/FERPA/").first()).toBeVisible();
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

// NOTE: The settings page was redesigned from collapsible cards to a flat
// sectioned layout. There is no longer an "Account" card, "Family Members"
// section, "Billing & Subscription" expander, or collapsible "Legal" card.
// Tests below validate the new flat sections directly.

// ─── Settings Page — Profile Section ───────────────────────────────────────

test.describe("Settings — Profile Section", () => {
  test("Profile section shows user fields", async ({ page }) => {
    await navigateToSettings(page);

    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=/^Name$/i").first()).toBeVisible();
    await expect(page.locator("text=/^Email$/i").first()).toBeVisible();
    await expect(page.locator("text=/^Password$/i").first()).toBeVisible();
    await expect(page.locator("text=/^Role$/i").first()).toBeVisible();
    // Student-only fields use shorter labels in the redesign
    await expect(page.locator("text=/^Grade$/i").first()).toBeVisible();
    await expect(page.locator("text=/^Graduation$/i").first()).toBeVisible();
  });
});

// ─── Settings — Name Editing ───────────────────────────────────────────────

test.describe("Settings — Name Editing", () => {
  test("clicking name shows edit inputs, cancel reverts", async ({ page }) => {
    await navigateToSettings(page);

    // The current name value is rendered as an inline edit button next to "Name"
    const profileCard = page.getByRole("heading", { name: "Profile" }).locator("..");
    const nameEditBtn = profileCard.locator("button").filter({ hasNot: page.locator("text=Reset") }).first();
    await nameEditBtn.click();
    await page.waitForTimeout(500);

    // First/last name input labels appear
    await expect(page.locator("text=First name")).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("text=Last name")).toBeVisible();

    // Click Cancel
    const cancelBtn = page.locator("button", { hasText: "Cancel" }).first();
    await cancelBtn.click();
    await page.waitForTimeout(500);

    // Edit form should be gone
    await expect(page.locator("text=First name")).toBeHidden();
  });
});

// ─── Settings — Linked Accounts (replaces Family Members) ──────────────────

test.describe("Settings — Linked Accounts Section", () => {
  test("Linked Accounts section exists", async ({ page }) => {
    await navigateToSettings(page);

    // "Family Members" was renamed/restructured into "Linked Accounts"
    await expect(page.getByRole("heading", { name: "Linked Accounts" })).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Settings — Legal Section ──────────────────────────────────────────────

test.describe("Settings — Legal Section", () => {
  test("Legal section shows Terms and Privacy links", async ({ page }) => {
    await navigateToSettings(page);

    await expect(page.getByRole("heading", { name: "Legal" })).toBeVisible({ timeout: 5_000 });

    // Section is no longer collapsible — links are always rendered
    const tosLink = page.locator('a[href="/terms"]').first();
    const privacyLink = page.locator('a[href="/privacy"]').first();
    await expect(tosLink).toBeVisible({ timeout: 3_000 });
    await expect(privacyLink).toBeVisible();
  });
});

// ─── Settings — Delete Account ─────────────────────────────────────────────

test.describe("Settings — Delete Account", () => {
  test("Delete Account button opens confirmation dialog", async ({ page }) => {
    await navigateToSettings(page);

    // Danger Zone is a flat section now; the Delete Account button is always rendered
    await expect(page.getByRole("heading", { name: "Danger Zone" })).toBeVisible({ timeout: 5_000 });

    const deleteBtn = page.getByRole("button", { name: "Delete Account", exact: true });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Confirmation dialog
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // "type DELETE" input + label
    await expect(page.locator("#delete-confirm")).toBeVisible();
    await expect(page.locator("text=/Type.*DELETE.*confirm/i")).toBeVisible();

    // Data export checkbox label was shortened
    await expect(page.locator("text=Download my data before deleting")).toBeVisible();

    // Close via Cancel
    const cancelBtn = dialog.getByRole("button", { name: "Cancel" });
    await cancelBtn.click();
    await page.waitForTimeout(300);
    await expect(dialog).toBeHidden();
  });
});

// NOTE: The "Settings — Billing Section" test was removed. Billing has its
// own dedicated /settings/billing page, and FREE_LAUNCH_MODE collapses that
// page to a single notice. There is no inline billing panel on /settings.

// ─── Password Show/Hide Toggle ─────────────────────────────────────────────

test.describe("Password Show/Hide Toggle", () => {
  test("login page password field has show/hide toggle button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h2", { hasText: "Sign in" })).toBeVisible({ timeout: 5_000 });

    // Password input should exist (.first() avoids the "Show password" toggle)
    const passwordInput = page.getByLabel("Password").first();
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
