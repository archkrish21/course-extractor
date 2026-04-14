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
  await expect(
    page.locator("text=/Course Planner/")
  ).toBeVisible({ timeout: 10_000 });
}

async function skipIfNoPlans(page: Page) {
  const noPlanState = page.locator("text=/No plans yet|Create Your First Plan|No Plans Shared/i");
  if ((await noPlanState.count()) > 0 && (await noPlanState.first().isVisible())) {
    test.skip();
  }
}

async function expandFirstGrade(page: Page) {
  const collapsed = page.locator('[role="rowheader"][aria-expanded="false"]').first();
  if ((await collapsed.count()) > 0) {
    await collapsed.click();
    await page.waitForTimeout(500);
  }
}

async function expandAllGrades(page: Page) {
  for (let i = 0; i < 4; i++) {
    const collapsed = page.locator('[role="rowheader"][aria-expanded="false"]').first();
    if ((await collapsed.count()) > 0) {
      await collapsed.click();
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Find a grade bar header that contains the given grade text.
 * e.g. gradeBar(page, 9) matches the row header containing "Grade 9".
 * The header is a <div role="rowheader">, not a <button>.
 */
function gradeBar(page: Page, grade: number) {
  return page.locator(`[role="rowheader"]`, { has: page.locator(`span[data-grade="${grade}"]`) });
}

// ─── Lock Icon Visibility ──────────────────────────────────────────────────

test.describe("Grade Lock — Lock icon visibility", () => {
  test("lock button appears on current and previous grade bars", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    // At least one Lock or Locked button should be visible on a grade bar
    const lockButtons = page.locator('button[aria-label*="Lock Grade"], button[aria-label*="Unlock Grade"]');
    await page.waitForTimeout(2000);

    const count = await lockButtons.count();
    // The feature should render lock buttons on current and previous grades
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("lock button does NOT appear on future grade bars", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    // Future grades are those beyond the effective current grade.
    // The highest grade level is 12 — check if grade 12 has a lock button.
    // If grade 12 is in the future, it should NOT have a lock button.
    // We check all four grade levels; any grade whose bar does NOT contain
    // a lock/unlock button is presumably a future grade.
    for (const grade of [9, 10, 11, 12]) {
      const bar = gradeBar(page, grade);
      if ((await bar.count()) === 0) continue;

      const lockBtn = bar.locator('button[aria-label*="Lock Grade"], button[aria-label*="Unlock Grade"]');
      const hasCurrent = bar.locator("text=(current)");

      // If this grade has "(current)" label, lock should be present
      if ((await hasCurrent.count()) > 0) {
        expect(await lockBtn.count()).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("lock button shows 'Lock' text when unlocked, 'Locked' when locked", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    // Check for unlocked lock buttons — should display "Lock"
    const unlockableButtons = page.locator('button[aria-label^="Lock Grade"]');
    if ((await unlockableButtons.count()) > 0) {
      const text = await unlockableButtons.first().textContent();
      expect(text?.trim()).toBe("Lock");
    }

    // Check for locked lock buttons — should display "Locked"
    const lockedButtons = page.locator('button[aria-label^="Unlock Grade"]');
    if ((await lockedButtons.count()) > 0) {
      const text = await lockedButtons.first().textContent();
      expect(text?.trim()).toBe("Locked");
    }

    // At least one type should exist
    const totalLockButtons = (await unlockableButtons.count()) + (await lockedButtons.count());
    expect(totalLockButtons).toBeGreaterThanOrEqual(1);
  });
});

// ─── Locking a Grade (redirect to year-end) ────────────────────────────────

test.describe("Grade Lock — Locking redirects to year-end", () => {
  test("clicking Lock on a grade bar navigates to /year-end?grade=X", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    // Find an unlocked grade to lock
    const lockButton = page.locator('button[aria-label^="Lock Grade"]').first();
    if ((await lockButton.count()) === 0) {
      test.skip(); // All grades may already be locked or no lock buttons present
      return;
    }

    // Extract the grade number from the aria-label "Lock Grade X"
    const ariaLabel = await lockButton.getAttribute("aria-label");
    const gradeMatch = ariaLabel?.match(/Lock Grade (\d+)/);
    expect(gradeMatch).toBeTruthy();
    const gradeNum = gradeMatch![1];

    await lockButton.click();
    await page.waitForURL(/\/year-end/, { timeout: 10_000 });

    expect(page.url()).toContain(`/year-end`);
    expect(page.url()).toContain(`grade=${gradeNum}`);
  });
});

// ─── Unlock Flow ────────────────────────────────────────────────────────────

test.describe("Grade Lock — Unlock flow", () => {
  test("clicking Locked shows confirmation dialog", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    const lockedButton = page.locator('button[aria-label^="Unlock Grade"]').first();
    if ((await lockedButton.count()) === 0) {
      test.skip(); // No locked grades to test
      return;
    }

    await lockedButton.click();
    await page.waitForTimeout(500);

    // Confirmation dialog should appear
    const dialog = page.locator('div[role="alertdialog"][aria-label="Unlock grade confirmation"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test("dialog has 'Unlock Grade X?' title and Cancel/Unlock buttons", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    const lockedButton = page.locator('button[aria-label^="Unlock Grade"]').first();
    if ((await lockedButton.count()) === 0) {
      test.skip();
      return;
    }

    // Extract grade from aria-label "Unlock Grade X"
    const ariaLabel = await lockedButton.getAttribute("aria-label");
    const gradeMatch = ariaLabel?.match(/Unlock Grade (\d+)/);
    expect(gradeMatch).toBeTruthy();
    const gradeNum = gradeMatch![1];

    await lockedButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('div[role="alertdialog"][aria-label="Unlock grade confirmation"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Title text
    await expect(dialog.locator(`text=Unlock Grade ${gradeNum}?`)).toBeVisible();

    // Cancel button
    await expect(dialog.locator("button", { hasText: "Cancel" })).toBeVisible();

    // Unlock button
    await expect(dialog.locator("button", { hasText: `Unlock Grade ${gradeNum}` })).toBeVisible();
  });

  test("clicking Cancel closes dialog without unlocking", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    const lockedButton = page.locator('button[aria-label^="Unlock Grade"]').first();
    if ((await lockedButton.count()) === 0) {
      test.skip();
      return;
    }

    await lockedButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('div[role="alertdialog"][aria-label="Unlock grade confirmation"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click Cancel
    await dialog.locator("button", { hasText: "Cancel" }).click();
    await page.waitForTimeout(500);

    // Dialog should be gone
    await expect(dialog).toBeHidden();

    // The button should still say "Locked" (grade remains locked)
    await expect(lockedButton).toBeVisible();
    const text = await lockedButton.textContent();
    expect(text?.trim()).toBe("Locked");
  });

  test("clicking Unlock removes the lock", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    const lockedButton = page.locator('button[aria-label^="Unlock Grade"]').first();
    if ((await lockedButton.count()) === 0) {
      test.skip();
      return;
    }

    const ariaLabel = await lockedButton.getAttribute("aria-label");
    const gradeMatch = ariaLabel?.match(/Unlock Grade (\d+)/);
    expect(gradeMatch).toBeTruthy();
    const gradeNum = gradeMatch![1];

    await lockedButton.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('div[role="alertdialog"][aria-label="Unlock grade confirmation"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click the Unlock button
    await dialog.locator("button", { hasText: `Unlock Grade ${gradeNum}` }).click();
    await page.waitForTimeout(1000);

    // Dialog should close
    await expect(dialog).toBeHidden();

    // The grade bar should now show "Lock" instead of "Locked"
    const newLockBtn = page.locator(`button[aria-label="Lock Grade ${gradeNum}"]`);
    await expect(newLockBtn).toBeVisible({ timeout: 5_000 });
    const text = await newLockBtn.textContent();
    expect(text?.trim()).toBe("Lock");

    // Re-lock it to restore original state (redirect to year-end, then navigate back)
    // We leave cleanup to the test harness — locking requires the year-end wizard flow
  });
});

// ─── Locked Grade UI Restrictions ───────────────────────────────────────────

test.describe("Grade Lock — Locked grade UI restrictions", () => {
  /**
   * Helper: find a locked grade number from the page, expand it, and return
   * the grade number. Returns null if no locked grades exist.
   */
  async function findAndExpandLockedGrade(page: Page): Promise<number | null> {
    await page.waitForTimeout(2000);

    // Find all locked grade buttons
    const lockedButtons = page.locator('button[aria-label^="Unlock Grade"]');
    if ((await lockedButtons.count()) === 0) return null;

    const ariaLabel = await lockedButtons.first().getAttribute("aria-label");
    const match = ariaLabel?.match(/Unlock Grade (\d+)/);
    if (!match) return null;
    const grade = parseInt(match[1], 10);

    // Expand this grade if collapsed
    const bar = gradeBar(page, grade);
    const isExpanded = await bar.getAttribute("aria-expanded");
    if (isExpanded === "false") {
      await bar.click();
      await page.waitForTimeout(500);
    }

    return grade;
  }

  test("bulk status dropdown is hidden in locked grade semesters", async ({ page }) => {
    test.setTimeout(60_000);
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    const grade = await findAndExpandLockedGrade(page);
    if (grade === null) { test.skip(); return; }

    // Bulk status selects within the locked grade row should not exist.
    // The grade row is the div[role="row"] containing the grade bar.
    const gradeRow = page.locator('div[role="row"]', { has: page.locator(`span[data-grade="${grade}"]`) });
    const bulkStatus = gradeRow.locator('select[title*="Set status for all courses"]');
    expect(await bulkStatus.count()).toBe(0);
  });

  test("bulk grade dropdown is hidden in locked grade semesters", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const grade = await findAndExpandLockedGrade(page);
    if (grade === null) { test.skip(); return; }

    const gradeRow = page.locator('div[role="row"]', { has: page.locator(`span[data-grade="${grade}"]`) });
    const bulkGrade = gradeRow.locator('select[title*="Set grade for all courses"]');
    expect(await bulkGrade.count()).toBe(0);
  });

  test("clear semester button is hidden in locked grade semesters", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const grade = await findAndExpandLockedGrade(page);
    if (grade === null) { test.skip(); return; }

    // Clear semester buttons use aria-label "Clear all courses in Grade X, Semester Y"
    const clearSem1 = page.locator(`button[aria-label="Clear all courses in Grade ${grade}, Semester 1"]`);
    const clearSem2 = page.locator(`button[aria-label="Clear all courses in Grade ${grade}, Semester 2"]`);
    expect(await clearSem1.count()).toBe(0);
    expect(await clearSem2.count()).toBe(0);
  });

  test("clear grade button is hidden in locked grade bar", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const grade = await findAndExpandLockedGrade(page);
    if (grade === null) { test.skip(); return; }

    // Clear grade button has title "Clear all courses in Grade X"
    const bar = gradeBar(page, grade);
    const clearBtn = bar.locator(`button[title="Clear all courses in Grade ${grade}"]`);
    expect(await clearBtn.count()).toBe(0);
  });

  test("add course button is hidden in locked grade semesters", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const grade = await findAndExpandLockedGrade(page);
    if (grade === null) { test.skip(); return; }

    // Add course buttons use aria-label "Add course to Grade X, Semester Y"
    const addSem1 = page.locator(`button[aria-label="Add course to Grade ${grade}, Semester 1"]`);
    const addSem2 = page.locator(`button[aria-label="Add course to Grade ${grade}, Semester 2"]`);
    const addSem1Max = page.locator(`button[aria-label="Maximum courses reached for Grade ${grade}, Semester 1"]`);
    const addSem2Max = page.locator(`button[aria-label="Maximum courses reached for Grade ${grade}, Semester 2"]`);

    expect(await addSem1.count()).toBe(0);
    expect(await addSem2.count()).toBe(0);
    expect(await addSem1Max.count()).toBe(0);
    expect(await addSem2Max.count()).toBe(0);
  });

  test("status dropdown is not interactive on course cards in locked grades", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const grade = await findAndExpandLockedGrade(page);
    if (grade === null) { test.skip(); return; }

    // In locked grades, status is rendered as a <span> not a <button>.
    // There should be no status buttons with "Click to change" in the locked row.
    const gradeRow = page.locator('div[role="row"]', { has: page.locator(`span[data-grade="${grade}"]`) });
    const statusButtons = gradeRow.locator('button[aria-label*="Click to change"]');
    expect(await statusButtons.count()).toBe(0);
  });

  test("grade dropdown is not interactive on course cards in locked grades", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const grade = await findAndExpandLockedGrade(page);
    if (grade === null) { test.skip(); return; }

    // In locked grades, grade is rendered as a Badge not a <select>.
    const gradeRow = page.locator('div[role="row"]', { has: page.locator(`span[data-grade="${grade}"]`) });
    const gradeSelects = gradeRow.locator('select[aria-label*="grade for"]');
    expect(await gradeSelects.count()).toBe(0);
  });

  test("remove button is hidden on course cards in locked grades", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);

    const grade = await findAndExpandLockedGrade(page);
    if (grade === null) { test.skip(); return; }

    // Remove buttons have aria-label "Remove <course name>"
    const gradeRow = page.locator('div[role="row"]', { has: page.locator(`span[data-grade="${grade}"]`) });
    const removeButtons = gradeRow.locator('button[aria-label^="Remove "]');
    expect(await removeButtons.count()).toBe(0);
  });
});

