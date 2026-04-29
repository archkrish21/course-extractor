import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TourInvite } from "@/components/tour-invite";

describe("TourInvite", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <TourInvite
        visible={false}
        title="Tour the planner?"
        description="A walkthrough of the planner."
        onStart={() => {}}
        onSkip={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders title, description, and both action buttons when visible", () => {
    render(
      <TourInvite
        visible
        title="Tour the planner?"
        description="A walkthrough of the planner."
        onStart={() => {}}
        onSkip={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Guided tour invitation" })).toBeInTheDocument();
    expect(screen.getByText("Tour the planner?")).toBeInTheDocument();
    expect(screen.getByText("A walkthrough of the planner.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start tour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });

  it("calls onStart when 'Start tour' is clicked", () => {
    const onStart = vi.fn();
    render(
      <TourInvite
        visible
        title="x"
        description="y"
        onStart={onStart}
        onSkip={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start tour" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when 'Skip' is clicked", () => {
    const onSkip = vi.fn();
    render(
      <TourInvite
        visible
        title="x"
        description="y"
        onStart={() => {}}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when the dismiss icon button is clicked", () => {
    const onSkip = vi.fn();
    render(
      <TourInvite
        visible
        title="x"
        description="y"
        onStart={() => {}}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss tour invitation" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when Escape is pressed", () => {
    const onSkip = vi.fn();
    render(
      <TourInvite
        visible
        title="x"
        description="y"
        onStart={() => {}}
        onSkip={onSkip}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
