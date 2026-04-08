import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@test.com");
  await page.getByLabel("Password").fill("Test1234!");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|planner|courses)/, { timeout: 15_000 });
}

/**
 * The test user (student@test.com) is on the Plus plan, so print buttons
 * should be enabled. We detect the actual tier at runtime so these tests
 * remain correct if the seed data changes.
 */
async function detectCanPrint(page: Page): Promise<boolean> {
  // The planner page renders canPrint from currentAccount.subscriptionTier.
  // We can read it from the DOM: if the print button is disabled the user
  // is on trial/starter; if enabled they are on plus/elite.
  // We probe the progress page because it always has a single Print button.
  await page.goto("/progress");
  await page.waitForTimeout(3000);

  const printBtn = page.getByRole("button", { name: "Print" });
  if ((await printBtn.count()) === 0) return true; // no button found, assume enabled
  return !(await printBtn.isDisabled());
}

// ─── Planner Page ──────────────────────────────────────────────────────────

test.describe("Print Gating — Planner", () => {
  test("print button exists with correct aria-label", async ({ page }) => {
    await login(page);
    await page.goto("/planner");
    await expect(page.locator("text=Loading your plans...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.locator("text=/Course Planner/")).toBeVisible({
      timeout: 10_000,
    });

    const printBtn = page.locator('button[aria-label="Print plan"]');
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
  });

  test("print button is enabled for Plus/Elite users", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(!canPrint, "Test user is not on Plus/Elite — skipping enabled check");

    await page.goto("/planner");
    await expect(page.locator("text=Loading your plans...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.locator("text=/Course Planner/")).toBeVisible({
      timeout: 10_000,
    });

    const printBtn = page.locator('button[aria-label="Print plan"]');
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
    await expect(printBtn).toBeEnabled();
  });

  test("print button is disabled for Trial/Starter users", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — skipping disabled check");

    await page.goto("/planner");
    await expect(page.locator("text=Loading your plans...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.locator("text=/Course Planner/")).toBeVisible({
      timeout: 10_000,
    });

    const printBtn = page.locator('button[aria-label="Print plan"]');
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
    await expect(printBtn).toBeDisabled();
  });

  test("disabled print button has upgrade tooltip", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — tooltip only shown when disabled");

    await page.goto("/planner");
    await expect(page.locator("text=Loading your plans...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.locator("text=/Course Planner/")).toBeVisible({
      timeout: 10_000,
    });

    const wrapper = page.locator('span[title*="Upgrade to Plus"]', {
      has: page.locator('button[aria-label="Print plan"]'),
    });
    await expect(wrapper).toBeVisible({ timeout: 5_000 });
    const title = await wrapper.getAttribute("title");
    expect(title).toContain("Upgrade to Plus");
  });
});

// ─── Progress Page ─────────────────────────────────────────────────────────

test.describe("Print Gating — Progress", () => {
  test("print button exists on progress page", async ({ page }) => {
    await login(page);
    await page.goto("/progress");
    await page.waitForTimeout(3000);

    const printBtn = page.getByRole("button", { name: "Print" });
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
  });

  test("print button is enabled for Plus/Elite users", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(!canPrint, "Test user is not on Plus/Elite — skipping enabled check");

    await page.goto("/progress");
    await page.waitForTimeout(3000);

    const printBtn = page.getByRole("button", { name: "Print" });
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
    await expect(printBtn).toBeEnabled();
  });

  test("print button is disabled for Trial/Starter users", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — skipping disabled check");

    await page.goto("/progress");
    await page.waitForTimeout(3000);

    const printBtn = page.getByRole("button", { name: "Print" });
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
    await expect(printBtn).toBeDisabled();
  });

  test("disabled print button has upgrade tooltip", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — tooltip only shown when disabled");

    await page.goto("/progress");
    await page.waitForTimeout(3000);

    const wrapper = page.locator('span[title*="Upgrade to Plus"]', {
      has: page.getByRole("button", { name: "Print" }),
    });
    await expect(wrapper).toBeVisible({ timeout: 5_000 });
    const title = await wrapper.getAttribute("title");
    expect(title).toContain("Upgrade to Plus");
  });
});

// ─── Transcript Page ───────────────────────────────────────────────────────

test.describe("Print Gating — Transcript", () => {
  test("print button exists on transcript page", async ({ page }) => {
    await login(page);
    await page.goto("/transcript");
    await page.waitForTimeout(3000);

    const printBtn = page.getByRole("button", { name: "Print" });
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
  });

  test("print button is enabled for Plus/Elite users", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(!canPrint, "Test user is not on Plus/Elite — skipping enabled check");

    await page.goto("/transcript");
    await page.waitForTimeout(3000);

    const printBtn = page.getByRole("button", { name: "Print" });
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
    await expect(printBtn).toBeEnabled();
  });

  test("print button is disabled for Trial/Starter users", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — skipping disabled check");

    await page.goto("/transcript");
    await page.waitForTimeout(3000);

    const printBtn = page.getByRole("button", { name: "Print" });
    await expect(printBtn).toBeVisible({ timeout: 5_000 });
    await expect(printBtn).toBeDisabled();
  });

  test("disabled print button has upgrade tooltip", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — tooltip only shown when disabled");

    await page.goto("/transcript");
    await page.waitForTimeout(3000);

    const wrapper = page.locator('span[title*="Upgrade to Plus"]', {
      has: page.getByRole("button", { name: "Print" }),
    });
    await expect(wrapper).toBeVisible({ timeout: 5_000 });
    const title = await wrapper.getAttribute("title");
    expect(title).toContain("Upgrade to Plus");
  });
});

