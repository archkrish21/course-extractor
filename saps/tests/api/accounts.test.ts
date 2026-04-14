import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const PARENT_USER = { id: "parent-1", email: "parent@test.com" };
const STUDENT_USER = { id: "student-1", email: "student@test.com" };

const TEST_ACCOUNT = {
  id: "acc-1",
  studentName: "Test Student",
  studentDateOfBirth: "2010-01-15",
  gradeLevel: 9,
  graduationYear: 2028,
  createdBy: PARENT_USER.id,
  billingContactId: PARENT_USER.id,
  claimCode: "ABCD1234",
  claimExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  claimedAt: null,
  studentUserId: null,
};

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockValues = vi.fn();

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
  chain.values = mockValues.mockImplementation(self);
  chain.returning = mockReturning.mockResolvedValue([TEST_ACCOUNT]);
  chain.update = vi.fn().mockImplementation(self);
  chain.set = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  chain.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    // Pass a mock tx that behaves like db
    return fn(chain);
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
  getAuthenticatedUser: vi.fn(),
  getAccountContext: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  accounts: { id: "a_id", studentName: "a_studentName", studentDateOfBirth: "a_studentDateOfBirth", gradeLevel: "a_gradeLevel", graduationYear: "a_graduationYear", createdBy: "a_createdBy", billingContactId: "a_billingContactId", claimCode: "a_claimCode", claimExpiresAt: "a_claimExpiresAt", claimedAt: "a_claimedAt", studentUserId: "a_studentUserId" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId", role: "am_role", canEdit: "am_canEdit" },
  accountInviteCodes: { id: "aic_id", accountId: "aic_accountId", code: "aic_code", targetRole: "aic_targetRole", expiresAt: "aic_expiresAt", createdBy: "aic_createdBy", claimedBy: "aic_claimedBy", claimedAt: "aic_claimedAt", createdAt: "aic_createdAt", sharedPlans: "aic_sharedPlans" },
  studentProfiles: { userId: "sp_userId", graduationYear: "sp_graduationYear", currentGradeLevel: "sp_currentGradeLevel" },
  users: { id: "u_id", email: "u_email", role: "u_role", accountStatus: "u_accountStatus", freezeReason: "u_freezeReason", onboardingCompletedAt: "u_onboardingCompletedAt" },
  subscriptions: { userId: "sub_userId", accountId: "sub_accountId", subscriptionPlanId: "sub_planId", status: "sub_status", trialEndsAt: "sub_trialEndsAt" },
  subscriptionPlans: { id: "sp_id", name: "sp_name" },
}));

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/email/templates", () => ({
  inviteEmail: vi.fn().mockReturnValue({ subject: "Invite", html: "<p>Invite</p>" }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings,
    }),
    { raw: vi.fn() }
  ),
}));

import { requireAuth } from "@/lib/auth/get-user";
import { GET, POST } from "@/app/api/v1/accounts/route";
import { POST as claimAccount } from "@/app/api/v1/accounts/claim/route";

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

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/v1/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(PARENT_USER);
  });

  it("parent creates account with email invite (new student)", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent" }])); // user role check
      if (queryIndex === 2) return Promise.resolve(resolve([])); // no existing student user
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([TEST_ACCOUNT]);

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts", {
      student_name: "Test Student",
      student_email: "student@test.com",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.account).toHaveProperty("id");
    expect(body.data).toHaveProperty("invite_code");
    expect(body.data).toHaveProperty("student_exists", false);
    expect(body.data).toHaveProperty("email_sent");
  });

  it("parent creates account with email invite (existing student)", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent" }])); // user role check
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: "existing-student", role: "student" }])); // existing user
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([TEST_ACCOUNT]);

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts", {
      student_name: "Test Student",
      student_email: "existing@test.com",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toHaveProperty("student_exists", true);
    expect(body.data).toHaveProperty("email_sent");
  });

  it("parent can create account without DOB, grade, or graduation year", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // no existing student
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([TEST_ACCOUNT]);

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts", {
      student_name: "Test Student",
      student_email: "student@test.com",
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it("rejects COPPA when DOB provided and under 13", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent" }]));
      return Promise.resolve(resolve([]));
    });

    const now = new Date();
    const underageDob = `${now.getFullYear() - 12}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts", {
      student_name: "Young Student",
      student_email: "young@test.com",
      student_date_of_birth: underageDob,
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("13");
  });

  it("blocks self-invite", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent" }]));
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts", {
      student_name: "Self",
      student_email: "parent@test.com", // same as PARENT_USER.email
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toContain("yourself");
  });

  it("rejects non-parent users", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }]));
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts", {
      student_name: "Test Student",
      student_email: "student@test.com",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("parent");
  });

  it("returns 400 for missing email", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent" }]));
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts", {
      student_name: "Test Student",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid email", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent" }]));
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts", {
      student_name: "Test Student",
      student_email: "not-an-email",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/accounts/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(STUDENT_USER);
  });

  it("student claims account", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }])); // user role check
      if (queryIndex === 2) return Promise.resolve(resolve([TEST_ACCOUNT])); // account by claim code
      if (queryIndex === 3) return Promise.resolve(resolve([])); // no existing account
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "elite-plan-1" }])); // elite plan
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_ACCOUNT, studentUserId: STUDENT_USER.id, claimedAt: new Date() }]);

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts/claim", {
      claim_code: "ABCD1234",
    });
    const response = await claimAccount(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.account).toHaveProperty("student_name");
    expect(body.data.message).toContain("claimed successfully");
  });

  it("rejects invalid claim code", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // no matching account
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts/claim", {
      claim_code: "INVALID1",
    });
    const response = await claimAccount(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("Invalid or already claimed");
  });

  it("rejects non-student users", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "parent" }])); // not a student
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest("http://localhost:3000/api/v1/accounts/claim", {
      claim_code: "ABCD1234",
    });
    const response = await claimAccount(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("student");
  });
});

describe("GET /api/v1/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(PARENT_USER);
  });

  it("lists accounts for user", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(
        resolve([
          {
            id: "acc-1",
            studentName: "Test Student",
            gradeLevel: 9,
            graduationYear: 2028,
            role: "parent",
            isClaimed: new Date(),
            studentUserId: "student-1",
          },
        ])
      );
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toHaveProperty("student_name", "Test Student");
    expect(body.data[0]).toHaveProperty("is_claimed", true);
    expect(body.data[0]).toHaveProperty("role", "parent");
  });

  it("returns 401 without auth", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns empty array when user has no accounts", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([]));
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });
});
