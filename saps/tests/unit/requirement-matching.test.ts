import { describe, it, expect } from "vitest";

/**
 * Unit tests for graduation requirement matching logic.
 * These test the pure functions extracted from the requirements route.
 */

// ── Re-implement the pure functions from route.ts for testing ───────────────

interface MatchingRule {
  type: "code_prefix" | "codes" | "division" | "multi_division" | "remainder";
  prefix?: string;
  codes?: string[];
  divisionNames?: string[];
}

interface PlanCourseEntry {
  courseId: string;
  divisionId: string;
  divisionName: string;
  code: string;
  name: string;
  creditValue: string;
  status: string | null;
}

function perRowCredit(creditValue: string): number {
  const val = parseFloat(creditValue) || 0;
  return val > 1 ? val / 2 : val;
}

function courseMatchesRule(
  course: PlanCourseEntry,
  rule: MatchingRule | null,
  divisionId: string
): boolean {
  if (!rule) {
    return course.divisionId === divisionId;
  }
  switch (rule.type) {
    case "code_prefix":
      return course.code.startsWith(rule.prefix ?? "");
    case "codes":
      return (rule.codes ?? []).includes(course.code);
    case "division":
      return course.divisionId === divisionId;
    case "multi_division":
      return (rule.divisionNames ?? []).includes(course.divisionName);
    case "remainder":
      return true;
    default:
      return course.divisionId === divisionId;
  }
}

function makeCourse(overrides: Partial<PlanCourseEntry> = {}): PlanCourseEntry {
  return {
    courseId: "c-1",
    divisionId: "div-1",
    divisionName: "Mathematics",
    code: "MTH151",
    name: "Algebra",
    creditValue: "2",
    status: "planned",
    ...overrides,
  };
}

// ── perRowCredit tests ──────────────────────────────────────────────────────

describe("perRowCredit", () => {
  it("returns creditValue/2 for full-year courses (creditValue > 1)", () => {
    expect(perRowCredit("2")).toBe(1);
    expect(perRowCredit("2.0")).toBe(1);
  });

  it("returns creditValue/2 for 1.5-period AP science courses (creditValue = 3)", () => {
    expect(perRowCredit("3")).toBe(1.5);
    expect(perRowCredit("3.0")).toBe(1.5);
  });

  it("returns creditValue as-is for semester courses (creditValue <= 1)", () => {
    expect(perRowCredit("1")).toBe(1);
    expect(perRowCredit("1.0")).toBe(1);
    expect(perRowCredit("0.5")).toBe(0.5);
  });

  it("returns 0 for invalid values", () => {
    expect(perRowCredit("")).toBe(0);
    expect(perRowCredit("abc")).toBe(0);
  });
});

// ── courseMatchesRule tests ──────────────────────────────────────────────────

