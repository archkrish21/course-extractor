import { describe, it, expect } from "vitest";
import { formatViolation, type MessageSegment } from "@/lib/planner/format-violation-message";

function names(segments: MessageSegment[]): Array<{ name: string; codes: string[] }> {
  return segments
    .filter((s): s is Extract<MessageSegment, { kind: "name" }> => s.kind === "name")
    .map(({ name, codes }) => ({ name, codes }));
}

function text(segments: MessageSegment[]): string {
  return segments.map((s) => (s.kind === "text" ? s.text : s.name)).join("");
}

describe("formatViolation — prerequisite/corequisite path", () => {
  it("collapses three same-name prereq codes into one chip with all codes in tooltip", () => {
    const segments = formatViolation({
      type: "prerequisite",
      message: "CSC391/CSC392 requires one of CSC181 or CSC82S or CSC182 to be completed in an earlier semester (requirement group 1).",
      targetName: "AP COMPUTER SCIENCE A",
      targetCode: "CSC391/CSC392",
      missingPrerequisites: [
        { code: "CSC181", name: "Computer Programming 2" },
        { code: "CSC82S", name: "Computer Programming 2" },
        { code: "CSC182", name: "Computer Programming 2" },
      ],
    });

    expect(text(segments)).toBe(
      "AP COMPUTER SCIENCE A requires Computer Programming 2 to be completed in an earlier semester."
    );
    expect(names(segments)).toEqual([
      { name: "AP COMPUTER SCIENCE A", codes: ["CSC391/CSC392"] },
      { name: "Computer Programming 2", codes: ["CSC181", "CSC82S", "CSC182"] },
    ]);
  });

  it("preserves OR alternatives when names actually differ", () => {
    const segments = formatViolation({
      type: "prerequisite",
      message: "MTH301 requires one of MTH201 or MTH202 to be completed in an earlier semester (requirement group 1).",
      targetName: "Calculus",
      targetCode: "MTH301",
      missingPrerequisites: [
        { code: "MTH201", name: "Algebra 2" },
        { code: "MTH202", name: "Trigonometry" },
      ],
    });

    expect(text(segments)).toBe(
      "Calculus requires Algebra 2 or Trigonometry to be completed in an earlier semester."
    );
  });

  it("dedups case-insensitively (catalog has 'WORLD HISTORY' and 'World History' for the same course)", () => {
    const segments = formatViolation({
      type: "prerequisite",
      message: "SOC632 requires one of SOC101/SOC102 or SOC13S/SOC14S",
      targetName: "AP COMPARATIVE GOVERNMENT",
      targetCode: "SOC632",
      missingPrerequisites: [
        { code: "SOC101/SOC102", name: "WORLD HISTORY AND GEOGRAPHY" },
        { code: "SOC13S/SOC14S", name: "World History and Geography" },
      ],
    });

    const namedChips = names(segments);
    expect(namedChips).toHaveLength(2);
    expect(namedChips[1].name).toBe("WORLD HISTORY AND GEOGRAPHY"); // first-seen casing wins
    expect(namedChips[1].codes).toEqual(["SOC101/SOC102", "SOC13S/SOC14S"]);
  });

  it("uses 'taken in the same semester' phrasing for corequisites", () => {
    const segments = formatViolation({
      type: "corequisite",
      message: "FOO101 requires BAR101 to be taken in the same semester (co-requisite group 1).",
      targetName: "Foo",
      targetCode: "FOO101",
      missingPrerequisites: [{ code: "BAR101", name: "Bar" }],
    });

    expect(text(segments)).toBe("Foo requires Bar to be taken in the same semester.");
  });
});

describe("formatViolation — non-prereq path (parse and swap)", () => {
  it("substitutes target code with target name in a grade_level message", () => {
    const segments = formatViolation({
      type: "grade_level",
      message: "CSC181 is not available for grade 9. Available grades: 10, 11, 12.",
      targetName: "Computer Programming 2",
      targetCode: "CSC181",
    });

    expect(text(segments)).toBe(
      "Computer Programming 2 is not available for grade 9. Available grades: 10, 11, 12."
    );
    expect(names(segments)).toEqual([
      { name: "Computer Programming 2", codes: ["CSC181"] },
    ]);
  });

  it("renders both target and a referenced course as name chips", () => {
    const segments = formatViolation({
      type: "duplicate",
      message: "SOC101/SOC102 is equivalent to SOC13S/SOC14S which is already in your plan.",
      targetName: "WORLD HISTORY AND GEOGRAPHY",
      targetCode: "SOC101/SOC102",
      referencedCourses: [
        { code: "SOC13S/SOC14S", name: "World History and Geography (Summer)" },
      ],
    });

    expect(names(segments)).toEqual([
      { name: "WORLD HISTORY AND GEOGRAPHY", codes: ["SOC101/SOC102"] },
      { name: "World History and Geography (Summer)", codes: ["SOC13S/SOC14S"] },
    ]);
  });

  it("strips a trailing requirement-group suffix even when the path is parse-and-swap", () => {
    // Defensive — should not happen on non-prereq types, but the regex is generic.
    const segments = formatViolation({
      type: "duplicate",
      message: "FOO101 appears twice (requirement group 2).",
      targetName: "Foo",
      targetCode: "FOO101",
    });

    expect(text(segments)).toBe("Foo appears twice.");
  });

  it("handles codes containing regex metacharacters (slash) without breaking", () => {
    const segments = formatViolation({
      type: "enrollment_rule",
      message: "MTH151/MTH152 is a full-year course and must span both semesters.",
      targetName: "Algebra 1",
      targetCode: "MTH151/MTH152",
    });

    expect(names(segments)).toEqual([
      { name: "Algebra 1", codes: ["MTH151/MTH152"] },
    ]);
  });

  it("returns the raw message as a single text segment when no codes match", () => {
    const segments = formatViolation({
      type: "enrollment_rule",
      message: "Some unstructured warning.",
      targetName: "Alpha",
      targetCode: "AAA999",
    });

    expect(segments).toEqual([
      { kind: "text", text: "Some unstructured warning." },
    ]);
  });
});
