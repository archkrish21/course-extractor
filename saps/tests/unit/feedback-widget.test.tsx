import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedbackWidget } from "@/components/feedback-widget";

// next/navigation isn't running in JSDOM — stub usePathname.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn().mockResolvedValue(new Response("{}")),
}));

describe("FeedbackWidget — star rating styling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function openWidget() {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /send feedback/i }));
  }

  // PR #95: empty-state stars used `text-border`, which in dark mode
  // (#3A2930) was indistinguishable from the card bg (#262128). They
  // were nearly invisible until hovered. Switched to text-muted-foreground/60.
  it("unselected stars use text-muted-foreground/60 so they stay visible in dark mode", () => {
    openWidget();
    const starButtons = screen.getAllByRole("button", { name: /^Rate \d star/ });
    expect(starButtons).toHaveLength(5);

    for (const btn of starButtons) {
      const svg = btn.querySelector("svg")!;
      expect(svg.getAttribute("class")).toContain("text-muted-foreground/60");
      expect(svg.getAttribute("class")).toContain("fill-none");
      expect(svg.getAttribute("class")).not.toContain("text-border");
    }
  });

  it("selected/hovered stars use fill-warning text-warning", () => {
    openWidget();
    const starButtons = screen.getAllByRole("button", { name: /^Rate \d star/ });

    fireEvent.click(starButtons[2]); // 3-star rating

    const svgs = starButtons.map((b) => b.querySelector("svg")!);
    // Stars 1-3 should be filled
    for (let i = 0; i < 3; i++) {
      expect(svgs[i].getAttribute("class")).toContain("fill-warning");
      expect(svgs[i].getAttribute("class")).toContain("text-warning");
    }
    // Stars 4-5 stay empty
    for (let i = 3; i < 5; i++) {
      expect(svgs[i].getAttribute("class")).toContain("fill-none");
      expect(svgs[i].getAttribute("class")).toContain("text-muted-foreground/60");
    }
  });
});