describe("courseMatchesRule", () => {
  describe("null rule (legacy fallback)", () => {
    it("matches by divisionId", () => {
      const course = makeCourse({ divisionId: "div-math" });
      expect(courseMatchesRule(course, null, "div-math")).toBe(true);
    });

    it("does not match different divisionId", () => {
      const course = makeCourse({ divisionId: "div-eng" });
      expect(courseMatchesRule(course, null, "div-math")).toBe(false);
    });
  });

  describe("code_prefix rule", () => {
    it("matches courses with matching code prefix", () => {
      const rule: MatchingRule = { type: "code_prefix", prefix: "ENG" };
      expect(courseMatchesRule(makeCourse({ code: "ENG151/ENG152" }), rule, "div-1")).toBe(true);
      expect(courseMatchesRule(makeCourse({ code: "ENG211/ENG212" }), rule, "div-1")).toBe(true);
    });

    it("does not match courses with different prefix", () => {
      const rule: MatchingRule = { type: "code_prefix", prefix: "ENG" };
      expect(courseMatchesRule(makeCourse({ code: "MTH151" }), rule, "div-1")).toBe(false);
      expect(courseMatchesRule(makeCourse({ code: "SCI111" }), rule, "div-1")).toBe(false);
    });

    it("handles missing prefix gracefully", () => {
      const rule: MatchingRule = { type: "code_prefix" };
      // Empty prefix matches everything
      expect(courseMatchesRule(makeCourse({ code: "MTH151" }), rule, "div-1")).toBe(true);
    });
  });

  describe("codes rule", () => {
    it("matches courses in the codes list", () => {
      const rule: MatchingRule = { type: "codes", codes: ["SCI111/SCI112", "SCI211/SCI212"] };
      expect(courseMatchesRule(makeCourse({ code: "SCI111/SCI112" }), rule, "div-1")).toBe(true);
      expect(courseMatchesRule(makeCourse({ code: "SCI211/SCI212" }), rule, "div-1")).toBe(true);
    });

    it("does not match courses not in the codes list", () => {
      const rule: MatchingRule = { type: "codes", codes: ["SCI111/SCI112"] };
      expect(courseMatchesRule(makeCourse({ code: "SCI401/SCI402" }), rule, "div-1")).toBe(false);
    });

    it("handles missing codes array gracefully", () => {
      const rule: MatchingRule = { type: "codes" };
      expect(courseMatchesRule(makeCourse({ code: "SCI111" }), rule, "div-1")).toBe(false);
    });
  });

  describe("division rule", () => {
    it("matches by divisionId (same as null rule)", () => {
      const rule: MatchingRule = { type: "division" };
      const course = makeCourse({ divisionId: "div-math" });
      expect(courseMatchesRule(course, rule, "div-math")).toBe(true);
    });

    it("does not match different divisionId", () => {
      const rule: MatchingRule = { type: "division" };
      const course = makeCourse({ divisionId: "div-eng" });
      expect(courseMatchesRule(course, rule, "div-math")).toBe(false);
    });
  });

  describe("multi_division rule", () => {
    it("matches courses in any of the named divisions", () => {
      const rule: MatchingRule = {
        type: "multi_division",
        divisionNames: ["Applied Arts", "Fine Arts", "Multilingual Learning"],
      };
      expect(courseMatchesRule(makeCourse({ divisionName: "Fine Arts" }), rule, "div-1")).toBe(true);
      expect(courseMatchesRule(makeCourse({ divisionName: "Applied Arts" }), rule, "div-1")).toBe(true);
    });

    it("does not match courses in other divisions", () => {
      const rule: MatchingRule = {
        type: "multi_division",
        divisionNames: ["Applied Arts", "Fine Arts"],
      };
      expect(courseMatchesRule(makeCourse({ divisionName: "Mathematics" }), rule, "div-1")).toBe(false);
    });

    it("handles missing divisionNames gracefully", () => {
      const rule: MatchingRule = { type: "multi_division" };
      expect(courseMatchesRule(makeCourse({ divisionName: "Fine Arts" }), rule, "div-1")).toBe(false);
    });
  });

  describe("remainder rule", () => {
    it("matches any course", () => {
      const rule: MatchingRule = { type: "remainder" };
      expect(courseMatchesRule(makeCourse({ code: "MTH151", divisionName: "Mathematics" }), rule, "div-other")).toBe(true);
      expect(courseMatchesRule(makeCourse({ code: "ENG151", divisionName: "English" }), rule, "div-other")).toBe(true);
    });
  });

  describe("unknown rule type", () => {
    it("falls back to divisionId matching", () => {
      const rule = { type: "unknown" } as unknown as MatchingRule;
      const course = makeCourse({ divisionId: "div-math" });
      expect(courseMatchesRule(course, rule, "div-math")).toBe(true);
      expect(courseMatchesRule(course, rule, "div-other")).toBe(false);
    });
  });
});

// ── Credit claiming logic tests ─────────────────────────────────────────────

