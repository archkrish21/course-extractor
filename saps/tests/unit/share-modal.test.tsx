import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock dependencies ─────────────────────────────────────────────────────

vi.mock("@/lib/account-context", () => ({
  useAccount: () => ({
    currentAccount: { id: "acc-1", role: "student" },
    accounts: [],
    loading: false,
    userEmail: "student@test.com",
    userRole: "student",
    userFirstName: "Test",
    userLastName: "User",
  }),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [] }),
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void; [key: string]: unknown }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <span {...props}>{children}</span>
  ),
}));

import { ShareModal } from "@/components/plans/share-modal";

describe("ShareModal", () => {
  const defaultProps = {
    planId: "plan-1",
    planName: "My Academic Plan",
    accountId: "acc-1",
    createdBy: "user-1",
    currentUserId: "user-1",
    isOpen: true,
    onClose: vi.fn(),
    onUpdated: vi.fn(),
  };

  it("renders the share title", async () => {
    render(<ShareModal {...defaultProps} />);
    // findBy* awaits the post-mount fetch effect so its setState lands inside act
    expect(await screen.findByText(/Share/)).toBeInTheDocument();
  });

  it("has a close button with aria-label", async () => {
    render(<ShareModal {...defaultProps} />);
    expect(await screen.findByLabelText("Close share dialog")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShareModal {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByLabelText("Close share dialog"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<ShareModal {...defaultProps} onClose={onClose} />);
    const backdrop = container.querySelector("[aria-hidden='true']");
    if (backdrop) await user.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has a dialog role with aria-modal", async () => {
    render(<ShareModal {...defaultProps} />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("returns null when isOpen is false", () => {
    const { container } = render(<ShareModal {...defaultProps} isOpen={false} />);
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });
});
