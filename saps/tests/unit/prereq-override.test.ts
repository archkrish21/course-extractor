import { describe, it, expect, vi, beforeEach } from "vitest";

// Two query chains in validatePlanIntegrity:
//   1. SELECT plan_courses + courses (plan rows)
//   2. SELECT course_prerequisites + courses (prereq rows)
// Drive them sequentially via a queue.

let queryQueue: unknown[][] = [];

function makeChain() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.then = vi.fn((resolve: (v: unknown) => unknown) => {
    const next = queryQueue.shift() ?? [];
    return Promise.resolve(resolve(next));
  });
  return chain;
}

let dbChain = makeChain();

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) => (dbChain as Record<string, unknown>)[prop as string],
    }
  ),
}));

vi.mock("@/lib/db/schema", () => ({
  planCourses: {
    id: "pc_id",
    planId: "pc_planId",
    courseId: "pc_courseId",
    gradeLevel: "pc_gradeLevel",
    semester: "pc_semester",
    status: "pc_status",
    prereqOverridden: "pc_prereqOverridden",
  },
  courses: {
    id: "c_id",
    code: "c_code",
    name: "c_name",
    duration: "c_duration",
    gradeLevels: "c_gradeLevels",
    semestersOffered: "c_semestersOffered",
    catalogVersionId: "c_catalogVersionId",
  },
  coursePrerequisites: {
    courseId: "cpr_courseId",
    prerequisiteId: "cpr_prerequisiteId",
    relationshipType: "cpr_relationshipType",
    requirementGroup: "cpr_requirementGroup",
    isRecommended: "cpr_isRecommended",
  },
  fourYearPlans: { id: "fyp_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  sql: Object.assign(
    (strings: TemplateStringsArray) => ({ type: "sql", strings }),
    { raw: vi.fn() }
  ),
}));

import { validatePlanIntegrity } from "@/lib/prereq/validator";

const ALG1_ID = "course-alg1";
const ALG2_ID = "course-alg2";

function alg2Row(prereqOverridden: boolean) {
  return {
    id: "pc-1",
    courseId: ALG2_ID,
    gradeLevel: 10, // matches course.gradeLevels — no grade_level violation
    semester: 1,
    status: "planned",
    prereqOverridden,
    course: {
      id: ALG2_ID,
      code: "MAT202",
      name: "Algebra 2",
      duration: "semester",
      gradeLevels: [10, 11], // Algebra 2 is not normally a Gr 9 course
      semestersOffered: [1, 2],
      catalogVersionId: "cv-1",
    },
  };
}

const PREREQ_ROW = {
  courseId: ALG2_ID,
  prerequisiteId: ALG1_ID,
  relationshipType: "prerequisite",
  requirementGroup: 1,
  isRecommended: false,
  prereqCode: "MAT201",
  prereqName: "Algebra 1",
};

describe("validatePlanIntegrity — prereq override", () => {
  beforeEach(() => {
    dbChain = makeChain();
    queryQueue = [];
  });

  it("flags a prereq violation when the row is not overridden", async () => {
    queryQueue.push([alg2Row(false)]); // plan_courses query
    queryQueue.push([PREREQ_ROW]); // prereqs query

    const result = await validatePlanIntegrity("plan-1");

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === "prerequisite")).toBe(true);
  });

  it("moves the prereq violation into ignoredViolations when prereqOverridden is true", async () => {
    queryQueue.push([alg2Row(true)]);
    queryQueue.push([PREREQ_ROW]);

    const result = await validatePlanIntegrity("plan-1");

    expect(result.violations.filter((v) => v.type === "prerequisite")).toHaveLength(0);
    expect(result.ignoredViolations.filter((v) => v.type === "prerequisite")).toHaveLength(1);
  });

  it("flags a grade-level violation when the row is not overridden", async () => {
    const offGradeRow = {
      ...alg2Row(false),
      gradeLevel: 9, // 9 is not in course.gradeLevels [10, 11] → grade_level violation
    };
    queryQueue.push([offGradeRow]);
    queryQueue.push([]); // no prereqs for this scenario

    const result = await validatePlanIntegrity("plan-1");

    expect(result.violations.some((v) => v.type === "grade_level")).toBe(true);
  });

  it("moves the grade-level violation into ignoredViolations when prereqOverridden is true", async () => {
    const offGradeRow = {
      ...alg2Row(true),
      gradeLevel: 9,
    };
    queryQueue.push([offGradeRow]);
    queryQueue.push([]);

    const result = await validatePlanIntegrity("plan-1");

    expect(result.violations.some((v) => v.type === "grade_level")).toBe(false);
    expect(result.ignoredViolations.some((v) => v.type === "grade_level")).toBe(true);
  });
});
