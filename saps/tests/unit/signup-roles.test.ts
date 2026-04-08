import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockInsertValues: Record<string, unknown>[] = [];
const mockReturning = vi.fn().mockResolvedValue([{ id: "new-account-id" }]);

function createQueryChain(resolveValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.innerJoin = vi.fn().mockImplementation(self);
  chain.leftJoin = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveValue))
  );
  chain.insert = vi.fn().mockImplementation(self);
  chain.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
    mockInsertValues.push(vals);
    return chain;
  });
  chain.returning = mockReturning;
  chain.onConflictDoNothing = vi.fn().mockImplementation(self);
  return chain;
}

let dbChain = createQueryChain();

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, {
    get(_target, prop) {
      if (prop in dbChain) return (dbChain as Record<string, unknown>)[prop as string];
      return undefined;
    },
  }),
}));

vi.mock("@/lib/db/schema", () => ({
  users: { id: "id", email: "email", role: "role" },
  accounts: { id: "id", studentUserId: "studentUserId" },
  accountMembers: { accountId: "accountId", userId: "userId" },
  studentProfiles: { userId: "userId" },
  subscriptions: { id: "id" },
  subscriptionPlans: { id: "id", name: "name" },
  legalDocuments: { id: "id", isCurrent: "isCurrent" },
  consentRecords: { id: "id" },
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireAuth: vi.fn(),
  getAccountContext: vi.fn(),
}));

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

const mockSupabaseSignUp = vi.fn().mockResolvedValue({
  data: { user: { id: "new-user-id" } },
  error: null,
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      signUp: (...args: unknown[]) => mockSupabaseSignUp(...args),
    },
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Signup — role handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.length = 0;
    dbChain = createQueryChain();
  });

  it("accepts 'guardian' as a valid role", async () => {
    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "guardian@test.com",
        password: "password123",
        date_of_birth: "1980-01-01",
        role: "guardian",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("maps 'guardian' role to 'parent' in the stored user record", async () => {
    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "guardian@test.com",
        password: "password123",
        date_of_birth: "1980-01-01",
        role: "guardian",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    // The API response should show "parent" (mapped from guardian)
    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe("parent");
  });

  it("keeps 'counselor' role as-is (no mapping)", async () => {
    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "counselor@test.com",
        password: "password123",
        date_of_birth: "1980-01-01",
        role: "counselor",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe("counselor");
  });

  it("keeps 'student' role as-is", async () => {
    const { POST } = await import("@/app/api/v1/auth/signup/route");

    // For student signup, the chain needs to return data for account creation
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([])); // legal docs
      return Promise.resolve(resolve([]));
    });

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@test.com",
        password: "password123",
        date_of_birth: "2008-01-01",
        role: "student",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe("student");
  });

  it("rejects signup for users under 13 (COPPA)", async () => {
    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const today = new Date();
    const under13 = `${today.getFullYear() - 12}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "kid@test.com",
        password: "password123",
        date_of_birth: under13,
        role: "student",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("COPPA_BLOCKED");
  });
});
