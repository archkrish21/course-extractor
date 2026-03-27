/**
 * Letter grade to GPA base points mapping.
 * null values indicate grades excluded from GPA calculation.
 */
export const GRADE_TO_POINTS: Record<string, number | null> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  "D-": 0.7,
  F: 0.0,
  P: null, // Pass -- excluded from GPA
  I: null, // Incomplete -- excluded until resolved
};