// ─── Dashboard Page ────────────────────────────────────────────────────────

test.describe("Print Gating — Dashboard", () => {
  test("Print Plan button exists in Quick Actions", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    const printPlanBtn = page.getByRole("button", { name: "Print Plan" });
    await expect(printPlanBtn).toBeVisible({ timeout: 5_000 });
  });

  test("Print Plan button is enabled for Plus/Elite users", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(!canPrint, "Test user is not on Plus/Elite — skipping enabled check");

    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    // For Plus/Elite users the Print Plan button is a link, not disabled
    const printPlanBtn = page.getByRole("button", { name: "Print Plan" });
    await expect(printPlanBtn).toBeVisible({ timeout: 5_000 });
    await expect(printPlanBtn).toBeEnabled();
  });

  test("Print Plan button is disabled for Trial/Starter users", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — skipping disabled check");

    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    const printPlanBtn = page.getByRole("button", { name: "Print Plan" });
    await expect(printPlanBtn).toBeVisible({ timeout: 5_000 });
    await expect(printPlanBtn).toBeDisabled();
  });

  test("disabled Print Plan button has upgrade tooltip", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — tooltip only shown when disabled");

    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    const wrapper = page.locator('span[title*="Upgrade to Plus"]', {
      has: page.getByRole("button", { name: "Print Plan" }),
    });
    await expect(wrapper).toBeVisible({ timeout: 5_000 });
    const title = await wrapper.getAttribute("title");
    expect(title).toContain("Upgrade to Plus");
  });
});

// ─── Cross-Page Tooltip Consistency ────────────────────────────────────────

test.describe("Print Gating — Tooltip Consistency", () => {
  test("all disabled print buttons show upgrade tooltip text", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(canPrint, "Test user is on Plus/Elite — tooltips only shown when disabled");

    // Check progress page
    await page.goto("/progress");
    await page.waitForTimeout(3000);
    const progressTooltip = page.locator('span[title*="Upgrade to Plus"]').first();
    await expect(progressTooltip).toBeVisible({ timeout: 5_000 });

    // Check transcript page
    await page.goto("/transcript");
    await page.waitForTimeout(3000);
    const transcriptTooltip = page.locator('span[title*="Upgrade to Plus"]').first();
    await expect(transcriptTooltip).toBeVisible({ timeout: 5_000 });

    // Check dashboard page
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);
    const dashboardTooltip = page.locator('span[title*="Upgrade to Plus"]').first();
    await expect(dashboardTooltip).toBeVisible({ timeout: 5_000 });

    // Check planner page
    await page.goto("/planner");
    await expect(page.locator("text=Loading your plans...")).toBeHidden({
      timeout: 15_000,
    });
    const plannerTooltip = page.locator('span[title*="Upgrade to Plus"]').first();
    await expect(plannerTooltip).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Disclaimer on Print Views ────────────────────────────────────────────

test.describe("Print — Disclaimer", () => {
  test("planner print page shows disclaimer in footer", async ({ page }) => {
    await login(page);
    const canPrint = await detectCanPrint(page);
    test.skip(!canPrint, "Test user cannot print — skipping print page check");

    // Navigate to planner to get a plan ID
    await page.goto("/planner");
    await expect(page.locator("text=/Course Planner/")).toBeVisible({ timeout: 15_000 });

    // Find the print button and get its target URL
    const printBtn = page.locator('button[aria-label="Print plan"]');
    if ((await printBtn.count()) === 0) {
      test.skip();
      return;
    }

    // Open print page directly (the button opens a new tab)
    const href = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Print plan"]');
      return btn?.closest("[onclick]")?.getAttribute("onclick")?.match(/window\.open\('([^']+)'/)?.[1] ?? null;
    });

    // Alternatively, extract plan ID from the page and go to print URL
    const planId = await page.evaluate(() => {
      const select = document.querySelector('select[aria-label="Select a plan"]') as HTMLSelectElement | null;
      return select?.value ?? null;
    });

    if (planId) {
      await page.goto(`/planner/print?id=${planId}`);
      await page.waitForTimeout(3000);
      await expect(page.locator("text=This is not an official school document")).toBeVisible({ timeout: 10_000 });
    } else if (href) {
      await page.goto(href);
      await page.waitForTimeout(3000);
      await expect(page.locator("text=This is not an official school document")).toBeVisible({ timeout: 10_000 });
    }
  });
});
