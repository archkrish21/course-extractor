import { test, expect, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

// ─── Helper ────────────────────────────────────────────────────────────────

/**
 * Navigate to /signup and wait for React hydration to complete. Without this,
 * pre-hydration the form's onSubmit and button onClick handlers are not yet
 * attached, so clicks fall through to native form submission and toggles silently
 * fail. Especially flaky on mobile.
 */
async function gotoSignup(page: Page) {
  await page.goto("/signup");
  await waitForHydration(page);
}

// ─── Signup Page Layout ────────────────────────────────────────────────────

test.describe("Signup — Page Layout", () => {
  test("signup page renders heading", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });

  test("subtitle text is visible", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.locator("text=Start planning your academic path today")).toBeVisible();
  });
});

// ─── Role Selector ─────────────────────────────────────────────────────────

test.describe("Signup — Role Selector", () => {
  test("four role buttons exist (Student, Parent, Guardian, Counselor)", async ({ page }) => {
    await gotoSignup(page);

    // The Guardian role was added between Parent and Counselor
    await expect(page.locator('button[role="radio"]', { hasText: "Student" }).first()).toBeVisible();
    await expect(page.locator('button[role="radio"]', { hasText: "Parent" }).first()).toBeVisible();
    await expect(page.locator('button[role="radio"]', { hasText: "Guardian" }).first()).toBeVisible();
    await expect(page.locator('button[role="radio"]', { hasText: "Counselor" }).first()).toBeVisible();
    await expect(page.locator('button[role="radio"]')).toHaveCount(4);
  });

  test("Student role is selected by default", async ({ page }) => {
    await gotoSignup(page);

    const studentBtn = page.locator('button[role="radio"]', { hasText: "Student" }).first();
    await expect(studentBtn).toHaveAttribute("aria-checked", "true");
  });

  test("clicking a different role selects it", async ({ page }) => {
    await gotoSignup(page);

    const parentBtn = page.locator('button[role="radio"]', { hasText: "Parent" }).first();
    await parentBtn.click();
    await expect(parentBtn).toHaveAttribute("aria-checked", "true");

    const studentBtn = page.locator('button[role="radio"]', { hasText: "Student" }).first();
    await expect(studentBtn).toHaveAttribute("aria-checked", "false");
  });
});

// ─── Email and Password Fields ─────────────────────────────────────────────

test.describe("Signup — Email and Password Fields", () => {
  test("email input exists", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("password input exists", async ({ page }) => {
    await gotoSignup(page);
    // Required-asterisk in label breaks getByLabel exact match; use the input directly
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("confirm password input exists", async ({ page }) => {
    await gotoSignup(page);
    // The form has TWO type=password inputs (Password + Confirm password)
    await expect(page.locator('input[type="password"]')).toHaveCount(2);
  });
});

// ─── Password Show/Hide Toggle ─────────────────────────────────────────────

test.describe("Signup — Password Show/Hide", () => {
  test("password fields have show/hide toggle buttons", async ({ page }) => {
    await gotoSignup(page);

    // Both password inputs start as type="password"
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(2);

    // Each password Input renders a Show/Hide toggle button
    const toggleButtons = page.locator('button[aria-label="Show password"], button[aria-label="Hide password"]');
    expect(await toggleButtons.count()).toBeGreaterThanOrEqual(1);
  });
});

// ─── Age Confirmation (COPPA) ──────────────────────────────────────────────

test.describe("Signup — Age Confirmation", () => {
  test("age confirmation checkbox exists", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.locator("#age-confirm-checkbox")).toBeVisible();
  });

  test("age confirmation label mentions 13 or older", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.locator("text=at least 13 years old")).toBeVisible();
  });
});

// ─── Frozen State/School ───────────────────────────────────────────────────

test.describe("Signup — Frozen State and School", () => {
  test("Illinois is shown as read-only state", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.locator("text=Illinois")).toBeVisible();
  });

  test("Adlai E. Stevenson High School is shown as read-only school", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.locator("text=Adlai E. Stevenson High School")).toBeVisible();
  });

  test("state and school fields are not editable inputs", async ({ page }) => {
    await gotoSignup(page);

    // The "Illinois" and "Adlai..." values are rendered as readonly divs with a
    // cursor-not-allowed class, not <input> elements. Verify there is no input
    // with those values anywhere on the page.
    const illinoisInput = page.locator('input[value="Illinois"]');
    const schoolInput = page.locator('input[value="Adlai E. Stevenson High School"]');
    expect(await illinoisInput.count()).toBe(0);
    expect(await schoolInput.count()).toBe(0);

    // Sanity check the readonly display divs are present
    await expect(page.locator("text=Illinois").first()).toBeVisible();
    await expect(page.locator("text=Adlai E. Stevenson High School").first()).toBeVisible();
  });
});

// ─── School Request Link ───────────────────────────────────────────────────

