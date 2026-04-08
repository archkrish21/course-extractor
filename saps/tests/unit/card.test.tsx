import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

describe("Card", () => {
  // ── Card ──────────────────────────────────────────────────────────
  describe("Card", () => {
    it("renders children", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("has design system classes: rounded-xl, border, shadow-sm", () => {
      render(<Card data-testid="card">Content</Card>);
      const el = screen.getByTestId("card");
      expect(el.className).toContain("rounded-xl");
      expect(el.className).toContain("border");
      expect(el.className).toContain("border-border");
      expect(el.className).toContain("shadow-sm");
    });

    it("has bg-card and text-card-foreground", () => {
      render(<Card data-testid="card">Content</Card>);
      const el = screen.getByTestId("card");
      expect(el.className).toContain("bg-card");
      expect(el.className).toContain("text-card-foreground");
    });

    it("merges custom className", () => {
      render(<Card className="my-class" data-testid="card">Content</Card>);
      const el = screen.getByTestId("card");
      expect(el.className).toContain("my-class");
      expect(el.className).toContain("rounded-xl");
    });

    it("forwards HTML attributes", () => {
      render(<Card data-testid="card" role="article">Content</Card>);
      expect(screen.getByTestId("card")).toHaveAttribute("role", "article");
    });
  });

  // ── CardHeader ────────────────────────────────────────────────────
  describe("CardHeader", () => {
    it("renders children", () => {
      render(<CardHeader>Header</CardHeader>);
      expect(screen.getByText("Header")).toBeInTheDocument();
    });

    it("has p-5 padding and pb-0", () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      const el = screen.getByTestId("header");
      expect(el.className).toContain("p-5");
      expect(el.className).toContain("pb-0");
    });

    it("has flex-col layout", () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      expect(screen.getByTestId("header").className).toContain("flex-col");
    });
  });

  // ── CardContent ───────────────────────────────────────────────────
  describe("CardContent", () => {
    it("renders children", () => {
      render(<CardContent>Body</CardContent>);
      expect(screen.getByText("Body")).toBeInTheDocument();
    });

    it("has p-5 padding", () => {
      render(<CardContent data-testid="content">Body</CardContent>);
      expect(screen.getByTestId("content").className).toContain("p-5");
    });
  });

  // ── CardFooter ────────────────────────────────────────────────────
  describe("CardFooter", () => {
    it("renders children", () => {
      render(<CardFooter>Footer</CardFooter>);
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });

    it("has p-5 padding and pt-0", () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const el = screen.getByTestId("footer");
      expect(el.className).toContain("p-5");
      expect(el.className).toContain("pt-0");
    });

    it("has flex items-center layout", () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const el = screen.getByTestId("footer");
      expect(el.className).toContain("flex");
      expect(el.className).toContain("items-center");
    });
  });

  // ── Composition ───────────────────────────────────────────────────
  describe("composition", () => {
    it("renders full Card with Header, Content, and Footer", () => {
      render(
        <Card data-testid="card">
          <CardHeader>Title</CardHeader>
          <CardContent>Body text</CardContent>
          <CardFooter>Actions</CardFooter>
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card).toBeInTheDocument();
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Body text")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });
});