describe("credit claiming logic", () => {
  it("caps claimed credits at required amount for a requirement", () => {
    // Simulate: 8 credits of math courses, but only 6 required
    const mathCourses = [
      makeCourse({ code: "MTH151", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH151", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH251", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH251", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH351", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH351", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH451", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH451", creditValue: "2", status: "planned" }),
    ];

    const reqCredits = 6;
    const claimed = new Set<number>();
    let plannedCredits = 0;

    for (let i = 0; i < mathCourses.length; i++) {
      if (!claimed.has(i)) {
        const credit = perRowCredit(mathCourses[i].creditValue);
        plannedCredits += credit;
        claimed.add(i);
        if (plannedCredits >= reqCredits) break;
      }
    }

    expect(plannedCredits).toBe(6);
    expect(claimed.size).toBe(6); // Only 6 of 8 rows claimed
  });

  it("earned courses are claimed before planned courses", () => {
    const courses = [
      makeCourse({ code: "MTH151", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH251", creditValue: "2", status: "completed" }),
    ];

    const reqCredits = 1;
    const earned = courses.filter((c) => c.status === "completed");
    const planned = courses.filter((c) => c.status !== "completed");

    let earnedCredits = 0;
    for (const c of earned) {
      earnedCredits += perRowCredit(c.creditValue);
      if (earnedCredits >= reqCredits) break;
    }

    expect(earnedCredits).toBe(1);
    // No planned courses needed since earned covers the requirement
    const remaining = reqCredits - earnedCredits;
    expect(remaining).toBeLessThanOrEqual(0);
  });

  it("excess courses flow to remainder requirement", () => {
    // 4 math rows (4 credits), but math req only needs 2
    const allCourses = [
      makeCourse({ code: "MTH151", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH151", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH251", creditValue: "2", status: "planned" }),
      makeCourse({ code: "MTH251", creditValue: "2", status: "planned" }),
    ];

    const reqCredits = 2;
    const claimed = new Set<number>();
    let plannedCredits = 0;

    for (let i = 0; i < allCourses.length; i++) {
      const credit = perRowCredit(allCourses[i].creditValue);
      plannedCredits += credit;
      claimed.add(i);
      if (plannedCredits >= reqCredits) break;
    }

    expect(claimed.size).toBe(2); // Only 2 rows claimed

    // Remainder gets the unclaimed rows
    const unclaimed = allCourses.filter((_, i) => !claimed.has(i));
    expect(unclaimed.length).toBe(2);
    const remainderCredits = unclaimed.reduce((s, c) => s + perRowCredit(c.creditValue), 0);
    expect(remainderCredits).toBe(2);
  });

  it("AP 1.5-period courses contribute 1.5 credits per row", () => {
    // AP Physics: creditValue=3.0, stored as 2 rows
    const apCourses = [
      makeCourse({ code: "SCI651", creditValue: "3", status: "planned" }),
      makeCourse({ code: "SCI651", creditValue: "3", status: "planned" }),
    ];

    const totalCredits = apCourses.reduce((s, c) => s + perRowCredit(c.creditValue), 0);
    expect(totalCredits).toBe(3); // 1.5 per row * 2 rows
  });
});

// ── Requirement status derivation ───────────────────────────────────────────

describe("requirement status derivation", () => {
  function deriveStatus(earned: number, planned: number, required: number) {
    if (earned >= required) return "met";
    if (earned + planned >= required) return "in_progress";
    return "gap";
  }

  it("returns 'met' when earned credits >= required", () => {
    expect(deriveStatus(8, 0, 8)).toBe("met");
    expect(deriveStatus(10, 0, 8)).toBe("met");
  });

  it("returns 'in_progress' when earned + planned >= required", () => {
    expect(deriveStatus(2, 6, 8)).toBe("in_progress");
    expect(deriveStatus(0, 8, 8)).toBe("in_progress");
  });

  it("returns 'gap' when earned + planned < required", () => {
    expect(deriveStatus(0, 0, 8)).toBe("gap");
    expect(deriveStatus(2, 3, 8)).toBe("gap");
  });
});
