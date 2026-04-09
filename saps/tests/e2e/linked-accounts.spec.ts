import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page, email = "student@test.com", password = "Test1234!") {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

async function navigateToSettings(page: Page) {
  await login(page);
  await page.goto("/settings");
  await page.waitForTimeout(2_000);
}

// ─── Linked Accounts Section ────────────────────────────────────────────────

test.describe("Settings — Linked Accounts", () => {
  test('displays "Linked Accounts" heading', async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    const heading = page.locator("text=Linked Accounts").first();
    await expect(heading).toBeVisible({ timeout: 5_000 });

    // Ensure we do NOT show the old "Family Members" heading
    const oldHeading = page.locator("text=Family Members");
    expect(await oldHeading.count()).toBe(0);
  });

  test('shows "linked accounts used" count', async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    const usedText = page.locator("text=/linked accounts used/i").first();
    await expect(usedText).toBeVisible({ timeout: 5_000 });
  });

  test("invite form is visible for student role", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    // Email input for invites
    const emailInput = page.locator('input[type="email"][placeholder*="Invite"]');
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    // Role select dropdown
    const roleSelect = page.locator("select").filter({ hasText: /Parent|Guardian|Counselor/ }).first();
    await expect(roleSelect).toBeVisible();

    // Invite button
    const inviteBtn = page.locator("button", { hasText: "Invite" }).first();
    await expect(inviteBtn).toBeVisible();
  });

  test("role select includes Counselor option", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    const roleSelect = page.locator("select").filter({ hasText: /Parent|Guardian|Counselor/ }).first();
    if ((await roleSelect.count()) === 0) {
      test.skip();
      return;
    }

    const counselorOption = roleSelect.locator('option[value="counselor"]');
    await expect(counselorOption).toBeAttached();
    expect(await counselorOption.textContent()).toBe("Counselor");
  });

  test("parent role sees Child option in role select", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    // Check if current user is a parent by looking for Child option
    const roleSelect = page.locator("select").filter({ hasText: /Parent|Guardian|Counselor/ }).first();
    if ((await roleSelect.count()) === 0) {
      test.skip();
      return;
    }

    const childOption = roleSelect.locator('option[value="student"]');
    if ((await childOption.count()) === 0) {
      // Not a parent account — skip
      test.skip();
      return;
    }
    expect(await childOption.textContent()).toBe("Child");
  });

  test("invite form is hidden for counselor role", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    // Determine current role from the profile section
    const counselorBadge = page.locator("text=counselor").first();
    if ((await counselorBadge.count()) === 0) {
      // Not logged in as counselor — skip
      test.skip();
      return;
    }

    // Invite form should not be present for counselors
    const emailInput = page.locator('input[type="email"][placeholder*="Invite"]');
    expect(await emailInput.count()).toBe(0);
  });

  test("remove button (X) exists on linked account members", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    // Remove buttons have title="Remove"
    const removeButtons = page.locator('button[title="Remove"]');
    if ((await removeButtons.count()) === 0) {
      // No linked members to remove — data dependent, just verify page loaded
      const heading = page.locator("text=Linked Accounts").first();
      await expect(heading).toBeVisible();
      return;
    }

    await expect(removeButtons.first()).toBeVisible();
  });
});

// ─── FREE_LAUNCH_MODE Linked Account Limits ─────────────────────────────────

test.describe("Settings — Linked Account Limits (FREE_LAUNCH_MODE)", () => {
  test("linked accounts badge shows /3 limit (not /5 from Plus plan)", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    // The badge should show "X/3 used" when FREE_LAUNCH_MODE is on
    const badge = page.locator("text=/\\d+\\/3 used/");
    await expect(badge).toBeVisible({ timeout: 5_000 });

    // Should NOT show /5 (Plus limit) or /8 (Elite limit)
    const wrongLimit = page.locator("text=/\\d+\\/5 used|\\d+\\/8 used/");
    expect(await wrongLimit.count()).toBe(0);
  });

  test("subscription section is hidden in FREE_LAUNCH_MODE", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    // The "Subscription" heading and "Manage" button should not be visible
    const subHeading = page.locator("h2, h3", { hasText: "Subscription" });
    expect(await subHeading.count()).toBe(0);
  });

  test("billing page shows Free Early Access in FREE_LAUNCH_MODE", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await login(page);
    await page.goto("/settings/billing");
    await page.waitForTimeout(2_000);

    await expect(page.locator("text=Free Early Access")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=No credit card required")).toBeVisible();
    await expect(page.locator("a[href='/settings']", { hasText: "Back to Settings" })).toBeVisible();
  });

  test("invite section does not show Upgrade link in FREE_LAUNCH_MODE", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    // The "Upgrade" link within the invite section should be hidden
    const upgradeLink = page.locator("a[href='/settings/billing']", { hasText: "Upgrade" });
    expect(await upgradeLink.count()).toBe(0);
  });
});

