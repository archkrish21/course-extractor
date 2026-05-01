/**
 * Derives which semester slots a completed-course toggle in onboarding's
 * Past Courses step should populate.
 *
 * Pre-summer offerings live at semester -2 (Session 1) and -1 (Session 2);
 * regular offerings live at 1 and 2. Full-year courses must honor their
 * `semestersOffered` so a pre-summer pair like World History (SOC13S/SOC14S,
 * offered in [-2, -1]) lands in pre-summer cells, not regular Sem 1 / Sem 2.
 */
export function deriveCompletionSemesters(
  duration: string,
  semestersOffered: number[] | null | undefined,
): number[] {
  if (duration === "full_year") {
    const offered = semestersOffered ?? [];
    return offered.length === 2 ? [offered[0], offered[1]] : [1, 2];
  }
  return [semestersOffered?.[0] ?? 1];
}
