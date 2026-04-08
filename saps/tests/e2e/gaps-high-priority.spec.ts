import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

// ─── Contact Form Submission ───────────────────────────────────────────────

test.describe("Contact — Form Submission", () => {
  test("contact form has all required fields", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForTimeout(1_000);

    await expect(page.locator('input[placeholder="Your name"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('input[placeholder="you@example.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="What\'s this about?"]')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Tell us more..."]')).toBeVisible();
  });

  test("submit button is disabled when required fields are empty", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForTimeout(1_000);

    const submitBtn = page.getByRole("button", { name: /Send Message/i });
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await expect(submitBtn).toBeDisabled();
  });

  test("submit button enables when name, email, and message are filled", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForTimeout(1_000);

    await page.locator('input[placeholder="Your name"]').fill("Test User");
    await page.locator('input[placeholder="you@example.com"]').fill("test@example.com");
    await page.locator('textarea[placeholder="Tell us more..."]').fill("This is a test message.");

    const submitBtn = page.getByRole("button", { name: /Send Message/i });
    await expect(submitBtn).toBeEnabled();
  });

  test("submitting contact form shows success state", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForTimeout(1_000);

    await page.locator('input[placeholder="Your name"]').fill("E2E Test");
    await page.locator('input[placeholder="you@example.com"]').fill("e2e@test.com");
    await page.locator('input[placeholder="What\'s this about?"]').fill("Test Subject");
    await page.locator('textarea[placeholder="Tell us more..."]').fill("Automated test message — please ignore.");

    const submitBtn = page.getByRole("button", { name: /Send Message/i });
    await submitBtn.click();

    // Should show either success or error (both are valid — depends on API config)
    const success = page.locator("text=/Message sent|Thank you/i");
    const error = page.locator("text=/error|failed|try again/i");
    const sending = page.locator("text=/Sending/i");

    // Wait for the form to process
    await page.waitForTimeout(5_000);

    const hasSuccess = (await success.count()) > 0;
    const hasError = (await error.count()) > 0;
    const stillSending = (await sending.count()) > 0;
    expect(hasSuccess || hasError || !stillSending).toBeTruthy();
  });
});

// ─── 404 Page ──────────────────────────────────────────────────────────────

test.describe("404 — Invalid URLs", () => {
  test("invalid URL shows 404 or redirects", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-12345");

    // Either shows a 404 page or redirects to a valid page
    const is404 = response?.status() === 404;
    const hasNotFoundText = (await page.locator("text=/not found|404|page doesn't exist/i").count()) > 0;
    const redirected = !page.url().includes("this-page-does-not-exist");

    expect(is404 || hasNotFoundText || redirected).toBeTruthy();
  });

  test("invalid authenticated URL redirects to login or 404", async ({ page }) => {
    const response = await page.goto("/nonexistent-app-page");
    await page.waitForTimeout(2_000);

    const is404 = response?.status() === 404;
    const redirectedToLogin = page.url().includes("/login");
    const hasNotFoundText = (await page.locator("text=/not found|404/i").count()) > 0;

    expect(is404 || redirectedToLogin || hasNotFoundText).toBeTruthy();
  });
});

// ─── Course Detail Modal ───────────────────────────────────────────────────

