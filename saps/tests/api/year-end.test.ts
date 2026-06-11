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
  chain.execute = vi.fn().mockResolvedValue(undefined);
  return chain;
}

let dbChain = createQueryChain();

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "execute") return dbChain.execute;
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

vi.mock("@/lib/api/require-same-origin", () => ({
  requireSameOrigin: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/gpa/snapshot", () => ({
  maybeCreateSemesterSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db/schema", () => ({
  fourYearPlans: { id: "id", accountId: "accountId", isPrimary: "isPrimary", isTemplate: "isTemplate", lockedGradeLevels: "lockedGradeLevels" },
  planCourses: { id: "pc_id", planId: "pc_planId", courseId: "pc_courseId", gradeLevel: "pc_gradeLevel", semester: "pc_semester", status: "pc_status", plannedGrade: "pc_plannedGrade" },
  courses: { id: "c_id", code: "c_code", name: "c_name", creditValue: "c_creditValue" },
  accounts: { id: "a_id", gradeLevel: "a_gradeLevel", studentUserId: "a_studentUserId" },
  accountMembers: { accountId: "am_accountId", userId: "am_userId" },
  studentProfiles: { userId: "sp_userId", yearEndTransitionState: "sp_yearEndTransitionState", yearEndNextEligibleYear: "sp_yearEndNextEligibleYear" },
}));

vi.mock("@/config/grade-scale", () => ({
  ALL_GRADES: ["A", "B", "C", "D", "F", "P"],
}));

const mockIsYearEndBannerActive = vi.fn().mockReturnValue(true);
const mockCurrentAcademicYear = vi.fn().mockReturnValue(2026);
vi.mock("@/config/school-calendar", () => ({
  isYearEndBannerActive: (...args: unknown[]) => mockIsYearEndBannerActive(...args),
  currentAcademicYear: (...args: unknown[]) => mockCurrentAcademicYear(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: "sql", strings }),
    { raw: vi.fn() }
  ),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { GET, POST } from "@/app/api/v1/year-end/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(query = ""): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000/api/v1/year-end${query}`));
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/v1/year-end"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/v1/year-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
  });

  it("returns planId alongside year-end state (contract)", async () => {
    // Consumers (dashboard banner, wizard) need planId so they can call
    // /plans/:id/validate without a separate lookup.
    // nextEligibleYear = 2026 and mockCurrentAcademicYear = 2026 → eligible → "pending".
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }])); // membership
      if (queryIndex === 2) return Promise.resolve(resolve([{ gradeLevel: 10 }]));      // account
      if (queryIndex === 3) return Promise.resolve(resolve([{ yearEndTransitionState: "completed", yearEndNextEligibleYear: 2026 }])); // profile
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "plan-1" }]));        // primary plan
      if (queryIndex === 5) return Promise.resolve(resolve([]));                          // current year courses
      if (queryIndex === 6) return Promise.resolve(resolve([]));                          // next year courses
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.planId).toBe("plan-1");
    expect(body.data.gradeLevel).toBe(10);
    expect(body.data.transitionState).toBe("pending");
  });

  it("suppresses banner for new users (null yearEndNextEligibleYear)", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ gradeLevel: 9 }]));
      if (queryIndex === 3) return Promise.resolve(resolve([{ yearEndTransitionState: "pending", yearEndNextEligibleYear: null }]));
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "plan-1" }]));
      if (queryIndex === 5) return Promise.resolve(resolve([
        { id: "pc-1", courseId: "c1", code: "MTH", name: "Math", gradeLevel: 9, semester: 1, status: "planned", plannedGrade: null, creditValue: "1.0" },
      ]));
      if (queryIndex === 6) return Promise.resolve(resolve([]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.transitionState).toBe("completed");
  });

  it("suppresses banner when completed in same banner window", async () => {
    // nextEligibleYear = 2027, currentAcademicYear = 2026 → not yet eligible
    mockCurrentAcademicYear.mockReturnValueOnce(2026);
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ gradeLevel: 12 }]));
      if (queryIndex === 3) return Promise.resolve(resolve([{ yearEndTransitionState: "completed", yearEndNextEligibleYear: 2027 }]));
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "plan-1" }]));
      if (queryIndex === 5) return Promise.resolve(resolve([
        { id: "pc-1", courseId: "c1", code: "MTH", name: "Math", gradeLevel: 12, semester: 1, status: "enrolled", plannedGrade: null, creditValue: "1.0" },
      ]));
      if (queryIndex === 6) return Promise.resolve(resolve([]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.transitionState).toBe("completed");
  });

  it("shows banner in a new academic year when nextEligibleYear has been reached", async () => {
    // nextEligibleYear = 2027, currentAcademicYear = 2027 → eligible
    mockCurrentAcademicYear.mockReturnValueOnce(2027);
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ gradeLevel: 12 }]));
      if (queryIndex === 3) return Promise.resolve(resolve([{ yearEndTransitionState: "completed", yearEndNextEligibleYear: 2027 }]));
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "plan-1" }]));
      if (queryIndex === 5) return Promise.resolve(resolve([
        { id: "pc-1", courseId: "c1", code: "MTH", name: "Math", gradeLevel: 12, semester: 1, status: "enrolled", plannedGrade: null, creditValue: "1.0" },
      ]));
      if (queryIndex === 6) return Promise.resolve(resolve([]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.transitionState).toBe("pending");
  });

  it("returns planId as null when the student has no primary plan", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ gradeLevel: 10 }]));
      if (queryIndex === 3) return Promise.resolve(resolve([{ yearEndTransitionState: "completed", yearEndNextEligibleYear: 2026 }]));
      if (queryIndex === 4) return Promise.resolve(resolve([])); // no primary plan
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.planId).toBeNull();
  });

  it("returns completed state and empty data when outside the year-end banner window", async () => {
    mockIsYearEndBannerActive.mockReturnValueOnce(false);

    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.transitionState).toBe("completed");
    expect(body.data.currentYearCourses).toEqual([]);
    expect(body.data.planId).toBeNull();
    expect(body.data.gradeLevel).toBeNull();
  });

  it("counts completed-without-grade courses as incomplete", async () => {
    // Regression: previously incompleteCount excluded status === 'completed',
    // which silently let year-end proceed with missing grades (the UI also
    // rendered a locked '—' badge blocking entry). Now any non-dropped course
    // without a plannedGrade is incomplete.
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      if (queryIndex === 2) return Promise.resolve(resolve([{ gradeLevel: 10 }]));
      if (queryIndex === 3) return Promise.resolve(resolve([{ yearEndTransitionState: "completed", yearEndNextEligibleYear: 2026 }]));
      if (queryIndex === 4) return Promise.resolve(resolve([{ id: "plan-1" }]));
      if (queryIndex === 5) return Promise.resolve(resolve([
        { id: "pc-1", courseId: "c1", code: "MTH", name: "Math",      gradeLevel: 10, semester: 1, status: "completed", plannedGrade: "A", creditValue: "1.0" },
        { id: "pc-2", courseId: "c2", code: "ENG", name: "English",   gradeLevel: 10, semester: 1, status: "completed", plannedGrade: null, creditValue: "1.0" }, // ← bug case
        { id: "pc-3", courseId: "c3", code: "SCI", name: "Science",   gradeLevel: 10, semester: 1, status: "enrolled",  plannedGrade: null, creditValue: "1.0" },
        { id: "pc-4", courseId: "c4", code: "GPE", name: "PE",        gradeLevel: 10, semester: 1, status: "dropped",   plannedGrade: null, creditValue: "1.0" }, // excluded
      ]));
      if (queryIndex === 6) return Promise.resolve(resolve([]));
      return Promise.resolve(resolve([]));
    });

    const response = await GET(makeGetRequest());
    const body = await response.json();

    // Expect 2 incomplete: the completed-without-grade row AND the enrolled-without-grade row.
    // Dropped is excluded; completed-with-grade is excluded.
    expect(body.data.incompleteCount).toBe(2);
  });
});

