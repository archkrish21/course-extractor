import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  // ── Rendering ─────────────────────────────────────────────────────
  it("renders a checkbox input", () => {
    render(<Checkbox id="test" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("renders with label text", () => {
    render(<Checkbox id="agree" label="I agree" />);
    expect(screen.getByText("I agree")).toBeInTheDocument();
  });

  it("associates label with checkbox via id", () => {
    render(<Checkbox id="terms" label="Accept terms" />);
    expect(screen.getByLabelText("Accept terms")).toBeInTheDocument();
  });

  // ── States ────────────────────────────────────────────────────────
  describe("states", () => {
    it("can be checked", async () => {
      const user = userEvent.setup();
      render(<Checkbox id="check" label="Check me" />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it("supports disabled state", () => {
      render(<Checkbox id="dis" label="Disabled" disabled />);
      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("supports defaultChecked", () => {
      render(<Checkbox id="def" label="Default" defaultChecked />);
      expect(screen.getByRole("checkbox")).toBeChecked();
    });
  });

  // ── Error ─────────────────────────────────────────────────────────
  describe("error", () => {
    it("displays error message", () => {
      render(<Checkbox id="err" label="Accept" error="Required" />);
      expect(screen.getByText("Required")).toBeInTheDocument();
    });

    it("error has role=alert", () => {
      render(<Checkbox id="err" error="Must accept" />);
      expect(screen.getByRole("alert")).toHaveTextContent("Must accept");
    });

    it("applies border-destructive when error present", () => {
      render(<Checkbox id="err" error="Error" />);
      expect(screen.getByRole("checkbox").className).toContain("border-destructive");
    });
  });

  // ── Styling ───────────────────────────────────────────────────────
  describe("styling", () => {
    it("has focus-visible outline", () => {
      render(<Checkbox id="focus" />);
      const cb = screen.getByRole("checkbox");
      expect(cb.className).toContain("focus-visible:outline-2");
    });

    it("label has cursor-pointer", () => {
      render(<Checkbox id="ptr" label="Click" />);
      const label = screen.getByText("Click").closest("label");
      expect(label?.className).toContain("cursor-pointer");
    });

    it("merges custom className", () => {
      render(<Checkbox id="custom" className="extra" />);
      expect(screen.getByRole("checkbox").className).toContain("extra");
    });
  });

  // ── Label rendering ───────────────────────────────────────────────
  it("renders without label when none provided", () => {
    const { container } = render(<Checkbox id="no-label" />);
    expect(container.querySelector("span")).toBeNull();
  });

  it("supports ReactNode as label", () => {
    render(
      <Checkbox
        id="rich"
        label={<span data-testid="rich-label">Rich <strong>label</strong></span>}
      />
    );
    expect(screen.getByTestId("rich-label")).toBeInTheDocument();
  });
});
