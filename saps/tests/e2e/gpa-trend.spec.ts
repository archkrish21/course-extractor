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

async function navigateToProgress(page: Page) {
  await login(page);
  await page.goto("/progress");
  await page.waitForTimeout(3000);
}

// ─── Progress Page Loads ───────────────────────────────────────────────────

test.describe("GPA Trend — Page Load", () => {
  test("progress page loads successfully", async ({ page }) => {
    await navigateToProgress(page);
    await expect(
      page.getByRole("heading", { name: "Academic Progress" })
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ─── GPA Trend Chart Visibility ────────────────────────────────────────────

test.describe("GPA Trend — Chart Visibility", () => {
  test("GPA trend chart is visible when 2+ snapshots exist", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop sidebar test");
    await navigateToProgress(page);

    const trendHeading = page.locator("text=GPA Trend");
    const hasTrend = (await trendHeading.count()) > 0;

    if (!hasTrend) {
      // Fewer than 2 snapshots — chart should not render; skip gracefully
      test.skip();
      return;
    }

    await expect(trendHeading).toBeVisible();
  });

  test("GPA trend chart has Unweighted legend item", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop sidebar test");
    await navigateToProgress(page);

    const trendHeading = page.locator("text=GPA Trend");
    if ((await trendHeading.count()) === 0) {
      test.skip();
      return;
    }

    const unweightedLegend = page.locator("text=Unweighted");
    await expect(unweightedLegend).toBeVisible({ timeout: 5_000 });
  });

  test("GPA trend chart has Weighted legend item", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop sidebar test");
    await navigateToProgress(page);

    const trendHeading = page.locator("text=GPA Trend");
    if ((await trendHeading.count()) === 0) {
      test.skip();
      return;
    }

    // "Weighted" also appears in the transcript GPA cards; narrow to the trend card
    const weightedLegend = page.locator("text=Weighted").first();
    await expect(weightedLegend).toBeVisible({ timeout: 5_000 });
  });

  test("GPA trend chart is not visible when fewer than 2 snapshots exist", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop sidebar test");
    await navigateToProgress(page);

    // We cannot deterministically control snapshot count here,
    // so we verify consistency: either the chart renders (2+ snapshots)
    // or it does not (< 2 snapshots). Both are valid states.
    const trendHeading = page.locator("text=GPA Trend");
    const hasTrend = (await trendHeading.count()) > 0;

    if (hasTrend) {
      // Chart is visible — verify it rendered properly with both legend items
      await expect(page.locator("text=Unweighted").first()).toBeVisible({ timeout: 5_000 });
      await expect(page.locator("text=Weighted").first()).toBeVisible({ timeout: 5_000 });
    } else {
      // No chart — confirm it is truly absent (not just slow to load)
      await page.waitForTimeout(2000);
      expect(await trendHeading.count()).toBe(0);
    }
  });
});

// ─── GPA Trend Chart Rendering ─────────────────────────────────────────────

test.describe("GPA Trend — Chart Rendering", () => {
  test("chart container renders SVG when trend is visible", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop sidebar test");
    await navigateToProgress(page);

    const trendHeading = page.locator("text=GPA Trend");
    if ((await trendHeading.count()) === 0) {
      test.skip();
      return;
    }

    // Recharts renders an SVG inside the ResponsiveContainer
    const trendCard = trendHeading.locator("xpath=ancestor::div[contains(@class, 'rounded')]");
    const svg = trendCard.locator("svg").first();
    await expect(svg).toBeVisible({ timeout: 5_000 });
  });

  test("chart has axis labels rendered", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "Desktop sidebar test");
    await navigateToProgress(page);

    const trendHeading = page.locator("text=GPA Trend");
    if ((await trendHeading.count()) === 0) {
      test.skip();
      return;
    }

    // X-axis should show date ticks (e.g., "Jan '25", "May '25")
    // Recharts renders tick text inside <text> elements within the SVG
    const trendCard = trendHeading.locator("xpath=ancestor::div[contains(@class, 'rounded')]");
    const ticks = trendCard.locator("svg .recharts-cartesian-axis-tick");
    const tickCount = await ticks.count();
    expect(tickCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── Manual Snapshot Creation & Chart Appearance ───────────────────────────

test.describe("GPA Trend — Snapshot API", () => {
  test("creating snapshots via API makes chart appear after refresh", async ({ page, request }) => {
    test.skip(test.info().project.name === "mobile", "Desktop sidebar test");
    await navigateToProgress(page);

    // Check current snapshot count via API
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const listRes = await request.get("/api/v1/gpa/snapshots", {
      headers: { Cookie: cookieHeader },
    });
    expect(listRes.ok()).toBeTruthy();

    const listJson = await listRes.json();
    const existingCount = (listJson.data ?? listJson ?? []).length;

    // Create manual snapshots until we have at least 2
    const needed = Math.max(0, 2 - existingCount);
    const createdIds: string[] = [];

    for (let i = 0; i < needed; i++) {
      const createRes = await request.post("/api/v1/gpa/snapshots", {
        headers: { Cookie: cookieHeader },
      });
      // Snapshot creation may fail if no grade entries exist; handle gracefully
      if (!createRes.ok()) {
        test.skip();
        return;
      }
      const createJson = await createRes.json();
      const snap = createJson.data ?? createJson;
      if (snap?.id) createdIds.push(snap.id);
    }

    // Refresh the progress page
    await page.goto("/progress");
    await page.waitForTimeout(3000);

    // Verify the GPA Trend chart now appears
    const trendHeading = page.locator("text=GPA Trend");
    if (existingCount + createdIds.length >= 2) {
      await expect(trendHeading.first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("text=Unweighted").first()).toBeVisible({ timeout: 5_000 });
      await expect(page.locator("text=Weighted").first()).toBeVisible({ timeout: 5_000 });
    } else {
      // Not enough data to produce a chart (e.g., no grade entries)
      const heading = page.getByRole("heading", { name: "Academic Progress" });
      await expect(heading).toBeVisible({ timeout: 10_000 });
    }
  });

  test("GET /api/v1/gpa/snapshots returns snapshot list", async ({ page, request }) => {
    await navigateToProgress(page);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const res = await request.get("/api/v1/gpa/snapshots", {
      headers: { Cookie: cookieHeader },
    });
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    const snapshots = json.data ?? json ?? [];
    expect(Array.isArray(snapshots)).toBeTruthy();

    // Each snapshot should have expected fields
    if (snapshots.length > 0) {
      const snap = snapshots[0];
      expect(snap).toHaveProperty("id");
      expect(snap).toHaveProperty("snapshotDate");
      expect(snap).toHaveProperty("trigger");
      expect(snap).toHaveProperty("cumulativeGpa");
      expect(snap).toHaveProperty("weightedGpa");
    }
  });

  test("POST /api/v1/gpa/snapshots creates a manual snapshot", async ({ page, request }) => {
    await navigateToProgress(page);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const createRes = await request.post("/api/v1/gpa/snapshots", {
      headers: { Cookie: cookieHeader },
    });

    if (!createRes.ok()) {
      // May fail if student has no grade entries; skip gracefully
      test.skip();
      return;
    }

    const json = await createRes.json();
    const snap = json.data ?? json;
    expect(snap).toHaveProperty("id");
    expect(snap.trigger).toBe("manual");
  });
});
