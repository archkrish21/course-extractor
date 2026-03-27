import { describe, it, expect } from "vitest";
import { calculateGPA, formatGPA } from "@/lib/gpa/calc";

// Helper to build a course entry quickly
function makeCourse(overrides: {
  creditValue?: string;
  creditType?: string;
  plannedGrade?: string | null;
  status?: "planned" | "enrolled" | "completed" | "dropped";
  gpaWaiver?: boolean;
}) {
  return {
    creditValue: overrides.creditValue ?? "1",
    creditType: overrides.creditType ?? "CP",
    plannedGrade: overrides.plannedGrade ?? null,
    status: overrides.status ?? "completed",
    gpaWaiver: overrides.gpaWaiver ?? false,
  };
}

describe("calculateGPA", () => {
  // ── Empty / trivial ──────────────────────────────────────────────
  describe("empty and null cases", () => {
    it("returns null GPAs and 0 credits for an empty courses array", () => {
      const result = calculateGPA([], "projected");
      expect(result).toEqual({
        unweighted: null,
        weighted: null,
        totalCredits: 0,
        coursesUsed: 0,
      });
    });

    it("returns null GPAs when all courses lack a grade", () => {
      const courses = [
        makeCourse({ status: "completed", plannedGrade: null }),
        makeCourse({ status: "completed", plannedGrade: null }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.unweighted).toBeNull();
      expect(result.weighted).toBeNull();
    });
  });

  // ── Dropped courses ──────────────────────────────────────────────
  describe("dropped courses", () => {
    it("excludes dropped courses from GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "dropped" }),
        makeCourse({ plannedGrade: "B", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.coursesUsed).toBe(1);
      // Only the B (3.0) should be counted
      expect(result.unweighted).toBeCloseTo(3.0);
    });
  });

  // ── GPA waiver courses ───────────────────────────────────────────
  describe("GPA waiver courses", () => {
    it("excludes courses with gpaWaiver=true from GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "F", status: "completed", gpaWaiver: true }),
        makeCourse({ plannedGrade: "A", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.coursesUsed).toBe(1);
      expect(result.unweighted).toBeCloseTo(4.0);
    });
  });

  // ── Pass/Fail grades ─────────────────────────────────────────────
  describe("Pass/Fail and Incomplete grades", () => {
    it("excludes P grade from GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "P", status: "completed" }),
        makeCourse({ plannedGrade: "B+", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.coursesUsed).toBe(1);
      expect(result.unweighted).toBeCloseTo(3.3);
    });

    it("excludes I (incomplete) grade from GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "I", status: "completed" }),
        makeCourse({ plannedGrade: "C", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.coursesUsed).toBe(1);
      expect(result.unweighted).toBeCloseTo(2.0);
    });
  });

  // ── Various grade combinations ───────────────────────────────────
  describe("grade combinations", () => {
    it("calculates cumulative GPA for A+, A, A- mix", () => {
      const courses = [
        makeCourse({ plannedGrade: "A+", status: "completed" }),
        makeCourse({ plannedGrade: "A", status: "completed" }),
        makeCourse({ plannedGrade: "A-", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      // (4.0 + 4.0 + 3.7) / 3 = 3.9
      expect(result.unweighted).toBeCloseTo(3.9, 1);
      expect(result.coursesUsed).toBe(3);
      expect(result.totalCredits).toBe(3);
    });

    it("calculates GPA for B+, B, B- mix", () => {
      const courses = [
        makeCourse({ plannedGrade: "B+", status: "completed" }),
        makeCourse({ plannedGrade: "B", status: "completed" }),
        makeCourse({ plannedGrade: "B-", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      // (3.3 + 3.0 + 2.7) / 3 = 3.0
      expect(result.unweighted).toBeCloseTo(3.0, 1);
    });

    it("all A+ grades yields 4.0 unweighted GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "A+", status: "completed" }),
        makeCourse({ plannedGrade: "A+", status: "completed" }),
        makeCourse({ plannedGrade: "A+", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.unweighted).toBeCloseTo(4.0);
    });

    it("all F grades yields 0.0 GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "F", status: "completed" }),
        makeCourse({ plannedGrade: "F", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.unweighted).toBeCloseTo(0.0);
      expect(result.weighted).toBeCloseTo(0.0);
    });

    it("mixed grades produce correct weighted average", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed" }),  // 4.0
        makeCourse({ plannedGrade: "C", status: "completed" }),  // 2.0
      ];
      const result = calculateGPA(courses, "projected");
      // (4.0 + 2.0) / 2 = 3.0
      expect(result.unweighted).toBeCloseTo(3.0);
    });
  });

  // ── Credit weighting (AP, Honors, CP) ────────────────────────────
  describe("credit type weighting", () => {
    it("AP courses get +1.0 weight bonus on weighted GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed", creditType: "AP" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.unweighted).toBeCloseTo(4.0);
      // Weighted: 4.0 + 1.0 = 5.0
      expect(result.weighted).toBeCloseTo(5.0);
    });

    it("Honors courses get +0.5 weight bonus on weighted GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed", creditType: "Honors" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.unweighted).toBeCloseTo(4.0);
      // Weighted: 4.0 + 0.5 = 4.5
      expect(result.weighted).toBeCloseTo(4.5);
    });

    it("CP courses have no weight bonus", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed", creditType: "CP" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.unweighted).toBe(result.weighted);
    });

    it("Accelerated courses get +0.5 weight bonus", () => {
      const courses = [
        makeCourse({ plannedGrade: "B", status: "completed", creditType: "Accelerated" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.unweighted).toBeCloseTo(3.0);
      // Weighted: 3.0 + 0.5 = 3.5
      expect(result.weighted).toBeCloseTo(3.5);
    });

    it("mixed credit types produce correct weighted GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed", creditType: "AP" }),     // unw=4.0, w=5.0
        makeCourse({ plannedGrade: "A", status: "completed", creditType: "CP" }),     // unw=4.0, w=4.0
        makeCourse({ plannedGrade: "A", status: "completed", creditType: "Honors" }), // unw=4.0, w=4.5
      ];
      const result = calculateGPA(courses, "projected");
      // Unweighted: (4+4+4)/3 = 4.0
      expect(result.unweighted).toBeCloseTo(4.0);
      // Weighted: (5+4+4.5)/3 = 4.5
      expect(result.weighted).toBeCloseTo(4.5);
    });
  });

  // ── Full-year vs semester credit weighting ───────────────────────
  describe("credit value weighting", () => {
    it("semester course (creditValue=1) uses 1 credit", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed", creditValue: "1" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.totalCredits).toBe(1);
    });

    it("full-year course (creditValue=2) uses 1 semester credit (2/2)", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed", creditValue: "2" }),
      ];
      const result = calculateGPA(courses, "projected");
      // creditValue 2 > 1, so semesterCredit = 2/2 = 1
      expect(result.totalCredits).toBe(1);
    });

    it("half-credit course (creditValue=0.5) uses 0.5 credit", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed", creditValue: "0.5" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.totalCredits).toBe(0.5);
    });

    it("full-year and semester courses are weighted correctly together", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed", creditValue: "2" }),  // semCredit=1, pts=4
        makeCourse({ plannedGrade: "C", status: "completed", creditValue: "1" }),  // semCredit=1, pts=2
      ];
      const result = calculateGPA(courses, "projected");
      // (4*1 + 2*1) / (1+1) = 3.0
      expect(result.unweighted).toBeCloseTo(3.0);
      expect(result.totalCredits).toBe(2);
    });
  });

  // ── Projected vs Actual mode ─────────────────────────────────────
  describe("projected vs actual mode", () => {
    it("projected mode includes planned, enrolled, and completed courses", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "planned" }),
        makeCourse({ plannedGrade: "B", status: "enrolled" }),
        makeCourse({ plannedGrade: "C", status: "completed" }),
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.coursesUsed).toBe(3);
      // (4.0 + 3.0 + 2.0) / 3 = 3.0
      expect(result.unweighted).toBeCloseTo(3.0);
    });

    it("actual mode includes only completed courses", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "planned" }),
        makeCourse({ plannedGrade: "B", status: "enrolled" }),
        makeCourse({ plannedGrade: "C", status: "completed" }),
      ];
      const result = calculateGPA(courses, "actual");
      expect(result.coursesUsed).toBe(1);
      expect(result.unweighted).toBeCloseTo(2.0);
    });

    it("actual mode with no completed courses returns null GPAs", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "planned" }),
        makeCourse({ plannedGrade: "B", status: "enrolled" }),
      ];
      const result = calculateGPA(courses, "actual");
      expect(result.unweighted).toBeNull();
      expect(result.weighted).toBeNull();
      expect(result.coursesUsed).toBe(0);
    });
  });

  // ── What-if simulation ───────────────────────────────────────────
  describe("what-if simulation", () => {
    it("adding a course changes projected GPA", () => {
      const base = [
        makeCourse({ plannedGrade: "B", status: "completed" }), // 3.0
      ];
      const withExtra = [
        ...base,
        makeCourse({ plannedGrade: "A", status: "planned" }), // 4.0
      ];
      const before = calculateGPA(base, "projected");
      const after = calculateGPA(withExtra, "projected");
      expect(before.unweighted).toBeCloseTo(3.0);
      // (3.0 + 4.0) / 2 = 3.5
      expect(after.unweighted).toBeCloseTo(3.5);
    });

    it("removing a low-grade course raises projected GPA", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "completed" }), // 4.0
        makeCourse({ plannedGrade: "D", status: "completed" }), // 1.0
      ];
      const all = calculateGPA(courses, "projected");
      const withoutD = calculateGPA([courses[0]], "projected");
      // (4+1)/2 = 2.5 vs 4.0
      expect(all.unweighted).toBeCloseTo(2.5);
      expect(withoutD.unweighted).toBeCloseTo(4.0);
    });
  });

  // ── Mixed statuses edge case ─────────────────────────────────────
  describe("mixed statuses", () => {
    it("handles a mix of dropped, waiver, P/F, and graded courses", () => {
      const courses = [
        makeCourse({ plannedGrade: "A", status: "dropped" }),
        makeCourse({ plannedGrade: "B", status: "completed", gpaWaiver: true }),
        makeCourse({ plannedGrade: "P", status: "completed" }),
        makeCourse({ plannedGrade: "B+", status: "completed" }), // only this counts
      ];
      const result = calculateGPA(courses, "projected");
      expect(result.coursesUsed).toBe(1);
      expect(result.unweighted).toBeCloseTo(3.3);
    });
  });
});

describe("formatGPA", () => {
  it("formats a GPA to 2 decimal places", () => {
    expect(formatGPA(3.75)).toBe("3.75");
  });

  it("formats a whole number GPA with trailing zeros", () => {
    expect(formatGPA(4.0)).toBe("4.00");
  });

  it("returns '--' for null GPA", () => {
    expect(formatGPA(null)).toBe("--");
  });

  it("formats 0.0 correctly", () => {
    expect(formatGPA(0.0)).toBe("0.00");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatGPA(3.333333)).toBe("3.33");
  });
});
