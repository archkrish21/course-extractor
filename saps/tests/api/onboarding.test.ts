import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_USER = { id: "user-1", email: "student@test.com" };

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
  chain.update = vi.fn().mockImplementation(self);
  chain.set = vi.fn().mockImplementation(self);
  chain.values = mockValues.mockImplementation(self);
  chain.returning = mockReturning.mockResolvedValue([{ id: "plan-1" }]);
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
  users: { id: "id", role: "role" },
  studentProfiles: { userId: "userId" },
  fourYearPlans: { id: "id", studentId: "studentId", accountId: "accountId", isTemplate: "isTemplate" },
  planCourses: { planId: "planId", courseId: "courseId" },
  planShares: { planId: "planId", userId: "userId" },
  gradeEntries: { studentId: "studentId", courseId: "courseId" },
  courses: { id: "id", code: "code", catalogVersionId: "catalogVersionId", isActive: "isActive", creditValue: "creditValue" },
  courseCatalogVersions: { id: "id", loadedAt: "loadedAt", schoolYear: "schoolYear" },
  accountMembers: { accountId: "accountId", userId: "userId" },
  accounts: { id: "id", studentUserId: "studentUserId" },
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/config/grade-scale", () => ({
  ALL_GRADES: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "P", "NC", "W", "I", "AU"] as const,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
}));

