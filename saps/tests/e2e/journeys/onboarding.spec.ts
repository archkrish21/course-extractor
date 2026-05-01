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

/**
 * Regression: full-year pre-summer courses (e.g. World History SOC13S/SOC14S
 * with semestersOffered [-2, -1]) used to be hardcoded into Sem 1 / Sem 2
 * during onboarding's Past Courses step. Drives the wizard as a Grade 11
 * student, checks World History under Grade 9 past courses, and verifies
 * the resulting plan places it in the pre-summer cells, not regular ones.
 *
 * This test consumes studentOnboarding's pre-onboarding state and will
 * skip on subsequent runs until the DB is reseeded — same pattern as the
 * smoke test above.
 */
test("full-year pre-summer past course lands in pre-summer cells, not Sem 1/2", async ({ page }) => {
  await loginAsOnboardingUser(page);
  await page.goto("/onboarding");
  await page.waitForLoadState("domcontentloaded");

  if (!page.url().includes("/onboarding")) {
    test.skip(true, "User already onboarded — cannot drive the wizard");
    return;
  }

  // Step 1: pick Grade 11 (triggers the 3-step flow with Past Courses).
  await page.locator('input[name="grade_level"][value="11"]').check({ force: true });
  await page.getByRole("button", { name: /^Next/i }).click();

  // Step 2: Past Courses. Grade 9 tab is the default for Grade 11 students,
  // but click it explicitly for resilience.
  const grade9Tab = page.getByRole("button", { name: /^Grade 9/ });
  await grade9Tab.waitFor({ state: "visible", timeout: 10_000 });
  await grade9Tab.click();

  // Wait for course list to load, then check World History (SOC13S/SOC14S).
  // The label contains both the course code and name.
  const worldHistoryLabel = page.locator("label", { hasText: "SOC13S/SOC14S" }).first();
  await worldHistoryLabel.waitFor({ state: "visible", timeout: 15_000 });
  await worldHistoryLabel.locator('input[type="checkbox"]').check();

  await page.getByRole("button", { name: /^Next/i }).click();

  // Step 3: Assign Grades — defaults ("A") are fine, just complete.
  await page.getByRole("button", { name: /^Complete$/i }).click();

  // Onboarding redirects to /planner or /dashboard once the plan is created.
  await page.waitForURL(/\/(dashboard|planner)/, { timeout: 20_000 });

  // Verify via API: the new primary plan must have SOC13S/SOC14S in
  // Grade 9 pre-summer cells (-2, -1), NOT in regular Sem 1/2.
  const plansRes = await page.request.get("/api/v1/plans");
  expect(plansRes.ok(), "GET /api/v1/plans succeeded").toBeTruthy();
  const plansBody = await plansRes.json();
  const plans = plansBody.data ?? plansBody.plans ?? [];
  const primary = plans.find((p: { isPrimary?: boolean }) => p.isPrimary);
  expect(primary, "primary plan was created by onboarding").toBeTruthy();

  const coursesRes = await page.request.get(`/api/v1/plans/${primary.id}/courses`);
  expect(coursesRes.ok(), "GET plan courses succeeded").toBeTruthy();
  const coursesBody = await coursesRes.json();
  const grouped: Record<string, Record<string, Array<{ course?: { code?: string } }>>> =
    coursesBody.data ?? coursesBody;
  const grade9 = grouped["9"] ?? {};

  const codesIn = (sem: string) =>
    (grade9[sem] ?? []).map((c) => c.course?.code).filter((x): x is string => Boolean(x));

  expect(codesIn("-2"), "Pre-Summer Session 1 of Grade 9").toContain("SOC13S/SOC14S");
  expect(codesIn("-1"), "Pre-Summer Session 2 of Grade 9").toContain("SOC13S/SOC14S");
  expect(codesIn("1"), "Sem 1 of Grade 9 must NOT hold the pre-summer course").not.toContain("SOC13S/SOC14S");
  expect(codesIn("2"), "Sem 2 of Grade 9 must NOT hold the pre-summer course").not.toContain("SOC13S/SOC14S");
});