// ─── Settings Profile — State & School ──────────────────────────────────────

test.describe("Settings — Profile", () => {
  test("profile displays State and School", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    const stateText = page.locator("text=Illinois").first();
    await expect(stateText).toBeVisible({ timeout: 5_000 });

    const schoolText = page.locator("text=Stevenson").first();
    await expect(schoolText).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Settings — Subscription Section ────────────────────────────────────────

test.describe("Settings — Subscription", () => {
  test("subscription section shows plan badge and Manage button (when subscriptions enabled)", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    // In FREE_LAUNCH_MODE, subscription section is hidden
    const subHeading = page.locator("h2, h3", { hasText: "Subscription" });
    if ((await subHeading.count()) === 0) {
      // FREE_LAUNCH_MODE is on — verify it's intentionally absent
      const freeAccessBadge = page.locator("text=/\\d+\\/3 used/");
      await expect(freeAccessBadge).toBeVisible({ timeout: 5_000 });
      return;
    }

    // Plan badge (Starter, Plus, Elite, or Free Trial)
    const planBadge = page.locator("text=/Starter|Plus|Elite|Free Trial/").first();
    await expect(planBadge).toBeVisible({ timeout: 5_000 });

    // Manage button linking to billing
    const manageBtn = page.locator("a[href='/settings/billing'] button, a[href='/settings/billing']").filter({ hasText: "Manage" }).first();
    await expect(manageBtn).toBeVisible();
  });
});

// ─── Account Deletion ──────────────────────────────────────────────────────

test.describe("Settings — Account Deletion", () => {
  test("Danger Zone section is visible", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    const dangerZone = page.locator("text=Danger Zone");
    await expect(dangerZone).toBeVisible({ timeout: 5_000 });

    const deleteBtn = page.getByRole("button", { name: "Delete Account" });
    await expect(deleteBtn).toBeVisible();
  });

  test("Delete Account button opens confirmation modal", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    const deleteBtn = page.getByRole("button", { name: "Delete Account" });
    await deleteBtn.click();

    // Modal should appear with warning
    const modal = page.locator('[role="alertdialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=Delete your account?")).toBeVisible();
    await expect(page.locator("text=permanently delete")).toBeVisible();
  });

  test("Delete button is disabled until DELETE is typed", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    await page.getByRole("button", { name: "Delete Account" }).click();
    await page.waitForTimeout(500);

    const confirmBtn = page.getByRole("button", { name: "Delete my account" });
    await expect(confirmBtn).toBeDisabled();

    // Type partial text — button should stay disabled
    const confirmInput = page.locator("#delete-confirm");
    await confirmInput.fill("DELET");
    await expect(confirmBtn).toBeDisabled();

    // Type full "DELETE" — button should enable
    await confirmInput.fill("DELETE");
    await expect(confirmBtn).toBeEnabled();
  });

  test("Cancel closes modal without action", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    await page.getByRole("button", { name: "Delete Account" }).click();
    await page.waitForTimeout(500);

    const modal = page.locator('[role="alertdialog"]');
    await expect(modal).toBeVisible();

    // Click Cancel
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).not.toBeVisible({ timeout: 3_000 });

    // Page should still be on settings
    expect(page.url()).toContain("/settings");
  });

  test("Export data checkbox is present in modal", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    await page.getByRole("button", { name: "Delete Account" }).click();
    await page.waitForTimeout(500);

    const exportCheckbox = page.locator('input[type="checkbox"]').last();
    await expect(exportCheckbox).toBeVisible();

    const exportLabel = page.locator("text=Download my data before deleting");
    await expect(exportLabel).toBeVisible();
  });

  test("Export checkbox is toggleable", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    await page.getByRole("button", { name: "Delete Account" }).click();
    await page.waitForTimeout(500);

    const exportCheckbox = page.locator("label", { hasText: "Download my data" }).locator('input[type="checkbox"]');
    await expect(exportCheckbox).toBeVisible();

    // Toggle on
    await exportCheckbox.check();
    await expect(exportCheckbox).toBeChecked();

    // Toggle off
    await exportCheckbox.uncheck();
    await expect(exportCheckbox).not.toBeChecked();
  });

  test("confirmation input and type DELETE label are present", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToSettings(page);

    await page.getByRole("button", { name: "Delete Account" }).click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=/Type.*DELETE.*to confirm/")).toBeVisible();
    await expect(page.locator("#delete-confirm")).toBeVisible();
    expect(await page.locator("#delete-confirm").getAttribute("placeholder")).toBe("DELETE");
  });
});

