import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const PARENT_USER = { id: "parent-1", email: "parent@test.com" };
const ACCOUNT_ID = "acc-1";

const PENDING_INVITE = {
  id: "inv-1",
  code: "ABCD1234",
  targetRole: "student",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days out
  claimedBy: null,
  claimedAt: null,
  createdAt: new Date(),
};

const CLAIMED_INVITE = {
  ...PENDING_INVITE,
  id: "inv-2",
  claimedBy: "student-1",
  claimedAt: new Date(),
};

const EXPIRED_INVITE = {
  ...PENDING_INVITE,
  id: "inv-3",
  expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
};

// ── Mocks ───────────────────────────────────────────────────────────────────

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
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveValue))
  );
  chain.insert = vi.fn().mockImplementation(self);
  chain.values = vi.fn().mockImplementation(self);
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.update = vi.fn().mockImplementation(self);
  chain.set = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  chain.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(chain));
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
  getAccountContext: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  accountInviteCodes: { id: "aic_id", accountId: "aic_accountId", code: "aic_code", targetRole: "aic_targetRole", expiresAt: "aic_expiresAt", createdBy: "aic_createdBy", claimedBy: "aic_claimedBy", claimedAt: "aic_claimedAt", createdAt: "aic_createdAt" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId", role: "am_role" },
  accounts: { id: "a_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: "sql", strings }),
    { raw: vi.fn() }
  ),
}));

vi.mock("@/lib/api/require-same-origin", () => ({
  requireSameOrigin: vi.fn().mockReturnValue(null),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { GET, DELETE } from "@/app/api/v1/accounts/[id]/invites/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

const routeContext = { params: Promise.resolve({ id: ACCOUNT_ID }) };

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/v1/accounts/:id/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(PARENT_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "parent", canEdit: true });
  });

  it("returns 'none' when no invites exist", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([]))
    );

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`);
    const response = await GET(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("none");
  });

  it("returns 'pending' for unclaimed non-expired invite", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([PENDING_INVITE]))
    );

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`);
    const response = await GET(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("pending");
    expect(body.data).toHaveProperty("invite_code", "ABCD1234");
    expect(body.data).toHaveProperty("expires_at");
  });

  it("returns 'accepted' for claimed invite", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([CLAIMED_INVITE]))
    );

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`);
    const response = await GET(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("accepted");
    expect(body.data).toHaveProperty("claimed_at");
  });

  it("returns 'expired' for unclaimed expired invite", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([EXPIRED_INVITE]))
    );

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`);
    const response = await GET(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("expired");
  });

  it("returns 403 for non-members", async () => {
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`);
    const response = await GET(request, routeContext);

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/v1/accounts/:id/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(PARENT_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "parent", canEdit: true });
  });

  it("revokes pending invite and deletes account when no student joined", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([])); // no student members
      return Promise.resolve(resolve([]));
    });
    dbChain.returning = vi.fn().mockResolvedValue([{ id: "inv-1" }]); // deleted invite

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`, { method: "DELETE" });
    const response = await DELETE(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.revoked).toBe(1);
    expect(body.data.account_deleted).toBe(true);
  });

  it("revokes invite but keeps account when student has joined", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ userId: "student-1" }])); // student exists
      return Promise.resolve(resolve([]));
    });
    dbChain.returning = vi.fn().mockResolvedValue([{ id: "inv-1" }]);

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`, { method: "DELETE" });
    const response = await DELETE(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.revoked).toBe(1);
    expect(body.data.account_deleted).toBe(false);
  });

  it("returns 403 for read-only members", async () => {
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "counselor", canEdit: false });

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`, { method: "DELETE" });
    const response = await DELETE(request, routeContext);

    expect(response.status).toBe(403);
  });

  it("returns 403 for non-members", async () => {
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = createRequest(`http://localhost:3000/api/v1/accounts/${ACCOUNT_ID}/invites`, { method: "DELETE" });
    const response = await DELETE(request, routeContext);

    expect(response.status).toBe(403);
  });
});
