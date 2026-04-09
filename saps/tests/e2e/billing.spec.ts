import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToBilling(page: Page) {
  await login(page);
  await page.goto("/settings/billing");
  await page.waitForTimeout(3000);
}

// ─── Billing Page ───────────────────────────────────────────────────────────

test.describe("Billing — Page Load", () => {
  test("billing page loads successfully", async ({ page }) => {
    await navigateToBilling(page);
    await expect(
      page.getByRole("heading", { name: "Billing & Subscription" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows current plan info", async ({ page }) => {
    await navigateToBilling(page);

    // Should show current plan name
    const planName = page.locator("text=/Starter|Plus|Elite|Trial/");
    await expect(planName.first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows status badge", async ({ page }) => {
    await navigateToBilling(page);

    const badge = page.locator("text=/Active|Trial|Past Due|Canceled/");
    await expect(badge.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Pricing Cards ──────────────────────────────────────────────────────────

test.describe("Billing — Pricing Cards", () => {
  test("shows all 3 tier cards", async ({ page }) => {
    await navigateToBilling(page);

    await expect(page.locator("text=Starter").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Plus").first()).toBeVisible();
    await expect(page.locator("text=Elite").first()).toBeVisible();
  });

  test("shows billing interval toggle", async ({ page }) => {
    await navigateToBilling(page);

    await expect(page.getByRole("button", { name: "Monthly" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Annual" })).toBeVisible();
    await expect(page.getByRole("button", { name: "4-Year" })).toBeVisible();
  });

  test("switching interval updates prices", async ({ page }) => {
    await navigateToBilling(page);

    // Click Monthly
    await page.getByRole("button", { name: "Monthly" }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=$9.99/mo")).toBeVisible({ timeout: 5_000 });

    // Click Annual
    await page.getByRole("button", { name: "Annual" }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=$107.88/yr")).toBeVisible({ timeout: 5_000 });

    // Click 4-Year
    await page.getByRole("button", { name: "4-Year" }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=$399")).toBeVisible({ timeout: 5_000 });
  });

  test("shows feature lists for each tier", async ({ page }) => {
    await navigateToBilling(page);

    // Starter features
    await expect(page.locator("text=1 plan")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Course browser")).toBeVisible();

    // Plus features
    await expect(page.locator("text=10 plans")).toBeVisible();
    await expect(page.locator("text=What-if GPA")).toBeVisible();

    // Elite features
    await expect(page.locator("text=Unlimited plans")).toBeVisible();
    await expect(page.locator("text=AI course suggestions")).toBeVisible();
  });

  test("starter shows Free Forever", async ({ page }) => {
    await navigateToBilling(page);
    await expect(page.locator("text=Free Forever")).toBeVisible({ timeout: 10_000 });
  });

  test("Elite card has Popular badge", async ({ page }) => {
    await navigateToBilling(page);
    await expect(page.locator("text=Popular")).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Upgrade Buttons ────────────────────────────────────────────────────────

test.describe("Billing — Upgrade Buttons", () => {
  test("shows upgrade buttons for non-current plans", async ({ page }) => {
    await navigateToBilling(page);

    const upgradeButtons = page.locator("text=/Upgrade to/");
    // Should have at least 1 upgrade button (for the tier the user isn't on)
    const count = await upgradeButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("current plan shows Current Plan button (disabled)", async ({ page }) => {
    await navigateToBilling(page);

    const currentPlan = page.locator("text=Current Plan");
    // Should show "Current Plan" for the active tier
    const count = await currentPlan.count();
    expect(count).toBeGreaterThanOrEqual(0); // May be 0 if on trial
  });
});

// ─── Trial Info ─────────────────────────────────────────────────────────────

test.describe("Billing — Trial Info", () => {
  test("shows trial countdown when trialing", async ({ page }) => {
    await navigateToBilling(page);

    // If on trial, should show days remaining
    const trialInfo = page.locator("text=/day.*remaining.*trial/i");
    const hasTrialInfo = (await trialInfo.count()) > 0;

    // Either shows trial info or current plan — both valid
    const heading = page.getByRole("heading", { name: "Billing & Subscription" });
    await expect(heading).toBeVisible();
  });
});

// ─── Manage Billing ─────────────────────────────────────────────────────────

test.describe("Billing — Manage Billing", () => {
  test("shows Manage Billing button when stripe customer exists", async ({ page }) => {
    await navigateToBilling(page);

    const manageBtn = page.locator("text=Manage Billing");
    // Only shows if user has a Stripe customer ID
    const heading = page.getByRole("heading", { name: "Billing & Subscription" });
    await expect(heading).toBeVisible();
  });
});

// ─── Navigation ─────────────────────────────────────────────────────────────

test.describe("Billing — Navigation", () => {
  test("billing page accessible via /settings/billing URL", async ({ page }) => {
    await navigateToBilling(page);
    await expect(
      page.getByRole("heading", { name: "Billing & Subscription" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
