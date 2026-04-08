import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_USER = { id: "user-1", email: "student@test.com" };
const TEST_ACCOUNT_CTX = { accountId: "acc-1", role: "student" as const, canEdit: true };
const TEST_PLAN_ID = "plan-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_COURSE_ID = "c1a2b3c4-d5e6-47a8-b9c0-d1e2f3a4b5c6";
const TEST_PLAN_COURSE_ID = "pc-aaaa-bbbb-cccc-dddd-eeeeeeee";

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
  lockedGradeLevels: [9],
  activatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const TEST_PLAN_UNLOCKED = {
  ...TEST_PLAN,
  lockedGradeLevels: [],
};

const TEST_PLAN_COURSE = {
  id: TEST_PLAN_COURSE_ID,
  planId: TEST_PLAN_ID,
  courseId: TEST_COURSE_ID,
  gradeLevel: 9,
  semester: 1,
  status: "planned",
  plannedGrade: null,
  displayOrder: 0,
  notes: null,
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
  chain.returning = mockReturning.mockResolvedValue([TEST_PLAN_COURSE]);
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

vi.mock("@/lib/prereq/validator", () => ({
  validateCourseAddition: vi.fn().mockResolvedValue({
    valid: true,
    violations: [],
  }),
  validatePlanIntegrity: vi.fn().mockResolvedValue({
    valid: true,
    violations: [],
  }),
  getTransitiveDownstream: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/schema", () => ({
  fourYearPlans: { id: "id", name: "name", studentId: "studentId", accountId: "accountId", createdBy: "createdBy", schoolYear: "schoolYear", catalogVersionId: "catalogVersionId", status: "status", isPrimary: "isPrimary", isTemplate: "isTemplate", lockedGradeLevels: "lockedGradeLevels" },
  planCourses: { id: "pc_id", planId: "pc_planId", courseId: "pc_courseId", gradeLevel: "pc_gradeLevel", semester: "pc_semester", status: "pc_status", plannedGrade: "pc_plannedGrade", gpaWaiverApplied: "pc_gpaWaiverApplied", displayOrder: "pc_displayOrder", notes: "pc_notes" },
  courses: { id: "c_id", code: "c_code", name: "c_name", creditValue: "c_creditValue", duration: "c_duration", creditType: "c_creditType", isAp: "c_isAp", isDualCredit: "c_isDualCredit", isHonors: "c_isHonors", gpaWaiver: "c_gpaWaiver", gradeLevels: "c_gradeLevels", semestersOffered: "c_semestersOffered", divisionId: "c_divisionId", catalogVersionId: "c_catalogVersionId" },
  divisions: { id: "div_id", name: "div_name" },
  planHistory: { planId: "ph_planId", changedBy: "ph_changedBy", action: "ph_action", beforeState: "ph_beforeState", afterState: "ph_afterState" },
  studentParentLinks: { studentId: "spl_studentId", parentId: "spl_parentId" },
  counselorStudentLinks: { studentId: "csl_studentId", counselorId: "csl_counselorId" },
  planShares: { id: "ps_id", planId: "ps_planId", userId: "ps_userId", permission: "ps_permission", isHidden: "ps_isHidden", grantedBy: "ps_grantedBy" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId", role: "am_role", canEdit: "am_canEdit" },
  accounts: { id: "a_id", gradeLevel: "a_gradeLevel", studentUserId: "a_studentUserId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings,
    }),
    { raw: vi.fn() }
  ),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { validateCourseAddition, validatePlanIntegrity } from "@/lib/prereq/validator";
import { POST as lockGrade } from "@/app/api/v1/plans/[id]/lock-grade/route";
import { POST as addCourse } from "@/app/api/v1/plans/[id]/courses/route";
import {
  PATCH as patchCourse,
  DELETE as deleteCourse,
} from "@/app/api/v1/plans/[id]/courses/[courseId]/route";

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

function planCourseContext(id: string, courseId: string) {
  return { params: Promise.resolve({ id, courseId }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/v1/plans/:id/lock-grade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
  });

  it("successfully locks a grade level", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN_UNLOCKED }])); // plan lookup
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/lock-grade`,
      { grade_level: 10, locked: true }
    );
    const response = await lockGrade(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.locked_grade_levels).toEqual([10]);
  });

  it("successfully unlocks a grade level", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }])); // plan has [9] locked
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/lock-grade`,
      { grade_level: 9, locked: false }
    );
    const response = await lockGrade(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.locked_grade_levels).toEqual([]);
  });

  it("returns 404 for non-existent plan", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([])); // no plan found
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/lock-grade`,
      { grade_level: 9, locked: true }
    );
    const response = await lockGrade(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 for non-member", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }]));
      return Promise.resolve(resolve([]));
    });
    mockGetPlanAccess.mockResolvedValue(null);

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/lock-grade`,
      { grade_level: 9, locked: true }
    );
    const response = await lockGrade(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 for missing grade_level", async () => {
    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/lock-grade`,
      { locked: true }
    );
    const response = await lockGrade(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid locked value", async () => {
    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/lock-grade`,
      { grade_level: 9, locked: "yes" }
    );
    const response = await lockGrade(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not duplicate if grade already locked", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }])); // already has [9] locked
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/lock-grade`,
      { grade_level: 9, locked: true }
    );
    const response = await lockGrade(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.locked_grade_levels).toEqual([9]);
  });
});

describe("PATCH /api/v1/plans/:id/courses/:courseId – lock enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
  });

  it("returns 409 when trying to change status on a locked grade", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }])); // plan with lockedGradeLevels: [9]
      if (queryIndex === 2) return Promise.resolve(resolve([{ ...TEST_PLAN_COURSE }])); // course at gradeLevel 9
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses/${TEST_PLAN_COURSE_ID}`,
      { status: "enrolled" },
      "PATCH"
    );
    const response = await patchCourse(
      request,
      planCourseContext(TEST_PLAN_ID, TEST_PLAN_COURSE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("locked");
  });

  it("returns 409 when trying to change semester on a locked grade", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ ...TEST_PLAN_COURSE }]));
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses/${TEST_PLAN_COURSE_ID}`,
      { semester: 2 },
      "PATCH"
    );
    const response = await patchCourse(
      request,
      planCourseContext(TEST_PLAN_ID, TEST_PLAN_COURSE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("locked");
  });

  it("returns 409 when trying to change grade on a locked grade", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ ...TEST_PLAN_COURSE }]));
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses/${TEST_PLAN_COURSE_ID}`,
      { planned_grade: "A" },
      "PATCH"
    );
    const response = await patchCourse(
      request,
      planCourseContext(TEST_PLAN_ID, TEST_PLAN_COURSE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("locked");
  });

  it("allows GPA waiver toggle on a locked grade", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ ...TEST_PLAN_COURSE }]));
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN_COURSE, gpaWaiverApplied: true }]);

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses/${TEST_PLAN_COURSE_ID}`,
      { gpa_waiver_applied: true },
      "PATCH"
    );
    const response = await patchCourse(
      request,
      planCourseContext(TEST_PLAN_ID, TEST_PLAN_COURSE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.gpaWaiverApplied).toBe(true);
  });
});

describe("DELETE /api/v1/plans/:id/courses/:courseId – lock enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
    (validatePlanIntegrity as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      violations: [],
    });
  });

  it("returns 409 when trying to delete a course from a locked grade", async () => {
    const planCourseWithDetails = {
      ...TEST_PLAN_COURSE,
      courseCode: "ENG101",
      courseName: "English I",
      catalogVersionId: "cv-1",
    };

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }])); // plan with lockedGradeLevels: [9]
      if (queryIndex === 2) return Promise.resolve(resolve([planCourseWithDetails])); // course at gradeLevel 9
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses/${TEST_PLAN_COURSE_ID}`
    );
    const response = await deleteCourse(
      request,
      planCourseContext(TEST_PLAN_ID, TEST_PLAN_COURSE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("locked");
  });
});

describe("POST /api/v1/plans/:id/courses – lock enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
    mockGetPlanAccess.mockResolvedValue({ permission: "owner", isHidden: false });
    (validateCourseAddition as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      violations: [],
    });
  });

  it("returns 409 when trying to add a course to a locked grade", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ ...TEST_PLAN }])); // plan with lockedGradeLevels: [9]
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses`,
      {
        course_id: TEST_COURSE_ID,
        grade_level: 9,
        semester: 1,
      }
    );
    const response = await addCourse(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("locked");
  });
});