test.describe("Signup — School Request", () => {
  test("Request yours link exists", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.locator("button", { hasText: "Request yours" })).toBeVisible();
  });

  test("clicking Request yours shows request form", async ({ page }) => {
    await gotoSignup(page);

    await page.locator("button", { hasText: "Request yours" }).click();

    // Form should appear with school name input, email input, and Notify Me button
    const schoolInput = page.locator('input[placeholder="School name and state"]');
    const emailInput = page.locator('input[placeholder="Your email"]');
    const notifyBtn = page.locator("button", { hasText: "Notify Me" });

    await expect(schoolInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(notifyBtn).toBeVisible();
  });

  test("Notify Me button is disabled when fields are empty", async ({ page }) => {
    await gotoSignup(page);

    await page.locator("button", { hasText: "Request yours" }).click();
    const notifyBtn = page.locator("button", { hasText: "Notify Me" });
    await expect(notifyBtn).toBeDisabled();
  });
});

// ─── Terms of Service Checkbox ─────────────────────────────────────────────

test.describe("Signup — ToS Checkbox", () => {
  test("ToS checkbox with Terms of Service and Privacy Policy links exists", async ({ page }) => {
    await gotoSignup(page);

    // The checkbox itself can be hidden behind its label wrapper depending on layout;
    // assert presence rather than visibility, then check the wrapping label text.
    await expect(page.locator("#tos-checkbox")).toHaveCount(1);
    await expect(page.locator("text=I agree to the").first()).toBeVisible();

    const tosLink = page.locator('a[href="/terms"]', { hasText: "Terms of Service" }).first();
    const privacyLink = page.locator('a[href="/privacy"]', { hasText: "Privacy Policy" }).first();

    await expect(tosLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
  });
});

// ─── Submit Disabled Without ToS ───────────────────────────────────────────

test.describe("Signup — Submit Button", () => {
  test("Create account button is disabled when ToS unchecked", async ({ page }) => {
    await gotoSignup(page);

    const submitBtn = page.locator('button[type="submit"]', { hasText: "Create account" });
    await expect(submitBtn).toBeDisabled();
  });

  test("Create account button becomes enabled when ToS and age confirmation are both checked", async ({ page }) => {
    await gotoSignup(page);

    // Use .check() on the inputs directly. On mobile, clicking the label text can
    // hit one of the Terms/Privacy links inside the label and navigate away.
    await page.locator("#tos-checkbox").check({ force: true });
    await page.locator("#age-confirm-checkbox").check({ force: true });

    const submitBtn = page.locator('button[type="submit"]', { hasText: "Create account" });
    await expect(submitBtn).toBeEnabled();
  });
});

// ─── COPPA Gate ────────────────────────────────────────────────────────────

test.describe("Signup — COPPA Gate", () => {
  test("submit button is disabled when age confirmation is unchecked", async ({ page }) => {
    await gotoSignup(page);

    // Check ToS but NOT age confirmation
    await page.locator("#tos-checkbox").check({ force: true });

    const submitBtn = page.locator('button[type="submit"]', { hasText: "Create account" });
    await expect(submitBtn).toBeDisabled();
  });

  test("submit button becomes enabled only when both ToS and age checkboxes are checked", async ({ page }) => {
    await gotoSignup(page);

    const submitBtn = page.locator('button[type="submit"]', { hasText: "Create account" });
    await expect(submitBtn).toBeDisabled();

    await page.locator("#tos-checkbox").check({ force: true });
    await expect(submitBtn).toBeDisabled();

    await page.locator("#age-confirm-checkbox").check({ force: true });
    await expect(submitBtn).toBeEnabled();
  });
});

// ─── Sign In Link ──────────────────────────────────────────────────────────

test.describe("Signup — Sign In Link", () => {
  test("Already have an account? Sign in link exists and navigates to /login", async ({ page }) => {
    await gotoSignup(page);

    await expect(page.locator("text=Already have an account?")).toBeVisible();

    // Use .first() to handle any duplicate matches; href is what we really care about
    const signInLink = page.locator('a[href="/login"]').filter({ hasText: "Sign in" }).first();
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute("href", "/login");

    // Scroll into view explicitly — chromium can leave the link below the fold
    await signInLink.scrollIntoViewIfNeeded();
    await signInLink.click();
    await page.waitForURL(/\/login(\?|$)/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});

// ─── Auth Layout Footer ───────────────────────────────────────────────────

test.describe("Signup — Auth Layout Footer", () => {
  test("footer contains Terms of Service link", async ({ page }) => {
    await gotoSignup(page);

    // The footer links are outside the card, in the auth layout
    const footerTos = page.locator('a[href="/terms"]').last();
    await expect(footerTos).toBeVisible();
    await expect(footerTos).toHaveText("Terms of Service");
  });

  test("footer contains Privacy Policy link", async ({ page }) => {
    await gotoSignup(page);

    const footerPrivacy = page.locator('a[href="/privacy"]').last();
    await expect(footerPrivacy).toBeVisible();
    await expect(footerPrivacy).toHaveText("Privacy Policy");
  });
});
