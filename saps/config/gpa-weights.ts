/**
 * GPA weight bonuses by credit type.
 * These values are added to the base grade points for weighted GPA calculation.
 *
 * THESE VALUES ARE ILLUSTRATIVE -- get exact values from school before going live.
 */
export const CREDIT_TYPE_WEIGHT: Record<string, number> = {
  CP: 0.0, // College Prep -- standard weight
  Accelerated: 0.5, // +0.5 bonus
  Honors: 0.5, // +0.5 bonus (placeholder -- confirm with school)
  AP: 1.0, // +1.0 bonus
  "Pass/Fail": 0.0, // excluded from GPA
};
