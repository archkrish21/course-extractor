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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
