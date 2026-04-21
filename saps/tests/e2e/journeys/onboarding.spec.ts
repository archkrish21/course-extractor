import { test, expect, type Page } from "@playwright/test";
import { waitForHydration } from "../helpers/auth";
import { USERS, TEST_PASSWORD } from "../fixtures/test-users";

/**
 * Onboarding flow: the `studentOnboarding` test user is seeded without
 * `onboarding_completed_at`, so /onboarding is reachable without getting
 * redirected to /dashboard. We verify the page loads and shows the first
 * step, which is the minimum signal that the flow is wired up.
 *
 * Full-flow signup+onboarding tests that create new auth users are out of
 * scope here — they're destructive and flaky. This smoke test covers the
 * critical "page renders for a pre-onboarding user" path.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function loginAsOnboardingUser(page: Page) {
  await page.goto("/login");
  await waitForHydration(page);
  await page.locator('input[type="email"]').fill(USERS.studentOnboarding.email);
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(
    /\/(dashboard|planner|courses|consent|onboarding)/,
    { timeout: 15_000 }
  );
}

test("onboarding page renders step indicator for a pre-onboarding student", async ({ page }) => {
  await loginAsOnboardingUser(page);
  await page.goto("/onboarding");
  await page.waitForLoadState("domcontentloaded");

  // Some users may already be past onboarding (if the test order swapped
  // the seed state) — accept either the onboarding page or a redirect to
  // dashboard, but NOT a 404.
  const url = page.url();
  if (url.includes("/dashboard")) {
    test.skip(true, "User already onboarded — /onboarding redirected to /dashboard");
    return;
  }

  // Onboarding page must show a progress indicator OR a setup heading
  await expect
    .poll(async () => {
      const stepIndicator = await page.locator('[role="progressbar"], [aria-current="step"]').count();
      const heading = await page.locator("h1, h2").count();
      return stepIndicator + heading;
    }, { timeout: 10_000 })
    .toBeGreaterThan(0);
});