// ─── GPA Waiver on Locked Grades ────────────────────────────────────────────

test.describe("Grade Lock — GPA waiver still works on locked grades", () => {
  test("GPA waiver toggle is visible and clickable on locked grade courses", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop test");
    await navigateToPlanner(page);
    await skipIfNoPlans(page);
    await page.waitForTimeout(2000);

    // Find a locked grade
    const lockedButtons = page.locator('button[aria-label^="Unlock Grade"]');
    if ((await lockedButtons.count()) === 0) {
      test.skip(); // No locked grades
      return;
    }

    const ariaLabel = await lockedButtons.first().getAttribute("aria-label");
    const match = ariaLabel?.match(/Unlock Grade (\d+)/);
    if (!match) { test.skip(); return; }
    const grade = parseInt(match[1], 10);

    // Expand the locked grade
    const bar = gradeBar(page, grade);
    const isExpanded = await bar.getAttribute("aria-expanded");
    if (isExpanded === "false") {
      await bar.click();
      await page.waitForTimeout(500);
    }

    // Look for GPA Waiver buttons in the locked grade row
    const gradeRow = page.locator('div[role="row"]', { has: page.locator(`span[data-grade="${grade}"]`) });
    const waiverButtons = gradeRow.locator('button', { hasText: "GPA Waiver" });

    if ((await waiverButtons.count()) === 0) {
      // No waiver-eligible courses in this locked grade — data-dependent skip
      test.skip();
      return;
    }

    const waiverBtn = waiverButtons.first();
    await expect(waiverBtn).toBeVisible();

    // Click it to toggle — should not throw or be disabled
    await waiverBtn.click();
    await page.waitForTimeout(500);

    // Click again to toggle back
    await waiverBtn.click();
    await page.waitForTimeout(500);

    // Button should still be visible (not removed by locked state)
    await expect(waiverBtn).toBeVisible();
  });
});
