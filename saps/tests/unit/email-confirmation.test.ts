import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────

function createQueryChain(resolveValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.update = vi.fn().mockImplementation(self);
  chain.set = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.values = vi.fn().mockImplementation(self);
  chain.returning = vi.fn().mockResolvedValue([{ id: "new-account-id" }]);
  chain.onConflictDoNothing = vi.fn().mockImplementation(self);
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveValue))
  );
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
  users: { id: "id", email: "email", role: "role", isEmailVerified: "isEmailVerified" },
  accounts: { id: "id", studentUserId: "studentUserId" },
  accountMembers: { accountId: "accountId", userId: "userId" },
  studentProfiles: { userId: "userId" },
  subscriptions: { id: "id" },
  subscriptionPlans: { id: "id", name: "name" },
  legalDocuments: { id: "id", isCurrent: "isCurrent" },
  consentRecords: { id: "id" },
}));

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
}));

// ── Supabase mock (shared, reconfigured per test) ──────────────────────────

const mockVerifyOtp = vi.fn();
const mockGetUser = vi.fn();
const mockSignUp = vi.fn();
const mockExchangeCode = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCode(...args),
      getUser: () => mockGetUser(),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { deleteUser: vi.fn().mockResolvedValue({}) } },
  }),
}));

// ── Tests: /auth/confirm route ─────────────────────────────────────────────

describe("Email confirmation — /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
  });

  // ── No valid params ──

  it("redirects to login with error when no params are provided", async () => {
    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm")
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?error=invalid_confirmation_link");
  });

  it("redirects to login with error when only type is provided (no code or token_hash)", async () => {
    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm?type=signup")
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?error=invalid_confirmation_link");
  });

  // ── PKCE code exchange flow ──

  it("exchanges PKCE code for session and redirects to login on success", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-789" } },
    });

    const mockSet = vi.fn().mockImplementation(() => dbChain);
    dbChain.set = mockSet;

    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm?code=pkce_abc123")
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?confirmed=true");
    expect(mockExchangeCode).toHaveBeenCalledWith("pkce_abc123");
    expect(mockSet).toHaveBeenCalledWith({ isEmailVerified: true });
  });

  it("redirects with confirmation_failed when PKCE code exchange fails", async () => {
    mockExchangeCode.mockResolvedValue({ error: { message: "Invalid code" } });

    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm?code=invalid_code")
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?error=confirmation_failed");
  });

  // ── Token hash verification flow ──

  it("redirects with confirmation_failed when verifyOtp fails", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "Token expired" } });

    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm?token_hash=expired123&type=signup")
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?error=confirmation_failed");
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "expired123",
      type: "signup",
    });
  });

  it("verifies OTP, marks email verified, and redirects to login on success", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    const mockSet = vi.fn().mockImplementation(() => dbChain);
    dbChain.set = mockSet;

    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm?token_hash=valid123&type=signup")
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?confirmed=true");
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "valid123",
      type: "signup",
    });
    expect(mockSet).toHaveBeenCalledWith({ isEmailVerified: true });
  });

  // ── Edge cases ──

  it("still redirects to login when getUser returns no user after verification", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm?token_hash=valid123&type=signup")
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?confirmed=true");
    // Should not attempt to update DB when no user
    expect(dbChain.update).not.toHaveBeenCalled();
  });

  it("handles email type confirmation", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-456" } },
    });

    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm?token_hash=abc&type=email")
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?confirmed=true");
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "abc",
      type: "email",
    });
  });

  it("prefers PKCE code over token_hash when both are present", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-999" } },
    });

    const mockSet = vi.fn().mockImplementation(() => dbChain);
    dbChain.set = mockSet;

    const { GET } = await import("@/app/auth/confirm/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/auth/confirm?code=pkce_xyz&token_hash=abc&type=signup")
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?confirmed=true");
    expect(mockExchangeCode).toHaveBeenCalledWith("pkce_xyz");
    // verifyOtp should NOT have been called since code takes priority
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});

// ── Tests: Signup email_confirmation_pending ────────────────────────────────

describe("Signup — email confirmation pending flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
  });

  it("returns email_confirmation_pending: true when no session (confirmation enabled)", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "new-user-id" }, session: null },
      error: null,
    });

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/api/v1/auth/signup"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@test.com",
          password: "Password123!",
          date_of_birth: "1980-01-01",
          role: "parent",
          tos_accepted: true,
        }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.email_confirmation_pending).toBe(true);
  });

  it("returns email_confirmation_pending: false when session exists (confirmation disabled)", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "new-user-id" },
        session: { access_token: "tok", refresh_token: "ref" },
      },
      error: null,
    });

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/api/v1/auth/signup"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@test.com",
          password: "Password123!",
          date_of_birth: "1980-01-01",
          role: "counselor",
          tos_accepted: true,
        }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.email_confirmation_pending).toBe(false);
  });

  it("returns email_confirmation_pending for student signup too", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "new-user-id" }, session: null },
      error: null,
    });

    const { POST } = await import("@/app/api/v1/auth/signup/route");

    const request = new NextRequest(
      new URL("http://localhost:3000/api/v1/auth/signup"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "student@test.com",
          password: "Password123!",
          date_of_birth: "2008-01-01",
          role: "student",
          tos_accepted: true,
        }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.email_confirmation_pending).toBe(true);
  });
});
