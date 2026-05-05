import { describe, it, expect } from "vitest";
import { expandWithEquivalents } from "@/lib/prereq/expand-prereqs";

/**
 * Tests for the seed-step prereq expansion. The function composes two layers:
 *   1. Lateral summer/regular equivalents (`config/summer-equivalents.ts`)
 *   2. Upward rigor-ladder siblings (`config/course-families.ts`)
 * Each layer is tested in isolation, then together.
 */

describe("expandWithEquivalents", () => {
  it("returns just the input id when no equivalents/siblings are known", () => {
    const courseIds = { "MTH151/MTH152": "id-mth151" };
    const expanded = expandWithEquivalents(
      "id-mth151",
      "MTH151/MTH152",
      courseIds
    );
    expect(expanded).toEqual(["id-mth151"]);
  });

  it("expands summer/regular equivalents in either direction (lateral)", () => {
    // SOC101/SOC102 ↔ SOC13S/SOC14S in summer-equivalents.ts.
    const courseIds = {
      "SOC101/SOC102": "id-soc101",
      "SOC13S/SOC14S": "id-soc13s",
    };
    const fromRegular = expandWithEquivalents(
      "id-soc101",
      "SOC101/SOC102",
      courseIds
    );
    expect(fromRegular).toContain("id-soc101");
    expect(fromRegular).toContain("id-soc13s");
    expect(fromRegular).toHaveLength(2);
  });

  it("expands the rigor ladder for the reported AP US History case", () => {
    // The user-reported scenario: when seeding AP Psychology's prereq edge
    // pointing at SOC321/SOC322 (CP US History), an additional edge to
    // SOC621/SOC622 (AP US History) must be inserted in the same
    // requirement_group so the AP version satisfies under OR semantics.
    const courseIds = {
      "SOC321/SOC322": "id-soc321",
      "SOC621/SOC622": "id-soc621",
    };
    const expanded = expandWithEquivalents(
      "id-soc321",
      "SOC321/SOC322",
      courseIds
    );
    expect(expanded).toContain("id-soc321");
    expect(expanded).toContain("id-soc621");
    expect(expanded).toHaveLength(2);
  });

  it("does NOT expand downward — AP prereq stays as just AP", () => {
    // Inverse direction: a hypothetical course that requires AP US History
    // must not be relaxed to also accept CP US History. The ladder is
    // strictly "level >= prereq's level", so seeding from the AP code
    // returns only itself (CP is below AP).
    const courseIds = {
      "SOC321/SOC322": "id-soc321",
      "SOC621/SOC622": "id-soc621",
    };
    const expanded = expandWithEquivalents(
      "id-soc621",
      "SOC621/SOC622",
      courseIds
    );
    expect(expanded).toEqual(["id-soc621"]);
  });

  it("composes summer/regular AND rigor ladder when both apply", () => {
    // SOC321/SOC322 (CP USH) has BOTH a summer equivalent (SOC41S, SOC42S)
    // AND an AP rigor sibling (SOC621/SOC622). All three should appear.
    const courseIds = {
      "SOC321/SOC322": "id-soc321",
      "SOC41S": "id-soc41s",
      "SOC42S": "id-soc42s",
      "SOC621/SOC622": "id-soc621",
    };
    const expanded = expandWithEquivalents(
      "id-soc321",
      "SOC321/SOC322",
      courseIds
    );
    expect(expanded).toContain("id-soc321");
    expect(expanded).toContain("id-soc41s");
    expect(expanded).toContain("id-soc42s");
    expect(expanded).toContain("id-soc621");
    expect(expanded).toHaveLength(4);
  });

  it("silently skips equivalents/siblings whose codes aren't in the courseIds map", () => {
    // Sibling exists in course-families.ts but not in this catalog version's
    // courseIds map — should be skipped, not crash. Mirrors what happens
    // mid-migration when a new sibling course is introduced.
    const courseIds = {
      "SOC321/SOC322": "id-soc321",
      // Note: SOC621/SOC622 NOT in map.
    };
    const expanded = expandWithEquivalents(
      "id-soc321",
      "SOC321/SOC322",
      courseIds
    );
    expect(expanded).toEqual(["id-soc321"]);
  });

  it("expands cross-level rigor siblings for English Junior family", () => {
    // CP Junior English has Accel + 2 AP siblings — 3 expansions in one call.
    const courseIds = {
      "ENG311/ENG312": "id-eng311",
      "ENG381/ENG382": "id-eng381",
      "ENG371/ENG372": "id-eng371",
      "ENG341/ENG342": "id-eng341",
    };
    const expanded = expandWithEquivalents(
      "id-eng311",
      "ENG311/ENG312",
      courseIds
    );
    expect(expanded.sort()).toEqual(
      ["id-eng311", "id-eng341", "id-eng371", "id-eng381"].sort()
    );
  });
});
