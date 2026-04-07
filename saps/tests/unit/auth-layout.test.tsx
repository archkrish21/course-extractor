import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock next/link ────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
}));

import AuthLayout from "@/app/(auth)/layout";

describe("Auth Layout", () => {
  it("renders children", () => {
    render(<AuthLayout><p>Test content</p></AuthLayout>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders SAPS logo as a link to home", () => {
    render(<AuthLayout><p>Test</p></AuthLayout>);
    const logoLink = screen.getByText("SAPS").closest("a");
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("renders Home link in footer", () => {
    render(<AuthLayout><p>Test</p></AuthLayout>);
    const homeLink = screen.getByText("Home");
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders Terms of Service link in footer", () => {
    render(<AuthLayout><p>Test</p></AuthLayout>);
    const tosLink = screen.getByText("Terms of Service");
    expect(tosLink).toBeInTheDocument();
    expect(tosLink.closest("a")).toHaveAttribute("href", "/terms");
  });

  it("renders Privacy Policy link in footer", () => {
    render(<AuthLayout><p>Test</p></AuthLayout>);
    const ppLink = screen.getByText("Privacy Policy");
    expect(ppLink).toBeInTheDocument();
    expect(ppLink.closest("a")).toHaveAttribute("href", "/privacy");
  });

  it("renders subtitle text", () => {
    render(<AuthLayout><p>Test</p></AuthLayout>);
    expect(screen.getByText("Student Academic Planning System")).toBeInTheDocument();
  });
});
