import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// next/navigation isn't available in JSDOM — stub useRouter.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// hCaptcha pulls in browser-only globals; stub it to a no-op component.
vi.mock("@hcaptcha/react-hcaptcha", () => ({
  default: () => null,
}));

import SignupPage from "@/app/(auth)/signup/page";

// ── Helpers ─────────────────────────────────────────────────────────────────

function setSearch(search: string) {
  // jsdom permits direct mutation of window.location.search via history API.
  window.history.replaceState({}, "", `/signup${search}`);
}

function getRoleButtons() {
  return screen.getAllByRole("radio") as HTMLButtonElement[];
}

function findRole(label: string) {
  return getRoleButtons().find((b) => b.textContent?.includes(label));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("SignupPage — role pre-select & lock from invite URL", () => {
  beforeEach(() => {
    setSearch("");
  });

  afterEach(() => {
    setSearch("");
  });

  it("defaults to Student when no role param is in the URL", () => {
    render(<SignupPage />);
    const studentBtn = findRole("Student");
    const parentBtn = findRole("Parent");
    expect(studentBtn?.getAttribute("aria-checked")).toBe("true");
    expect(parentBtn?.getAttribute("aria-checked")).toBe("false");
    // No lock indicator
    expect(screen.queryByText(/Role set by your invite/i)).toBeNull();
  });

  it("pre-selects Parent when ?role=parent is in the URL", () => {
    setSearch("?invite=ABC&account=11111111-1111-4111-8111-111111111111&role=parent");
    render(<SignupPage />);
    const parentBtn = findRole("Parent");
    const studentBtn = findRole("Student");
    expect(parentBtn?.getAttribute("aria-checked")).toBe("true");
    expect(studentBtn?.getAttribute("aria-checked")).toBe("false");
  });

  it("pre-selects Guardian when ?role=guardian is in the URL", () => {
    setSearch("?role=guardian");
    render(<SignupPage />);
    expect(findRole("Guardian")?.getAttribute("aria-checked")).toBe("true");
  });

  it("disables the unselected role buttons when the role is locked by the URL", () => {
    setSearch("?invite=ABC&account=11111111-1111-4111-8111-111111111111&role=parent");
    render(<SignupPage />);

    const parentBtn = findRole("Parent")!;
    const studentBtn = findRole("Student")!;
    const guardianBtn = findRole("Guardian")!;

    expect(parentBtn.disabled).toBe(false);
    expect(studentBtn.disabled).toBe(true);
    expect(guardianBtn.disabled).toBe(true);

    // Clicking a disabled button must not change the role.
    fireEvent.click(studentBtn);
    expect(parentBtn.getAttribute("aria-checked")).toBe("true");
    expect(studentBtn.getAttribute("aria-checked")).toBe("false");
  });

  it("shows the 'Role set by your invite' hint only when locked", () => {
    setSearch("?role=parent");
    const { unmount } = render(<SignupPage />);
    expect(screen.getByText(/Role set by your invite/i)).toBeInTheDocument();
    unmount();

    setSearch("");
    render(<SignupPage />);
    expect(screen.queryByText(/Role set by your invite/i)).toBeNull();
  });

  it("ignores an unknown role param and leaves the default + buttons unlocked", () => {
    setSearch("?role=admin");
    render(<SignupPage />);
    expect(findRole("Student")?.getAttribute("aria-checked")).toBe("true");
    expect(findRole("Parent")?.disabled).toBe(false);
    expect(screen.queryByText(/Role set by your invite/i)).toBeNull();
  });

  it("ignores ?role=counselor (not in the visible role list) and stays unlocked", () => {
    // Counselor invites are not surfaced from the settings UI in v1, but the
    // signup form should still degrade gracefully if such a URL is hit.
    setSearch("?role=counselor");
    render(<SignupPage />);
    expect(findRole("Student")?.getAttribute("aria-checked")).toBe("true");
    expect(findRole("Parent")?.disabled).toBe(false);
  });
});
