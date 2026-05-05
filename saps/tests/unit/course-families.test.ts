import { describe, it, expect } from "vitest";
import {
  COURSE_FAMILIES,
  getHigherOrEqualRigorSiblings,
  satisfiesByRigor,
} from "@/config/course-families";

describe("course families — getHigherOrEqualRigorSiblings", () => {
  it("returns AP sibling for CP U.S. History prereq", () => {
    // The reported bug: AP USH (SOC621/SOC622) should satisfy CP USH (SOC321/SOC322)
    expect(getHigherOrEqualRigorSiblings("SOC321/SOC322")).toEqual([
      "SOC621/SOC622",
    ]);
  });

  it("returns no siblings for AP U.S. History (already top of family)", () => {
    expect(getHigherOrEqualRigorSiblings("SOC621/SOC622")).toEqual([]);
  });

  it("returns Accelerated sibling for CP Sophomore English", () => {
    expect(getHigherOrEqualRigorSiblings("ENG211/ENG212")).toEqual([
      "ENG231/ENG232",
    ]);
  });

  it("returns AP siblings + higher Accelerated for CP Junior English", () => {
    const siblings = getHigherOrEqualRigorSiblings("ENG311/ENG312");
    expect(siblings).toContain("ENG381/ENG382"); // Accelerated
    expect(siblings).toContain("ENG371/ENG372"); // AP English Lang
    expect(siblings).toContain("ENG341/ENG342"); // AP American Studies
    expect(siblings).toHaveLength(3);
  });

  it("returns only AP siblings (excludes lower) for Accelerated Junior English", () => {
    const siblings = getHigherOrEqualRigorSiblings("ENG381/ENG382");
    expect(siblings).toContain("ENG371/ENG372");
    expect(siblings).toContain("ENG341/ENG342");
    expect(siblings).not.toContain("ENG311/ENG312"); // CP — lower, excluded
  });

  it("returns multiple AP siblings for CP Physics", () => {
    const siblings = getHigherOrEqualRigorSiblings("SCI401/SCI402");
    expect(siblings).toContain("SCI611/SCI612"); // AP Physics 1
    expect(siblings).toContain("SCI661/SCI662"); // AP Physics C
    expect(siblings).toContain("SCI681/SCI682"); // AP Physics 2
  });

  it("returns same-level + Honors siblings for CP Sociology", () => {
    // SOC541 (CP sem 1) → SOC542 (CP sem 2, same level) and SOC571/SOC572 (Honors, higher).
    // Same-level siblings are included so a same-level sibling-code prereq is also satisfied.
    const siblings = getHigherOrEqualRigorSiblings("SOC541");
    expect(siblings).toContain("SOC542");
    expect(siblings).toContain("SOC571");
    expect(siblings).toContain("SOC572");
    expect(siblings).toHaveLength(3);
  });

  it("returns empty array for unknown code", () => {
    expect(getHigherOrEqualRigorSiblings("ZZZ999")).toEqual([]);
  });

  it("returns empty array for code outside any family (e.g. PE)", () => {
    expect(getHigherOrEqualRigorSiblings("PED121")).toEqual([]);
  });
});

describe("course families — satisfiesByRigor", () => {
  it("AP U.S. History satisfies CP U.S. History prereq", () => {
    expect(satisfiesByRigor("SOC621/SOC622", "SOC321/SOC322")).toBe(true);
  });

  it("CP U.S. History does NOT satisfy AP U.S. History prereq", () => {
    expect(satisfiesByRigor("SOC321/SOC322", "SOC621/SOC622")).toBe(false);
  });

  it("Accelerated satisfies CP prereq within Sophomore English family", () => {
    expect(satisfiesByRigor("ENG231/ENG232", "ENG211/ENG212")).toBe(true);
  });

  it("CP does NOT satisfy Accelerated prereq", () => {
    expect(satisfiesByRigor("ENG211/ENG212", "ENG231/ENG232")).toBe(false);
  });

  it("AP satisfies Accelerated prereq within Junior English family", () => {
    expect(satisfiesByRigor("ENG371/ENG372", "ENG381/ENG382")).toBe(true);
  });

  it("Honors satisfies CP within Sociology family", () => {
    expect(satisfiesByRigor("SOC571", "SOC541")).toBe(true);
  });

  it("same level + same family satisfies (sibling AP variants)", () => {
    // AP Physics 1 and AP Physics 2 are both in the physics family at AP.
    // Either should satisfy a prereq pointing at the other.
    expect(satisfiesByRigor("SCI611/SCI612", "SCI681/SCI682")).toBe(true);
    expect(satisfiesByRigor("SCI681/SCI682", "SCI611/SCI612")).toBe(true);
  });

  it("returns false for codes in different families", () => {
    // U.S. History and World History are different families.
    expect(satisfiesByRigor("SOC621/SOC622", "SOC101/SOC102")).toBe(false);
  });

  it("returns false for the trivial self case (callers handle exact match separately)", () => {
    expect(satisfiesByRigor("SOC321/SOC322", "SOC321/SOC322")).toBe(false);
  });

  it("returns false when either code is unknown", () => {
    expect(satisfiesByRigor("ZZZ999", "SOC321/SOC322")).toBe(false);
    expect(satisfiesByRigor("SOC321/SOC322", "ZZZ999")).toBe(false);
  });
});

describe("course families — structural sanity", () => {
  it("every family has at least 2 members", () => {
    for (const f of COURSE_FAMILIES) {
      expect(f.members.length, `family ${f.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("no course code appears in more than one family", () => {
    const seen = new Map<string, string>();
    for (const f of COURSE_FAMILIES) {
      for (const m of f.members) {
        const prior = seen.get(m.code);
        expect(prior, `code ${m.code} appears in both ${prior} and ${f.id}`).toBeUndefined();
        seen.set(m.code, f.id);
      }
    }
  });

  it("every family has unique ids", () => {
    const ids = COURSE_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
