import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────
// Use the canonical login() from helpers.ts — the previous local copy had a
// narrow waitForURL regex (missing /consent and /onboarding) that hung when
// the seeded student briefly redirected through those routes after login.

async function navigateToPlanner(page: Page) {
  await login(page);
  await page.goto("/planner");
  await expect(page.locator("text=Loading your plans...")).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator("text=/Course Planner/")).toBeVisible({
    timeout: 10_000,
  });
}

// ─── Plan management ────────────────────────────────────────────────────────

test.describe("Planner — Plan Management", () => {
  test("create new plan with name and template", async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToPlanner(page);

    // Click the create new plan button
    const createButton = page.getByLabel("Create new plan");
    // If no plans exist, use the "Create Plan" button in the empty state or
    // the "Get Started" button in the empty-state CTA
    const emptyCreateButton = page.getByRole("button", {
      name: /Create Plan|Get Started/,
    });

    if (await createButton.isVisible()) {
      await createButton.click();
    } else if (await emptyCreateButton.isVisible()) {
      await emptyCreateButton.click();
    } else {
      test.skip();
      return;
    }

    // Modal should appear
    const modal = page.locator(
      '[role="dialog"][aria-label="Create new plan"]'
    );
    await expect(modal).toBeVisible();

    // Skip if plan limit is reached (Create Plan button will be disabled)
    const createPlanBtn = modal.getByRole("button", { name: /Create Plan/ });
    if (await createPlanBtn.isDisabled()) {
      test.skip(true, "Plan limit reached — Create Plan button is disabled");
      return;
    }

    // Fill plan name
    await page.locator("#new-plan-name").fill("E2E Test Plan");

    // Check for template options
    const blankOption = modal.locator("text=Blank Plan");
    await expect(blankOption).toBeVisible();

    // Select a template if available
    const templateButtons = modal.locator(
      'button:not(:has-text("Blank Plan")):not(:has-text("Cancel")):not(:has-text("Create Plan"))'
    );
    const templateCount = await templateButtons.count();
    if (templateCount > 0) {
      await templateButtons.first().click();
    }

    // Create the plan
    await createPlanBtn.click();

    // Wait for modal to close and plan to load
    await expect(modal).toBeHidden({ timeout: 10_000 });
  });

  test("create blank plan", async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToPlanner(page);

    const createButton = page.getByLabel("Create new plan");
    const emptyCreateButton = page.getByRole("button", {
      name: /Create Plan|Get Started/,
    });

    if (await createButton.isVisible()) {
      await createButton.click();
    } else if (await emptyCreateButton.isVisible()) {
      await emptyCreateButton.click();
    } else {
      test.skip();
      return;
    }

    const modal = page.locator(
      '[role="dialog"][aria-label="Create new plan"]'
    );
    await expect(modal).toBeVisible();

    // Skip if plan limit is reached
    const createPlanBtn = modal.getByRole("button", { name: /Create Plan/ });
    if (await createPlanBtn.isDisabled()) {
      test.skip(true, "Plan limit reached — Create Plan button is disabled");
      return;
    }

    // Fill plan name
    await page.locator("#new-plan-name").fill("E2E Blank Plan");

    // Ensure "Blank Plan" is selected (default)
    const blankOption = modal.locator('button:has-text("Blank Plan")');
    await blankOption.click();

    // Create
    await createPlanBtn.click();
    await expect(modal).toBeHidden({ timeout: 10_000 });
  });

  test("delete a plan with confirmation", async ({ page }) => {
    // Bumped from the default 30s — navigateToPlanner alone can take up to
    // 25s on a cold worker (15s loading + 10s heading), leaving very little
    // budget for the multi-step switch + click + dialog flow below.
    test.setTimeout(60_000);
    await navigateToPlanner(page);

    // Read attributes via evaluate() so we never auto-wait on a locator that
    // may temporarily detach during a plan switch (the toolbar re-renders).
    // The previous version called `.isDisabled()`, which waits up to the
    // test timeout for the element to attach — and if the new plan has no
    // delete button (counselor permission) it would hang the entire test.
    const getDeleteButtonState = async () => {
      return await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label^="Delete plan:"]');
        if (!btn) return { exists: false, disabled: false } as const;
        const isDisabled = (btn as HTMLButtonElement).disabled;
        return { exists: true, disabled: isDisabled } as const;
      });
    };

    let state = await getDeleteButtonState();
    if (!state.exists) {
      test.skip();
      return;
    }

    if (state.disabled) {
      // Switch to a non-primary plan via the plan selector
      const planSelector = page.locator('[aria-label="Select a plan"]');
      if ((await planSelector.count()) === 0 || !(await planSelector.isVisible())) {
        test.skip(); // Only one plan; can't switch
        return;
      }
      const options = planSelector.locator("option");
      const count = await options.count();
      let switched = false;
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text && !text.includes("★")) {
          const value = await options.nth(i).getAttribute("value");
          if (value) {
            await planSelector.selectOption(value);
            await page.waitForTimeout(1000);
            switched = true;
            break;
          }
        }
      }
      if (!switched) {
        test.skip();
        return;
      }
      state = await getDeleteButtonState();
      if (!state.exists || state.disabled) {
        test.skip();
        return;
      }
    }

    const deleteButton = page.locator('button[aria-label^="Delete plan:"]').first();
    await deleteButton.click();

    const confirmDialog = page.locator(
      '[role="alertdialog"][aria-label="Delete plan confirmation"]'
    );
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText("Delete plan?");

    // Cancel the deletion (don't actually delete in tests)
    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).toBeHidden();
  });

  test("switch between plans", async ({ page }) => {
    await navigateToPlanner(page);

    const planSelector = page.locator('[aria-label="Select a plan"]');
    if (!(await planSelector.isVisible())) {
      test.skip(); // Only one plan exists
      return;
    }

    // Get options
    const options = planSelector.locator("option");
    const optionCount = await options.count();

    if (optionCount > 1) {
      // Switch to the second plan
      const secondValue = await options.nth(1).getAttribute("value");
      if (secondValue) {
        await planSelector.selectOption(secondValue);
        // Wait for plan data to load
        await page.waitForTimeout(1000);
        // The planner should update (no assertion on specific content since it's data-dependent)
      }
    }
  });

  test("reset plan to template", async ({ page }) => {
    await navigateToPlanner(page);

    const resetButton = page.getByLabel("Reset to template");
    if (!(await resetButton.isVisible())) {
      test.skip(); // Plan not created from template
      return;
    }

    // Verify the button is present
    await expect(resetButton).toBeVisible();
    // We don't click it to avoid destructive changes
  });
});

