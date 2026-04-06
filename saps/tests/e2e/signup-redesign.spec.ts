import { test, expect } from "@playwright/test";

// ─── Signup Page Layout ────────────────────────────────────────────────────

test.describe("Signup — Page Layout", () => {
  test("signup page renders heading", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });

  test("subtitle text is visible", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("text=Start planning your academic path today")).toBeVisible();
  });
});

// ─── Role Selector ─────────────────────────────────────────────────────────

test.describe("Signup — Role Selector", () => {
  test("three role buttons exist (Student, Parent, Counselor)", async ({ page }) => {
    await page.goto("/signup");

    const studentBtn = page.locator('button[role="radio"]', { hasText: "Student" });
    const parentBtn = page.locator('button[role="radio"]', { hasText: "Parent" });
    const counselorBtn = page.locator('button[role="radio"]', { hasText: "Counselor" });

    await expect(studentBtn).toBeVisible();
    await expect(parentBtn).toBeVisible();
    await expect(counselorBtn).toBeVisible();
  });

  test("Student role is selected by default", async ({ page }) => {
    await page.goto("/signup");

    const studentBtn = page.locator('button[role="radio"]', { hasText: "Student" });
    await expect(studentBtn).toHaveAttribute("aria-checked", "true");
  });

  test("clicking a different role selects it", async ({ page }) => {
    await page.goto("/signup");

    const parentBtn = page.locator('button[role="radio"]', { hasText: "Parent" });
    await parentBtn.click();
    await expect(parentBtn).toHaveAttribute("aria-checked", "true");

    const studentBtn = page.locator('button[role="radio"]', { hasText: "Student" });
    await expect(studentBtn).toHaveAttribute("aria-checked", "false");
  });
});

// ─── Email and Password Fields ─────────────────────────────────────────────

test.describe("Signup — Email and Password Fields", () => {
  test("email input exists", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("password input exists", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });

  test("confirm password input exists", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Confirm password")).toBeVisible();
  });
});

// ─── Password Show/Hide Toggle ─────────────────────────────────────────────

test.describe("Signup — Password Show/Hide", () => {
  test("password fields have show/hide toggle buttons", async ({ page }) => {
    await page.goto("/signup");

    // Password fields should start as type="password"
    const passwordInput = page.getByLabel("Password", { exact: true });
    const confirmInput = page.getByLabel("Confirm password");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(confirmInput).toHaveAttribute("type", "password");

    // Look for toggle buttons near password fields
    const toggleButtons = page.locator('button[aria-label*="password" i], button[aria-label*="show" i], button[aria-label*="hide" i]');
    expect(await toggleButtons.count()).toBeGreaterThanOrEqual(1);
  });
});

// ─── Date of Birth Field ───────────────────────────────────────────────────

test.describe("Signup — Date of Birth", () => {
  test("date of birth input exists", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Date of birth")).toBeVisible();
  });
});

// ─── Frozen State/School ───────────────────────────────────────────────────

test.describe("Signup — Frozen State and School", () => {
  test("Illinois is shown as read-only state", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("text=Illinois")).toBeVisible();
  });

  test("Adlai E. Stevenson High School is shown as read-only school", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("text=Adlai E. Stevenson High School")).toBeVisible();
  });

  test("state and school fields are not editable inputs", async ({ page }) => {
    await page.goto("/signup");

    // They should be rendered as divs, not input elements
    const stateContainer = page.locator("div", { hasText: "Illinois" }).locator("input");
    const schoolContainer = page.locator("div", { hasText: "Adlai E. Stevenson High School" }).locator("input");

    expect(await stateContainer.count()).toBe(0);
    expect(await schoolContainer.count()).toBe(0);
  });
});

// ─── School Request Link ───────────────────────────────────────────────────

