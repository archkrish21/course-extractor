/**
 * Stevenson High School grade scale.
 * Central definition — all grade-related code imports from here.
 *
 * Letter grade to GPA base points mapping.
 * null values indicate grades excluded from GPA calculation.
 */
export const GRADE_TO_POINTS: Record<string, number | null> = {
  A: 4.0,
  B: 3.0,
  C: 2.0,
  D: 1.0,
  F: 0.0,
  P: null, // Pass — excluded from GPA
  I: null, // Incomplete — excluded until resolved
};

/** Grades that count toward GPA calculation */
export const GPA_GRADES = ["A", "B", "C", "D", "F"] as const;

/** All valid grades including non-GPA (P, I) */
export const ALL_GRADES = ["A", "B", "C", "D", "F", "P", "I"] as const;

/** Grades available for student grade entry (dropdown options) */
export const GRADE_OPTIONS = ["A", "B", "C", "D", "F"] as const;

/** Grades for Pass/Fail-only courses (PE, Driver Ed) */
export const PASS_FAIL_OPTIONS = ["P", "F"] as const;

/**
 * Determine if a course is Pass/Fail only (no letter grades).
 * Per Stevenson policy: Driver Ed and regular PE courses are P/F.
 * Health (PED201/202), Applied Health (PED231/232), and Leadership courses get letter grades.
 */
export function isPassFailCourse(code: string): boolean {
  // Driver Education — always P/F
  if (code.startsWith("D/E")) return true;
  // PE courses — P/F except Health, Applied Health, Adventure Ed, Lifeguard, and Leadership
  if (code.startsWith("PED")) {
    // Health Education
    if (code.startsWith("PED201") || code.startsWith("PED202")) return false;
    // Applied Health
    if (code.startsWith("PED231") || code.startsWith("PED232")) return false;
    // Adventure Education
    if (code.startsWith("PED331") || code.startsWith("PED332")) return false;
    // Lifeguard Training
    if (code.startsWith("PED501")) return false;
    // Leadership courses (contain "L" in code)
    if (/L/.test(code)) return false;
    // All other PED courses are P/F (regular PE)
    return true;
  }
  return false;
}

/** Grade type for TypeScript */
export type Grade = (typeof ALL_GRADES)[number];
export type GpaGrade = (typeof GPA_GRADES)[number];
