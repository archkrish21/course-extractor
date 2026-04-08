import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  // ── Rendering ─────────────────────────────────────────────────────
  it("renders children text", () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders as a span element", () => {
    render(<Badge>Test</Badge>);
    const el = screen.getByText("Test");
    expect(el.tagName).toBe("SPAN");
  });

  it("has rounded-full class", () => {
    render(<Badge>Pill</Badge>);
    expect(screen.getByText("Pill").className).toContain("rounded-full");
  });

  it("has text-xs and font-semibold", () => {
    render(<Badge>Small</Badge>);
    const el = screen.getByText("Small");
    expect(el.className).toContain("text-xs");
    expect(el.className).toContain("font-semibold");
  });

  // ── Default variant ───────────────────────────────────────────────
  it("applies default variant when none specified", () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText("Default");
    expect(el.className).toContain("bg-muted");
    expect(el.className).toContain("text-muted-foreground");
  });

  // ── All 8 variants ────────────────────────────────────────────────
  describe("variants", () => {
    const variants = [
      { name: "ap" as const, bgClass: "bg-ap-light", textClass: "text-ap" },
      { name: "honors" as const, bgClass: "bg-honors-light", textClass: "text-honors" },
      { name: "dual-credit" as const, bgClass: "bg-dual-credit-light", textClass: "text-dual-credit" },
      { name: "accelerated" as const, bgClass: "bg-accelerated-light", textClass: "text-accelerated" },
      { name: "success" as const, bgClass: "bg-success-light", textClass: "text-success" },
      { name: "warning" as const, bgClass: "bg-warning-light", textClass: "text-warning" },
      { name: "destructive" as const, bgClass: "bg-destructive-light", textClass: "text-destructive" },
    ];

    for (const { name, bgClass, textClass } of variants) {
      it(`applies ${name} variant classes`, () => {
        render(<Badge variant={name}>{name}</Badge>);
        const el = screen.getByText(name);
        expect(el.className).toContain(bgClass);
        expect(el.className).toContain(textClass);
      });
    }
  });

  // ── Props ─────────────────────────────────────────────────────────
  it("merges custom className", () => {
    render(<Badge className="extra-class">Custom</Badge>);
    const el = screen.getByText("Custom");
    expect(el.className).toContain("extra-class");
    expect(el.className).toContain("rounded-full"); // still has base
  });

  it("forwards additional HTML attributes", () => {
    render(<Badge data-testid="my-badge">Attr</Badge>);
    expect(screen.getByTestId("my-badge")).toBeInTheDocument();
  });

  it("applies whitespace-nowrap to prevent wrapping", () => {
    render(<Badge>No Wrap</Badge>);
    expect(screen.getByText("No Wrap").className).toContain("whitespace-nowrap");
  });
});
