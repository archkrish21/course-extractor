import { describe, it, expect } from "vitest";
import { isYearEndBannerActive } from "@/config/school-calendar";

/** Create a date in local time (avoiding UTC midnight timezone shift issues). */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12); // noon local
}

describe("isYearEndBannerActive", () => {
  it("returns false before May 15", () => {
    expect(isYearEndBannerActive(localDate(2026, 1, 10))).toBe(false);
    expect(isYearEndBannerActive(localDate(2026, 3, 20))).toBe(false);
    expect(isYearEndBannerActive(localDate(2026, 5, 14))).toBe(false);
  });

  it("returns true on May 15", () => {
    expect(isYearEndBannerActive(localDate(2026, 5, 15))).toBe(true);
  });

  it("returns true between May 15 and July 31", () => {
    expect(isYearEndBannerActive(localDate(2026, 5, 20))).toBe(true);
    expect(isYearEndBannerActive(localDate(2026, 6, 15))).toBe(true);
    expect(isYearEndBannerActive(localDate(2026, 7, 31))).toBe(true);
  });

  it("returns false after July 31", () => {
    expect(isYearEndBannerActive(localDate(2026, 8, 1))).toBe(false);
    expect(isYearEndBannerActive(localDate(2026, 9, 15))).toBe(false);
    expect(isYearEndBannerActive(localDate(2026, 12, 25))).toBe(false);
  });
});
