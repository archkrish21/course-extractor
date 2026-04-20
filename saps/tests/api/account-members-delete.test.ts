import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const PARENT_USER = { id: "parent-1", email: "parent@test.com" };
const STUDENT_USER = { id: "student-1", email: "student@test.com" };
const COUNSELOR_USER = { id: "counselor-1", email: "counselor@test.com" };

const TEST_ACCOUNT_ID = "acc-1";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockExecute = vi.fn().mockResolvedValue([]);

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
  chain.delete = vi.fn().mockImplementation(self);
  chain.execute = mockExecute;
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
  getAuthenticatedUser: vi.fn(),
  getAccountContext: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  accounts: { id: "a_id", studentUserId: "a_studentUserId" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId" },
}));

vi.mock("@/lib/api/require-same-origin", () => ({
  requireSameOrigin: vi.fn().mockReturnValue(null),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings,
    }),
    { raw: vi.fn() }
  ),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { DELETE } from "@/app/api/v1/accounts/[id]/members/[userId]/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createDeleteRequest(): NextRequest {
  return new NextRequest(
    new URL(`http://localhost:3000/api/v1/accounts/${TEST_ACCOUNT_ID}/members/${COUNSELOR_USER.id}`),
    { method: "DELETE" }
  );
}

function makeRouteContext(accountId: string, userId: string) {
  return { params: Promise.resolve({ id: accountId, userId }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("DELETE /api/v1/accounts/:id/members/:userId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(PARENT_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({ accountId: TEST_ACCOUNT_ID, role: "parent" });
    (requireSameOrigin as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  it("removes a non-student member successfully (invited by caller)", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ studentUserId: STUDENT_USER.id }])); // account lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ userId: COUNSELOR_USER.id, invitedBy: PARENT_USER.id }])); // target member exists, invited by parent
      return Promise.resolve(resolve([]));
    });

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, COUNSELOR_USER.id);
    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ deleted: true });
  });

  it("parent can remove themselves (unlink from student)", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ studentUserId: STUDENT_USER.id }])); // account lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ userId: PARENT_USER.id, invitedBy: null }])); // target is self — invitedBy irrelevant
      return Promise.resolve(resolve([]));
    });

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, PARENT_USER.id);
    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ deleted: true });
  });

  it("non-inviter parent cannot remove another member", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ studentUserId: STUDENT_USER.id }])); // account lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ userId: COUNSELOR_USER.id, invitedBy: "someone-else" }])); // invited by a different user
      return Promise.resolve(resolve([]));
    });

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, COUNSELOR_USER.id);
    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("only remove members you invited");
  });

  it("blocks non-student from removing the student (account owner)", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ studentUserId: STUDENT_USER.id }])); // account lookup
      return Promise.resolve(resolve([]));
    });

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, STUDENT_USER.id);
    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("Only the student");
  });

  it("student can remove themselves from their own account", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(STUDENT_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({ accountId: TEST_ACCOUNT_ID, role: "student" });

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ studentUserId: STUDENT_USER.id }])); // account lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ userId: STUDENT_USER.id, invitedBy: null }])); // target member exists
      return Promise.resolve(resolve([]));
    });

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, STUDENT_USER.id);
    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ deleted: true });
  });

  it("returns 403 when user is not a member of the account", async () => {
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, COUNSELOR_USER.id);
    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 without auth", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    );

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, COUNSELOR_USER.id);
    const response = await DELETE(request, context);

    expect(response.status).toBe(401);
  });

  it("returns 403 when CSRF check fails", async () => {
    (requireSameOrigin as ReturnType<typeof vi.fn>).mockReturnValue(
      new Response(
        JSON.stringify({ error: { code: "FORBIDDEN", message: "CSRF check failed" } }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    );

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, COUNSELOR_USER.id);
    const response = await DELETE(request, context);

    expect(response.status).toBe(403);
  });

  it("returns 404 when account does not exist", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([])); // no account found
    });

    const request = createDeleteRequest();
    const context = makeRouteContext("nonexistent-acc", COUNSELOR_USER.id);
    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("Account not found");
  });

  it("returns 404 when target member does not exist", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ studentUserId: STUDENT_USER.id }])); // account exists
      if (queryIndex === 2) return Promise.resolve(resolve([])); // target member NOT found
      return Promise.resolve(resolve([]));
    });

    const request = createDeleteRequest();
    const context = makeRouteContext(TEST_ACCOUNT_ID, "nonexistent-user");
    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("Member not found");
  });
});
