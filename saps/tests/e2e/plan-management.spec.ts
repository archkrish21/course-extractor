import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToPlans(page: Page) {
  await login(page);
  await page.goto("/plans");
  await expect(page.locator("h1", { hasText: "My Plans" })).toBeVisible({
    timeout: 15_000,
  });
}

async function skipIfNoPlans(page: Page) {
  const noPlanState = page.locator("text=No plans yet");
  if (await noPlanState.isVisible({ timeout: 2_000 }).catch(() => false)) {
    test.skip();
  }
}

// ─── Page Load ──────────────────────────────────────────────────────────────

test.describe("Plans — Page Load", () => {
  test("page shows My Plans heading", async ({ page }) => {
    await navigateToPlans(page);
    await expect(page.locator("h1", { hasText: "My Plans" })).toBeVisible();
  });

  test("back arrow navigates to /planner", async ({ page }) => {
    await navigateToPlans(page);
    const backLink = page.locator('a[aria-label="Back to planner"]');
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL(/\/planner/, { timeout: 10_000 });
    expect(page.url()).toContain("/planner");
  });
});

// ─── Tabs ───────────────────────────────────────────────────────────────────

test.describe("Plans — Tabs", () => {
  test("My Plans tab is active by default", async ({ page }) => {
    await navigateToPlans(page);
    const myTab = page.locator("button", { hasText: /^My Plans/ });
    await expect(myTab).toBeVisible();
    // Active tab has shadow-sm class (bg-card)
    await expect(myTab).toHaveClass(/bg-card/);
  });

  test("can switch to Shared with Me tab", async ({ page }) => {
    await navigateToPlans(page);
    const sharedTab = page.locator("button", { hasText: /^Shared with Me/ });
    await expect(sharedTab).toBeVisible();
    await sharedTab.click();
    await expect(sharedTab).toHaveClass(/bg-card/);

    // My Plans tab should no longer be active
    const myTab = page.locator("button", { hasText: /^My Plans/ });
    await expect(myTab).not.toHaveClass(/bg-card/);
  });

  test("tabs show plan counts", async ({ page }) => {
    await navigateToPlans(page);
    const myTab = page.locator("button", { hasText: /^My Plans \(\d+\)/ });
    await expect(myTab).toBeVisible();
    const sharedTab = page.locator("button", {
      hasText: /^Shared with Me \(\d+\)/,
    });
    await expect(sharedTab).toBeVisible();
  });
});

// ─── Plan Cards ─────────────────────────────────────────────────────────────

