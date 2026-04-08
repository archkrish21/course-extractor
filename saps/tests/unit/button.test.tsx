import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  // ── Rendering ─────────────────────────────────────────────────────
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("renders as a button element", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  // ── Variants ──────────────────────────────────────────────────────
  describe("variants", () => {
    it("applies default variant classes", () => {
      render(<Button>Default</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("bg-primary");
      expect(btn.className).toContain("text-primary-foreground");
    });

    it("applies outline variant classes", () => {
      render(<Button variant="outline">Outline</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("border");
      expect(btn.className).toContain("bg-transparent");
    });

    it("applies ghost variant classes", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("bg-transparent");
      expect(btn.className).toContain("hover:bg-muted");
    });

    it("applies destructive variant classes", () => {
      render(<Button variant="destructive">Delete</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("bg-destructive");
    });
  });

  // ── Sizes ─────────────────────────────────────────────────────────
  describe("sizes", () => {
    it("applies default size with min-h-[44px]", () => {
      render(<Button>Default</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("min-h-[44px]");
      expect(btn.className).toContain("h-11");
    });

    it("applies sm size", () => {
      render(<Button size="sm">Small</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("h-9");
    });

    it("applies lg size with min-h-[44px]", () => {
      render(<Button size="lg">Large</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("min-h-[44px]");
      expect(btn.className).toContain("h-12");
    });
  });

  // ── States ────────────────────────────────────────────────────────
  describe("states", () => {
    it("applies disabled attribute and styling", () => {
      render(<Button disabled>Disabled</Button>);
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      expect(btn.className).toContain("disabled:opacity-50");
      expect(btn.className).toContain("disabled:pointer-events-none");
    });

    it("has focus-visible outline classes", () => {
      render(<Button>Focus</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("focus-visible:outline-2");
      expect(btn.className).toContain("focus-visible:outline-offset-2");
      expect(btn.className).toContain("focus-visible:outline-ring");
    });
  });

  // ── Props ─────────────────────────────────────────────────────────
  describe("props", () => {
    it("forwards onClick handler", async () => {
      const user = userEvent.setup();
      let clicked = false;
      render(<Button onClick={() => { clicked = true; }}>Click</Button>);
      await user.click(screen.getByRole("button"));
      expect(clicked).toBe(true);
    });

    it("merges custom className", () => {
      render(<Button className="my-custom-class">Custom</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("my-custom-class");
      expect(btn.className).toContain("bg-primary"); // still has variant
    });

    it("forwards ref", () => {
      const ref = { current: null as HTMLButtonElement | null };
      render(<Button ref={ref}>Ref</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it("forwards type attribute", () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────
  describe("accessibility", () => {
    it("has rounded-lg for consistent border radius", () => {
      render(<Button>Rounded</Button>);
      expect(screen.getByRole("button").className).toContain("rounded-lg");
    });

    it("does not fire onClick when disabled", async () => {
      const user = userEvent.setup();
      let clicked = false;
      render(<Button disabled onClick={() => { clicked = true; }}>No</Button>);
      await user.click(screen.getByRole("button"));
      expect(clicked).toBe(false);
    });
  });
});
