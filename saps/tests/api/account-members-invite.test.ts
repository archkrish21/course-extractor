import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const STUDENT_USER = { id: "student-1", email: "student@test.com" };
const TEST_ACCOUNT_ID = "acc-1";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockValues = vi.fn();

function createQueryChain(resolveValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.from = vi.fn().mockImplementation(self);
  chain.innerJoin = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveValue))
  );
  chain.insert = vi.fn().mockImplementation(self);
  chain.values = mockValues.mockImplementation(self);
  chain.returning = mockReturning.mockResolvedValue([{ code: "ABC12345", expiresAt: new Date() }]);
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

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/subscription/middleware", () => ({
  getEffectiveTier: vi.fn().mockResolvedValue({ maxLinkedAccounts: 5 }),
  invalidateSubscriptionCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/audit/log", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/templates", () => ({
  inviteEmail: vi.fn().mockReturnValue({ subject: "", html: "" }),
  newUserInviteEmail: vi.fn().mockReturnValue({ subject: "Invite", html: "<p>New user invite</p>" }),
  existingUserInviteEmail: vi.fn().mockReturnValue({ subject: "Invite", html: "<p>Existing user invite</p>" }),
}));

vi.mock("@/lib/db/schema", () => ({
  accountMembers: { accountId: "am_accountId", userId: "am_userId", role: "am_role", canEdit: "am_canEdit", joinedAt: "am_joinedAt", invitedBy: "am_invitedBy" },
  accountInviteCodes: {
    id: "aic_id",
    accountId: "aic_accountId",
    code: "aic_code",
    targetRole: "aic_targetRole",
    targetEmail: "aic_targetEmail",
    sharedPlans: "aic_sharedPlans",
    expiresAt: "aic_expiresAt",
    createdBy: "aic_createdBy",
    createdAt: "aic_createdAt",
    claimedBy: "aic_claimedBy",
  },
  accounts: { id: "a_id", studentName: "a_studentName" },
  users: { id: "u_id", email: "u_email", firstName: "u_firstName", lastName: "u_lastName", role: "u_role", onboardingCompletedAt: "u_onboardingCompletedAt" },
  planShares: { planId: "ps_planId", userId: "ps_userId", permission: "ps_permission" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  count: vi.fn(() => ({ type: "count" })),
  inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  gt: vi.fn((...args: unknown[]) => ({ type: "gt", args })),
  // `sql` is a tagged template; capture the values so tests can assert that
  // the lookup email was lowercased before being interpolated.
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings: Array.from(strings),
    values,
  })),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { newUserInviteEmail, existingUserInviteEmail } from "@/lib/email/templates";
import { POST, GET } from "@/app/api/v1/accounts/[id]/members/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeInviteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new URL(`http://localhost:3000/api/v1/accounts/${TEST_ACCOUNT_ID}/members`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function routeContext(accountId: string) {
  return { params: Promise.resolve({ id: accountId }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/v1/accounts/:id/members — onboarding gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(STUDENT_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      accountId: TEST_ACCOUNT_ID,
      role: "student",
      canEdit: true,
    });
  });

  it("blocks a student from inviting when onboardingCompletedAt is null", async () => {
    // Only db read expected is the inviter role/onboarding lookup. Return
    // a student whose onboarding hasn't completed.
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{ role: "student", onboardingCompletedAt: null }]))
    );

    const response = await POST(
      makeInviteRequest({ target_role: "parent", email: "p@test.com" }),
      routeContext(TEST_ACCOUNT_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("ONBOARDING_REQUIRED");
  });

  it("allows a student to invite once onboarding is complete", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      // Inviter role + onboarding check
      if (queryIndex === 1) return Promise.resolve(resolve([
        { role: "student", onboardingCompletedAt: new Date() },
      ]));
      // Existing member with same email (none — not a dupe)
      if (queryIndex === 2) return Promise.resolve(resolve([]));
      // Existing pending invite to same email (none)
      if (queryIndex === 3) return Promise.resolve(resolve([]));
      // Tier check: parallel member count + pending count (Promise.all)
      if (queryIndex === 4) return Promise.resolve(resolve([{ count: 1 }])); // members
      if (queryIndex === 5) return Promise.resolve(resolve([{ count: 0 }])); // pending
      return Promise.resolve(resolve([]));
    });

    const response = await POST(
      makeInviteRequest({ target_role: "parent", email: "p@test.com" }),
      routeContext(TEST_ACCOUNT_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.invite_code).toBe("ABC12345");
  });

  it("treats the invited email case-insensitively against existing members (already-linked)", async () => {
    // Stored member email is mixed-case; inviter types it lowercased.
    // The lookup must find the member and return ALREADY_LINKED, otherwise
    // a duplicate invite would be created and the user would hit a worse
    // error later in the join flow.
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([
        { role: "student", onboardingCompletedAt: new Date() },
      ]));
      if (queryIndex === 2) return Promise.resolve(resolve([
        {
          userId: "u-2",
          email: "John.Doe@Example.com",
          firstName: "John",
          lastName: "Doe",
          role: "parent",
        },
      ]));
      return Promise.resolve(resolve([]));
    });

    const response = await POST(
      makeInviteRequest({ target_role: "parent", email: "john.doe@example.com" }),
      routeContext(TEST_ACCOUNT_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("ALREADY_LINKED");
  });

  it("treats the invited email case-insensitively when picking the email template", async () => {
    // User exists in `users` (with mixed-case stored email) but isn't yet a
    // member of this account. The existing-user lookup must hit so we send
    // the join-link email — not the signup-link email, which would fail at
    // signup with EMAIL_EXISTS and strand the recipient.
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([
        { role: "student", onboardingCompletedAt: new Date() },
      ]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // not yet a member
      if (queryIndex === 3) return Promise.resolve(resolve([])); // no pending dupe
      if (queryIndex === 4) return Promise.resolve(resolve([{ count: 1 }])); // members count
      if (queryIndex === 5) return Promise.resolve(resolve([{ count: 0 }])); // pending count
      if (queryIndex === 6) return Promise.resolve(resolve([{ studentName: "Stu" }])); // account
      if (queryIndex === 7) return Promise.resolve(resolve([{ email: "student@test.com" }])); // inviter
      if (queryIndex === 8) return Promise.resolve(resolve([{ id: "u-2" }])); // existing user found
      return Promise.resolve(resolve([]));
    });

    const response = await POST(
      makeInviteRequest({ target_role: "parent", email: "john.doe@example.com" }),
      routeContext(TEST_ACCOUNT_ID)
    );

    expect(response.status).toBe(201);
    expect(existingUserInviteEmail).toHaveBeenCalledTimes(1);
    expect(newUserInviteEmail).not.toHaveBeenCalled();
  });

  it("stores the recipient email lowercased on the invite row", async () => {
    // The pending-invites list relies on this column to show "you invited
    // X@y.com". The lowercase normalization keeps it consistent with the
    // case-insensitive lookups elsewhere in this route.
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student", onboardingCompletedAt: new Date() }]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // not already linked
      if (queryIndex === 3) return Promise.resolve(resolve([])); // no pending dupe
      if (queryIndex === 4) return Promise.resolve(resolve([{ count: 1 }])); // members
      if (queryIndex === 5) return Promise.resolve(resolve([{ count: 0 }])); // pending
      return Promise.resolve(resolve([]));
    });

    const response = await POST(
      makeInviteRequest({ target_role: "parent", email: "Mixed.Case@Example.COM" }),
      routeContext(TEST_ACCOUNT_ID)
    );

    expect(response.status).toBe(201);
    const insertCall = mockValues.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>).code !== undefined
    );
    expect(insertCall).toBeTruthy();
    expect((insertCall![0] as Record<string, unknown>).targetEmail).toBe("mixed.case@example.com");
  });

  it("does not apply the onboarding gate to non-student inviters", async () => {
    // A parent on a student account should be able to invite even if the
    // student hasn't onboarded yet. The gate is specifically about the
    // student's own account-population readiness, not the caller's role.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "parent-1", email: "parent@test.com" });
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      accountId: TEST_ACCOUNT_ID,
      role: "parent",
      canEdit: true,
    });

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent", onboardingCompletedAt: null }]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // no dupe
      if (queryIndex === 3) return Promise.resolve(resolve([])); // no pending dupe
      if (queryIndex === 4) return Promise.resolve(resolve([{ count: 1 }])); // members count
      if (queryIndex === 5) return Promise.resolve(resolve([{ count: 0 }])); // pending count
      return Promise.resolve(resolve([]));
    });

    const response = await POST(
      makeInviteRequest({ target_role: "guardian", email: "g@test.com" }),
      routeContext(TEST_ACCOUNT_ID)
    );

    expect(response.status).toBe(201);
  });

  it("counts pending invites against the linked-accounts limit (UPGRADE_REQUIRED)", async () => {
    // Plus tier maxLinkedAccounts = 5 (set globally for this describe).
    // 3 accepted members + 2 pending invites = 5 → at the cap; another
    // invite must be rejected even though there's room in account_members.
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([
        { role: "student", onboardingCompletedAt: new Date() },
      ]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // not a dupe member
      if (queryIndex === 3) return Promise.resolve(resolve([])); // not a dupe pending
      if (queryIndex === 4) return Promise.resolve(resolve([{ count: 3 }])); // members
      if (queryIndex === 5) return Promise.resolve(resolve([{ count: 2 }])); // pending
      return Promise.resolve(resolve([]));
    });

    const response = await POST(
      makeInviteRequest({ target_role: "parent", email: "newperson@test.com" }),
      routeContext(TEST_ACCOUNT_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.error.code).toBe("UPGRADE_REQUIRED");
    expect(body.error.current_count).toBe(5);
    expect(body.error.max).toBe(5);
  });

  it("blocks a duplicate invite when an unclaimed pending invite already exists for the same email", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([
        { role: "student", onboardingCompletedAt: new Date() },
      ]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // not yet a member
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "inv-existing" }])); // pending dupe found
      return Promise.resolve(resolve([]));
    });

    const response = await POST(
      makeInviteRequest({ target_role: "parent", email: "dad@test.com" }),
      routeContext(TEST_ACCOUNT_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("ALREADY_INVITED");
    expect(body.error.email).toBe("dad@test.com");
    // No invite row inserted when blocked
    expect(mockValues.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>).code !== undefined
    )).toBeUndefined();
  });
});

