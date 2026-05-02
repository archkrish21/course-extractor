import { describe, it, expect } from "vitest";
import {
  getEquivalents,
  areEquivalent,
  findEquivalentInPlan,
} from "@/config/summer-equivalents";

describe("summer-equivalents", () => {
  describe("getEquivalents — bidirectional resolution", () => {
    // The seed script (scripts/setup-db.ts) calls getEquivalents() on each
    // prereq's canonical code and adds parallel edges in the same
    // requirement_group so taking either offering satisfies the prereq.
    // These cases must stay bidirectional or the DAG drifts.

    it("Social Studies — SOC101/SOC102 ↔ SOC13S/SOC14S", () => {
      expect(getEquivalents("SOC101/SOC102")).toContain("SOC13S/SOC14S");
      expect(getEquivalents("SOC13S/SOC14S")).toContain("SOC101/SOC102");
    });

    it("Mathematics composites — MTH151/MTH152 ↔ MTH15S/MTH16S", () => {
      expect(getEquivalents("MTH151/MTH152")).toContain("MTH15S/MTH16S");
      expect(getEquivalents("MTH15S/MTH16S")).toContain("MTH151/MTH152");
    });

    it("multi-target mapping — PED summer reaches both regular semesters", () => {
      expect(getEquivalents("PED21S")).toEqual(
        expect.arrayContaining(["PED201", "PED202"]),
      );
      expect(getEquivalents("PED201")).toEqual(
        expect.arrayContaining(["PED21S", "PED22S"]),
      );
    });

    it("returns empty for codes with no equivalent", () => {
      expect(getEquivalents("SOC632")).toEqual([]);
      expect(getEquivalents("NOT_A_CODE")).toEqual([]);
    });
  });

  describe("areEquivalent", () => {
    it("is symmetric", () => {
      expect(areEquivalent("SOC101/SOC102", "SOC13S/SOC14S")).toBe(true);
      expect(areEquivalent("SOC13S/SOC14S", "SOC101/SOC102")).toBe(true);
    });

    it("returns false for unrelated codes", () => {
      expect(areEquivalent("SOC101/SOC102", "SOC632")).toBe(false);
    });
  });

  describe("findEquivalentInPlan", () => {
    it("finds a matching equivalent in the plan", () => {
      expect(
        findEquivalentInPlan("SOC101/SOC102", ["MTH151/MTH152", "SOC13S/SOC14S"]),
      ).toBe("SOC13S/SOC14S");
    });

    it("returns null when no equivalent is in the plan", () => {
      expect(
        findEquivalentInPlan("SOC101/SOC102", ["MTH151/MTH152", "SOC632"]),
      ).toBeNull();
    });
  });
});
