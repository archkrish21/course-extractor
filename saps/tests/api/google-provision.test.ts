import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockInsertValues: Record<string, unknown>[] = [];

function createQueryChain(resolveValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation((..._args: unknown[]) =>
    Promise.resolve(resolveValue)
  );
  chain.insert = vi.fn().mockImplementation(self);
  chain.values = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
    mockInsertValues.push(vals);
    return Promise.resolve();
  });
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
  users: { id: "id", email: "email" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
}));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

vi.mock("@/lib/api/require-same-origin", () => ({
  requireSameOrigin: vi.fn().mockReturnValue(null),
}));

import { POST } from "@/app/api/v1/auth/google-provision/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown = {}) {
  return new NextRequest(new URL("http://localhost:3000/api/v1/auth/google-provision"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setExistingUser(rows: Array<{ id: string }>) {
  dbChain = createQueryChain(rows);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/google-provision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.length = 0;
    setExistingUser([]);
  });

  it("returns 401 UNAUTHORIZED when no session is present", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(mockInsertValues).toHaveLength(0);
  });

  it("returns 401 when getUser surfaces an error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired" },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
  });

  it("creates a users row and returns /profile-setup for first-time Google sign-in", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "new-google-user-id",
          email: "newuser@example.com",
          user_metadata: { full_name: "New User" },
        },
      },
      error: null,
    });
    setExistingUser([]); // user does not exist yet

    const response = await POST(makeRequest({ redirect: null }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).toBe("/profile-setup");
    expect(body.data.new_user).toBe(true);

    expect(mockInsertValues).toHaveLength(1);
    expect(mockInsertValues[0]).toMatchObject({
      id: "new-google-user-id",
      email: "newuser@example.com",
      firstName: "New User",
      role: "student",
      isEmailVerified: true,
    });
  });

  it("falls back to user_metadata.name, then email prefix, for firstName", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
          email: "alice@example.com",
          user_metadata: { name: "Alice" }, // no full_name
        },
      },
      error: null,
    });
    setExistingUser([]);

    await POST(makeRequest());
    expect(mockInsertValues[0].firstName).toBe("Alice");

    // No name metadata at all → email prefix
    mockInsertValues.length = 0;
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-id", email: "bob@example.com", user_metadata: {} } },
      error: null,
    });
    setExistingUser([]);

    await POST(makeRequest());
    expect(mockInsertValues[0].firstName).toBe("bob");
  });

  it("returns /dashboard with new_user: false for an existing user and no requested redirect", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "returning-user", email: "x@x.com" } },
      error: null,
    });
    setExistingUser([{ id: "returning-user" }]);

    const response = await POST(makeRequest({ redirect: null }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).toBe("/dashboard");
    expect(body.data.new_user).toBe(false);
    expect(mockInsertValues).toHaveLength(0);
  });

  it("honors a requested redirect for an existing user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "returning-user", email: "x@x.com" } },
      error: null,
    });
    setExistingUser([{ id: "returning-user" }]);

    const response = await POST(makeRequest({ redirect: "/planner?id=42" }));

    const body = await response.json();
    expect(body.data.next).toBe("/planner?id=42");
    expect(body.data.new_user).toBe(false);
  });

  it("ignores the requested redirect for first-time users (always lands on /profile-setup)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "new-user", email: "n@n.com", user_metadata: {} } },
      error: null,
    });
    setExistingUser([]);

    const response = await POST(makeRequest({ redirect: "/planner" }));

    const body = await response.json();
    expect(body.data.next).toBe("/profile-setup");
    expect(body.data.new_user).toBe(true);
  });

  it("returns 403 FORBIDDEN when same-origin check fails", async () => {
    const { requireSameOrigin } = await import("@/lib/api/require-same-origin");
    (requireSameOrigin as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Invalid origin" } }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await POST(makeRequest());
    expect(response.status).toBe(403);
  });
});