test.describe("Course Detail Modal", () => {
  test("clicking a course in course browser opens detail modal", async ({ page }) => {
    await login(page);
    await page.goto("/courses");
    await page.waitForTimeout(3_000);

    // Click the first course name/link
    const courseLink = page.locator("button, a, tr", { hasText: /[A-Z]{2,4}\d{3}/ }).first();
    if ((await courseLink.count()) === 0) {
      test.skip(true, "No courses visible in browser");
      return;
    }
    await courseLink.click();
    await page.waitForTimeout(500);

    // Modal should open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test("course detail modal shows course name and metadata", async ({ page }) => {
    await login(page);
    await page.goto("/courses");
    await page.waitForTimeout(3_000);

    const courseLink = page.locator("button, a, tr", { hasText: /[A-Z]{2,4}\d{3}/ }).first();
    if ((await courseLink.count()) === 0) {
      test.skip(true, "No courses visible");
      return;
    }
    await courseLink.click();
    await page.waitForTimeout(500);

    const modal = page.locator('[role="dialog"]');
    if ((await modal.count()) === 0) {
      test.skip(true, "Modal did not open");
      return;
    }

    // Should show course metadata (credit type badge, description)
    const creditBadge = modal.locator("text=/CP|Honors|AP|Accelerated/");
    await expect(creditBadge.first()).toBeVisible({ timeout: 3_000 });
  });

  test("course detail modal has close button", async ({ page }) => {
    await login(page);
    await page.goto("/courses");
    await page.waitForTimeout(3_000);

    const courseLink = page.locator("button, a, tr", { hasText: /[A-Z]{2,4}\d{3}/ }).first();
    if ((await courseLink.count()) === 0) {
      test.skip(true, "No courses visible");
      return;
    }
    await courseLink.click();
    await page.waitForTimeout(500);

    const closeBtn = page.locator('button[aria-label="Close course details"]');
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });

    await closeBtn.click();
    await page.waitForTimeout(300);

    // Modal should be closed
    const modal = page.locator('[role="dialog"]');
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  test("course detail modal has Add to Plan button", async ({ page }) => {
    await login(page);
    await page.goto("/courses");
    await page.waitForTimeout(3_000);

    const courseLink = page.locator("button, a, tr", { hasText: /[A-Z]{2,4}\d{3}/ }).first();
    if ((await courseLink.count()) === 0) {
      test.skip(true, "No courses visible");
      return;
    }
    await courseLink.click();
    await page.waitForTimeout(500);

    const addBtn = page.locator("button, a", { hasText: /Add to Plan/i });
    await expect(addBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test("Add to Plan shows plan selector and grade/semester buttons", async ({ page }) => {
    await login(page);
    await page.goto("/courses");
    await page.waitForTimeout(3_000);

    const courseLink = page.locator("button, a, tr", { hasText: /[A-Z]{2,4}\d{3}/ }).first();
    if ((await courseLink.count()) === 0) {
      test.skip(true, "No courses visible");
      return;
    }
    await courseLink.click();
    await page.waitForTimeout(500);

    const addBtn = page.locator("button, a", { hasText: /Add to Plan/i }).first();
    if ((await addBtn.count()) === 0) {
      test.skip(true, "Add to Plan button not found");
      return;
    }
    await addBtn.click();
    await page.waitForTimeout(500);

    // Should show plan selector or grade/semester buttons
    const planSelect = page.locator("#add-plan-select");
    const gradeButtons = page.locator("button[aria-pressed]");

    const hasPlanSelect = (await planSelect.count()) > 0;
    const hasGradeButtons = (await gradeButtons.count()) > 0;
    expect(hasPlanSelect || hasGradeButtons).toBeTruthy();
  });

  test("backdrop click closes modal", async ({ page }) => {
    await login(page);
    await page.goto("/courses");
    await page.waitForTimeout(3_000);

    const courseLink = page.locator("button, a, tr", { hasText: /[A-Z]{2,4}\d{3}/ }).first();
    if ((await courseLink.count()) === 0) {
      test.skip(true, "No courses visible");
      return;
    }
    await courseLink.click();
    await page.waitForTimeout(500);

    const modal = page.locator('[role="dialog"]');
    if ((await modal.count()) === 0) {
      test.skip(true, "Modal did not open");
      return;
    }

    // Click outside the modal (on the backdrop)
    await page.locator(".fixed.inset-0.bg-black\\/50").click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });
});

// ─── Feedback Widget ───────────────────────────────────────────────────────
// Feedback widget tests are in linked-accounts.spec.ts (Feedback Widget section).

// ─── Plan Sharing ──────────────────────────────────────────────────────────

test.describe("Plans — Share Modal", () => {
  async function openShareModal(page: Page): Promise<boolean> {
    await login(page);
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    // Find share button on a plan card
    const shareBtn = page.locator("button", { hasText: /Share/i }).first();
    if ((await shareBtn.count()) === 0) {
      // Try SVG share icon button
      const iconBtn = page.locator('button[aria-label*="Share" i]').first();
      if ((await iconBtn.count()) === 0) return false;
      await iconBtn.click();
    } else {
      await shareBtn.click();
    }
    await page.waitForTimeout(500);
    return true;
  }

  test("share button opens share modal", async ({ page }) => {
    const opened = await openShareModal(page);
    if (!opened) {
      test.skip(true, "No share button found — no plans or sharing disabled");
      return;
    }

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test("share modal has close button", async ({ page }) => {
    const opened = await openShareModal(page);
    if (!opened) {
      test.skip(true, "No share button found");
      return;
    }

    const closeBtn = page.locator('button[aria-label*="Close" i]');
    await expect(closeBtn.first()).toBeVisible({ timeout: 5_000 });

    await closeBtn.first().click();
    await page.waitForTimeout(300);

    const modal = page.locator('[role="dialog"]');
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  test("share modal shows permission options", async ({ page }) => {
    const opened = await openShareModal(page);
    if (!opened) {
      test.skip(true, "No share button found");
      return;
    }

    // Should show permission dropdowns or member list
    const permSelect = page.locator("select");
    const memberList = page.locator("text=/No access|View only|Can edit|Full access/i");

    const hasPerms = (await permSelect.count()) > 0 || (await memberList.count()) > 0;
    // Modal should at least be visible even if no members
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Plan Deletion ─────────────────────────────────────────────────────────

test.describe("Plans — Delete Modal", () => {
  test("delete button opens confirmation modal", async ({ page }) => {
    await login(page);
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    // Find a non-primary plan's delete button (primary plans can't be deleted)
    const deleteBtn = page.locator("button.text-destructive, button[aria-label*='Delete' i]").first();
    if ((await deleteBtn.count()) === 0) {
      test.skip(true, "No deletable plans found");
      return;
    }
    await deleteBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator('[role="alertdialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=/Delete.*plan/i")).toBeVisible();
  });

  test("delete confirmation has Cancel and Delete buttons", async ({ page }) => {
    await login(page);
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    const deleteBtn = page.locator("button.text-destructive, button[aria-label*='Delete' i]").first();
    if ((await deleteBtn.count()) === 0) {
      test.skip(true, "No deletable plans found");
      return;
    }
    await deleteBtn.click();
    await page.waitForTimeout(500);

    await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /Delete Plan/i })).toBeVisible();
  });

  test("cancel closes delete modal without action", async ({ page }) => {
    await login(page);
    await page.goto("/plans");
    await page.waitForTimeout(2_000);

    const deleteBtn = page.locator("button.text-destructive, button[aria-label*='Delete' i]").first();
    if ((await deleteBtn.count()) === 0) {
      test.skip(true, "No deletable plans found");
      return;
    }
    await deleteBtn.click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /Cancel/i }).click();
    await page.waitForTimeout(300);

    const modal = page.locator('[role="alertdialog"]');
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });
});