// ── GET /api/v1/accounts/:id/members ────────────────────────────────────────

describe("GET /api/v1/accounts/:id/members — pending invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(STUDENT_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      accountId: TEST_ACCOUNT_ID,
      role: "student",
      canEdit: true,
    });
  });

  function makeGetRequest(): NextRequest {
    return new NextRequest(
      new URL(`http://localhost:3000/api/v1/accounts/${TEST_ACCOUNT_ID}/members`),
      { method: "GET" }
    );
  }

  it("returns members and pending_invites in the new shape", async () => {
    const expiresAt = new Date(Date.now() + 86400_000);
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      // 1: members join
      if (queryIndex === 1) return Promise.resolve(resolve([
        {
          userId: "u-self",
          role: "student",
          canEdit: true,
          joinedAt: new Date("2026-01-01"),
          invitedBy: null,
          email: "student@test.com",
          firstName: "Stu",
          lastName: null,
        },
      ]));
      // 2: pending invites
      if (queryIndex === 2) return Promise.resolve(resolve([
        {
          id: "inv-1",
          targetEmail: "parent@test.com",
          targetRole: "parent",
          expiresAt,
          createdBy: "u-self",
          createdAt: new Date(),
        },
      ]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest(), routeContext(TEST_ACCOUNT_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.members).toHaveLength(1);
    expect(body.data.members[0].email).toBe("student@test.com");
    expect(body.data.pending_invites).toHaveLength(1);
    expect(body.data.pending_invites[0]).toMatchObject({
      invite_id: "inv-1",
      email: "parent@test.com",
      role: "parent",
      can_revoke: true, // student caller
    });
  });

  it("marks can_revoke=true only for invites the caller created (non-student)", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "parent-1", email: "p1@test.com" });
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      accountId: TEST_ACCOUNT_ID,
      role: "parent",
      canEdit: true,
    });

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([])); // no members shown
      if (queryIndex === 2) return Promise.resolve(resolve([
        {
          id: "inv-mine",
          targetEmail: "g1@test.com",
          targetRole: "guardian",
          expiresAt: new Date(Date.now() + 86400_000),
          createdBy: "parent-1",
          createdAt: new Date(),
        },
        {
          id: "inv-other",
          targetEmail: "g2@test.com",
          targetRole: "guardian",
          expiresAt: new Date(Date.now() + 86400_000),
          createdBy: "someone-else",
          createdAt: new Date(),
        },
      ]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest(), routeContext(TEST_ACCOUNT_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    const byId = Object.fromEntries(
      body.data.pending_invites.map((i: Record<string, unknown>) => [i.invite_id, i])
    );
    expect(byId["inv-mine"].can_revoke).toBe(true);
    expect(byId["inv-other"].can_revoke).toBe(false);
  });

  it("surfaces invites with null email as-is so the client can render 'Pending invite'", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([])); // members
      if (queryIndex === 2) return Promise.resolve(resolve([
        {
          id: "inv-old",
          targetEmail: null, // pre-migration row
          targetRole: "parent",
          expiresAt: new Date(Date.now() + 86400_000),
          createdBy: "student-1",
          createdAt: new Date(),
        },
      ]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest(), routeContext(TEST_ACCOUNT_ID));
    const body = await response.json();

    expect(body.data.pending_invites[0].email).toBeNull();
  });
});