describe("POST /api/v1/year-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
  });

  function mockAdvancingStudentChain(gradeLevel: number) {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      // Membership lookup
      if (queryIndex === 1) return Promise.resolve(resolve([{ accountId: "acc-1" }]));
      // Account lookup (gradeLevel + studentUserId)
      if (queryIndex === 2) return Promise.resolve(resolve([{ gradeLevel, studentUserId: TEST_USER.id }]));
      // Primary plan lookup
      if (queryIndex === 3) return Promise.resolve(resolve([{ id: "plan-1", lockedGradeLevels: [] }]));
      // Plan courses for grade updates (status transitions)
      if (queryIndex === 4) return Promise.resolve(resolve([]));
      return Promise.resolve(resolve(undefined));
    });
  }

  it("sets yearEndNextEligibleYear to next academic year for advancing students", async () => {
    // After completing a non-graduating year the banner must not re-fire in the
    // same May–Jul window. yearEndNextEligibleYear = currentAcademicYear + 1
    // gates the GET so it only returns "pending" once the following year arrives.
    mockCurrentAcademicYear.mockReturnValueOnce(2026);
    mockAdvancingStudentChain(10);

    const response = await POST(makePostRequest({ grades: [], action: "complete" }));
    expect(response.status).toBe(200);

    const transitionSet = mockSet.mock.calls.find(([arg]) =>
      arg && typeof arg === "object" && "yearEndTransitionState" in arg
    );
    expect(transitionSet).toBeDefined();
    expect(transitionSet![0].yearEndTransitionState).toBe("completed");
    expect(transitionSet![0].yearEndNextEligibleYear).toBe(2027);
  });

  it("keeps yearEndTransitionState as 'completed' and does not set nextEligibleYear for graduating students", async () => {
    // Grade 12 is terminal — no next year-end ever. yearEndNextEligibleYear
    // must NOT be set so the GET permanently suppresses the banner.
    mockAdvancingStudentChain(12);

    const response = await POST(makePostRequest({ grades: [], action: "complete" }));
    expect(response.status).toBe(200);

    const transitionSet = mockSet.mock.calls.find(([arg]) =>
      arg && typeof arg === "object" && "yearEndTransitionState" in arg
    );
    expect(transitionSet).toBeDefined();
    expect(transitionSet![0].yearEndTransitionState).toBe("completed");
    expect(transitionSet![0].yearEndNextEligibleYear).toBeUndefined();
  });
});