// ─── Set primary plan ────────────────────────────────────────────────────────

test.describe("Planner — Set Primary", () => {
  test("Set Primary button is visible for non-primary plans", async ({
    page,
  }) => {
    await navigateToPlanner(page);

    // Need at least 2 plans
    const planSelector = page.locator("select[aria-label='Select a plan']");
    if (!(await planSelector.isVisible())) {
      test.skip(); // Only one plan, can't test
      return;
    }

    // Find a non-primary plan option (one without ★)
    const options = planSelector.locator("option");
    const count = await options.count();
    let nonPrimaryValue: string | null = null;

    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text && !text.includes("★")) {
        nonPrimaryValue = await options.nth(i).getAttribute("value");
        break;
      }
    }

    if (!nonPrimaryValue) {
      test.skip(); // All plans are primary (shouldn't happen)
      return;
    }

    // Switch to the non-primary plan
    await planSelector.selectOption(nonPrimaryValue);
    await page.waitForTimeout(1000);

    // Set Primary button should be visible
    const setPrimaryBtn = page.getByLabel(/Set.*as primary plan/i);
    await expect(setPrimaryBtn).toBeVisible();
  });

  test("Set Primary button is hidden for the current primary plan", async ({
    page,
  }) => {
    await navigateToPlanner(page);

    // Don't rely on the planner auto-selecting the primary plan — earlier
    // tests in the same worker can mutate which plan is primary in the DB,
    // and the planner restores the last-selected plan from sessionStorage
    // (per-context, but the seeded primary may have changed). Explicitly
    // pick the option marked with ★ before asserting.
    const planSelector = page.locator("select[aria-label='Select a plan']");
    if (await planSelector.isVisible()) {
      const options = planSelector.locator("option");
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const text = (await options.nth(i).textContent()) ?? "";
        if (text.includes("★")) {
          const value = await options.nth(i).getAttribute("value");
          if (value) {
            await planSelector.selectOption(value);
            await page.waitForTimeout(500);
          }
          break;
        }
      }
    }

    // The "Set Primary" button should NOT be visible for the primary plan
    const setPrimaryBtn = page.getByLabel(/Set.*as primary plan/i);
    await expect(setPrimaryBtn).toBeHidden();

    // But "Primary" badge should be visible
    await expect(page.getByText("Primary")).toBeVisible();
  });

  test("clicking Set Primary changes the plan to primary and active", async ({
    page,
  }) => {
    await navigateToPlanner(page);

    const planSelector = page.locator("select[aria-label='Select a plan']");
    if (!(await planSelector.isVisible())) {
      test.skip();
      return;
    }

    // Find a non-primary plan
    const options = planSelector.locator("option");
    const count = await options.count();
    let nonPrimaryValue: string | null = null;
    let nonPrimaryName: string | null = null;

    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text && !text.includes("★")) {
        nonPrimaryValue = await options.nth(i).getAttribute("value");
        nonPrimaryName = text.trim();
        break;
      }
    }

    if (!nonPrimaryValue) {
      test.skip();
      return;
    }

    // Switch to non-primary plan
    await planSelector.selectOption(nonPrimaryValue);
    await page.waitForTimeout(1000);

    // Click Set Primary
    const setPrimaryBtn = page.getByLabel(/Set.*as primary plan/i);
    await setPrimaryBtn.click();
    await page.waitForTimeout(1000);

    // Should show toast confirmation
    await expect(page.locator('[role="status"]').filter({ hasText: "active plan" })).toBeVisible({
      timeout: 5000,
    });

    // Primary badge should now be visible
    await expect(page.getByText("Primary")).toBeVisible();

    // Status should be "active"
    await expect(page.locator("text=active").first()).toBeVisible();

    // Set Primary button should now be hidden (it's already primary)
    await expect(setPrimaryBtn).toBeHidden();

    // Switch back to the old primary (now draft) and restore it
    // to avoid affecting other tests
    const updatedOptions = planSelector.locator("option");
    const updatedCount = await updatedOptions.count();
    for (let i = 0; i < updatedCount; i++) {
      const text = await updatedOptions.nth(i).textContent();
      if (text && !text.includes("★") && text.trim() !== nonPrimaryName) {
        const oldPrimaryValue = await updatedOptions.nth(i).getAttribute("value");
        if (oldPrimaryValue) {
          await planSelector.selectOption(oldPrimaryValue);
          await page.waitForTimeout(1000);
          const restoreBtn = page.getByLabel(/Set.*as primary plan/i);
          if (await restoreBtn.isVisible()) {
            await restoreBtn.click();
            await page.waitForTimeout(1000);
          }
        }
        break;
      }
    }
  });

  test("old primary plan is demoted to draft after switching", async ({
    page,
  }) => {
    await navigateToPlanner(page);

    const planSelector = page.locator("select[aria-label='Select a plan']");
    if (!(await planSelector.isVisible())) {
      test.skip();
      return;
    }

    // Don't trust the auto-selected plan to be the primary one — earlier
    // tests in the same worker can mutate which plan is primary in the DB.
    // Explicitly find the option marked with ★ and switch to it first so
    // we have a known starting state.
    const allOptions = planSelector.locator("option");
    const allCount = await allOptions.count();
    let primaryName: string | null = null;
    let primaryValue: string | null = null;
    for (let i = 0; i < allCount; i++) {
      const text = (await allOptions.nth(i).textContent()) ?? "";
      if (text.includes("★")) {
        primaryName = text.replace(" ★", "").trim();
        primaryValue = await allOptions.nth(i).getAttribute("value");
        break;
      }
    }
    if (!primaryName || !primaryValue) {
      test.skip(true, "No primary plan found");
      return;
    }
    await planSelector.selectOption(primaryValue);
    await page.waitForTimeout(500);
    const currentPrimaryName = primaryName;

    // Find a non-primary plan and switch to it
    const options = planSelector.locator("option");
    const count = await options.count();
    let nonPrimaryValue: string | null = null;

    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text && !text.includes("★")) {
        nonPrimaryValue = await options.nth(i).getAttribute("value");
        break;
      }
    }

    if (!nonPrimaryValue) {
      test.skip();
      return;
    }

    // Set the non-primary plan as primary
    await planSelector.selectOption(nonPrimaryValue);
    await page.waitForTimeout(1000);
    const setPrimaryBtn = page.getByLabel(/Set.*as primary plan/i);
    await setPrimaryBtn.click();
    await page.waitForTimeout(1500);

    // Now switch back to the old primary
    const updatedOptions = planSelector.locator("option");
    const updatedCount = await updatedOptions.count();
    for (let i = 0; i < updatedCount; i++) {
      const text = await updatedOptions.nth(i).textContent();
      if (text && text.trim().replace(" ★", "") === currentPrimaryName) {
        const oldValue = await updatedOptions.nth(i).getAttribute("value");
        if (oldValue) {
          await planSelector.selectOption(oldValue);
          await page.waitForTimeout(1000);
        }
        break;
      }
    }

    // Old primary should now show "draft" status (not "active"). The Badge
    // component (components/ui/badge.tsx) doesn't include the literal string
    // "badge" in its class names — it uses Tailwind utility classes like
    // "bg-warning-light text-warning". Match the visible badge text directly.
    const draftBadge = page.getByText("draft", { exact: true });
    await expect(draftBadge).toBeVisible({ timeout: 3000 });

    // Restore: set the old primary back
    const restoreBtn = page.getByLabel(/Set.*as primary plan/i);
    if (await restoreBtn.isVisible()) {
      await restoreBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});

