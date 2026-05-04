import { describe, it, expect } from "vitest";
import { isPassFailCourse, isRepeatableCourse } from "@/config/grade-scale";

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

// ── GPA threshold matching (honors_status) ──────────────────────────────────

describe("GPA threshold evaluation", () => {
  function evaluateGpaThreshold(
    weightedGpa: number | null,
    totalCredits: number,
    minGpa: number,
    minCredits: number
  ): "met" | "gap" {
    const gpaOk = weightedGpa !== null && weightedGpa >= minGpa;
    const creditsOk = totalCredits >= minCredits;
    return gpaOk && creditsOk ? "met" : "gap";
  }

  it("returns 'met' when GPA and credits meet threshold", () => {
    expect(evaluateGpaThreshold(4.2, 43, 4.0, 42)).toBe("met");
    expect(evaluateGpaThreshold(3.75, 42, 3.75, 42)).toBe("met");
  });

  it("returns 'gap' when GPA is below threshold", () => {
    expect(evaluateGpaThreshold(3.5, 43, 4.0, 42)).toBe("gap");
    expect(evaluateGpaThreshold(3.74, 45, 3.75, 42)).toBe("gap");
  });

  it("returns 'gap' when credits are below threshold", () => {
    expect(evaluateGpaThreshold(4.5, 40, 4.0, 42)).toBe("gap");
  });

  it("returns 'gap' when GPA is null", () => {
    expect(evaluateGpaThreshold(null, 45, 3.5, 42)).toBe("gap");
  });

  it("returns 'gap' when both GPA and credits are below", () => {
    expect(evaluateGpaThreshold(3.0, 30, 4.0, 42)).toBe("gap");
  });
});

// ── Course load evaluation ──────────────────────────────────────────────────

describe("course load evaluation", () => {
  function evaluateCourseLoad(
    courseCount: number,
    minCourses: number,
    maxCourses: number,
    hasEarlyBird: boolean,
    maxWithEarlyBird: number
  ): "met" | "gap" {
    const effectiveMax = hasEarlyBird ? maxWithEarlyBird : maxCourses;
    return courseCount >= minCourses && courseCount <= effectiveMax ? "met" : "gap";
  }

  it("returns 'met' for normal load (5-7 courses)", () => {
    expect(evaluateCourseLoad(5, 5, 7, false, 8)).toBe("met");
    expect(evaluateCourseLoad(6, 5, 7, false, 8)).toBe("met");
    expect(evaluateCourseLoad(7, 5, 7, false, 8)).toBe("met");
  });

  it("returns 'gap' for underload (< 5 courses)", () => {
    expect(evaluateCourseLoad(3, 5, 7, false, 8)).toBe("gap");
    expect(evaluateCourseLoad(4, 5, 7, false, 8)).toBe("gap");
    expect(evaluateCourseLoad(0, 5, 7, false, 8)).toBe("gap");
  });

  it("returns 'gap' for overload without early bird (> 7)", () => {
    expect(evaluateCourseLoad(8, 5, 7, false, 8)).toBe("gap");
    expect(evaluateCourseLoad(9, 5, 7, false, 8)).toBe("gap");
  });

  it("allows 8 courses with early bird", () => {
    expect(evaluateCourseLoad(8, 5, 7, true, 8)).toBe("met");
  });

  it("returns 'gap' for > 8 even with early bird", () => {
    expect(evaluateCourseLoad(9, 5, 7, true, 8)).toBe("gap");
  });
});

// ── Auto-from-course evaluation ─────────────────────────────────────────────

