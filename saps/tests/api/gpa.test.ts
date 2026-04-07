import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_USER = { id: "user-1", email: "student@test.com" };
const TEST_ACCOUNT_CTX = { accountId: "acc-1", role: "student" as const, canEdit: true };

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
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveValue))
  );
  chain.insert = vi.fn().mockImplementation(self);
  chain.values = mockValues.mockImplementation(self);
  chain.returning = mockReturning.mockResolvedValue([]);
  chain.update = vi.fn().mockImplementation(self);
  chain.set = mockSet.mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
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

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/gpa/calc", () => ({
  calculateGPA: vi.fn().mockReturnValue({
    unweighted: 3.5,
    weighted: 4.0,
    totalCredits: 10,
    coursesUsed: 5,
  }),
}));

vi.mock("@/lib/db/schema", () => ({
  courses: { id: "c_id", creditValue: "c_creditValue", creditType: "c_creditType" },
  planCourses: { planId: "pc_planId", courseId: "pc_courseId", gradeLevel: "pc_gradeLevel", semester: "pc_semester", status: "pc_status", plannedGrade: "pc_plannedGrade", gpaWaiverApplied: "pc_gpaWaiverApplied" },
  fourYearPlans: { id: "fp_id", accountId: "fp_accountId", isPrimary: "fp_isPrimary", isTemplate: "fp_isTemplate", createdBy: "fp_createdBy" },
  accounts: { id: "a_id" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId" },
  planShares: { id: "ps_id", planId: "ps_planId", userId: "ps_userId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  sql: Object.assign(vi.fn((...args: unknown[]) => ({ type: "sql", args })), {
    raw: vi.fn((s: string) => s),
  }),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { GET } from "@/app/api/v1/gpa/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/v1/gpa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
  });

  it("returns 401 without auth", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 })
    );

    const response = await GET(createRequest("/api/v1/gpa"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when no account found", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([]))
    );

    const response = await GET(createRequest("/api/v1/gpa"));
    expect(response.status).toBe(404);
  });

  it("returns 403 when not a member of the account", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/gpa"));
    expect(response.status).toBe(403);
  });

  it("returns empty GPA when no primary plan exists", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // no plan
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/gpa"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.cumulative.unweighted).toBeNull();
    expect(body.data.cumulative.weighted).toBeNull();
    expect(body.data.hasGrades).toBe(false);
  });

  it("returns GPA data for a plan with courses", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    const mockCourses = [
      { gradeLevel: 9, semester: 1, status: "completed", plannedGrade: "A", gpaWaiverApplied: false, creditValue: "2", creditType: "CP" },
      { gradeLevel: 9, semester: 2, status: "completed", plannedGrade: "A", gpaWaiverApplied: false, creditValue: "2", creditType: "CP" },
      { gradeLevel: 9, semester: 1, status: "planned", plannedGrade: "B", gpaWaiverApplied: false, creditValue: "1", creditType: "AP" },
    ];

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: "plan-1" }])); // plan
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "plan-1" }])); // access check
      if (queryIndex === 4) return Promise.resolve(resolve(mockCourses)); // courses
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/gpa"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("cumulative");
    expect(body.data).toHaveProperty("projected");
    expect(body.data).toHaveProperty("plan");
    expect(body.data).toHaveProperty("hasGrades");
    expect(body.data.cumulative).toHaveProperty("unweighted");
    expect(body.data.cumulative).toHaveProperty("weighted");
  });

  it("calculates plan credits correctly for full-year courses", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    // Full-year course: creditValue=2.0, each row = 1 credit
    const mockCourses = [
      { gradeLevel: 9, semester: 1, status: "completed", plannedGrade: "A", gpaWaiverApplied: false, creditValue: "2", creditType: "CP" },
      { gradeLevel: 9, semester: 2, status: "completed", plannedGrade: "A", gpaWaiverApplied: false, creditValue: "2", creditType: "CP" },
    ];

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: "plan-1" }]));
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "plan-1" }])); // access check
      if (queryIndex === 4) return Promise.resolve(resolve(mockCourses));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/gpa"));
    const body = await response.json();

    expect(response.status).toBe(200);
    // 2 rows * (2/2) = 2 credits total
    expect(body.data.plan.totalCredits).toBe(2);
    expect(body.data.plan.earnedCredits).toBe(2);
  });

  it("excludes dropped courses from plan totals", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    const mockCourses = [
      { gradeLevel: 9, semester: 1, status: "completed", plannedGrade: "A", gpaWaiverApplied: false, creditValue: "1", creditType: "CP" },
      { gradeLevel: 9, semester: 1, status: "dropped", plannedGrade: null, gpaWaiverApplied: false, creditValue: "1", creditType: "CP" },
    ];

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: "plan-1" }]));
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "plan-1" }])); // access check
      if (queryIndex === 4) return Promise.resolve(resolve(mockCourses));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/gpa"));
    const body = await response.json();

    expect(response.status).toBe(200);
    // Only 1 non-dropped course
    expect(body.data.plan.totalCredits).toBe(1);
    expect(body.data.plan.totalCourses).toBe(1);
  });

  it("returns empty GPA when user has no access to the primary plan", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: "plan-1" }])); // plan exists
      if (queryIndex === 3) return Promise.resolve(resolve([])); // access check fails — no plan_shares, not creator
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/gpa"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.cumulative.unweighted).toBeNull();
    expect(body.data.hasGrades).toBe(false);
  });
});
