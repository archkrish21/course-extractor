import { test, expect } from "@playwright/test";

/**
 * Public pages: homepage hero, legal pages. No auth required.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("homepage shows hero heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your four-year plan\.\s*Granted\./i })
  ).toBeVisible({ timeout: 10_000 });
});

test("homepage hero shows Early access badge, CTAs, and proof row", async ({ page }) => {
  await page.goto("/");

  // "Early access" pill (Phase 2 anchor element)
  await expect(page.getByText("Early access", { exact: true })).toBeVisible();

  // Primary and secondary CTAs (.first() — same labels appear in nav and final CTA)
  await expect(
    page.getByRole("link", { name: /^Get Started Free$/i }).first()
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /See how it works/i })).toBeVisible();

  // Proof row dots (Phase 2 — replaced the stats bar). exact:true so we
  // don't match similar phrases in the FAQ ("no credit card required" etc).
  await expect(page.getByText("Built for High School", { exact: true })).toBeVisible();
  await expect(page.getByText("Free to start", { exact: true })).toBeVisible();
  await expect(page.getByText("No credit card", { exact: true })).toBeVisible();
});

test("homepage shows how-it-works strip with V3 copy", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tell Genie your goals" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "See your path mapped" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Adjust as you grow" })
  ).toBeVisible();
});

test("homepage final CTA reads 'Map the path.' (no stacked brand beats)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^Map the path\.$/i })).toBeVisible();
  // Negative assertion: stale "Make the wish" copy should be gone
  await expect(page.getByText("Make the wish")).toHaveCount(0);
});

test("homepage footer shows wordmark, tagline, disclaimer, and request-school link", async ({ page }) => {
  await page.goto("/");

  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();

  // Wordmark renders in footer (the SVG has role=img + aria-label)
  await expect(footer.getByRole("img", { name: "planwithGenie" })).toBeVisible();

  // Tagline (the earned brand beat in the bottom bar)
  await expect(footer.getByText(/Academic planning, granted/i)).toBeVisible();

  // Legal disclaimer (load-bearing, must not regress)
  await expect(
    footer.getByText(/Not affiliated with Adlai E\. Stevenson High School/i)
  ).toBeVisible();

  // Subtitle link to /request-school
  const requestLink = footer.getByRole("link", { name: /more schools coming soon/i });
  await expect(requestLink).toBeVisible();
  await expect(requestLink).toHaveAttribute("href", "/request-school");
});

test("homepage body uses Inter font (Phase 1 fix — font-family actually loads)", async ({ page }) => {
  await page.goto("/");
  const fontFamily = await page.evaluate(
    () => window.getComputedStyle(document.body).fontFamily
  );
  expect(fontFamily).toMatch(/Inter/i);
});

test("terms of service page shows heading and key sections", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.locator("h1", { hasText: "Terms of Service" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("text=Acceptance of Terms")).toBeVisible();
});

test("privacy policy page shows heading and COPPA/FERPA sections", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator("h1", { hasText: "Privacy Policy" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("text=/COPPA/").first()).toBeVisible();
  await expect(page.locator("text=/FERPA/").first()).toBeVisible();
});

test("request-school page submits successfully", async ({ page }) => {
  // Stub the API so the test verifies the UI flow without coupling to DB
  // state. The actual route logic is covered by tests/api/school-request.test.ts.
  await page.route("**/api/v1/school-request", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { received: true } }),
    });
  });

  await page.goto("/request-school");

  await expect(
    page.getByRole("heading", { name: /Bring Genie to your school/i })
  ).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("School name").fill("Test High School, IL");
  await page.getByLabel("Your email").fill(`e2e-${Date.now()}@example.com`);

  await page.getByRole("button", { name: /Notify Me/i }).click();

  await expect(
    page.getByRole("heading", { name: /on the list/i })
  ).toBeVisible({ timeout: 10_000 });
});

test("unknown route shows 404 page with numeral and back-home CTA", async ({ page }) => {
  await page.goto("/this-page-does-not-exist-xyz");

  await expect(
    page.getByRole("heading", { name: /Page not found/i })
  ).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("404", { exact: true })).toBeVisible();

  const backLink = page.getByRole("link", { name: /Back to home/i });
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveAttribute("href", "/");
});
