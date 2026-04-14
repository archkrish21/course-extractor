import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const STUDENT_USER = { id: "student-1", email: "student@test.com" };
const PARENT_USER = { id: "parent-1", email: "parent@test.com" };

// ── Mocks ───────────────────────────────────────────────────────────────────

function createQueryChain(resolveValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveValue))
  );
  chain.update = vi.fn().mockImplementation(self);
  chain.set = vi.fn().mockImplementation(self);
  return chain;
}

let dbChain = createQueryChain();

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop in dbChain) {
          return (dbChain as Record<string, unknown>)[prop as string];
        }
        return undefined;
      },
    }
  ),
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  users: { id: "u_id", email: "u_email", firstName: "u_firstName", lastName: "u_lastName", role: "u_role", tourState: "u_tourState", onboardingCompletedAt: "u_onboardingCompletedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
}));

vi.mock("@/lib/api/require-same-origin", () => ({
  requireSameOrigin: vi.fn().mockReturnValue(null),
}));

import { requireAuth } from "@/lib/auth/get-user";
import { POST as completeOnboarding } from "@/app/api/v1/auth/onboarding-complete/route";
import { GET as getMe } from "@/app/api/v1/auth/me/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ── Tests: POST /api/v1/auth/onboarding-complete ────────────────────────────

describe("POST /api/v1/auth/onboarding-complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(STUDENT_USER);
  });

  it("marks onboarding as complete", async () => {
    const request = createRequest("http://localhost:3000/api/v1/auth/onboarding-complete", {
      method: "POST",
    });
    const response = await completeOnboarding(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.onboarding_completed).toBe(true);
    expect(dbChain.update).toHaveBeenCalled();
    expect(dbChain.set).toHaveBeenCalled();
  });

  it("returns 401 without auth", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    );

    const request = createRequest("http://localhost:3000/api/v1/auth/onboarding-complete", {
      method: "POST",
    });
    const response = await completeOnboarding(request);

    expect(response.status).toBe(401);
  });
});

// ── Tests: GET /api/v1/auth/me — onboarding_completed field ─────────────────

describe("GET /api/v1/auth/me — onboarding_completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
  });

  it("returns onboarding_completed: false for student without timestamp", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(STUDENT_USER);
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{
        email: "student@test.com",
        firstName: "Test",
        lastName: "Student",
        role: "student",
        tourState: {},
        onboardingCompletedAt: null,
      }]))
    );

    const response = await getMe();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.onboarding_completed).toBe(false);
  });

  it("returns onboarding_completed: true for student with timestamp", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(STUDENT_USER);
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{
        email: "student@test.com",
        firstName: "Test",
        lastName: "Student",
        role: "student",
        tourState: {},
        onboardingCompletedAt: new Date("2026-04-01"),
      }]))
    );

    const response = await getMe();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.onboarding_completed).toBe(true);
  });

  it("returns onboarding_completed: true for parent (regardless of timestamp)", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(PARENT_USER);
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{
        email: "parent@test.com",
        firstName: "Test",
        lastName: "Parent",
        role: "parent",
        tourState: {},
        onboardingCompletedAt: null,
      }]))
    );

    const response = await getMe();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.onboarding_completed).toBe(true);
  });

  it("returns onboarding_completed: true for counselor (regardless of timestamp)", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c-1", email: "c@test.com" });
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{
        email: "c@test.com",
        firstName: "Test",
        lastName: "Counselor",
        role: "counselor",
        tourState: {},
        onboardingCompletedAt: null,
      }]))
    );

    const response = await getMe();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.onboarding_completed).toBe(true);
  });
});
