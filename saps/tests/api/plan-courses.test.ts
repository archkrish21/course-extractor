import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_USER = { id: "user-1", email: "student@test.com" };
const TEST_ACCOUNT_CTX = { accountId: "acc-1", role: "student" as const, canEdit: true };
const TEST_PLAN_ID = "plan-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_COURSE_ID = "c1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6";
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
  activatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
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
  fourYearPlans: { id: "id", name: "name", studentId: "studentId", accountId: "accountId", createdBy: "createdBy", schoolYear: "schoolYear", catalogVersionId: "catalogVersionId", status: "status", isPrimary: "isPrimary", isTemplate: "isTemplate" },
  planCourses: { id: "pc_id", planId: "pc_planId", courseId: "pc_courseId", gradeLevel: "pc_gradeLevel", semester: "pc_semester", status: "pc_status", plannedGrade: "pc_plannedGrade", displayOrder: "pc_displayOrder", notes: "pc_notes" },
  courses: { id: "c_id", code: "c_code", name: "c_name", creditValue: "c_creditValue", duration: "c_duration", creditType: "c_creditType", isAp: "c_isAp", isDualCredit: "c_isDualCredit", isHonors: "c_isHonors", gpaWaiver: "c_gpaWaiver", gradeLevels: "c_gradeLevels", semestersOffered: "c_semestersOffered", divisionId: "c_divisionId", catalogVersionId: "c_catalogVersionId" },
  divisions: { id: "div_id", name: "div_name" },
  planHistory: { planId: "ph_planId", changedBy: "ph_changedBy", action: "ph_action", beforeState: "ph_beforeState", afterState: "ph_afterState" },
  studentParentLinks: { studentId: "spl_studentId", parentId: "spl_parentId" },
  counselorStudentLinks: { studentId: "csl_studentId", counselorId: "csl_counselorId" },
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
import { POST as addCourse, GET as getCourses } from "@/app/api/v1/plans/[id]/courses/route";
import {
  PATCH as patchCourse,
  DELETE as deleteCourse,
} from "@/app/api/v1/plans/[id]/courses/[courseId]/route";
import { GET as validatePlan } from "@/app/api/v1/plans/[id]/validate/route";

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

