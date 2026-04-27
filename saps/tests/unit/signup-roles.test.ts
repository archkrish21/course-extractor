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
  accountInviteCodes: { code: "code", accountId: "accountId", targetRole: "targetRole", expiresAt: "expiresAt", claimedBy: "claimedBy" },
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

// Supabase signUp() returns user.identities populated for fresh signups.
// When the email already exists, identities is empty (anti-enumeration).
// See app/api/v1/auth/signup/route.ts for the duplicate-email detection.
const mockSupabaseSignUp = vi.fn().mockResolvedValue({
  data: { user: { id: "new-user-id", identities: [{ id: "id-1" }] } },
  error: null,
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      signUp: (...args: unknown[]) => mockSupabaseSignUp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    },
  }),
}));

const mockAdminCreateUser = vi.fn().mockResolvedValue({
  data: { user: { id: "new-user-id" } },
  error: null,
});
const mockAdminGenerateLink = vi.fn().mockResolvedValue({
  data: { properties: { hashed_token: "tok" } },
  error: null,
});
const mockVerifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({
    auth: {
      admin: {
        deleteUser: vi.fn().mockResolvedValue({}),
        createUser: (...args: unknown[]) => mockAdminCreateUser(...args),
        generateLink: (...args: unknown[]) => mockAdminGenerateLink(...args),
      },
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
        password: "Password123!",
        age_confirmed: true,
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
        password: "Password123!",
        age_confirmed: true,
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
        password: "Password123!",
        age_confirmed: true,
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
        password: "Password123!",
        age_confirmed: true,
        role: "student",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe("student");
  });

  it("rejects signup when age_confirmed is missing (COPPA attestation required)", async () => {
    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "kid@test.com",
        password: "Password123!",
        role: "student",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/13 years old/i);
  });

  it("rejects signup when age_confirmed is false", async () => {
    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "kid@test.com",
        password: "Password123!",
        age_confirmed: false,
        role: "student",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Invite-driven role override ─────────────────────────────────────────────
// When the signup payload carries an invite (invite_code + invite_account),
// the invite's targetRole is the source of truth — the form-supplied role
// is informational. Without this override, a recipient invited as Parent
// could submit role=student and end up with a bogus self-owned student
// account *and* parent membership in the inviter's account.

describe("Signup — invite role override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.length = 0;
    dbChain = createQueryChain();
  });

  function inviteSignupBody(role: string) {
    return {
      email: "invitee@test.com",
      password: "Password123!",
      age_confirmed: true,
      role,
      tos_accepted: true,
      invite_code: "ABC12345",
      invite_account: "11111111-1111-4111-8111-111111111111",
    };
  }

  it("uses the invite's targetRole even when the form posts a different role", async () => {
    // Invite says "parent"; form posts "student". The user record must end
    // up as parent — otherwise the student branch creates a self-owned
    // account, profile and trial subscription that nobody asked for.
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([
        {
          targetRole: "parent",
          expiresAt: new Date(Date.now() + 86400_000),
          claimedBy: null,
        },
      ]));
      return Promise.resolve(resolve([])); // legal docs etc.
    });

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const response = await POST(new NextRequest(
      new URL("http://localhost:3000/api/v1/auth/signup"),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inviteSignupBody("student")) }
    ));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe("parent");
    const userInsert = mockInsertValues.find((v) => v.role !== undefined);
    expect(userInsert?.role).toBe("parent");
  });

  it("maps invite targetRole=guardian to 'parent' on storage", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([
        {
          targetRole: "guardian",
          expiresAt: new Date(Date.now() + 86400_000),
          claimedBy: null,
        },
      ]));
      return Promise.resolve(resolve([]));
    });

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const response = await POST(new NextRequest(
      new URL("http://localhost:3000/api/v1/auth/signup"),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inviteSignupBody("student")) }
    ));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user.role).toBe("parent");
  });

  it("returns 400 INVITE_INVALID when the invite code is not found", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([])) // invite lookup misses
    );

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const response = await POST(new NextRequest(
      new URL("http://localhost:3000/api/v1/auth/signup"),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inviteSignupBody("parent")) }
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVITE_INVALID");
    // No supabase user created and no DB writes for an invalid invite.
    expect(mockAdminCreateUser).not.toHaveBeenCalled();
    expect(mockInsertValues).toHaveLength(0);
  });

  it("returns 400 INVITE_INVALID when the invite has already been claimed", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([
        {
          targetRole: "parent",
          expiresAt: new Date(Date.now() + 86400_000),
          claimedBy: "someone-else",
        },
      ]))
    );

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const response = await POST(new NextRequest(
      new URL("http://localhost:3000/api/v1/auth/signup"),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inviteSignupBody("parent")) }
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVITE_INVALID");
    expect(mockAdminCreateUser).not.toHaveBeenCalled();
  });

  it("returns 400 INVITE_INVALID when the invite has expired", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([
        {
          targetRole: "parent",
          expiresAt: new Date(Date.now() - 1000), // expired
          claimedBy: null,
        },
      ]))
    );

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const response = await POST(new NextRequest(
      new URL("http://localhost:3000/api/v1/auth/signup"),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inviteSignupBody("parent")) }
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVITE_INVALID");
    expect(mockAdminCreateUser).not.toHaveBeenCalled();
  });
});

// ── Duplicate-email detection (PR #89) ──────────────────────────────────────
// Supabase's signUp() doesn't surface an "already registered" error — to
// prevent email enumeration it returns success with an obfuscated user
// whose `identities` array is empty. The route must detect this and return
// 409 EMAIL_EXISTS *before* writing to the DB; the original bug (not
// detecting it) tried to insert a duplicate users row, then deleted the
// real existing auth user from the rollback path.

describe("Signup — duplicate email detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.length = 0;
    dbChain = createQueryChain();
  });

  it("returns 409 EMAIL_EXISTS when signUp returns user with empty identities", async () => {
    mockSupabaseSignUp.mockResolvedValueOnce({
      data: { user: { id: "existing-user-id", identities: [] } },
      error: null,
    });

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "existing@test.com",
        password: "Password123!",
        age_confirmed: true,
        role: "student",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("EMAIL_EXISTS");
  });

  it("does not write to the users table when duplicate email is detected", async () => {
    mockSupabaseSignUp.mockResolvedValueOnce({
      data: { user: { id: "existing-user-id", identities: [] } },
      error: null,
    });

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "existing@test.com",
        password: "Password123!",
        age_confirmed: true,
        role: "student",
        tos_accepted: true,
      }),
    });

    await POST(request);

    // The bug we're guarding against: inserting a users row, failing on PK
    // collision, then the rollback path deleting the real existing user.
    expect(mockInsertValues).toHaveLength(0);
  });

  it("returns 409 when identities is missing entirely (defensive)", async () => {
    mockSupabaseSignUp.mockResolvedValueOnce({
      data: { user: { id: "existing-user-id" } }, // no identities key at all
      error: null,
    });

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(new URL("http://localhost:3000/api/v1/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "existing@test.com",
        password: "Password123!",
        age_confirmed: true,
        role: "student",
        tos_accepted: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("EMAIL_EXISTS");
  });
});