test.describe("Plans — Plan Cards", () => {
  test("plan cards show name, status badge, and permission badge", async ({
    page,
  }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    // At least one card should be visible
    const cards = page.locator('[class*="CardContent"], [data-slot="card-content"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Check for status badge (draft, active, or archived)
    const statusBadge = page
      .locator("text=/^(draft|active|archived)$/i")
      .first();
    await expect(statusBadge).toBeVisible({ timeout: 5_000 });

    // Check for permission badge (Owner, Can edit, View only, Full access)
    const permBadge = page
      .locator("text=/^(Owner|Can edit|View only|Full access)$/")
      .first();
    await expect(permBadge).toBeVisible({ timeout: 5_000 });
  });

  test("owner plans show Owner badge", async ({ page }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    const ownerBadge = page.locator("text=Owner").first();
    await expect(ownerBadge).toBeVisible({ timeout: 5_000 });
  });

  test("plan cards have action buttons", async ({ page }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    // Show/hide toggle
    const visibilityBtn = page
      .locator('button[title="Hide from planner"], button[title="Show in planner"]')
      .first();
    await expect(visibilityBtn).toBeVisible({ timeout: 5_000 });

    // Share button
    const shareBtn = page.locator('button[title="Share plan"]').first();
    await expect(shareBtn).toBeVisible({ timeout: 5_000 });

    // Open in planner link
    const openLink = page.locator('a[title="Open in planner"]').first();
    await expect(openLink).toBeVisible({ timeout: 5_000 });

    // Delete button
    const deleteBtn = page.locator('button[title="Delete plan"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Primary Plan Indicator ────────────────────────────────────────────────

test.describe("Plans — Primary Plan Indicator", () => {
  test("primary plan shows star indicator in plan name", async ({ page }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    // The primary plan name should contain the star character ★
    const starPlan = page.locator("a", { hasText: /\u2605/ }).first();
    await expect(starPlan).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Hide/Show Toggle ───────────────────────────────────────────────────────

test.describe("Plans — Hide/Show Toggle", () => {
  test("clicking eye icon toggles visibility and shows Hidden badge", async ({
    page,
  }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    // Find the first visible plan's toggle button
    const toggleBtn = page
      .locator('button[title="Hide from planner"]')
      .first();
    if ((await toggleBtn.count()) === 0) {
      test.skip();
      return;
    }

    // Click to hide
    await toggleBtn.click();
    await page.waitForTimeout(1_000);

    // Should now show Hidden badge
    const hiddenBadge = page.locator("text=Hidden").first();
    await expect(hiddenBadge).toBeVisible({ timeout: 5_000 });

    // The card should have reduced opacity (opacity-60 class)
    const card = hiddenBadge.locator("xpath=ancestor::div[contains(@class, 'opacity')]");
    if ((await card.count()) > 0) {
      await expect(card.first()).toHaveClass(/opacity-60/);
    }

    // Toggle back to show
    const showBtn = page.locator('button[title="Show in planner"]').first();
    await showBtn.click();
    await page.waitForTimeout(1_000);
  });
});

// ─── Open in Planner ────────────────────────────────────────────────────────

test.describe("Plans — Open in Planner", () => {
  test("clicking open icon navigates to /planner?planId=...", async ({
    page,
  }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    const openLink = page.locator('a[title="Open in planner"]').first();
    if ((await openLink.count()) === 0) {
      test.skip();
      return;
    }

    await openLink.click();
    await page.waitForURL(/\/planner\?planId=/, { timeout: 10_000 });
    expect(page.url()).toContain("/planner?planId=");
  });
});

// ─── New Plan Button ────────────────────────────────────────────────────────

test.describe("Plans — New Plan Button", () => {
  test("New Plan button navigates to /planner?newPlan=true", async ({
    page,
  }) => {
    await navigateToPlans(page);

    const newPlanBtn = page.locator("a", { hasText: "New Plan" });
    await expect(newPlanBtn).toBeVisible({ timeout: 5_000 });
    await newPlanBtn.click();
    await page.waitForURL(/\/planner\?newPlan=true/, { timeout: 10_000 });
    expect(page.url()).toContain("/planner?newPlan=true");
  });
});

// ─── Planner Manage Button ──────────────────────────────────────────────────

test.describe("Plans — Planner Manage Button", () => {
  test("planner page has Manage Plans button with tooltip", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/planner");
    await expect(page.locator("text=/Course Planner/")).toBeVisible({
      timeout: 15_000,
    });

    const manageBtn = page.locator('button[aria-label="Manage plans"]');
    await expect(manageBtn).toBeVisible({ timeout: 5_000 });
    await expect(manageBtn).toHaveAttribute("title", "Manage Plans");
  });

  test("clicking Manage Plans button navigates to /plans", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/planner");
    await expect(page.locator("text=/Course Planner/")).toBeVisible({
      timeout: 15_000,
    });

    const manageBtn = page.locator('button[aria-label="Manage plans"]');
    if ((await manageBtn.count()) === 0) {
      test.skip();
      return;
    }

    await manageBtn.click();
    await page.waitForURL(/\/plans/, { timeout: 10_000 });
    expect(page.url()).toContain("/plans");
  });
});

// ─── Share Modal ────────────────────────────────────────────────────────────

test.describe("Plans — Share Modal", () => {
  test("clicking share button opens modal with Share heading", async ({
    page,
  }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    const shareBtn = page.locator('button[title="Share plan"]').first();
    if ((await shareBtn.count()) === 0) {
      test.skip();
      return;
    }

    await shareBtn.click();
    await page.waitForTimeout(500);

    // Modal should open with "Share" in heading
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const heading = dialog.locator("h3", { hasText: /Share/ });
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });

  test("share modal shows family members with permission dropdowns", async ({
    page,
  }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    const shareBtn = page.locator('button[title="Share plan"]').first();
    if ((await shareBtn.count()) === 0) {
      test.skip();
      return;
    }

    await shareBtn.click();
    await page.waitForTimeout(1_000);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Wait for loading to finish
    await expect(dialog.locator("text=Loading...")).toBeHidden({
      timeout: 10_000,
    });

    // Check for permission dropdowns or "No other family members" message
    const selects = dialog.locator("select");
    const noMembers = dialog.locator(
      "text=No other family members to share with"
    );
    const hasSelects = (await selects.count()) > 0;
    const hasNoMembers = await noMembers.isVisible().catch(() => false);
    expect(hasSelects || hasNoMembers).toBeTruthy();

    // If selects exist, verify they have the expected options
    if (hasSelects) {
      const firstSelect = selects.first();
      const options = firstSelect.locator("option");
      const optionTexts: string[] = [];
      for (let i = 0; i < (await options.count()); i++) {
        optionTexts.push((await options.nth(i).textContent()) ?? "");
      }
      expect(optionTexts).toContain("No access");
      expect(optionTexts).toContain("View only");
      expect(optionTexts).toContain("Can edit");
      expect(optionTexts).toContain("Full access");
    }
  });

  test("Done button closes the share modal", async ({ page }) => {
    await navigateToPlans(page);
    await skipIfNoPlans(page);

    const shareBtn = page.locator('button[title="Share plan"]').first();
    if ((await shareBtn.count()) === 0) {
      test.skip();
      return;
    }

    await shareBtn.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click Done button
    const doneBtn = dialog.locator("button", { hasText: "Done" });
    await expect(doneBtn).toBeVisible({ timeout: 5_000 });
    await doneBtn.click();
    await page.waitForTimeout(500);

    // Modal should be closed
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});
