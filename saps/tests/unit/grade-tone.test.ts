import { describe, it, expect } from "vitest";
import { gradeToneVariant, gradeToneClasses, gradeToneTextColor } from "@/lib/grade-tone";

describe("gradeToneVariant", () => {
  it("maps A and P to success", () => {
    expect(gradeToneVariant("A")).toBe("success");
    expect(gradeToneVariant("P")).toBe("success");
  });

  it("maps B to info", () => {
    expect(gradeToneVariant("B")).toBe("info");
  });

  it("maps C and I to default (neutral)", () => {
    expect(gradeToneVariant("C")).toBe("default");
    expect(gradeToneVariant("I")).toBe("default");
  });

  it("maps D to warning", () => {
    expect(gradeToneVariant("D")).toBe("warning");
  });

  it("maps F to destructive (covers both A-F F and P/F failure)", () => {
    expect(gradeToneVariant("F")).toBe("destructive");
  });

  it("treats null/undefined/empty as default (no grade entered)", () => {
    expect(gradeToneVariant(null)).toBe("default");
    expect(gradeToneVariant(undefined)).toBe("default");
    expect(gradeToneVariant("")).toBe("default");
  });

  it("treats unrecognized strings as default", () => {
    expect(gradeToneVariant("Z")).toBe("default");
    expect(gradeToneVariant("a")).toBe("default"); // case-sensitive on purpose
  });
});

describe("gradeToneClasses", () => {
  it("returns paired bg+text Tailwind classes for each tone", () => {
    expect(gradeToneClasses("A")).toBe("bg-success-light text-success");
    expect(gradeToneClasses("B")).toBe("bg-info-light text-info");
    expect(gradeToneClasses("D")).toBe("bg-warning-light text-warning");
    expect(gradeToneClasses("F")).toBe("bg-destructive-light text-destructive");
    expect(gradeToneClasses("C")).toBe("bg-muted text-muted-foreground");
    expect(gradeToneClasses(null)).toBe("bg-muted text-muted-foreground");
  });
});

describe("gradeToneTextColor", () => {
  it("returns text-only color tokens for transcript-style rendering", () => {
    expect(gradeToneTextColor("A")).toBe("text-success");
    expect(gradeToneTextColor("B")).toBe("text-info");
    expect(gradeToneTextColor("C")).toBe("text-muted-foreground");
    expect(gradeToneTextColor("D")).toBe("text-warning");
    expect(gradeToneTextColor("F")).toBe("text-destructive");
    expect(gradeToneTextColor("P")).toBe("text-success");
    expect(gradeToneTextColor(null)).toBe("text-muted-foreground");
  });
});
