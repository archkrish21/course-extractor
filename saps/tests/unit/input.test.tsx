import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  // ── Rendering ─────────────────────────────────────────────────────
  it("renders with a visible label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders an input element", () => {
    render(<Input label="Name" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("has min-h-[44px] for touch target", () => {
    render(<Input label="Touch" />);
    expect(screen.getByRole("textbox").className).toContain("min-h-[44px]");
  });

  it("has rounded-lg border radius", () => {
    render(<Input label="Rounded" />);
    expect(screen.getByRole("textbox").className).toContain("rounded-lg");
  });

  // ── Label ─────────────────────────────────────────────────────────
  describe("label", () => {
    it("associates label with input via htmlFor/id", () => {
      render(<Input label="Username" id="user-input" />);
      const input = screen.getByLabelText("Username");
      expect(input).toHaveAttribute("id", "user-input");
    });

    it("generates an id when none provided", () => {
      render(<Input label="Auto ID" />);
      const input = screen.getByLabelText("Auto ID");
      expect(input.id).toBeTruthy();
    });

    it("hides label visually with hideLabel", () => {
      render(<Input label="Hidden" hideLabel />);
      const label = screen.getByText("Hidden");
      expect(label.className).toContain("sr-only");
    });

    it("shows required indicator", () => {
      render(<Input label="Required" required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });

  // ── Error state ───────────────────────────────────────────────────
  describe("error", () => {
    it("displays error message", () => {
      render(<Input label="Email" error="Invalid email" />);
      expect(screen.getByText("Invalid email")).toBeInTheDocument();
    });

    it("error has role=alert", () => {
      render(<Input label="Email" error="Bad" />);
      expect(screen.getByRole("alert")).toHaveTextContent("Bad");
    });

    it("sets aria-invalid on the input", () => {
      render(<Input label="Email" error="Error" />);
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    });

    it("links input to error via aria-describedby", () => {
      render(<Input label="Email" id="email" error="Required" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-describedby", "email-error");
    });

    it("applies border-destructive on error", () => {
      render(<Input label="Email" error="Bad" />);
      expect(screen.getByRole("textbox").className).toContain("border-destructive");
    });
  });

  // ── Helper text ───────────────────────────────────────────────────
  describe("helperText", () => {
    it("displays helper text", () => {
      render(<Input label="Email" helperText="We won't share it" />);
      expect(screen.getByText("We won't share it")).toBeInTheDocument();
    });

    it("hides helper text when error is present", () => {
      render(<Input label="Email" helperText="Help" error="Error" />);
      expect(screen.queryByText("Help")).not.toBeInTheDocument();
      expect(screen.getByText("Error")).toBeInTheDocument();
    });
  });

  // ── Password toggle ───────────────────────────────────────────────
  describe("password", () => {
    it("renders as password type initially", () => {
      render(<Input label="Password" type="password" />);
      const input = screen.getByLabelText("Password");
      expect(input).toHaveAttribute("type", "password");
    });

    it("shows toggle button for password fields", () => {
      render(<Input label="Password" type="password" />);
      expect(screen.getByLabelText("Show password")).toBeInTheDocument();
    });

    it("toggles password visibility on click", async () => {
      const user = userEvent.setup();
      render(<Input label="Password" type="password" />);
      const input = screen.getByLabelText("Password");
      expect(input).toHaveAttribute("type", "password");

      await user.click(screen.getByLabelText("Show password"));
      expect(input).toHaveAttribute("type", "text");

      await user.click(screen.getByLabelText("Hide password"));
      expect(input).toHaveAttribute("type", "password");
    });

    it("does not show toggle for non-password types", () => {
      render(<Input label="Email" type="email" />);
      expect(screen.queryByLabelText("Show password")).not.toBeInTheDocument();
    });
  });

  // ── Focus states ──────────────────────────────────────────────────
  describe("focus", () => {
    it("has focus-visible outline classes", () => {
      render(<Input label="Focus" />);
      const input = screen.getByRole("textbox");
      expect(input.className).toContain("focus-visible:outline-2");
      expect(input.className).toContain("focus-visible:outline-ring");
    });
  });

  // ── Props forwarding ──────────────────────────────────────────────
  describe("props", () => {
    it("forwards placeholder", () => {
      render(<Input label="Search" placeholder="Type here..." />);
      expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
    });

    it("forwards disabled state", () => {
      render(<Input label="Disabled" disabled />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("merges custom className", () => {
      render(<Input label="Custom" className="my-class" />);
      expect(screen.getByRole("textbox").className).toContain("my-class");
    });
  });
});