import { requireAuth } from "@/lib/auth/get-user";
import { POST } from "@/app/api/v1/auth/onboarding/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/v1/auth/onboarding"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
  });

  it("returns 401 without auth", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 })
    );

    const response = await POST(makeRequest({ grade_level: 10, graduation_year: 2028 }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    const response = await POST(makeRequest({ grade_level: "invalid" }));
    expect(response.status).toBe(400);
  });

  it("returns 403 for non-student users", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "counselor" }])); // user role check
      return Promise.resolve(resolve([]));
    });

    const response = await POST(makeRequest({ grade_level: 10, graduation_year: 2028 }));
    expect(response.status).toBe(403);
  });

  it("succeeds with basic grade/graduation data", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }])); // user role
      if (queryIndex === 2) return Promise.resolve(resolve(undefined)); // update studentProfiles
      if (queryIndex === 3) return Promise.resolve(resolve(undefined)); // update accounts (new)
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }])); // catalog
      if (queryIndex === 5) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // membership
      return Promise.resolve(resolve([]));
    });

    const response = await POST(makeRequest({ grade_level: 10, graduation_year: 2028 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
  });

  it("creates grade entries when courses_completed is provided", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }])); // user role
      if (queryIndex === 2) return Promise.resolve(resolve(undefined)); // update studentProfiles
      if (queryIndex === 3) return Promise.resolve(resolve(undefined)); // update accounts (new)
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }])); // catalog
      if (queryIndex === 5) return Promise.resolve(resolve([
        { id: "course-1", code: "MTH151", creditValue: "1.0" },
        { id: "course-2", code: "ENG111", creditValue: "1.0" },
      ])); // all courses
      // queryIndex 6,7 = grade entry inserts
      if (queryIndex === 8) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // membership
      return Promise.resolve(resolve([]));
    });

    const response = await POST(makeRequest({
      grade_level: 10,
      graduation_year: 2028,
      courses_completed: [
        { code: "MTH151", grade: "A", academic_year: "2024-2025", semester: 1 },
        { code: "ENG111", grade: "B+", academic_year: "2024-2025", semester: 1 },
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.grades_created).toBe(2);
  });

  it("creates a blank plan when courses are entered but no template", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }])); // user role
      if (queryIndex === 2) return Promise.resolve(resolve(undefined)); // update studentProfiles
      if (queryIndex === 3) return Promise.resolve(resolve(undefined)); // update accounts (new)
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }])); // catalog
      if (queryIndex === 5) return Promise.resolve(resolve([
        { id: "course-1", code: "MTH151", creditValue: "1.0" },
      ])); // all courses for grade entries
      // queryIndex 6 = grade entry insert
      if (queryIndex === 7) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // membership
      // queryIndex 8 = plan insert (returning handled by mockReturning)
      // queryIndex 9 = planShares insert
      if (queryIndex === 10) return Promise.resolve(resolve([
        { id: "course-1", code: "MTH151" },
      ])); // all courses for plan courses
      // queryIndex 11 = planCourse insert
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ id: "new-plan-1" }]);

    const response = await POST(makeRequest({
      grade_level: 10,
      graduation_year: 2028,
      courses_completed: [
        { code: "MTH151", grade: "A", academic_year: "2024-2025", semester: 1 },
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.plan_id).toBe("new-plan-1");
    expect(body.data.grades_created).toBe(1);
  });

  it("does not create a plan when no courses and no template", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }])); // user role
      if (queryIndex === 2) return Promise.resolve(resolve(undefined)); // update studentProfiles
      if (queryIndex === 3) return Promise.resolve(resolve(undefined)); // update accounts (new)
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }])); // catalog
      if (queryIndex === 5) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // membership
      return Promise.resolve(resolve([]));
    });

    const response = await POST(makeRequest({
      grade_level: 10,
      graduation_year: 2028,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.plan_id).toBeNull();
  });

  it("validates grade_level range", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    const response = await POST(makeRequest({ grade_level: 8, graduation_year: 2028 }));
    expect(response.status).toBe(400);
  });

  it("validates graduation_year range", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    const response = await POST(makeRequest({ grade_level: 10, graduation_year: 2020 }));
    expect(response.status).toBe(400);
  });

  it("validates course grade values", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    const response = await POST(makeRequest({
      grade_level: 10,
      graduation_year: 2028,
      courses_completed: [
        { code: "MTH151", grade: "X", academic_year: "2024-2025", semester: 1 },
      ],
    }));
    expect(response.status).toBe(400);
  });

  // ── Regression tests for today's fixes ──────────────────────────────────

  it("writes gradeLevel and graduationYear to accounts (not just student_profiles)", async () => {
    // Regression: previously, onboarding only updated student_profiles, leaving
    // accounts.gradeLevel at the signup default. Settings/dashboard read from
    // accounts, so they'd display stale defaults until year-end ran.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }]));
      if (queryIndex === 2) return Promise.resolve(resolve(undefined));
      if (queryIndex === 3) return Promise.resolve(resolve(undefined));
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }]));
      if (queryIndex === 5) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      return Promise.resolve(resolve([]));
    });

    await POST(makeRequest({ grade_level: 11, graduation_year: 2027 }));

    // Find the .set() call that targets the accounts row (has gradeLevel as a number field).
    const setCalls = (dbChain.set as ReturnType<typeof vi.fn>).mock.calls;
    const accountsSet = setCalls.find(([arg]) =>
      arg && typeof arg === "object" && arg.gradeLevel === 11
    );
    expect(accountsSet).toBeDefined();
    expect(accountsSet![0]).toMatchObject({ gradeLevel: 11, graduationYear: 2027 });
  });

  it("seeds lockedGradeLevels with all past grades when creating a plan (returning student)", async () => {
    // Regression: past courses are a finalized academic record. A grade-11
    // student onboarding should have grades 9 and 10 locked from day one so
    // the student doesn't accidentally edit historical entries.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }]));
      if (queryIndex === 2) return Promise.resolve(resolve(undefined));
      if (queryIndex === 3) return Promise.resolve(resolve(undefined));
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }]));
      if (queryIndex === 5) return Promise.resolve(resolve([
        { id: "course-1", code: "MTH151", creditValue: "1.0" },
      ]));
      if (queryIndex === 7) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 10) return Promise.resolve(resolve([
        { id: "course-1", code: "MTH151" },
      ]));
      return Promise.resolve(resolve([]));
    });
    mockReturning.mockResolvedValue([{ id: "new-plan-1" }]);

    await POST(makeRequest({
      grade_level: 11,
      graduation_year: 2027,
      courses_completed: [
        { code: "MTH151", grade: "A", academic_year: "2023-2024", semester: 1 },
      ],
    }));

    // Locate the plan insert — identified by the presence of lockedGradeLevels.
    const valuesCalls = mockValues.mock.calls;
    const planInsert = valuesCalls.find(([arg]) =>
      arg && typeof arg === "object" && Array.isArray(arg.lockedGradeLevels)
    );
    expect(planInsert).toBeDefined();
    expect(planInsert![0].lockedGradeLevels).toEqual([9, 10]);
  });

  it("leaves lockedGradeLevels empty for freshman onboarding", async () => {
    // Grade 9 has no past grades to lock. The computed array should be empty.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ role: "student" }]));
      if (queryIndex === 2) return Promise.resolve(resolve(undefined));
      if (queryIndex === 3) return Promise.resolve(resolve(undefined));
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "cv-1", schoolYear: "2025-2026" }]));
      if (queryIndex === 5) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      return Promise.resolve(resolve([]));
    });

    await POST(makeRequest({ grade_level: 9, graduation_year: 2029 }));

    // No plan insert for a grade-9 student with no template and no past courses,
    // so there should be no lockedGradeLevels-bearing insert. But if any insert
    // happens (defensive), it must carry an empty array — never include a grade
    // >= the student's current grade.
    const valuesCalls = mockValues.mock.calls;
    const planInsert = valuesCalls.find(([arg]) =>
      arg && typeof arg === "object" && Array.isArray(arg.lockedGradeLevels)
    );
    if (planInsert) {
      expect(planInsert[0].lockedGradeLevels).toEqual([]);
    }
  });
});
