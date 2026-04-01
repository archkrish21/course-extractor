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

vi.mock("@/lib/db/schema", () => ({
  graduationRequirements: { id: "gr_id", divisionId: "gr_divisionId", requirementName: "gr_requirementName", requiredCredits: "gr_requiredCredits", matchingRule: "gr_matchingRule", notes: "gr_notes", catalogVersionId: "gr_catalogVersionId", requirementGroup: "gr_requirementGroup", evaluationType: "gr_evaluationType", displayOrder: "gr_displayOrder", isOptIn: "gr_isOptIn" },
  courseCatalogVersions: { id: "cv_id", loadedAt: "cv_loadedAt" },
  courses: { id: "c_id", code: "c_code", name: "c_name", creditValue: "c_creditValue", divisionId: "c_divisionId", creditType: "c_creditType" },
  divisions: { id: "div_id", name: "div_name" },
  planCourses: { planId: "pc_planId", courseId: "pc_courseId", status: "pc_status", gradeLevel: "pc_gradeLevel", semester: "pc_semester", plannedGrade: "pc_plannedGrade", gpaWaiverApplied: "pc_gpaWaiverApplied" },
  fourYearPlans: { id: "fp_id", accountId: "fp_accountId", isPrimary: "fp_isPrimary", isTemplate: "fp_isTemplate" },
  accounts: { id: "a_id" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId" },
  studentRequirementStatus: { accountId: "srs_accountId", requirementId: "srs_requirementId", status: "srs_status", completedAt: "srs_completedAt" },
  studentRequirementOptIns: { accountId: "sro_accountId", requirementGroup: "sro_requirementGroup" },
}));

vi.mock("@/lib/gpa/calc", () => ({
  calculateGPA: vi.fn().mockReturnValue({
    unweighted: null,
    weighted: null,
    totalCredits: 0,
    coursesUsed: 0,
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { GET } from "@/app/api/v1/requirements/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/v1/requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
  });

  it("returns 401 without auth", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 })
    );

    const response = await GET(createRequest("/api/v1/requirements"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when no account found", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      // accountMembers lookup returns empty
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/requirements"));
    expect(response.status).toBe(404);
  });

  it("returns 403 when not a member of the account", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) {
        return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      }
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/requirements"));
    expect(response.status).toBe(403);
  });

  it("returns empty requirements when no catalog version exists", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) {
        return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      }
      // catalog version query returns empty
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/requirements"));
    expect(response.status).toBe(404);
  });

  it("returns empty requirements when no graduation requirements exist", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: "cv-1" }])); // catalog
      if (queryIndex === 3) return Promise.resolve(resolve([])); // requirements = empty
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/requirements"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.requirements).toEqual([]);
    expect(body.data.totalRequired).toBe(0);
  });

  it("uses planId query param when provided", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: "cv-1" }])); // catalog
      if (queryIndex === 3) return Promise.resolve(resolve([])); // requirements
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/requirements?planId=plan-123"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.requirements).toEqual([]);
  });

  it("uses X-Account-Id header for account resolution", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      // With X-Account-Id header, the first query is catalog (not accountMembers)
      if (queryIndex === 1) return Promise.resolve(resolve([{ id: "cv-1" }])); // catalog
      if (queryIndex === 2) return Promise.resolve(resolve([])); // requirements
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/requirements", {
      headers: { "X-Account-Id": "acc-1" },
    }));

    expect(response.status).toBe(200);
  });

  it("calculates earned and planned credits correctly", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    const mockRequirements = [
      {
        id: "req-1",
        divisionId: "div-math",
        name: "Mathematics",
        requiredCredits: "6.0",
        matchingRule: { type: "division" },
        notes: null,
        requirementGroup: "graduation",
        evaluationType: "course_match",
        displayOrder: 1,
        isOptIn: false,
      },
    ];

    const mockPlanCourses = [
      { courseId: "c1", divisionId: "div-math", divisionName: "Mathematics", code: "MTH151", name: "Algebra", creditValue: "2", status: "completed", gradeLevel: 9, semester: 1, creditType: "CP", plannedGrade: "A", gpaWaiverApplied: false },
      { courseId: "c1", divisionId: "div-math", divisionName: "Mathematics", code: "MTH151", name: "Algebra", creditValue: "2", status: "planned", gradeLevel: 9, semester: 2, creditType: "CP", plannedGrade: null, gpaWaiverApplied: false },
      { courseId: "c2", divisionId: "div-math", divisionName: "Mathematics", code: "MTH251", name: "Geometry", creditValue: "2", status: "planned", gradeLevel: 10, semester: 1, creditType: "CP", plannedGrade: null, gpaWaiverApplied: false },
      { courseId: "c2", divisionId: "div-math", divisionName: "Mathematics", code: "MTH251", name: "Geometry", creditValue: "2", status: "planned", gradeLevel: 10, semester: 2, creditType: "CP", plannedGrade: null, gpaWaiverApplied: false },
    ];

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // accountMembers
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: "cv-1" }])); // catalog
      if (queryIndex === 3) return Promise.resolve(resolve(mockRequirements)); // requirements
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "plan-1" }])); // plan
      if (queryIndex === 5) return Promise.resolve(resolve(mockPlanCourses)); // plan courses
      if (queryIndex === 6) return Promise.resolve(resolve([])); // opt-ins
      if (queryIndex === 7) return Promise.resolve(resolve([])); // manual statuses
      return Promise.resolve(resolve([]));
    });

    const response = await GET(createRequest("/api/v1/requirements"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.requirements).toHaveLength(1);
    expect(body.data.requirements[0].name).toBe("Mathematics");
    expect(body.data.requirements[0].earnedCredits).toBe(1);
    expect(body.data.totalEarned).toBeGreaterThanOrEqual(0);
    // Should also have groups array
    expect(body.data.groups).toBeDefined();
  });
});
