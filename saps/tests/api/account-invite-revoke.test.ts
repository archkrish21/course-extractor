import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_ACCOUNT_ID = "acc-1";
const TEST_INVITE_ID = "inv-1";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockDelete = vi.fn();

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
  chain.delete = mockDelete.mockImplementation(self);
  return chain;
}

let dbChain = createQueryChain();

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, {
    get(_t, prop) {
      if (prop in dbChain) return (dbChain as Record<string, unknown>)[prop as string];
      return undefined;
    },
  }),
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireAuth: vi.fn(),
  getAccountContext: vi.fn(),
}));

vi.mock("@/lib/api/require-same-origin", () => ({
  requireSameOrigin: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/db/schema", () => ({
  accountInviteCodes: {
    id: "aic_id",
    accountId: "aic_accountId",
    createdBy: "aic_createdBy",
    claimedBy: "aic_claimedBy",
    targetEmail: "aic_targetEmail",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
}));

vi.mock("@/lib/audit/log", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { DELETE } from "@/app/api/v1/accounts/[id]/invites/[inviteId]/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeDeleteRequest(): NextRequest {
  return new NextRequest(
    new URL(`http://localhost:3000/api/v1/accounts/${TEST_ACCOUNT_ID}/invites/${TEST_INVITE_ID}`),
    { method: "DELETE" }
  );
}

function routeContext() {
  return { params: Promise.resolve({ id: TEST_ACCOUNT_ID, inviteId: TEST_INVITE_ID }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("DELETE /api/v1/accounts/:id/invites/:inviteId — revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "student-1", email: "stu@test.com" });
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      accountId: TEST_ACCOUNT_ID,
      role: "student",
      canEdit: true,
    });
  });

  it("revokes a pending invite when caller is a student on the account", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([
        {
          id: TEST_INVITE_ID,
          accountId: TEST_ACCOUNT_ID,
          createdBy: "someone-else", // student can revoke any
          claimedBy: null,
          targetEmail: "p@test.com",
        },
      ]))
    );

    const response = await DELETE(makeDeleteRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.revoked).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("allows non-student callers to revoke only invites they created", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "parent-1", email: "p1@test.com" });
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      accountId: TEST_ACCOUNT_ID,
      role: "parent",
      canEdit: true,
    });
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([
        {
          id: TEST_INVITE_ID,
          accountId: TEST_ACCOUNT_ID,
          createdBy: "someone-else",
          claimedBy: null,
          targetEmail: "g@test.com",
        },
      ]))
    );

    const response = await DELETE(makeDeleteRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows a non-student caller to revoke their own invite", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "parent-1", email: "p1@test.com" });
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      accountId: TEST_ACCOUNT_ID,
      role: "parent",
      canEdit: true,
    });
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([
        {
          id: TEST_INVITE_ID,
          accountId: TEST_ACCOUNT_ID,
          createdBy: "parent-1",
          claimedBy: null,
          targetEmail: "g@test.com",
        },
      ]))
    );

    const response = await DELETE(makeDeleteRequest(), routeContext());

    expect(response.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("returns 404 when the invite does not exist for this account", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([])) // no row found
    );

    const response = await DELETE(makeDeleteRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 CONFLICT when the invite has already been accepted", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([
        {
          id: TEST_INVITE_ID,
          accountId: TEST_ACCOUNT_ID,
          createdBy: "student-1",
          claimedBy: "user-who-joined",
          targetEmail: "p@test.com",
        },
      ]))
    );

    const response = await DELETE(makeDeleteRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 403 when caller is not a member of the account", async () => {
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const response = await DELETE(makeDeleteRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
