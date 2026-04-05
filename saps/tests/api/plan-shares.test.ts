import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_USER = { id: "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", email: "owner@test.com" };
const TARGET_USER_ID = "f6f6f6f6-a7a7-4b8b-9c9c-d0d0d0d0d0d0";
const TEST_PLAN_ID = "plan-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const TEST_SHARE = {
  id: "share-1",
  planId: TEST_PLAN_ID,
  userId: TARGET_USER_ID,
  permission: "edit",
  isHidden: false,
  grantedBy: TEST_USER.id,
  createdAt: new Date(),
};

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
  chain.returning = mockReturning.mockResolvedValue([TEST_SHARE]);
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

const mockGetPlanAccess = vi.fn();
vi.mock("@/lib/auth/plan-permissions", () => ({
  getPlanAccess: (...args: unknown[]) => mockGetPlanAccess(...args),
  hasPermission: (userPerm: string, requiredPerm: string) => {
    const levels: Record<string, number> = { view: 1, edit: 2, delete: 3, owner: 4 };
    return (levels[userPerm] ?? 0) >= (levels[requiredPerm] ?? 0);
  },
}));

vi.mock("@/lib/db/schema", () => ({
  fourYearPlans: { id: "id", name: "name", studentId: "studentId", accountId: "accountId", createdBy: "createdBy", schoolYear: "schoolYear", catalogVersionId: "catalogVersionId", status: "status", isPrimary: "isPrimary", isTemplate: "isTemplate", lockedGradeLevels: "lockedGradeLevels" },
  planCourses: { id: "pc_id", planId: "pc_planId", courseId: "pc_courseId", gradeLevel: "pc_gradeLevel", semester: "pc_semester", status: "pc_status", plannedGrade: "pc_plannedGrade", gpaWaiverApplied: "pc_gpaWaiverApplied", displayOrder: "pc_displayOrder", notes: "pc_notes" },
  courses: { id: "c_id", code: "c_code", name: "c_name", creditValue: "c_creditValue", duration: "c_duration", creditType: "c_creditType", isAp: "c_isAp", isDualCredit: "c_isDualCredit", isHonors: "c_isHonors", gpaWaiver: "c_gpaWaiver", gradeLevels: "c_gradeLevels", semestersOffered: "c_semestersOffered", divisionId: "c_divisionId", catalogVersionId: "c_catalogVersionId" },
  divisions: { id: "div_id", name: "div_name" },
  planHistory: { planId: "ph_planId", changedBy: "ph_changedBy", action: "ph_action", beforeState: "ph_beforeState", afterState: "ph_afterState" },
  studentParentLinks: { studentId: "spl_studentId", parentId: "spl_parentId" },
  counselorStudentLinks: { studentId: "csl_studentId", counselorId: "csl_counselorId" },
  planShares: { id: "ps_id", planId: "ps_planId", userId: "ps_userId", permission: "ps_permission", isHidden: "ps_isHidden", grantedBy: "ps_grantedBy", createdAt: "ps_createdAt" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId", role: "am_role", canEdit: "am_canEdit" },
  accounts: { id: "a_id", gradeLevel: "a_gradeLevel", studentUserId: "a_studentUserId" },
  users: { id: "u_id", email: "u_email" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  count: vi.fn(() => ({ type: "count" })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings,
    }),
    { raw: vi.fn() }
  ),
}));

import { requireAuth } from "@/lib/auth/get-user";
import { GET as getShares, POST as createShare } from "@/app/api/v1/plans/[id]/shares/route";
import { PATCH as patchShare, DELETE as deleteShare } from "@/app/api/v1/plans/[id]/shares/[userId]/route";
import { PATCH as patchVisibility } from "@/app/api/v1/plans/[id]/visibility/route";
import { DELETE as deletePlan } from "@/app/api/v1/plans/[id]/route";

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

function planContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function shareContext(id: string, userId: string) {
  return { params: Promise.resolve({ id, userId }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/v1/plans/:id/shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
  });

  it("returns shares list when user is owner", async () => {
    const shareRow = {
      userId: TARGET_USER_ID,
      permission: "edit",
      isHidden: false,
      createdAt: new Date().toISOString(),
      email: "collaborator@test.com",
    };
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([shareRow]))
    );

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares`
    );
    const response = await getShares(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].user_id).toBe(TARGET_USER_ID);
    expect(body.data[0].permission).toBe("edit");
    expect(body.data[0].email).toBe("collaborator@test.com");
  });

  it("returns 403 when user is not owner (e.g., has edit permission)", async () => {
    mockGetPlanAccess.mockResolvedValue({ permission: "edit", isHidden: false });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares`
    );
    const response = await getShares(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/v1/plans/:id/shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
  });

  it("successfully shares a plan with another user", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // plan lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ userId: TARGET_USER_ID }])); // membership check
      if (queryIndex === 3) return Promise.resolve(resolve([])); // no existing share
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{
      userId: TARGET_USER_ID,
      permission: "edit",
      createdAt: new Date().toISOString(),
    }]);

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares`,
      { user_id: TARGET_USER_ID, permission: "edit" }
    );
    const response = await createShare(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user_id).toBe(TARGET_USER_ID);
    expect(body.data.permission).toBe("edit");
  });

  it("returns 400 for sharing with yourself", async () => {
    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares`,
      { user_id: TEST_USER.id, permission: "edit" }
    );
    const response = await createShare(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("yourself");
  });

  it("returns 409 if already shared", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // plan lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ userId: TARGET_USER_ID }])); // membership check
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "existing-share" }])); // existing share found
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares`,
      { user_id: TARGET_USER_ID, permission: "edit" }
    );
    const response = await createShare(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("already shared");
  });

  it("returns 403 when non-owner tries to share", async () => {
    mockGetPlanAccess.mockResolvedValue({ permission: "edit", isHidden: false });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares`,
      { user_id: TARGET_USER_ID, permission: "edit" }
    );
    const response = await createShare(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("PATCH /api/v1/plans/:id/shares/:userId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
  });

  it("successfully updates permission level", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ permission: "edit" }])); // existing share
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{
      userId: TARGET_USER_ID,
      permission: "view",
    }]);

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares/${TARGET_USER_ID}`,
      { permission: "view" },
      "PATCH"
    );
    const response = await patchShare(request, shareContext(TEST_PLAN_ID, TARGET_USER_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user_id).toBe(TARGET_USER_ID);
    expect(body.data.permission).toBe("view");
  });

  it("returns 409 when trying to change owner's permission", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{ permission: "owner" }]))
    );

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares/${TARGET_USER_ID}`,
      { permission: "edit" },
      "PATCH"
    );
    const response = await patchShare(request, shareContext(TEST_PLAN_ID, TARGET_USER_ID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("owner");
  });

  it("returns 404 for non-existent share", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([]))
    );

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares/${TARGET_USER_ID}`,
      { permission: "view" },
      "PATCH"
    );
    const response = await patchShare(request, shareContext(TEST_PLAN_ID, TARGET_USER_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/v1/plans/:id/shares/:userId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
  });

  it("successfully revokes a share", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{ permission: "edit" }]))
    );

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares/${TARGET_USER_ID}`
    );
    const response = await deleteShare(request, shareContext(TEST_PLAN_ID, TARGET_USER_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it("returns 409 when trying to revoke owner", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{ permission: "owner" }]))
    );

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares/${TARGET_USER_ID}`
    );
    const response = await deleteShare(request, shareContext(TEST_PLAN_ID, TARGET_USER_ID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("owner");
  });

  it("returns 404 for non-existent share", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([]))
    );

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/shares/${TARGET_USER_ID}`
    );
    const response = await deleteShare(request, shareContext(TEST_PLAN_ID, TARGET_USER_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/v1/plans/:id/visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
  });

  it("successfully toggles isHidden", async () => {
    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/visibility`,
      { is_hidden: true },
      "PATCH"
    );
    const response = await patchVisibility(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.is_hidden).toBe(true);
  });

  it("returns 403 when user has no access", async () => {
    mockGetPlanAccess.mockResolvedValue(null);

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/visibility`,
      { is_hidden: true },
      "PATCH"
    );
    const response = await patchVisibility(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("DELETE /api/v1/plans/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
  });

  it("returns 403 when user has view permission", async () => {
    // Query 1: plan fetch
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{ id: TEST_PLAN_ID, accountId: "acc-1", isPrimary: false }]))
    );
    mockGetPlanAccess.mockResolvedValue({ permission: "view", isHidden: false });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`,
      { method: "DELETE" }
    );
    const response = await deletePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 when user has edit permission", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([{ id: TEST_PLAN_ID, accountId: "acc-1", isPrimary: false }]))
    );
    mockGetPlanAccess.mockResolvedValue({ permission: "edit", isHidden: false });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`,
      { method: "DELETE" }
    );
    const response = await deletePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("succeeds when user has delete permission", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ id: TEST_PLAN_ID, accountId: "acc-1", isPrimary: false }])); // plan fetch
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 3 }])); // plan count
      if (queryIndex === 3) return Promise.resolve(resolve([{ count: 0 }])); // completed courses count
      if (queryIndex === 4) return Promise.resolve(resolve([])); // delete
      return Promise.resolve(resolve([]));
    });
    mockGetPlanAccess.mockResolvedValue({ permission: "delete", isHidden: false });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`,
      { method: "DELETE" }
    );
    const response = await deletePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it("succeeds when user has owner permission", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ id: TEST_PLAN_ID, accountId: "acc-1", isPrimary: false }])); // plan fetch
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 2 }])); // plan count
      if (queryIndex === 3) return Promise.resolve(resolve([{ count: 0 }])); // completed courses count
      if (queryIndex === 4) return Promise.resolve(resolve([])); // delete
      return Promise.resolve(resolve([]));
    });
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`,
      { method: "DELETE" }
    );
    const response = await deletePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it("returns 409 when plan is primary (only plan)", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ id: TEST_PLAN_ID, accountId: "acc-1", isPrimary: true }])); // plan fetch
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 1 }])); // plan count — only plan
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`,
      { method: "DELETE" }
    );
    const response = await deletePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("only plan");
  });

  it("returns 409 when plan has completed courses", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ id: TEST_PLAN_ID, accountId: "acc-1", isPrimary: false }])); // plan fetch
      if (queryIndex === 2) return Promise.resolve(resolve([{ count: 3 }])); // plan count — multiple plans
      if (queryIndex === 3) return Promise.resolve(resolve([{ count: 5 }])); // completed courses count
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}`,
      { method: "DELETE" }
    );
    const response = await deletePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("completed courses");
  });

  it("returns 404 for non-existent plan", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve([]))
    );

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/nonexistent-plan-id`,
      { method: "DELETE" }
    );
    const response = await deletePlan(request, planContext("nonexistent-plan-id"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
