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

import { validatePlanIntegrity, validateCourseAddition } from "@/lib/prereq/validator";

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

  it("respects prereqOverridden for enrollment_rule on full-year courses missing a half", async () => {
    // Full-year course present in Sem 1 but not Sem 2 — emits enrollment_rule.
    // When the row is overridden, that warning must end up in ignoredViolations
    // (regression: this used to push to violations unconditionally, so users
    // couldn't excuse the warning when they intentionally dropped half a year).
    const fullYearSem1Only = (overridden: boolean) => ({
      id: "pc-fy",
      courseId: "course-tec",
      gradeLevel: 9,
      semester: 1,
      status: "completed",
      prereqOverridden: overridden,
      course: {
        id: "course-tec",
        code: "TEC151/TEC152",
        name: "Intro to Engineering",
        duration: "full_year",
        gradeLevels: [9, 10, 11, 12],
        semestersOffered: [1, 2],
        catalogVersionId: "cv-1",
      },
    });

    queryQueue.push([fullYearSem1Only(false)]);
    queryQueue.push([]);
    let result = await validatePlanIntegrity("plan-1");
    expect(result.violations.some((v) => v.type === "enrollment_rule")).toBe(true);

    // Reset and try with override on
    queryQueue.push([fullYearSem1Only(true)]);
    queryQueue.push([]);
    result = await validatePlanIntegrity("plan-1");
    expect(result.violations.some((v) => v.type === "enrollment_rule")).toBe(false);
    expect(result.ignoredViolations.some((v) => v.type === "enrollment_rule")).toBe(true);
  });

  it("emits planCourseId on every violation so the planner can attribute by row", async () => {
    queryQueue.push([alg2Row(false)]);
    queryQueue.push([PREREQ_ROW]);

    const result = await validatePlanIntegrity("plan-1");

    const prereq = result.violations.find((v) => v.type === "prerequisite");
    expect(prereq?.planCourseId).toBe("pc-1");
  });

  it("respects prereqOverridden for corequisite violations", async () => {
    // Row with a corequisite that's not satisfied (the coreq isn't in the
    // plan in the same semester). When the row is overridden, the coreq
    // miss must end up in ignoredViolations.
    const row = (overridden: boolean) => ({
      ...alg2Row(overridden),
      gradeLevel: 10,
      semester: 1,
    });
    const COREQ_ROW = {
      courseId: ALG2_ID,
      prerequisiteId: "course-coreq",
      relationshipType: "corequisite",
      requirementGroup: 1,
      isRecommended: false,
      prereqCode: "PHY101",
      prereqName: "Physics 1",
    };

    queryQueue.push([row(false)]);
    queryQueue.push([COREQ_ROW]);
    let result = await validatePlanIntegrity("plan-1");
    expect(result.violations.some((v) => v.type === "corequisite")).toBe(true);

    queryQueue.push([row(true)]);
    queryQueue.push([COREQ_ROW]);
    result = await validatePlanIntegrity("plan-1");
    expect(result.violations.some((v) => v.type === "corequisite")).toBe(false);
    expect(result.ignoredViolations.some((v) => v.type === "corequisite")).toBe(true);
  });

  it("treats summer/regular equivalent as a satisfying prereq", async () => {
    // Regression: prior to defense-in-depth, the validator only matched
    // prereqs by exact course_id against the DAG. If the seed pipeline
    // hadn't fanned out a sibling edge (e.g. prod hadn't been re-seeded
    // since summer-equivalents.ts changed), placing SOC13S/SOC14S in
    // Gr 9 wouldn't satisfy SOC621/SOC622's SOC101/SOC102 prereq in Gr 11.
    // Now the validator also checks code-level equivalence as a fallback,
    // so either offering satisfies the requirement regardless of DAG state.
    const SOC621_ID = "course-soc621";
    const SOC101_ID = "course-soc101";
    const SOC13S_ID = "course-soc13s";

    const planRows = [
      {
        // Equivalent placed in Gr 9 — should satisfy the SOC101/SOC102 prereq.
        id: "pc-equiv",
        courseId: SOC13S_ID,
        gradeLevel: 9,
        semester: -1,
        status: "completed",
        prereqOverridden: false,
        course: {
          id: SOC13S_ID,
          code: "SOC13S/SOC14S",
          name: "World History and Geography",
          duration: "full_year",
          gradeLevels: [9, 10, 11, 12],
          semestersOffered: [-2, -1],
          catalogVersionId: "cv-1",
        },
      },
      {
        id: "pc-target",
        courseId: SOC621_ID,
        gradeLevel: 11,
        semester: 1,
        status: "planned",
        prereqOverridden: false,
        course: {
          id: SOC621_ID,
          code: "SOC621/SOC622",
          name: "AP U.S. History",
          duration: "full_year",
          gradeLevels: [11],
          semestersOffered: [1, 2],
          catalogVersionId: "cv-1",
        },
      },
    ];
    const PREREQ_EDGE_ONLY_REGULAR = {
      // The DAG only carries the regular-school-year edge — no sibling fanout.
      courseId: SOC621_ID,
      prerequisiteId: SOC101_ID,
      relationshipType: "prerequisite",
      requirementGroup: 1,
      isRecommended: false,
      prereqCode: "SOC101/SOC102",
      prereqName: "World History and Geography",
    };

    queryQueue.push(planRows);
    queryQueue.push([PREREQ_EDGE_ONLY_REGULAR]);

    const result = await validatePlanIntegrity("plan-1");

    expect(result.violations.filter((v) => v.type === "prerequisite")).toHaveLength(0);
    expect(result.ignoredViolations.filter((v) => v.type === "prerequisite")).toHaveLength(0);
  });

  it("treats a Mathematics summer/regular pair as equivalent (cross-family check)", async () => {
    // Locks in that the equivalence rule isn't SOC-specific. Picks the MTH
    // family to prove the same code path generalizes across every entry in
    // summer-equivalents.ts. If a future edit accidentally narrows the
    // resolver to one division, this test fails before the SOC test does.
    // Scenario: MTH15S/MTH16S (Algebra 1 summer) in Gr 9 satisfies the
    // MTH151/MTH152 prereq for MTH251/MTH252 (Algebra 2) in Gr 10.
    const ALG2_REG_ID = "course-mth251";
    const ALG1_REG_ID = "course-mth151";
    const ALG1_SUM_ID = "course-mth15s";

    const planRows = [
      {
        id: "pc-equiv",
        courseId: ALG1_SUM_ID,
        gradeLevel: 9,
        semester: -1,
        status: "completed",
        prereqOverridden: false,
        course: {
          id: ALG1_SUM_ID,
          code: "MTH15S/MTH16S",
          name: "Algebra 1",
          duration: "full_year",
          gradeLevels: [9, 10, 11, 12],
          semestersOffered: [-2, -1],
          catalogVersionId: "cv-1",
        },
      },
      {
        id: "pc-target",
        courseId: ALG2_REG_ID,
        gradeLevel: 10,
        semester: 1,
        status: "planned",
        prereqOverridden: false,
        course: {
          id: ALG2_REG_ID,
          code: "MTH251/MTH252",
          name: "Algebra 2",
          duration: "full_year",
          gradeLevels: [9, 10, 11, 12],
          semestersOffered: [1, 2],
          catalogVersionId: "cv-1",
        },
      },
    ];
    const REGULAR_ONLY_EDGE = {
      courseId: ALG2_REG_ID,
      prerequisiteId: ALG1_REG_ID,
      relationshipType: "prerequisite",
      requirementGroup: 1,
      isRecommended: false,
      prereqCode: "MTH151/MTH152",
      prereqName: "Algebra 1",
    };

    queryQueue.push(planRows);
    queryQueue.push([REGULAR_ONLY_EDGE]);

    const result = await validatePlanIntegrity("plan-1");

    expect(result.violations.filter((v) => v.type === "prerequisite")).toHaveLength(0);
  });

  it("still flags a prereq violation when no equivalent is in the plan", async () => {
    // Negative case: the equivalence check must not relax legitimate
    // violations. Same target row as above but no SOC13S/SOC14S in the plan.
    const SOC621_ID = "course-soc621";
    const SOC101_ID = "course-soc101";

    const planRows = [
      {
        id: "pc-target",
        courseId: SOC621_ID,
        gradeLevel: 11,
        semester: 1,
        status: "planned",
        prereqOverridden: false,
        course: {
          id: SOC621_ID,
          code: "SOC621/SOC622",
          name: "AP U.S. History",
          duration: "full_year",
          gradeLevels: [11],
          semestersOffered: [1, 2],
          catalogVersionId: "cv-1",
        },
      },
    ];
    const PREREQ_ROW_NO_MATCH = {
      courseId: SOC621_ID,
      prerequisiteId: SOC101_ID,
      relationshipType: "prerequisite",
      requirementGroup: 1,
      isRecommended: false,
      prereqCode: "SOC101/SOC102",
      prereqName: "World History and Geography",
    };

    queryQueue.push(planRows);
    queryQueue.push([PREREQ_ROW_NO_MATCH]);

    const result = await validatePlanIntegrity("plan-1");

    expect(result.violations.some((v) => v.type === "prerequisite")).toBe(true);
  });

  it("respects prereqOverridden for duplicate violations", async () => {
    // Two rows for the same course in the same cell — the validator emits a
    // duplicate violation from the alphabetically-earlier id only. Both
    // rows share prereqOverridden state here (reflects the bulk-override
    // behavior the planner uses for paired full-year rows).
    const dup = (overridden: boolean) => [
      {
        id: "pc-a", // earlier alphabetically — emits the violation
        courseId: ALG2_ID,
        gradeLevel: 10,
        semester: 1,
        status: "planned",
        prereqOverridden: overridden,
        course: {
          id: ALG2_ID,
          code: "MAT202",
          name: "Algebra 2",
          duration: "semester",
          gradeLevels: [10, 11],
          semestersOffered: [1, 2],
          catalogVersionId: "cv-1",
        },
      },
      {
        id: "pc-b",
        courseId: ALG2_ID,
        gradeLevel: 10,
        semester: 1,
        status: "planned",
        prereqOverridden: overridden,
        course: {
          id: ALG2_ID,
          code: "MAT202",
          name: "Algebra 2",
          duration: "semester",
          gradeLevels: [10, 11],
          semestersOffered: [1, 2],
          catalogVersionId: "cv-1",
        },
      },
    ];

    queryQueue.push(dup(false));
    queryQueue.push([]);
    let result = await validatePlanIntegrity("plan-1");
    expect(result.violations.some((v) => v.type === "duplicate")).toBe(true);

    queryQueue.push(dup(true));
    queryQueue.push([]);
    result = await validatePlanIntegrity("plan-1");
    expect(result.violations.some((v) => v.type === "duplicate")).toBe(false);
    expect(result.ignoredViolations.some((v) => v.type === "duplicate")).toBe(true);
  });
});

