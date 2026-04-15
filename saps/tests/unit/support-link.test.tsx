import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/config/support", () => ({
  get SUPPORT_URL() {
    return (globalThis as { __SUPPORT_URL__?: string | null }).__SUPPORT_URL__ ?? null;
  },
}));

function setSupportUrl(value: string | null) {
  (globalThis as { __SUPPORT_URL__?: string | null }).__SUPPORT_URL__ = value;
}

async function importComponent() {
  vi.resetModules();
  const mod = await import("@/components/ui/support-link");
  return mod.SupportLink;
}

describe("SupportLink", () => {
  beforeEach(() => {
    setSupportUrl(null);
  });

  it("renders nothing when SUPPORT_URL is null", async () => {
    const SupportLink = await importComponent();
    const { container } = render(<SupportLink />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when SUPPORT_URL is empty string", async () => {
    setSupportUrl("");
    const SupportLink = await importComponent();
    const { container } = render(<SupportLink />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an anchor when SUPPORT_URL is set", async () => {
    setSupportUrl("https://ko-fi.com/saps");
    const SupportLink = await importComponent();
    render(<SupportLink />);
    const link = screen.getByRole("link", { name: /support saps/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
  });

  it("uses SUPPORT_URL as href", async () => {
    setSupportUrl("https://ko-fi.com/saps");
    const SupportLink = await importComponent();
    render(<SupportLink />);
    expect(screen.getByRole("link", { name: /support saps/i })).toHaveAttribute(
      "href",
      "https://ko-fi.com/saps",
    );
  });

  it("opens in a new tab with safe rel attributes", async () => {
    setSupportUrl("https://ko-fi.com/saps");
    const SupportLink = await importComponent();
    render(<SupportLink />);
    const link = screen.getByRole("link", { name: /support saps/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the 'Support SAPS' label", async () => {
    setSupportUrl("https://ko-fi.com/saps");
    const SupportLink = await importComponent();
    render(<SupportLink />);
    expect(screen.getByText("Support SAPS")).toBeInTheDocument();
  });

  it("renders a decorative SVG icon marked aria-hidden", async () => {
    setSupportUrl("https://ko-fi.com/saps");
    const SupportLink = await importComponent();
    const { container } = render(<SupportLink />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies default classes when no className is provided", async () => {
    setSupportUrl("https://ko-fi.com/saps");
    const SupportLink = await importComponent();
    render(<SupportLink />);
    const link = screen.getByRole("link", { name: /support saps/i });
    expect(link.className).toContain("inline-flex");
    expect(link.className).toContain("text-muted-foreground");
  });

  it("uses custom className when provided (overrides defaults)", async () => {
    setSupportUrl("https://ko-fi.com/saps");
    const SupportLink = await importComponent();
    render(<SupportLink className="custom-class" />);
    const link = screen.getByRole("link", { name: /support saps/i });
    expect(link.className).toBe("custom-class");
  });
});