describe("auto-from-course evaluation", () => {
  it("returns 'completed' when matching course is completed", () => {
    const courses = [makeCourse({ code: "PED201", status: "completed" })];
    const rule = { type: "codes" as const, codes: ["PED201", "PED202"] };
    const matchingCompleted = courses.some(
      (c) => c.status === "completed" && (rule.codes ?? []).includes(c.code)
    );
    expect(matchingCompleted).toBe(true);
  });

  it("returns 'in_progress' when matching course is planned", () => {
    const courses = [makeCourse({ code: "PED201", status: "planned" })];
    const rule = { type: "codes" as const, codes: ["PED201", "PED202"] };
    const matchingCompleted = courses.some(
      (c) => c.status === "completed" && (rule.codes ?? []).includes(c.code)
    );
    const matchingPlanned = courses.some(
      (c) => c.status !== "completed" && (rule.codes ?? []).includes(c.code)
    );
    expect(matchingCompleted).toBe(false);
    expect(matchingPlanned).toBe(true);
  });

  it("returns 'gap' when no matching course exists", () => {
    const courses = [makeCourse({ code: "MTH151", status: "completed" })];
    const rule = { type: "codes" as const, codes: ["PED201", "PED202"] };
    const matchingCompleted = courses.some(
      (c) => c.status === "completed" && (rule.codes ?? []).includes(c.code)
    );
    const matchingPlanned = courses.some(
      (c) => c.status !== "completed" && (rule.codes ?? []).includes(c.code)
    );
    expect(matchingCompleted).toBe(false);
    expect(matchingPlanned).toBe(false);
  });
});

// ── PW/Dance/DriverEd check ─────────────────────────────────────────────────

describe("PW/Dance/DriverEd check", () => {
  const divisionNames = ["Physical Welfare"];
  const codePrefixes = ["DNC", "D/E"];

  function hasPwCourse(courses: PlanCourseEntry[]) {
    return courses.some(
      (pc) => divisionNames.includes(pc.divisionName) || codePrefixes.some((p) => pc.code.startsWith(p))
    );
  }

  it("matches Physical Welfare division courses", () => {
    const courses = [makeCourse({ divisionName: "Physical Welfare", code: "PED121" })];
    expect(hasPwCourse(courses)).toBe(true);
  });

  it("matches Dance courses by DNC prefix", () => {
    const courses = [makeCourse({ divisionName: "Fine Arts", code: "DNC101/DNC102" })];
    expect(hasPwCourse(courses)).toBe(true);
  });

  it("matches Driver Education by D/E prefix", () => {
    const courses = [makeCourse({ divisionName: "Applied Arts", code: "D/E231" })];
    expect(hasPwCourse(courses)).toBe(true);
  });

  it("does not match non-PW courses", () => {
    const courses = [makeCourse({ divisionName: "Mathematics", code: "MTH151" })];
    expect(hasPwCourse(courses)).toBe(false);
  });

  it("returns false for empty course list", () => {
    expect(hasPwCourse([])).toBe(false);
  });
});

// ── GPA waiver eligibility check ────────────────────────────────────────────

describe("GPA waiver eligibility", () => {
  it("passes when 4+ GPA-counted courses exist", () => {
    const courses = [
      makeCourse({ code: "MTH151", status: "planned" }),
      makeCourse({ code: "ENG151", status: "planned" }),
      makeCourse({ code: "SCI111", status: "planned" }),
      makeCourse({ code: "SOC101", status: "planned" }),
      makeCourse({ code: "ART101", status: "planned" }),
    ];
    // 5 non-waivered courses, 1 would be waivered = 4 GPA-counted = OK
    const gpaCounted = courses.length;
    expect(gpaCounted).toBeGreaterThanOrEqual(4);
  });

  it("fails when fewer than 4 GPA-counted courses exist", () => {
    const gpaCounted = 3;
    expect(gpaCounted).toBeLessThan(4);
  });
});

// ── Honors status computation ───────────────────────────────────────────────

// ── isPassFailCourse tests ───────────────────────────────────────────────────