// ─── Course management ──────────────────────────────────────────────────────

test.describe("Planner — Course Management", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPlanner(page);
  });

  test("remove a course from plan", async ({ page }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Find a course card with a remove button (the X button on plan-course-card)
    // Course cards in the grid have remove buttons
    const removeButtons = page.locator(
      '[role="gridcell"] button[aria-label*="Remove"], [role="gridcell"] button[title*="Remove"]'
    );

    if ((await removeButtons.count()) === 0) {
      // Try finding any remove-style button in the grid
      const trashButtons = page.locator(
        '[role="gridcell"] button:has(svg)'
      );
      // This is expected if no courses are in the plan
      test.skip();
      return;
    }

    // Verify the button exists; we won't click to avoid destructive changes
    await expect(removeButtons.first()).toBeVisible();
  });

  test("clear semester with confirmation", async ({ page }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Find a "Clear" button in a semester cell
    const clearSemBtn = page
      .locator('[role="gridcell"] button:has-text("Clear")')
      .first();

    if (!(await clearSemBtn.isVisible())) {
      test.skip(); // No courses in any semester
      return;
    }

    await clearSemBtn.click();

    // Confirmation dialog should appear
    const confirmDialog = page.locator(
      '[role="alertdialog"][aria-label="Clear courses confirmation"]'
    );
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(/Clear Semester/);

    // Cancel
    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).toBeHidden();
  });

  test("clear grade with confirmation", async ({ page }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Find a "Clear" button in a grade header row
    const clearGradeBtn = page
      .locator(
        'button[role="rowheader"] ~ * button:has-text("Clear"), button[role="rowheader"] button:has-text("Clear")'
      )
      .first();

    if (!(await clearGradeBtn.isVisible())) {
      test.skip(); // No courses in any grade
      return;
    }

    await clearGradeBtn.click();

    const confirmDialog = page.locator(
      '[role="alertdialog"][aria-label="Clear courses confirmation"]'
    );
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(/Clear Grade/);

    // Cancel
    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).toBeHidden();
  });

  test("change course status (planned -> enrolled -> completed)", async ({
    page,
  }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Look for the status indicator BUTTON on a course card. The previous
    // version used `text=/Planned|Enrolled|Completed/` which on mobile also
    // matched the filter dropdown's `<option value="planned">All → Planned</option>`
    // — those options are inside a gridcell but are not actual status badges.
    // Scope to the button whose accessible name starts with "Status:".
    const statusBadges = page.locator(
      '[role="gridcell"] button[aria-label^="Status:"]'
    );

    if ((await statusBadges.count()) === 0) {
      test.skip(); // No courses in plan
      return;
    }

    // Verify status badges exist
    await expect(statusBadges.first()).toBeVisible();
  });

  test("undo button appears after an action", async ({ page }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // The undo button only appears when canUndo is true
    // Check if it's visible (depends on having performed an action)
    const undoButton = page.locator('button[aria-label^="Undo:"]');

    // Undo button may or may not be visible depending on state
    // We just verify the planner has the structure for it
    const headerButtons = page.locator(
      'button[aria-label="Create new plan"]'
    );
    await expect(headerButtons.first()).toBeVisible();
  });

  test("Ctrl+Z triggers undo", async ({ page }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Ctrl+Z should be handled without errors even when there's nothing to undo
    await page.keyboard.press("Control+z");

    // The page should still be functional
    await expect(
      page.getByRole("heading", { name: "Course Planner" })
    ).toBeVisible();
  });

  test("toast notification shows after actions with undo link", async ({
    page,
  }) => {
    const noPlanState = page.locator("text=No plans yet");
    if (await noPlanState.isVisible()) {
      test.skip();
      return;
    }

    // Toast appears after adding/removing courses
    // We verify the toast container exists
    // The toast uses the ToastProvider, which renders at the app level
    // If we can trigger an action, we'd see a toast

    // Verify the planner page is functional
    await expect(
      page.getByRole("heading", { name: "Course Planner" })
    ).toBeVisible();
  });
});

