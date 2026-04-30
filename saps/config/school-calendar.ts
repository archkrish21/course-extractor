/**
 * Interim school calendar config — hardcoded for Stevenson High School.
 * Will be replaced by per-school `school_calendars` DB table (see #35).
 */

/** Month (1-12) and day when the year-end banner starts showing. */
export const YEAR_END_BANNER_START = { month: 5, day: 15 } as const; // May 15

/**
 * Returns true if the given date falls within the year-end banner window.
 * The banner opens on YEAR_END_BANNER_START and stays open until July 31
 * of the same academic year (giving students the summer to complete it).
 *
 * Academic year derivation:
 * - Aug 1 – Dec 31 → academic year ends next calendar year
 * - Jan 1 – Jul 31 → academic year ends this calendar year
 *
 * So for a student in the 2025-2026 school year:
 * - Banner shows from May 15 2026 through Jul 31 2026
 */
export function isYearEndBannerActive(now: Date = new Date()): boolean {
  const month = now.getMonth() + 1; // 1-indexed
  const day = now.getDate();

  const { month: startMonth, day: startDay } = YEAR_END_BANNER_START;

  // Banner is active from start date through July 31
  if (month > 7) return false; // Aug–Dec: too early for this academic year
  if (month < startMonth) return false;
  if (month === startMonth && day < startDay) return false;

  return true;
}

/**
 * Returns the next date the year-end banner will open, relative to `now`.
 * Used by surfaces like the empty-state transcript to tell users when the
 * window opens so they aren't stranded waiting on a feature they can't see.
 *
 * - Before May 15 (same year) → May 15 of the current calendar year
 * - May 15 – Jul 31 → window is currently open; returns today's May 15 anchor
 * - After Jul 31 → May 15 of the next calendar year
 */
export function nextYearEndBannerOpenDate(now: Date = new Date()): Date {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { month: startMonth, day: startDay } = YEAR_END_BANNER_START;

  // After July 31 → next calendar year's opening
  const targetYear = month > 7 ? year + 1 : year;
  return new Date(targetYear, startMonth - 1, startDay, 12);
}