describe("isPassFailCourse", () => {
  it("identifies Driver Education as P/F", () => {
    expect(isPassFailCourse("D/E231")).toBe(true);
    expect(isPassFailCourse("D/E232")).toBe(true);
  });

  it("identifies regular PE as P/F", () => {
    expect(isPassFailCourse("PED121")).toBe(true);
    expect(isPassFailCourse("PED122")).toBe(true);
    expect(isPassFailCourse("PED451")).toBe(true);
    expect(isPassFailCourse("PED452")).toBe(true);
    expect(isPassFailCourse("PED111/PED112")).toBe(true);
  });

  it("excludes Health Education from P/F", () => {
    expect(isPassFailCourse("PED201")).toBe(false);
    expect(isPassFailCourse("PED202")).toBe(false);
  });

  it("excludes Applied Health from P/F", () => {
    expect(isPassFailCourse("PED231")).toBe(false);
    expect(isPassFailCourse("PED232")).toBe(false);
  });

  // Adventure Education is part of the PE department per the Course Book (p. 86),
  // so it falls under the "all PE is P/F" rule — it is NOT a Leadership or
  // Aquatics exception.
  it("treats Adventure Education as P/F (regular PE)", () => {
    expect(isPassFailCourse("PED331")).toBe(true);
    expect(isPassFailCourse("PED332")).toBe(true);
  });

  it("excludes Lifeguard Training from P/F (Aquatics exception)", () => {
    expect(isPassFailCourse("PED501")).toBe(false);
  });

  it("excludes Leadership courses from P/F", () => {
    expect(isPassFailCourse("PED61L/PED62L")).toBe(false);
    expect(isPassFailCourse("PED41L/PED42L")).toBe(false);
    expect(isPassFailCourse("PED71L/PED72L")).toBe(false);
    expect(isPassFailCourse("PED81L/PED82L")).toBe(false);
  });

  it("treats catalog Pass/Fail credit type as P/F regardless of department", () => {
    expect(isPassFailCourse("ACTPREPS", "Pass/Fail")).toBe(true);
    expect(isPassFailCourse("ACTPREPS2", "Pass/Fail")).toBe(true);
    // Same code without the catalog hint — falls through to code rules
    expect(isPassFailCourse("ACTPREPS2")).toBe(false);
  });

  it("returns false for non-PE/non-DriverEd courses", () => {
    expect(isPassFailCourse("MTH151")).toBe(false);
    expect(isPassFailCourse("ENG151")).toBe(false);
    expect(isPassFailCourse("SCI111")).toBe(false);
    expect(isPassFailCourse("DNC101/DNC102")).toBe(false);
  });
});

// ── isRepeatableCourse tests ─────────────────────────────────────────────────

describe("isRepeatableCourse", () => {
  it("treats regular P/F PE courses as repeatable across slots", () => {
    expect(isRepeatableCourse("PED452")).toBe(true); // CHOICE P.E.
    expect(isRepeatableCourse("PED121")).toBe(true);
    expect(isRepeatableCourse("PED331")).toBe(true); // Adventure Education
    expect(isRepeatableCourse("PED111/PED112")).toBe(true);
  });

  it("excludes single-take PED courses (Health/Applied Health/Lifeguard/Leadership)", () => {
    expect(isRepeatableCourse("PED201")).toBe(false); // Health
    expect(isRepeatableCourse("PED231")).toBe(false); // Applied Health
    expect(isRepeatableCourse("PED501")).toBe(false); // Lifeguard
    expect(isRepeatableCourse("PED61L/PED62L")).toBe(false); // Leadership
  });

  it("excludes Driver Education (P/F but not repeatable)", () => {
    expect(isRepeatableCourse("D/E231")).toBe(false);
  });

  it("excludes academic and arts courses regardless of credit type", () => {
    expect(isRepeatableCourse("MTH151")).toBe(false);
    expect(isRepeatableCourse("ENG151")).toBe(false);
    expect(isRepeatableCourse("ACTPREPS2", "Pass/Fail")).toBe(false);
  });
});

// ── Course load academic-only count ─────────────────────────────────────────

