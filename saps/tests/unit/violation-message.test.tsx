import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViolationMessage } from "@/components/planner/violation-message";
import type { MessageSegment } from "@/lib/planner/format-violation-message";

describe("ViolationMessage", () => {
  it("renders text segments as plain text", () => {
    const segments: MessageSegment[] = [
      { kind: "text", text: "no codes here." },
    ];
    render(<ViolationMessage segments={segments} />);
    expect(screen.getByText("no codes here.")).toBeInTheDocument();
  });

  it("renders a name segment as visible text", () => {
    const segments: MessageSegment[] = [
      { kind: "name", name: "AP COMPUTER SCIENCE A", codes: ["CSC391/CSC392"] },
    ];
    render(<ViolationMessage segments={segments} />);
    expect(screen.getByText("AP COMPUTER SCIENCE A")).toBeInTheDocument();
  });

  it("does NOT render the code tooltip until the name is hovered", () => {
    // The card popover uses an overflow-y-auto <ul>. A CSS-only opacity
    // tooltip leaves the tooltip element in the DOM and can both leak
    // through and break the parent's scrollbar. Conditional render is the
    // contract this test pins.
    const segments: MessageSegment[] = [
      { kind: "name", name: "Computer Programming 2", codes: ["CSC181"] },
    ];
    render(<ViolationMessage segments={segments} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("reveals the code tooltip on mouseEnter and hides it on mouseLeave", () => {
    const segments: MessageSegment[] = [
      { kind: "name", name: "Computer Programming 2", codes: ["CSC181"] },
    ];
    render(<ViolationMessage segments={segments} />);
    const chip = screen.getByText("Computer Programming 2");
    const wrapper = chip.parentElement!;

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole("tooltip")).toHaveTextContent("CSC181");

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("reveals the code tooltip on focus (keyboard navigation)", () => {
    const segments: MessageSegment[] = [
      { kind: "name", name: "Algebra 2", codes: ["MTH201"] },
    ];
    render(<ViolationMessage segments={segments} />);
    const chip = screen.getByText("Algebra 2");
    const wrapper = chip.parentElement!;

    fireEvent.focus(wrapper);
    expect(screen.getByRole("tooltip")).toHaveTextContent("MTH201");

    fireEvent.blur(wrapper);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("joins multiple codes with ' / ' in the tooltip", () => {
    const segments: MessageSegment[] = [
      {
        kind: "name",
        name: "Computer Programming 2",
        codes: ["CSC181", "CSC82S", "CSC182"],
      },
    ];
    render(<ViolationMessage segments={segments} />);
    fireEvent.mouseEnter(screen.getByText("Computer Programming 2").parentElement!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("CSC181 / CSC82S / CSC182");
  });

  it("does not attach hover handlers when codes are empty (nothing to show)", () => {
    const segments: MessageSegment[] = [
      { kind: "name", name: "Unknown Course", codes: [] },
    ];
    render(<ViolationMessage segments={segments} />);
    fireEvent.mouseEnter(screen.getByText("Unknown Course").parentElement!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
