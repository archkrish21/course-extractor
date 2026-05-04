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
 *
 * A course is P/F when either:
 *  - the catalog marks `creditType` as "Pass/Fail" (e.g. ACT Prep, summer P/F offerings), or
 *  - the code matches Stevenson's PE/Driver Ed P/F policy (Course Book p. 86:
 *    "All classes in Physical Education, with the exception of Leadership and
 *    Aquatics courses, are Pass/Fail.").
 *
 * PE letter-graded exceptions: Health Education (PED201/202) and Applied Health
 * (PED231/232) are part of the Health Education department, not PE. Lifeguard
 * Training (PED501) is the Aquatics exception. Leadership courses (PED###L)
 * are the Leadership exception.
 */
export function isPassFailCourse(code: string, creditType?: string): boolean {
  // Catalog-level P/F (works for any department, e.g. ACTPREPS2)
  if (creditType === "Pass/Fail") return true;
  // Driver Education — always P/F
  if (code.startsWith("D/E")) return true;
  // PE courses — P/F except Health, Applied Health, Lifeguard, and Leadership
  if (code.startsWith("PED")) {
    // Health Education
    if (code.startsWith("PED201") || code.startsWith("PED202")) return false;
    // Applied Health
    if (code.startsWith("PED231") || code.startsWith("PED232")) return false;
    // Lifeguard Training (Aquatics)
    if (code.startsWith("PED501")) return false;
    // Leadership courses (PED codes ending with L, e.g. PED101L)
    if (/^PED\d+L/.test(code)) return false;
    // All other PED courses are P/F (regular PE)
    return true;
  }
  return false;
}

/**
 * Determine if a course can be taken in multiple semesters/grades within the same plan.
 *
 * Stevenson's PE requirement is 3.5 credits earned across all four years, so
 * regular P/F PE courses (e.g. CHOICE P.E. PED452) are taken every semester and
 * must be selectable in multiple slots. The single-take PED exceptions
 * (Health PED201/202, Applied Health PED231/232, Lifeguard PED501, Leadership
 * PED###L) are letter-graded and therefore correctly excluded by the
 * `isPassFailCourse` check.
 */
export function isRepeatableCourse(code: string, creditType?: string): boolean {
  return code.startsWith("PED") && isPassFailCourse(code, creditType);
}

/** Grade type for TypeScript */
export type Grade = (typeof ALL_GRADES)[number];
export type GpaGrade = (typeof GPA_GRADES)[number];