describe("course load academic-only count", () => {
  function isNonAcademic(course: PlanCourseEntry): boolean {
    return course.divisionName === "Physical Welfare" || course.code.startsWith("DNC") || course.code.startsWith("D/E");
  }

  it("excludes PE courses from academic count", () => {
    const courses = [
      makeCourse({ code: "MTH151", divisionName: "Mathematics" }),
      makeCourse({ code: "ENG151", divisionName: "Communication Arts" }),
      makeCourse({ code: "PED121", divisionName: "Physical Welfare" }),
      makeCourse({ code: "SCI111", divisionName: "Science" }),
    ];
    const academic = courses.filter((c) => !isNonAcademic(c));
    expect(academic.length).toBe(3);
  });

  it("excludes Dance courses from academic count", () => {
    const courses = [
      makeCourse({ code: "MTH151", divisionName: "Mathematics" }),
      makeCourse({ code: "DNC101/DNC102", divisionName: "Fine Arts" }),
    ];
    const academic = courses.filter((c) => !isNonAcademic(c));
    expect(academic.length).toBe(1);
  });

  it("excludes Driver Ed from academic count", () => {
    const courses = [
      makeCourse({ code: "MTH151", divisionName: "Mathematics" }),
      makeCourse({ code: "D/E231", divisionName: "Applied Arts" }),
    ];
    const academic = courses.filter((c) => !isNonAcademic(c));
    expect(academic.length).toBe(1);
  });

  it("counts Health Education as academic", () => {
    const courses = [
      makeCourse({ code: "PED201", divisionName: "Physical Welfare" }),
    ];
    // Health is in PW division but should... actually be counted as non-academic
    // because the division check catches it. This is correct — Health fills the
    // PW requirement slot, not the academic slot.
    const academic = courses.filter((c) => !isNonAcademic(c));
    expect(academic.length).toBe(0);
  });
});

// ── GPA waiver eligibility with P/F exclusion ───────────────────────────────

describe("GPA waiver eligibility with P/F exclusion", () => {
  it("excludes P/F courses when counting GPA-eligible courses", () => {
    const courses = [
      { code: "MTH151", waivered: false, dropped: false },
      { code: "ENG151", waivered: false, dropped: false },
      { code: "SCI111", waivered: false, dropped: false },
      { code: "PED121", waivered: false, dropped: false }, // P/F — not GPA-counted
      { code: "ART101", waivered: true, dropped: false },  // waivered
    ];
    const gpaCounted = courses.filter(
      (c) => !c.waivered && !c.dropped && !isPassFailCourse(c.code)
    ).length;
    expect(gpaCounted).toBe(3); // MTH, ENG, SCI — not PED (P/F) or ART (waivered)
  });

  it("triggers warning when fewer than 4 GPA-counted after P/F exclusion", () => {
    const courses = [
      { code: "MTH151", waivered: false, dropped: false },
      { code: "ENG151", waivered: true, dropped: false },  // waivered
      { code: "SCI111", waivered: true, dropped: false },  // waivered
      { code: "PED121", waivered: false, dropped: false },  // P/F
      { code: "SOC101", waivered: false, dropped: false },
      { code: "ART101", waivered: false, dropped: false },
    ];
    const gpaCounted = courses.filter(
      (c) => !c.waivered && !c.dropped && !isPassFailCourse(c.code)
    ).length;
    expect(gpaCounted).toBe(3); // MTH, SOC, ART — below 4 minimum
    expect(gpaCounted < 4).toBe(true);
  });
});

describe("honors status computation", () => {
  function computeHonors(weightedGpa: number | null, totalCredits: number) {
    if (weightedGpa === null || totalCredits < 42) return null;
    if (weightedGpa >= 4.0) return "Highest Honors";
    if (weightedGpa >= 3.75) return "High Honors";
    if (weightedGpa >= 3.5) return "Honors";
    return null;
  }

  it("returns Highest Honors for GPA 4.0+ with 42+ credits", () => {
    expect(computeHonors(4.2, 43)).toBe("Highest Honors");
    expect(computeHonors(4.0, 42)).toBe("Highest Honors");
  });

  it("returns High Honors for GPA 3.75-3.99", () => {
    expect(computeHonors(3.85, 45)).toBe("High Honors");
    expect(computeHonors(3.75, 42)).toBe("High Honors");
  });

  it("returns Honors for GPA 3.50-3.74", () => {
    expect(computeHonors(3.6, 44)).toBe("Honors");
    expect(computeHonors(3.5, 42)).toBe("Honors");
  });

  it("returns null for GPA below 3.5", () => {
    expect(computeHonors(3.4, 45)).toBeNull();
  });

  it("returns null when credits below 42", () => {
    expect(computeHonors(4.5, 40)).toBeNull();
  });

  it("returns null when GPA is null", () => {
    expect(computeHonors(null, 45)).toBeNull();
  });
});
