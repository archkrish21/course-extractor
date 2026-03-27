import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_USER = { id: "user-1", email: "student@test.com" };
const TEST_ACCOUNT_CTX = { accountId: "acc-1", role: "student" as const, canEdit: true };
const TEST_PLAN_ID = "plan-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_PLAN = {
  id: TEST_PLAN_ID,
  name: "My Plan",
  studentId: TEST_USER.id,
  accountId: "acc-1",
  createdBy: TEST_USER.id,
  schoolYear: "2025-2026",
  catalogVersionId: "cv-1",
  createdFromTemplateId: null,
  status: "draft",
  isPrimary: true,
  isTemplate: false,
  activatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Mocks ───────────────────────────────────────────────────────────────────

// Drizzle mock helpers
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
  chain.returning = mockReturning.mockResolvedValue([TEST_PLAN]);
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
  getAuthenticatedUser: vi.fn(),
  getAccountContext: vi.fn(),
}));

vi.mock("@/lib/subscription/middleware", () => ({
  getEffectiveTier: vi.fn().mockResolvedValue({
    tier: "starter",
    accountStatus: "active",
    freezeReason: null,
    canUseAI: false,
    maxPlans: 3,
  }),
}));

vi.mock("@/lib/prereq/validator", () => ({
  validatePlanIntegrity: vi.fn().mockResolvedValue({
    valid: true,
    violations: [],
  }),
  validateCourseAddition: vi.fn().mockResolvedValue({
    valid: true,
    violations: [],
  }),
}));

vi.mock("@/lib/db/schema", () => ({
  fourYearPlans: { id: "id", name: "name", studentId: "studentId", accountId: "accountId", createdBy: "createdBy", schoolYear: "schoolYear", catalogVersionId: "catalogVersionId", createdFromTemplateId: "createdFromTemplateId", status: "status", isPrimary: "isPrimary", isTemplate: "isTemplate", activatedAt: "activatedAt", createdAt: "createdAt", updatedAt: "updatedAt" },
  planCourses: { id: "pc_id", planId: "pc_planId", courseId: "pc_courseId", gradeLevel: "pc_gradeLevel", semester: "pc_semester", status: "pc_status", plannedGrade: "pc_plannedGrade", displayOrder: "pc_displayOrder", notes: "pc_notes" },
  courses: { id: "c_id", code: "c_code", name: "c_name", creditValue: "c_creditValue", duration: "c_duration", creditType: "c_creditType", isAp: "c_isAp", isDualCredit: "c_isDualCredit", isHonors: "c_isHonors", gpaWaiver: "c_gpaWaiver", gradeLevels: "c_gradeLevels", semestersOffered: "c_semestersOffered", divisionId: "c_divisionId", catalogVersionId: "c_catalogVersionId" },
  courseCatalogVersions: { id: "cv_id", loadedAt: "cv_loadedAt", schoolYear: "cv_schoolYear" },
  divisions: { id: "div_id", name: "div_name" },
  planHistory: { planId: "ph_planId", changedBy: "ph_changedBy", action: "ph_action", beforeState: "ph_beforeState", afterState: "ph_afterState" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId" },
  accounts: { id: "a_id", studentUserId: "a_studentUserId" },
  studentParentLinks: { studentId: "spl_studentId", parentId: "spl_parentId" },
  counselorStudentLinks: { studentId: "csl_studentId", counselorId: "csl_counselorId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  asc: vi.fn((col: unknown) => ({ type: "asc", col })),
  count: vi.fn(() => "count"),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings,
    }),
    { raw: vi.fn() }
  ),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { getEffectiveTier } from "@/lib/subscription/middleware";
import { GET, POST } from "@/app/api/v1/plans/route";
import {
  GET as getPlanById,
  PATCH as patchPlan,
  DELETE as deletePlan,
} from "@/app/api/v1/plans/[id]/route";

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

function mockRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/v1/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
  });

  it("returns 401 without auth", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = createRequest("http://localhost:3000/api/v1/plans");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns plans for authenticated user", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);

    // resolveAccountId falls back to accountMembers query
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) {
        // accountMembers lookup for resolveAccountId
        return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      }
      if (queryIndex === 2) {
        // plans query
        return Promise.resolve(resolve([]));
      }
      return Promise.resolve(resolve([]));
    });

    const request = createRequest("http://localhost:3000/api/v1/plans");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("data");
  });
});