test.describe("Signup — School Request", () => {
  test("Request yours link exists", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("button", { hasText: "Request yours" })).toBeVisible();
  });

  test("clicking Request yours shows request form", async ({ page }) => {
    await page.goto("/signup");

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
    await page.goto("/signup");

    await page.locator("button", { hasText: "Request yours" }).click();
    const notifyBtn = page.locator("button", { hasText: "Notify Me" });
    await expect(notifyBtn).toBeDisabled();
  });
});

// ─── Terms of Service Checkbox ─────────────────────────────────────────────

test.describe("Signup — ToS Checkbox", () => {
  test("ToS checkbox with Terms of Service and Privacy Policy links exists", async ({ page }) => {
    await page.goto("/signup");

    const tosCheckbox = page.locator("#tos-checkbox");
    await expect(tosCheckbox).toBeVisible();

    const tosLink = page.locator('a[href="/terms"]', { hasText: "Terms of Service" });
    const privacyLink = page.locator('a[href="/privacy"]', { hasText: "Privacy Policy" });

    await expect(tosLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
  });
});

// ─── Submit Disabled Without ToS ───────────────────────────────────────────

test.describe("Signup — Submit Button", () => {
  test("Create account button is disabled when ToS unchecked", async ({ page }) => {
    await page.goto("/signup");

    const submitBtn = page.locator('button[type="submit"]', { hasText: "Create account" });
    await expect(submitBtn).toBeDisabled();
  });

  test("Create account button becomes enabled when ToS is checked", async ({ page }) => {
    await page.goto("/signup");

    const tosCheckbox = page.locator("#tos-checkbox");
    await tosCheckbox.click();

    const submitBtn = page.locator('button[type="submit"]', { hasText: "Create account" });
    await expect(submitBtn).toBeEnabled();
  });
});

// ─── COPPA Block ───────────────────────────────────────────────────────────

test.describe("Signup — COPPA Block", () => {
  test("entering DOB making user under 13 shows COPPA block message", async ({ page }) => {
    await page.goto("/signup");

    const dobInput = page.getByLabel("Date of birth");

    // Enter a date that makes the user under 13 (e.g., 2 years ago)
    const today = new Date();
    const under13 = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    const dobValue = under13.toISOString().split("T")[0];

    await dobInput.fill(dobValue);

    await expect(page.locator("text=Account creation unavailable")).toBeVisible();
  });

  test("COPPA block disables submit button even with ToS checked", async ({ page }) => {
    await page.goto("/signup");

    // Check ToS first
    const tosCheckbox = page.locator("#tos-checkbox");
    await tosCheckbox.click();

    // Enter under-13 DOB
    const dobInput = page.getByLabel("Date of birth");
    const today = new Date();
    const under13 = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    await dobInput.fill(under13.toISOString().split("T")[0]);

    const submitBtn = page.locator('button[type="submit"]', { hasText: "Create account" });
    await expect(submitBtn).toBeDisabled();
  });
});

// ─── Sign In Link ──────────────────────────────────────────────────────────

test.describe("Signup — Sign In Link", () => {
  test("Already have an account? Sign in link exists and navigates to /login", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.locator("text=Already have an account?")).toBeVisible();

    const signInLink = page.locator('a[href="/login"]', { hasText: "Sign in" });
    await expect(signInLink).toBeVisible();

    await signInLink.click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});

// ─── Auth Layout Footer ───────────────────────────────────────────────────

test.describe("Signup — Auth Layout Footer", () => {
  test("footer contains Terms of Service link", async ({ page }) => {
    await page.goto("/signup");

    // The footer links are outside the card, in the auth layout
    const footerTos = page.locator('a[href="/terms"]').last();
    await expect(footerTos).toBeVisible();
    await expect(footerTos).toHaveText("Terms of Service");
  });

  test("footer contains Privacy Policy link", async ({ page }) => {
    await page.goto("/signup");

    const footerPrivacy = page.locator('a[href="/privacy"]').last();
    await expect(footerPrivacy).toBeVisible();
    await expect(footerPrivacy).toHaveText("Privacy Policy");
  });
});
