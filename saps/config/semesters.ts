/** All valid semester values in display order. */
export const SEMESTERS = [1, 2] as const;
export const SUMMER_SEMESTERS = [-2, -1] as const;
export const ALL_SEMESTERS = [-2, -1, 1, 2] as const;

export type SemesterValue = (typeof ALL_SEMESTERS)[number];

/** Whether a semester value represents summer. */
export function isSummerSemester(sem: number): boolean {
  return sem < 0;
}

/**
 * Human-readable label for a semester value.
 * Summer semesters (-2, -1) happen BEFORE the regular school year at that grade level.
 */
export function semesterLabel(sem: number): string {
  switch (sem) {
    case -2: return "Pre-Summer Session 1";
    case -1: return "Pre-Summer Session 2";
    case 1: return "Semester 1";
    case 2: return "Semester 2";
    default: return `Semester ${sem}`;
  }
}

/** Short label for compact displays (planner grid headers, charts). */
export function semesterShortLabel(sem: number): string {
  switch (sem) {
    case -2: return "Sum 1";
    case -1: return "Sum 2";
    case 1: return "S1";
    case 2: return "S2";
    default: return `S${sem}`;
  }
}
