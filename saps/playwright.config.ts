import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  globalTimeout: 10 * 60_000, // 10 min hard ceiling
  timeout: 20_000, // per-test default
  expect: { timeout: 5_000 },
  // Shared test user (student@test.com) has a 3-plan launch-tier cap. All
  // mutation-heavy tests create scratch plans, so strict single-worker
  // serialization is required to avoid plan-count races.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "html" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 7_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Browser navigations send Origin automatically, but Playwright's
    // APIRequestContext does not — and the prod build's CSRF check rejects
    // mutations without an allowed Origin. Setting it here covers both.
    extraHTTPHeaders: {
      Origin: "http://localhost:3000",
    },
    ...devices["Desktop Chrome"],
  },
  projects: [
    // ── Setup: create storageState files for each role (runs first) ──
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // ── API-only tests (use student auth + API request context) ──
    // Runs with a single worker to avoid parallel mutations of the shared
    // student plan state causing GPA/course count races.
    {
      name: "api",
      testDir: "./tests/e2e/api",
      use: { storageState: "./tests/e2e/.auth/student.json" },
      dependencies: ["setup"],
      fullyParallel: false,
    },

    // ── UI tests as student (default app user) ──
    {
      name: "ui-student",
      testDir: "./tests/e2e/ui",
      use: { storageState: "./tests/e2e/.auth/student.json" },
      dependencies: ["setup"],
    },

    // ── Journey tests (multi-role flows) ──
    {
      name: "journeys",
      testDir: "./tests/e2e/journeys",
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // E2E runs against a production build (`next build && next start`) rather
    // than `next dev`. Dev-mode lazy compile + Turbopack module eviction was
    // the source of intermittent HTML-404 flakes (see PRs #105, #111). Prod
    // build serves pre-compiled routes — no eviction, no warmup needed.
    // Cost: ~1-2 min build on first run; reused via reuseExistingServer.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Skip Sentry SDK init during E2E so test runs don't pollute the prod
    // Sentry project. The flag is checked at top of each sentry.*.config.ts.
    env: {
      NEXT_PUBLIC_E2E_DISABLE_TELEMETRY: "1",
    },
  },
});
