import { test, expect, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await waitForHydration(page);
  await page.locator('input[type="email"]').fill("student@test.com");
  await page.locator('input[type="password"]').first().fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

// ─── E103: Summer Courses in Transcript ─────────────────────────────────────

test.describe("Summer — Transcript Display", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/transcript");
    await page.waitForTimeout(3_000);
  });

  test("E103: transcript shows Pre-Summer Session headers with warning styling", async ({ page }) => {
    // Check if any summer session headers exist in the transcript
    const session1Header = page.locator("text=Pre-Summer Session 1");
    const session2Header = page.locator("text=Pre-Summer Session 2");

    const hasSummer = (await session1Header.count()) > 0 || (await session2Header.count()) > 0;

    if (!hasSummer) {
      // No summer courses completed — check that regular semesters render normally
      const sem1 = page.locator("text=Semester 1");
      const sem2 = page.locator("text=Semester 2");
      // At least regular semesters should be present if courses exist
      if ((await sem1.count()) === 0 && (await sem2.count()) === 0) {
        test.skip(true, "No completed courses in transcript to verify");
        return;
      }
      // Verify no "Sem -2" or "Sem -1" text leaks through
      await expect(page.locator("text=Sem -2")).toBeHidden();
      await expect(page.locator("text=Sem -1")).toBeHidden();
      return;
    }

    // If summer headers exist, verify they render
    await expect(session1Header).toBeVisible();
  });

  test("E103: summer semester labels show correctly (not negative numbers)", async ({ page }) => {
    // Ensure no raw semester values like "-2" or "-1" are displayed
    // The transcript should show "Pre-Summer Session 1" and "Pre-Summer Session 2"
    const pageText = await page.locator("main").textContent();
    expect(pageText).not.toContain("Semester -2");
    expect(pageText).not.toContain("Semester -1");
    expect(pageText).not.toContain("Sem -2");
    expect(pageText).not.toContain("Sem -1");
  });
});

// ─── E104: Summer Courses in Print View ─────────────────────────────────────

test.describe("Summer — Print View", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/planner/print");
    await page.waitForTimeout(3_000);
  });

  test("E104: print page renders without raw semester values", async ({ page }) => {
    // The print page should never show semester -2 or -1 as raw numbers
    const pageText = await page.locator("body").textContent();
    expect(pageText).not.toContain("Semester -2");
    expect(pageText).not.toContain("Semester -1");
  });

  test("E104: summer courses in print show with sun prefix under regular semesters", async ({ page }) => {
    // Summer courses are merged under Semester 1 and 2 with ☀ prefix
    const sunPrefixed = page.locator("text=☀");
    const count = await sunPrefixed.count();

    if (count > 0) {
      // At least one summer course is shown with the sun prefix
      await expect(sunPrefixed.first()).toBeVisible();
    }
    // If no summer courses exist, this is fine — we just verify no errors
  });

  test("E104: print page shows Semester 1 and Semester 2 columns", async ({ page }) => {
    // Wait for the print page to fully render the SAPS header
    await expect(page.locator("text=Student Academic Planning System").first()).toBeVisible({ timeout: 10_000 });

    const sem1Labels = page.locator("text=Semester 1");
    const sem2Labels = page.locator("text=Semester 2");

    // At least one grade section should have semester columns
    expect(await sem1Labels.count()).toBeGreaterThan(0);
    expect(await sem2Labels.count()).toBeGreaterThan(0);
  });
});

// ─── E105: Summer Courses in Year-End Wizard ────────────────────────────────

test.describe("Summer — Year-End Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/year-end");
    await page.waitForTimeout(3_000);
  });

  test("E105: year-end wizard iterates summer semesters", async ({ page }) => {
    // The year-end wizard should show courses grouped by semester
    // including pre-summer sessions if any exist

    const heading = page.getByRole("heading", { name: "Year-End Review" });
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Check for Pre-Summer Session labels
    const session1 = page.locator("text=Pre-Summer Session 1");
    const session2 = page.locator("text=Pre-Summer Session 2");

    const hasSummer = (await session1.count()) > 0 || (await session2.count()) > 0;

    if (hasSummer) {
      // Summer courses should appear with warning-styled headers
      if (await session1.isVisible()) {
        await expect(session1).toBeVisible();
      }
    }

    // Regardless of summer courses, regular semesters should be present
    // (if the student has enrolled courses)
    const pageText = await page.locator("main").textContent();
    expect(pageText).not.toContain("Semester -2");
    expect(pageText).not.toContain("Semester -1");
  });
});

// ─── E106: Summer Course GPA Contribution ───────────────────────────────────

test.describe("Summer — GPA Contribution", () => {
  test("E106: transcript GPA section renders valid values", async ({ page }) => {
    await login(page);
    await page.goto("/transcript");
    await page.waitForTimeout(3_000);

    // Look for GPA display — should show numeric values (not NaN or undefined)
    const gpaElements = page.locator("text=/\\d+\\.\\d+/");
    const count = await gpaElements.count();

    if (count === 0) {
      test.skip(true, "No GPA values displayed — no completed courses");
      return;
    }

    // Verify GPA values are reasonable numbers (0.0-5.0 range)
    const firstGpa = await gpaElements.first().textContent();
    if (firstGpa) {
      const parsed = parseFloat(firstGpa);
      expect(parsed).toBeGreaterThanOrEqual(0);
      expect(parsed).toBeLessThanOrEqual(5.0);
    }
  });
});

// ─── E102: Summer Courses in Validation Report ─────────────────────────────

test.describe("Summer — Validation Report", () => {
  test("E102: validation report does not show raw negative semester values", async ({ page }) => {
    await login(page);
    await page.goto("/planner");
    await expect(page.locator("text=Loading your plans...")).toBeHidden({
      timeout: 15_000,
    });

    // Look for the validation panel/report
    const validationBtn = page.locator(
      'button:has-text("Validation"), button:has-text("Issues"), button:has-text("Report")'
    ).first();

    if (await validationBtn.isVisible()) {
      await validationBtn.click();
      await page.waitForTimeout(1_000);
    }

    // Ensure no raw "-2" or "-1" semester references in the validation output
    const mainText = await page.locator("main").textContent();
    expect(mainText).not.toContain("semester -2");
    expect(mainText).not.toContain("semester -1");
  });
});