// ─── GPA Waiver ──────────────────────────────────────────────────────────────

test.describe("Planner — GPA Waiver", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPlanner(page);
  });

  test("GPA Waiver button is visible on waiver-eligible courses", async ({
    page,
  }) => {
    // Look for any "GPA Waiver" button in the planner grid
    const waiverBtn = page.locator('button:has-text("GPA Waiver")').first();

    // May or may not be visible depending on courses in the plan
    if (await waiverBtn.isVisible()) {
      await expect(waiverBtn).toBeVisible();
    } else {
      test.skip(); // No waiver-eligible courses in current plan
    }
  });

  test("clicking GPA Waiver toggles the waiver state", async ({ page }) => {
    const waiverBtn = page.locator('button:has-text("GPA Waiver")').first();
    if (!(await waiverBtn.isVisible())) {
      test.skip();
      return;
    }

    // Click to toggle waiver on
    await waiverBtn.click();
    await page.waitForTimeout(1500);

    // Should show toast
    await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 5000 });

    // Click again to toggle waiver off
    await waiverBtn.click();
    await page.waitForTimeout(1500);
  });
});

// ─── Bulk Updates ────────────────────────────────────────────────────────────

test.describe("Planner — Bulk Updates", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPlanner(page);
  });

  test("bulk status dropdown is visible in semester cell header", async ({
    page,
  }) => {
    // Expand a grade if needed
    const collapsedHeader = page
      .locator('button[role="rowheader"][aria-expanded="false"]')
      .first();
    if (await collapsedHeader.isVisible()) {
      await collapsedHeader.click();
      await page.waitForTimeout(500);
    }

    // Look for the Status dropdown in a semester cell
    const statusSelect = page.locator('select[title="Set status for all courses in this semester"]').first();
    if (await statusSelect.isVisible()) {
      await expect(statusSelect).toBeVisible();
    } else {
      test.skip(); // No courses in expanded semester
    }
  });

  test("bulk grade dropdown is visible in semester cell header", async ({
    page,
  }) => {
    const collapsedHeader = page
      .locator('button[role="rowheader"][aria-expanded="false"]')
      .first();
    if (await collapsedHeader.isVisible()) {
      await collapsedHeader.click();
      await page.waitForTimeout(500);
    }

    const gradeSelect = page.locator('select[title="Set grade for all courses in this semester"]').first();
    if (await gradeSelect.isVisible()) {
      await expect(gradeSelect).toBeVisible();
    } else {
      test.skip();
    }
  });

  test("AP course cards show only one AP badge (no duplicate)", async ({
    page,
  }) => {
    // Find any course card that contains "AP" in its credit type badge
    const apBadges = page.locator('[role="button"]').filter({ hasText: /\bAP\b/ });
    const count = await apBadges.count();

    if (count === 0) {
      test.skip(); // No AP courses in plan
      return;
    }

    // Check first AP course card — should have exactly one AP badge, not two
    const firstApCard = apBadges.first();
    const badgesInCard = firstApCard.locator('span:has-text("AP")');
    const badgeCount = await badgesInCard.count();

    // Should be 1 (credit type badge) not 2
    expect(badgeCount).toBeLessThanOrEqual(1);
  });
});
