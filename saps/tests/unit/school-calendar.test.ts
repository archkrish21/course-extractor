import { describe, it, expect } from "vitest";
import {
  isYearEndBannerActive,
  nextYearEndBannerOpenDate,
} from "@/config/school-calendar";

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

describe("nextYearEndBannerOpenDate", () => {
  it("returns May 15 of the same year when called before May 15", () => {
    const result = nextYearEndBannerOpenDate(localDate(2026, 4, 29));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(15);
  });

  it("returns May 15 of the same year when the window is currently open", () => {
    const result = nextYearEndBannerOpenDate(localDate(2026, 6, 10));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });

  it("returns May 15 of next year when called after July 31", () => {
    const result = nextYearEndBannerOpenDate(localDate(2026, 8, 1));
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });

  it("returns May 15 of next year when called in late fall", () => {
    const result = nextYearEndBannerOpenDate(localDate(2026, 11, 20));
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });
});