describe("POST /api/v1/plans/:id/courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
    (validateCourseAddition as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      violations: [],
    });
  });

  it.skip("adds course to plan", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN])); // plan lookup
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: TEST_COURSE_ID, code: "ENG101", name: "English I" }])); // course lookup
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([TEST_PLAN_COURSE]);

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

    expect(response.status).toBe(201);
    expect(body.data).toHaveProperty("planCourse");
  });

  it.skip("returns 409 for duplicate course", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: TEST_COURSE_ID, code: "ENG101", name: "English I" }]));
      return Promise.resolve(resolve([]));
    });

    (validateCourseAddition as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      violations: [
        {
          type: "duplicate",
          courseId: TEST_COURSE_ID,
          courseName: "English I",
          courseCode: "ENG101",
          message: "Course is already in this plan.",
        },
      ],
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
  });

  it.skip("returns 422 with prerequisite violations", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: TEST_COURSE_ID, code: "AP-CALC", name: "AP Calculus" }]));
      return Promise.resolve(resolve([]));
    });

    (validateCourseAddition as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      violations: [
        {
          type: "prerequisite",
          courseId: TEST_COURSE_ID,
          courseName: "AP Calculus",
          courseCode: "AP-CALC",
          message: "Missing prerequisite: Pre-Calculus",
        },
      ],
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses`,
      {
        course_id: TEST_COURSE_ID,
        grade_level: 10,
        semester: 1,
      }
    );
    const response = await addCourse(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toHaveProperty("violations");
    expect(body.violations.length).toBeGreaterThan(0);
  });

  it.skip("adds course despite warnings with force_add", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: TEST_COURSE_ID, code: "AP-CALC", name: "AP Calculus" }]));
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN_COURSE, courseId: TEST_COURSE_ID }]);

    (validateCourseAddition as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      violations: [
        {
          type: "prerequisite",
          courseId: TEST_COURSE_ID,
          courseName: "AP Calculus",
          courseCode: "AP-CALC",
          message: "Missing prerequisite: Pre-Calculus",
        },
      ],
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses`,
      {
        course_id: TEST_COURSE_ID,
        grade_level: 10,
        semester: 1,
        force_add: true,
      }
    );
    const response = await addCourse(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toHaveProperty("planCourse");
    expect(body.data).toHaveProperty("warnings");
  });

  it.skip("bypasses all checks with skip_validation (undo)", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: TEST_COURSE_ID, code: "ENG101", name: "English I" }]));
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([TEST_PLAN_COURSE]);

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses`,
      {
        course_id: TEST_COURSE_ID,
        grade_level: 9,
        semester: 1,
        skip_validation: true,
      }
    );
    const response = await addCourse(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(201);
    // validateCourseAddition should NOT have been called
    expect(validateCourseAddition).not.toHaveBeenCalled();
  });

  it.skip("accepts status parameter", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ id: TEST_COURSE_ID, code: "ENG101", name: "English I" }]));
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN_COURSE, status: "enrolled" }]);

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses`,
      {
        course_id: TEST_COURSE_ID,
        grade_level: 9,
        semester: 1,
        status: "enrolled",
      }
    );
    const response = await addCourse(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.planCourse.status).toBe("enrolled");
  });

  it("returns 400 for invalid body", async () => {
    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses`,
      { grade_level: 9 } // missing course_id and semester
    );
    const response = await addCourse(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/v1/plans/:id/courses/:courseId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
  });

  it("updates status", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN])); // plan lookup
      if (queryIndex === 2) return Promise.resolve(resolve([TEST_PLAN_COURSE])); // plan course lookup
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN_COURSE, status: "enrolled" }]);

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

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("enrolled");
  });

  it("updates planned_grade", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      if (queryIndex === 2) return Promise.resolve(resolve([TEST_PLAN_COURSE]));
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ ...TEST_PLAN_COURSE, plannedGrade: "A" }]);

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

    expect(response.status).toBe(200);
    expect(body.data.plannedGrade).toBe("A");
  });

  it("returns 400 when no fields provided", async () => {
    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses/${TEST_PLAN_COURSE_ID}`,
      {},
      "PATCH"
    );
    const response = await patchCourse(
      request,
      planCourseContext(TEST_PLAN_ID, TEST_PLAN_COURSE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when plan course not found", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // not found
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses/nonexistent-id`,
      { status: "enrolled" },
      "PATCH"
    );
    const response = await patchCourse(
      request,
      planCourseContext(TEST_PLAN_ID, "nonexistent-id")
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/v1/plans/:id/courses/:courseId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
    (validatePlanIntegrity as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      violations: [],
    });
  });

  it("removes course from plan", async () => {
    const planCourseWithDetails = {
      ...TEST_PLAN_COURSE,
      courseCode: "ENG101",
      courseName: "English I",
      catalogVersionId: "cv-1",
    };

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN])); // plan lookup
      if (queryIndex === 2) return Promise.resolve(resolve([planCourseWithDetails])); // plan course lookup
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

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
    expect(body.data.removedCourse).toHaveProperty("courseCode", "ENG101");
  });

  it("returns 404 when plan course not found", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      if (queryIndex === 2) return Promise.resolve(resolve([])); // not found
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/courses/nonexistent-id`
    );
    const response = await deleteCourse(
      request,
      planCourseContext(TEST_PLAN_ID, "nonexistent-id")
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/v1/plans/:id/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
  });

  it("returns all violations", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      return Promise.resolve(resolve([]));
    });

    (validatePlanIntegrity as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      violations: [
        {
          type: "prerequisite",
          courseId: TEST_COURSE_ID,
          courseCode: "AP-CALC",
          courseName: "AP Calculus",
          message: "Missing prerequisite: Pre-Calculus",
        },
      ],
    });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/validate`
    );
    const response = await validatePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.valid).toBe(false);
    expect(body.data.totalViolations).toBe(1);
    expect(body.data.courseViolations).toHaveLength(1);
    expect(body.data.courseViolations[0].courseCode).toBe("AP-CALC");
  });

  it("returns valid when no violations", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([TEST_PLAN]));
      return Promise.resolve(resolve([]));
    });

    (validatePlanIntegrity as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      violations: [],
    });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/validate`
    );
    const response = await validatePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.valid).toBe(true);
    expect(body.data.totalViolations).toBe(0);
  });

  it("returns 404 for non-existent plan", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([]));
    });

    const request = createRequest(
      `http://localhost:3000/api/v1/plans/${TEST_PLAN_ID}/validate`
    );
    const response = await validatePlan(request, planContext(TEST_PLAN_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
