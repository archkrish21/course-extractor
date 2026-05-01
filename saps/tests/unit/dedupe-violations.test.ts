import { describe, it, expect } from "vitest";
import { dedupeViolations } from "@/lib/planner/dedupe-violations";

describe("dedupeViolations", () => {
  it("returns an empty array for empty input", () => {
    expect(dedupeViolations([])).toEqual([]);
  });

  it("preserves a list with no duplicates", () => {
    const list = [
      { type: "prerequisite", message: "needs SPA101" },
      { type: "prerequisite", message: "needs CSC100" },
    ];
    expect(dedupeViolations(list)).toEqual(list);
  });

  it("collapses identical (type, message) repeats — paired-course case", () => {
    // SPA201/SPA202 emits the same violation twice (once per side).
    const list = [
      { type: "prerequisite", message: "SPA201/SPA202 requires SPA101/SPA102" },
      { type: "prerequisite", message: "SPA201/SPA202 requires SPA101/SPA102" },
    ];
    expect(dedupeViolations(list)).toEqual([list[0]]);
  });

  it("treats different types with the same message as distinct", () => {
    const list = [
      { type: "prerequisite", message: "blocked" },
      { type: "grade_level", message: "blocked" },
    ];
    expect(dedupeViolations(list)).toEqual(list);
  });

  it("preserves first-occurrence order", () => {
    const a = { type: "prerequisite", message: "a" };
    const b = { type: "prerequisite", message: "b" };
    const c = { type: "prerequisite", message: "c" };
    expect(dedupeViolations([a, b, a, c, b, a])).toEqual([a, b, c]);
  });

  it("preserves extra fields on the kept violation object", () => {
    const list = [
      { type: "prerequisite", message: "x", severity: "warning", extra: 1 },
      { type: "prerequisite", message: "x", severity: "warning", extra: 2 },
    ];
    expect(dedupeViolations(list)).toEqual([list[0]]);
  });
});
