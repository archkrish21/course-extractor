import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/toast";

// Helper component to trigger toasts
function ToastTrigger({ message, undoAction, duration }: { message: string; undoAction?: () => void; duration?: number }) {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast(message, undoAction, duration)}>
      Show Toast
    </button>
  );
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("Toast", () => {
  // ── Rendering ─────────────────────────────────────────────────────
  it("renders toast container with aria-live polite", () => {
    const { container } = renderWithProvider(<ToastTrigger message="Test" />);
    const liveRegion = container.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
  });

  it("renders toast message when triggered", async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Saved!" />);
    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("toast has role=status", async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Status" />);
    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // ── Auto-dismiss ──────────────────────────────────────────────────
  it("auto-dismisses after default duration (5000ms)", async () => {
    vi.useFakeTimers();
    renderWithProvider(<ToastTrigger message="Bye" />);

    // Trigger toast inside act
    act(() => { screen.getByText("Show Toast").click(); });
    expect(screen.getByText("Bye")).toBeInTheDocument();

    // Advance past duration + exit animation
    act(() => { vi.advanceTimersByTime(5200); });
    expect(screen.queryByText("Bye")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("respects custom duration", async () => {
    vi.useFakeTimers();
    renderWithProvider(<ToastTrigger message="Quick" duration={1000} />);

    act(() => { screen.getByText("Show Toast").click(); });
    expect(screen.getByText("Quick")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText("Quick")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByText("Quick")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  // ── Dismiss button ────────────────────────────────────────────────
  it("has a dismiss button with aria-label", async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Dismiss me" />);
    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByLabelText("Dismiss")).toBeInTheDocument();
  });

  it("dismisses on clicking X button", async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Close me" />);
    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Close me")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Dismiss"));
    // Wait for exit animation (200ms)
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText("Close me")).not.toBeInTheDocument();
  });

  // ── Undo action ───────────────────────────────────────────────────
  it("shows Undo button when undoAction provided", async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    renderWithProvider(<ToastTrigger message="Deleted" undoAction={undo} />);
    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Undo")).toBeInTheDocument();
  });

  it("does not show Undo button when no undoAction", async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="No undo" />);
    await user.click(screen.getByText("Show Toast"));
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();
  });

  it("calls undoAction when Undo clicked", async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    renderWithProvider(<ToastTrigger message="Deleted" undoAction={undo} />);
    await user.click(screen.getByText("Show Toast"));
    await user.click(screen.getByText("Undo"));
    expect(undo).toHaveBeenCalledOnce();
  });

  // ── Multiple toasts ───────────────────────────────────────────────
  it("can display multiple toasts simultaneously", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <>
        <ToastTrigger message="First" />
        <ToastTrigger message="Second" />
      </>
    );
    const buttons = screen.getAllByText("Show Toast");
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  // ── Styling ───────────────────────────────────────────────────────
  it("toast has design system styling", async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Styled" />);
    await user.click(screen.getByText("Show Toast"));
    const toast = screen.getByRole("status");
    expect(toast.className).toContain("rounded-lg");
    expect(toast.className).toContain("border-border");
    expect(toast.className).toContain("shadow-lg");
  });
});
