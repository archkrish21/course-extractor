import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_USER = { id: "user-join-1" };
const TEST_ACCOUNT_ID = "acc-join-aaaa-bbbb-cccc-ddddeeee";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();

function createQueryChain(resolveValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.innerJoin = vi.fn().mockImplementation(self);
  chain.leftJoin = vi.fn().mockImplementation(self);
  chain.orderBy = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.onConflictDoNothing = vi.fn().mockImplementation(self);
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveValue))
  );
  chain.insert = vi.fn().mockImplementation(self);
  chain.values = mockValues.mockImplementation(self);
  chain.returning = mockReturning.mockResolvedValue([]);
  chain.update = vi.fn().mockImplementation(self);
  chain.set = mockSet.mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  chain.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    await fn(chain);
  });
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

vi.mock("@/lib/audit/log", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db/schema", () => ({
  accountMembers: { accountId: "am_accountId", userId: "am_userId", role: "am_role", canEdit: "am_canEdit" },
  accountInviteCodes: { id: "aic_id", accountId: "aic_accountId", code: "aic_code", targetRole: "aic_targetRole", expiresAt: "aic_expiresAt", claimedBy: "aic_claimedBy", createdBy: "aic_createdBy" },
  accounts: { id: "a_id", studentUserId: "a_studentUserId", gradeLevel: "a_gradeLevel", graduationYear: "a_graduationYear" },
  studentProfiles: { userId: "sp_userId", currentGradeLevel: "sp_currentGradeLevel", graduationYear: "sp_graduationYear" },
  users: { id: "u_id", email: "u_email" },
  subscriptions: { id: "sub_id" },
  subscriptionPlans: { id: "subp_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings,
    }),
    { raw: vi.fn() }
  ),
}));

import { requireAuth } from "@/lib/auth/get-user";
import { POST as joinAccount } from "@/app/api/v1/accounts/[id]/members/join/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

function makeJsonRequest(url: string, body: unknown, method = "POST"): NextRequest {
  return createRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function accountContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

// v1-hide: counselor role hidden from UI; re-enable by switching `describe.skip` back to `describe`.
describe.skip("POST /api/v1/accounts/:id/members/join — counselor canEdit behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
  });

  it("counselor joins with canEdit false", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      // Query 1: look up invite code — found, unclaimed, counselor role
      if (queryIndex === 1) {
        return Promise.resolve(resolve([{
          id: "invite-1",
          accountId: TEST_ACCOUNT_ID,
          code: "COUN1234",
          targetRole: "counselor",
          expiresAt: futureDate,
          claimedBy: null,
          createdBy: "owner-1",
        }]));
      }
      // Query 2: check existing membership — not a member
      if (queryIndex === 2) return Promise.resolve(resolve([]));
      // Remaining queries inside transaction
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/accounts/${TEST_ACCOUNT_ID}/members/join`,
      { invite_code: "COUN1234" }
    );
    const response = await joinAccount(request, accountContext(TEST_ACCOUNT_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);

    // Verify the insert was called with canEdit: false for counselor
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER.id,
        role: "counselor",
        canEdit: false,
      })
    );
  });

  it("non-counselor joins with canEdit true", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      // Query 1: look up invite code — found, unclaimed, parent role
      if (queryIndex === 1) {
        return Promise.resolve(resolve([{
          id: "invite-2",
          accountId: TEST_ACCOUNT_ID,
          code: "PARE5678",
          targetRole: "parent",
          expiresAt: futureDate,
          claimedBy: null,
          createdBy: "owner-1",
        }]));
      }
      // Query 2: check existing membership — not a member
      if (queryIndex === 2) return Promise.resolve(resolve([]));
      // Remaining queries inside transaction
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/accounts/${TEST_ACCOUNT_ID}/members/join`,
      { invite_code: "PARE5678" }
    );
    const response = await joinAccount(request, accountContext(TEST_ACCOUNT_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);

    // Verify the insert was called with canEdit: true for parent
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER.id,
        role: "parent",
        canEdit: true,
      })
    );
  });
});