// ─── Billing Page ───────────────────────────────────────────────────────────

test.describe("Billing — Plan Details", () => {
  test("4-year plan shows Expires (not Renews)", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await login(page);
    await page.goto("/settings/billing");
    await page.waitForTimeout(3_000);

    // Check if user is on a 4-year plan
    const fourYearText = page.locator("text=/4-year/i").first();
    if ((await fourYearText.count()) === 0) {
      // Not on a 4-year plan — skip
      test.skip();
      return;
    }

    const expiresText = page.locator("text=/Expires/").first();
    await expect(expiresText).toBeVisible({ timeout: 5_000 });

    // Should NOT show "Renews" for 4-year plans
    const renewsText = page.locator("text=/Renews on/");
    expect(await renewsText.count()).toBe(0);
  });

  test("pricing cards mention linked accounts", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await login(page);
    await page.goto("/settings/billing");
    await page.waitForTimeout(3_000);

    const linkedText = page.locator("text=/linked accounts/i");
    await expect(linkedText.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Login Page — Password Toggle ──────────────────────────────────────────

test.describe("Login — Password Visibility", () => {
  test("password field has show/hide toggle button", async ({ page }) => {
    await page.goto("/login");

    // The Input component renders a toggle button with aria-label
    const toggleBtn = page.locator('button[aria-label="Show password"]');
    await expect(toggleBtn).toBeVisible({ timeout: 5_000 });

    // Click to show password
    await toggleBtn.click();

    // After clicking, label should change to "Hide password"
    const hideBtn = page.locator('button[aria-label="Hide password"]');
    await expect(hideBtn).toBeVisible({ timeout: 3_000 });
  });
});

// ─── Name Display ──────────────────────────────────────────────────────────

test.describe("Name Display", () => {
  test("dashboard welcome message shows user name", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(2_000);

    const welcomeText = page.locator("text=/Welcome,/").first();
    await expect(welcomeText).toBeVisible({ timeout: 5_000 });
  });

  test("settings profile shows user name", async ({ page }) => {
    await navigateToSettings(page);

    // Look for a Name field input and verify its value is not empty
    const nameField = page.locator('input[name="name"], input[id="name"], input[placeholder*="name" i]').first();
    if ((await nameField.count()) === 0) {
      // Try finding a display-only name element near a "Name" label
      const nameLabel = page.locator("text=/^Name$/").first();
      if ((await nameLabel.count()) === 0) {
        test.skip();
        return;
      }
      await expect(nameLabel).toBeVisible({ timeout: 5_000 });
      return;
    }

    const value = await nameField.inputValue();
    expect(value).toBeTruthy();
    expect(value).not.toBe("null");
  });

  test("account switcher shows student names with tooltip", async ({ page }) => {
    await login(page);
    await page.waitForTimeout(2_000);

    // Look for an account switcher trigger
    const switcher = page.locator('button[aria-label*="account" i], button[aria-label*="switch" i], [data-testid="account-switcher"]').first();
    if ((await switcher.count()) === 0) {
      // No account switcher present — user may only have one account
      test.skip();
      return;
    }

    await switcher.click();
    await page.waitForTimeout(1_000);

    // Verify account list items have title attributes (tooltips) with student names
    const accountItems = page.locator('[role="menuitem"][title], [role="option"][title], li[title]');
    if ((await accountItems.count()) === 0) {
      // No titled account items found — skip gracefully
      test.skip();
      return;
    }

    const firstTitle = await accountItems.first().getAttribute("title");
    expect(firstTitle).toBeTruthy();
    expect(firstTitle).not.toBe("");
  });
});

// ─── Feedback Widget ──────────────────────────────────────────────────────

test.describe("Feedback Widget", () => {
  test("feedback button is visible after login", async ({ page }) => {
    await login(page);

    const feedbackBtn = page.locator('button[aria-label="Send feedback"]');
    await expect(feedbackBtn).toBeVisible({ timeout: 5_000 });
  });

  test("clicking feedback button opens panel", async ({ page }) => {
    await login(page);

    const feedbackBtn = page.locator('button[aria-label="Send feedback"]');
    await feedbackBtn.click();

    const heading = page.locator("text=Send Feedback").first();
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });

  test("star rating shows 5 star buttons", async ({ page }) => {
    await login(page);

    const feedbackBtn = page.locator('button[aria-label="Send feedback"]');
    await feedbackBtn.click();

    for (let i = 1; i <= 5; i++) {
      const star = page.locator(`button[aria-label="Rate ${i} star${i > 1 ? "s" : ""}"]`);
      await expect(star).toBeVisible({ timeout: 5_000 });
    }
  });

  test("submit button is disabled without rating", async ({ page }) => {
    await login(page);

    const feedbackBtn = page.locator('button[aria-label="Send feedback"]');
    await feedbackBtn.click();

    const submitBtn = page.locator("button", { hasText: "Submit Feedback" }).first();
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await expect(submitBtn).toBeDisabled();
  });

  test("close button hides feedback panel", async ({ page }) => {
    await login(page);

    const feedbackBtn = page.locator('button[aria-label="Send feedback"]');
    await feedbackBtn.click();

    const heading = page.locator("text=Send Feedback").first();
    await expect(heading).toBeVisible({ timeout: 5_000 });

    const closeBtn = page.locator('button[aria-label="Close"]').first();
    await closeBtn.click();

    await expect(heading).not.toBeVisible({ timeout: 5_000 });
  });
});

// ─── Guided Tours ─────────────────────────────────────────────────────────

test.describe("Guided Tours", () => {
  test("tour button is visible in nav", async ({ page }) => {
    await login(page);

    const tourBtn = page.locator('button[title="Take a guided tour of this page"]');
    await expect(tourBtn).toBeVisible({ timeout: 5_000 });
  });

  test('tour button contains "Tour" text', async ({ page }) => {
    await login(page);

    const tourBtn = page.locator('button[title="Take a guided tour of this page"]');
    await expect(tourBtn).toBeVisible({ timeout: 5_000 });
    await expect(tourBtn).toContainText("Tour");
  });

  test("dashboard tour triggers with Welcome to SAPS", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(2_000);

    const tourBtn = page.locator('button[title="Take a guided tour of this page"]');
    await tourBtn.click();

    const popover = page.locator(".driver-popover");
    await expect(popover).toBeVisible({ timeout: 5_000 });
    await expect(popover).toContainText("Welcome to SAPS");
  });

  test("planner tour triggers", async ({ page }) => {
    await login(page);
    await page.goto("/planner");
    await page.waitForTimeout(2_000);

    const tourBtn = page.locator('button[title="Take a guided tour of this page"]');
    await tourBtn.click();

    const popover = page.locator(".driver-popover");
    await expect(popover).toBeVisible({ timeout: 5_000 });
  });

  test("tour button opens driver.js overlay", async ({ page }) => {
    await login(page);

    const tourBtn = page.locator('button[title="Take a guided tour of this page"]');
    await tourBtn.click();

    const popover = page.locator(".driver-popover");
    await expect(popover).toBeVisible({ timeout: 5_000 });
  });
});
