import { GRADE_TO_POINTS, isPassFailCourse } from "@/config/grade-scale";
import { CREDIT_TYPE_WEIGHT } from "@/config/gpa-weights";

interface CourseForGPA {
  creditValue: string;
  creditType: string;
  plannedGrade?: string | null;
  status: "planned" | "enrolled" | "completed" | "dropped";
  gpaWaiver?: boolean;
  gpaWaiverApplied?: boolean;
  code?: string;
}

interface GPAResult {
  unweighted: number | null;
  weighted: number | null;
  totalCredits: number;
  coursesUsed: number;
}

/**
 * Calculate GPA from a list of courses.
 * - Only courses with a grade are included.
 * - Dropped courses and GPA waiver courses are excluded.
 * - Pass/Fail grades (P, I) are excluded.
 * - `mode`: "projected" includes planned+enrolled+completed; "actual" includes only completed.
 */
export function calculateGPA(
  courses: CourseForGPA[],
  mode: "projected" | "actual"
): GPAResult {
  let totalWeightedPoints = 0;
  let totalUnweightedPoints = 0;
  let totalCredits = 0;
  let coursesUsed = 0;

  for (const c of courses) {
    // Skip dropped
    if (c.status === "dropped") continue;

    // Actual mode: only completed courses
    if (mode === "actual" && c.status !== "completed") continue;

    // Skip courses where student applied GPA waiver
    if (c.gpaWaiverApplied) continue;

    // Skip P/F-only courses (Driver Ed, regular PE) from GPA per Stevenson policy
    if (c.code && isPassFailCourse(c.code)) continue;

    // Skip courses without a grade
    const grade = c.plannedGrade;
    if (!grade) continue;

    // Skip Pass/Fail/Incomplete grades
    const basePoints = GRADE_TO_POINTS[grade];
    if (basePoints === null || basePoints === undefined) continue;

    // Credit value per semester (each row is one semester = half the course credit)
    const creditValue = parseFloat(c.creditValue) || 0;
    // Since full-year courses are now stored as 2 rows with credit_value=2.0 each,
    // but each row represents one semester, use 1.0 credit per row for GPA
    const semesterCredit = creditValue > 1 ? creditValue / 2 : creditValue;

    const weightBonus = CREDIT_TYPE_WEIGHT[c.creditType] ?? 0;

    totalUnweightedPoints += basePoints * semesterCredit;
    totalWeightedPoints += (basePoints + weightBonus) * semesterCredit;
    totalCredits += semesterCredit;
    coursesUsed++;
  }

  if (totalCredits === 0) {
    return { unweighted: null, weighted: null, totalCredits: 0, coursesUsed: 0 };
  }

  return {
    unweighted: totalUnweightedPoints / totalCredits,
    weighted: totalWeightedPoints / totalCredits,
    totalCredits,
    coursesUsed,
  };
}

/** Format GPA to 2 decimal places, or "--" if null */
export function formatGPA(gpa: number | null): string {
  if (gpa === null) return "--";
  return gpa.toFixed(2);
}