describe("validateCourseAddition — summer/regular equivalent satisfies prereq", () => {
  // Same equivalence rule as validatePlanIntegrity, but applied at the
  // add-gate (before the row exists). Three queries fire in this path:
  //   1. SELECT target course
  //   2. SELECT existing plan_courses + courses
  //   3. SELECT course_prerequisites + courses (target's prereqs)
  // Drive them via the same queue-based mock.

  const SOC621_ID = "course-soc621";
  const SOC101_ID = "course-soc101";
  const SOC13S_ID = "course-soc13s";

  const targetCourse = {
    id: SOC621_ID,
    code: "SOC621/SOC622",
    name: "AP U.S. History",
    duration: "full_year",
    creditType: "AP",
    gradeLevels: [11],
    semestersOffered: [1, 2],
    catalogVersionId: "cv-1",
  };

  const equivalentInGr9 = {
    id: "pc-equiv",
    courseId: SOC13S_ID,
    gradeLevel: 9,
    semester: -1,
    status: "completed",
    course: {
      id: SOC13S_ID,
      code: "SOC13S/SOC14S",
      name: "World History and Geography",
      duration: "full_year",
      gradeLevels: [9, 10, 11, 12],
      semestersOffered: [-2, -1],
      catalogVersionId: "cv-1",
    },
  };

  const prereqEdgeRegularOnly = {
    prerequisiteId: SOC101_ID,
    relationshipType: "prerequisite",
    requirementGroup: 1,
    isRecommended: false,
    minimumGrade: null,
    prereqCode: "SOC101/SOC102",
    prereqName: "World History and Geography",
  };

  beforeEach(() => {
    dbChain = makeChain();
    queryQueue = [];
  });

  it("accepts the add when an equivalent is in the plan at an earlier slot", async () => {
    queryQueue.push([targetCourse]); // 1. target course
    queryQueue.push([equivalentInGr9]); // 2. existing plan courses
    queryQueue.push([prereqEdgeRegularOnly]); // 3. target's prereqs (regular-edge only)

    const result = await validateCourseAddition("plan-1", SOC621_ID, 11, 1);

    expect(result.violations.filter((v) => v.type === "prerequisite")).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it("flags the add when no equivalent is in the plan", async () => {
    queryQueue.push([targetCourse]);
    queryQueue.push([]); // empty plan
    queryQueue.push([prereqEdgeRegularOnly]);

    const result = await validateCourseAddition("plan-1", SOC621_ID, 11, 1);

    expect(result.valid).toBe(false);
    const prereq = result.violations.find((v) => v.type === "prerequisite");
    expect(prereq?.courseCode).toBe("SOC621/SOC622");
    expect(prereq?.details?.missingPrerequisites?.[0]?.code).toBe("SOC101/SOC102");
  });

  it("does not double-count: the equivalent in plan should not also trigger a duplicate violation", async () => {
    // Defensive: SOC13S/SOC14S sharing a NAME ("World History and Geography")
    // with the SOC101/SOC102 prereq must not surface as a semester-partner
    // duplicate when SOC621/SOC622 is the course being added. Different
    // target name ("AP U.S. History"), so no partner check fires — but the
    // assertion locks the behavior in.
    queryQueue.push([targetCourse]);
    queryQueue.push([equivalentInGr9]);
    queryQueue.push([prereqEdgeRegularOnly]);

    const result = await validateCourseAddition("plan-1", SOC621_ID, 11, 1);

    expect(result.violations.filter((v) => v.type === "duplicate")).toHaveLength(0);
  });
});
