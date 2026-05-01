import { describe, it, expect } from "vitest";
import { deriveCompletionSemesters } from "@/lib/onboarding/derive-completion-semesters";

describe("deriveCompletionSemesters", () => {
  it("places single-semester pre-summer courses in their offered slot", () => {
    // ART51S — Digital Art and Design 1, offered in Pre-Summer Session 1
    expect(deriveCompletionSemesters("semester", [-2])).toEqual([-2]);
    // ACTPREPS2 — ACT Prep, offered in Pre-Summer Session 2
    expect(deriveCompletionSemesters("semester", [-1])).toEqual([-1]);
  });

  it("places single-semester regular courses in their offered slot", () => {
    expect(deriveCompletionSemesters("semester", [1])).toEqual([1]);
    expect(deriveCompletionSemesters("semester", [2])).toEqual([2]);
  });

  it("falls back to semester 1 when a single-semester course has no offering data", () => {
    expect(deriveCompletionSemesters("semester", null)).toEqual([1]);
    expect(deriveCompletionSemesters("semester", [])).toEqual([1]);
  });

  it("honors pre-summer pairing for full-year courses (regression for SOC13S/SOC14S)", () => {
    // World History (SOC13S/SOC14S) — full-year, offered in Pre-Summer Sessions 1 & 2
    expect(deriveCompletionSemesters("full_year", [-2, -1])).toEqual([-2, -1]);
  });

  it("uses regular Sem 1 / Sem 2 for full-year courses with the standard pairing", () => {
    expect(deriveCompletionSemesters("full_year", [1, 2])).toEqual([1, 2]);
  });

  it("falls back to [1, 2] for full-year courses missing semestersOffered", () => {
    expect(deriveCompletionSemesters("full_year", null)).toEqual([1, 2]);
    expect(deriveCompletionSemesters("full_year", undefined)).toEqual([1, 2]);
    expect(deriveCompletionSemesters("full_year", [1])).toEqual([1, 2]);
  });
});
