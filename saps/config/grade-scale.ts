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

/** Grade type for TypeScript */
export type Grade = (typeof ALL_GRADES)[number];
export type GpaGrade = (typeof GPA_GRADES)[number];