describe("POST /api/v1/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
    (getEffectiveTier as ReturnType<typeof vi.fn>).mockResolvedValue({
      tier: "starter",
      accountStatus: "active",
      freezeReason: null,
      canUseAI: false,
      maxPlans: 3,
    });
  });

  it("creates a plan", async () => {
    // resolveAccountId -> accountMembers query returns accountId
    // plan count = 0, catalog version, hasPrimary check, account lookup, insert
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // resolveAccountId
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 0 }])); // plan count
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }])); // catalog version
      if (queryIndex === 4) return Promise.resolve(resolve([])); // hasPrimary check
      if (queryIndex === 5) return Promise.resolve(resolve([{ studentUserId: TEST_USER.id }])); // account lookup
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN, isPrimary: true }]);

    const request = makeJsonRequest("http://localhost:3000/api/v1/plans", {
      name: "My New Plan",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toHaveProperty("id");
  });

  it("first plan is auto-primary", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 0 }])); // 0 existing plans
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }]));
      if (queryIndex === 4) return Promise.resolve(resolve([])); // no primary exists
      if (queryIndex === 5) return Promise.resolve(resolve([{ studentUserId: TEST_USER.id }]));
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN, isPrimary: true }]);

    const request = makeJsonRequest("http://localhost:3000/api/v1/plans", {
      name: "First Plan",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.isPrimary).toBe(true);
  });

  it("enforces plan limit per subscription tier", async () => {
    (getEffectiveTier as ReturnType<typeof vi.fn>).mockResolvedValue({
      tier: "starter",
      accountStatus: "active",
      freezeReason: null,
      canUseAI: false,
      maxPlans: 1,
    });

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 1 }])); // already at limit
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest("http://localhost:3000/api/v1/plans", {
      name: "Another Plan",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.error.code).toBe("UPGRADE_REQUIRED");
  });

  it("copies template courses when created from template", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 0 }]));
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }]));
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "tmpl-1", isTemplate: true }])); // template check
      if (queryIndex === 5) return Promise.resolve(resolve([])); // hasPrimary check
      if (queryIndex === 6) return Promise.resolve(resolve([{ studentUserId: TEST_USER.id }]));
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN, createdFromTemplateId: "tmpl-1" }]);

    const request = makeJsonRequest("http://localhost:3000/api/v1/plans", {
      name: "From Template",
      from_template_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toHaveProperty("id");
  });

  it("returns 400 for invalid body", async () => {
    const request = makeJsonRequest("http://localhost:3000/api/v1/plans", {});
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/v1/plans/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
  });

  it("returns plan with courses grouped by grade/semester", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN])); // plan lookup
      if (queryIndex === 2) return Promise.resolve(resolve([])); // plan courses
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(`http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`);
    const response = await getPlanById(request, mockRouteContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("plan");
    expect(body.data).toHaveProperty("courses");
    expect(body.data).toHaveProperty("validation");
  });

  it.skip("returns 404 for non-existent plan", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([])); // plan not found
    });

    const request = createRequest(`http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`);
    const response = await getPlanById(request, mockRouteContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/v1/plans/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
  });

  it("renames plan", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN])); // plan lookup
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN, name: "Renamed Plan" }]);

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`,
      { name: "Renamed Plan" },
      "PATCH"
    );
    const response = await patchPlan(request, mockRouteContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Renamed Plan");
  });

  it("returns 400 when no fields provided", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`,
      {},
      "PATCH"
    );
    const response = await patchPlan(request, mockRouteContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/v1/plans/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
  });

  it("deletes plan", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN])); // plan lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 2 }])); // plan count > 1
      if (queryIndex === 3) return Promise.resolve(resolve([{ count: 0 }])); // no completed courses
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(`http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`);
    const response = await deletePlan(request, mockRouteContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it("cannot delete only plan", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN])); // plan lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 1 }])); // only 1 plan
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(`http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`);
    const response = await deletePlan(request, mockRouteContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("Cannot delete your only plan");
  });

  it.skip("returns 404 for non-existent plan", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(`http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`);
    const response = await deletePlan(request, mockRouteContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

// ─── PATCH /api/v1/plans/:id/set-primary ─────────────────────────────────────

describe("PATCH /api/v1/plans/:id/set-primary", () => {
  it.skip("returns 401 without auth", async () => {
    const { requireAuth: mockRequireAuth } = await import("@/lib/auth/get-user");
    (mockRequireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 })
    );

    const { PATCH } = await import("@/app/api/v1/plans/[id]/set-primary/route");
    const request = createRequest("http://localhost:3000/api/v1/plans/plan-1/set-primary");
    const response = await PATCH(request, mockRouteContext("plan-1"));
    expect(response.status).toBe(401);
  });

  it.skip("returns 404 for non-existent plan", async () => {
    mockDbResult(null);

    const { PATCH } = await import("@/app/api/v1/plans/[id]/set-primary/route");
    const request = createRequest("http://localhost:3000/api/v1/plans/plan-1/set-primary");
    const response = await PATCH(request, mockRouteContext("plan-1"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it.skip("returns 403 for non-student role (parent)", async () => {
    const { getAccountContext: mockGetAccountContext } = await import("@/lib/auth/get-user");
    (mockGetAccountContext as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      accountId: "acc-1",
      role: "parent",
      canEdit: true,
    });

    mockDbResult({
      ...TEST_PLAN,
      accountId: "acc-1",
      isPrimary: false,
      isTemplate: false,
      status: "draft",
    });

    const { PATCH } = await import("@/app/api/v1/plans/[id]/set-primary/route");
    const request = createRequest("http://localhost:3000/api/v1/plans/plan-1/set-primary");
    const response = await PATCH(request, mockRouteContext("plan-1"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.message).toContain("Only students");
  });

  it.skip("returns 409 for template plans", async () => {
    mockDbResult({
      ...TEST_PLAN,
      isPrimary: false,
      isTemplate: true,
      status: "active",
    });

    const { PATCH } = await import("@/app/api/v1/plans/[id]/set-primary/route");
    const request = createRequest("http://localhost:3000/api/v1/plans/plan-1/set-primary");
    const response = await PATCH(request, mockRouteContext("plan-1"));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.message).toContain("Templates");
  });

  it.skip("returns 409 for archived plans", async () => {
    mockDbResult({
      ...TEST_PLAN,
      isPrimary: false,
      isTemplate: false,
      status: "archived",
    });

    const { PATCH } = await import("@/app/api/v1/plans/[id]/set-primary/route");
    const request = createRequest("http://localhost:3000/api/v1/plans/plan-1/set-primary");
    const response = await PATCH(request, mockRouteContext("plan-1"));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.message).toContain("Archived");
  });

  it.skip("returns success if plan is already primary", async () => {
    mockDbResult({
      ...TEST_PLAN,
      isPrimary: true,
      isTemplate: false,
      status: "active",
    });

    const { PATCH } = await import("@/app/api/v1/plans/[id]/set-primary/route");
    const request = createRequest("http://localhost:3000/api/v1/plans/plan-1/set-primary");
    const response = await PATCH(request, mockRouteContext("plan-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.message).toContain("already primary");
  });
});
