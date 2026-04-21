import { test, expect } from "@playwright/test";

/**
 * Auth API surface: current user, route protection.
 */

test("GET /api/v1/auth/me returns the current user", async ({ request }) => {
  const res = await request.get("/api/v1/auth/me");
  expect(res.ok()).toBe(true);
  const data = await res.json();
  const user = data.user ?? data.data ?? data;
  expect(user.email).toBe("student@test.com");
  expect(user.role).toBe("student");
});
