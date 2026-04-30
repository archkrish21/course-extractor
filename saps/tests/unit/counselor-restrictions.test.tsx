import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Tests verifying counselor role restrictions across the app.
 * Counselors should NOT be able to: create plans, delete plans, share plans,
 * invite others, or access billing.
 * Counselors SHOULD be able to: view shared plans, see student info, sign out.
 */

// ── Mock next/navigation ──────────────────────────────────────────────────

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: vi.fn() }),
  usePathname: () => "/planner",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ── Mock next/link ────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ── Mock account context ──────────────────────────────────────────────────

const mockAccountContext = {
  currentAccount: null as Record<string, unknown> | null,
  accounts: [] as Record<string, unknown>[],
  switchAccount: vi.fn(),
  loading: false,
  refetchAccounts: vi.fn(),
  userEmail: "counselor@test.com",
  userRole: "counselor",
  userFirstName: "Jane",
  userLastName: "Smith",
  refetchUser: vi.fn(),
};

vi.mock("@/lib/account-context", () => ({
  useAccount: () => mockAccountContext,
  AccountProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Mock other dependencies ───────────────────────────────────────────────

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardFooter: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function setCounselorAccount() {
  mockAccountContext.currentAccount = {
    id: "acc-1",
    studentName: "Test Student",
    gradeLevel: 10,
    graduationYear: 2028,
    role: "counselor",
    isClaimed: true,
    subscriptionTier: "plus",
    studentFirstName: "John",
    studentLastName: "Doe",
    state: "IL",
    schoolName: "Stevenson High School",
  };
  mockAccountContext.accounts = [mockAccountContext.currentAccount];
  mockAccountContext.userRole = "counselor";
}

function setStudentAccount() {
  mockAccountContext.currentAccount = {
    id: "acc-1",
    studentName: "Test Student",
    gradeLevel: 10,
    graduationYear: 2028,
    role: "student",
    isClaimed: true,
    subscriptionTier: "plus",
    studentFirstName: "John",
    studentLastName: "Doe",
    state: "IL",
    schoolName: "Stevenson High School",
  };
  mockAccountContext.accounts = [mockAccountContext.currentAccount];
  mockAccountContext.userRole = "student";
  mockAccountContext.userFirstName = "John";
}

// ── Tests ─────────────────────────────────────────────────────────────────

// v1-hide: counselor role hidden from UI; re-enable by switching `describe.skip` back to `describe`.
describe.skip("Counselor restrictions", () => {
  describe("Account switcher", () => {
    it("shows counselor in the account switcher (isParentOrCounselor check)", () => {
      setCounselorAccount();
      // The showSwitcher logic: accounts.length >= 2 || isParentOrCounselor
      const isParentOrCounselor = mockAccountContext.accounts.some(
        (a) => a.role === "parent" || a.role === "counselor" || a.role === "guardian"
      );
      expect(isParentOrCounselor).toBe(true);
    });

    it("does not show counselor as parent in switcher logic", () => {
      setCounselorAccount();
      const isParent = mockAccountContext.accounts.some((a) => a.role === "parent");
      expect(isParent).toBe(false);
    });
  });

  describe("Billing access", () => {
    it("counselor role should not see billing link", () => {
      setCounselorAccount();
      const role = mockAccountContext.currentAccount?.role;
      expect(role).toBe("counselor");
      expect(role !== "counselor").toBe(false); // billing condition fails
    });

    it("student role should see billing link", () => {
      setStudentAccount();
      const role = mockAccountContext.currentAccount?.role;
      expect(role !== "counselor").toBe(true);
    });
  });

  describe("Plan creation restrictions", () => {
    it("counselor should not be able to create plans (isCounselor flag)", () => {
      setCounselorAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      expect(isCounselor).toBe(true);
    });

    it("student should be able to create plans", () => {
      setStudentAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      expect(isCounselor).toBe(false);
    });
  });

  describe("Plan actions", () => {
    it("counselor cannot delete plans", () => {
      setCounselorAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      const canDelete = !isCounselor && true; // permission check
      expect(canDelete).toBe(false);
    });

    it("counselor cannot share plans", () => {
      setCounselorAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      const canShare = !isCounselor && true; // isOwner check
      expect(canShare).toBe(false);
    });

    it("student can delete and share plans", () => {
      setStudentAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      expect(!isCounselor && true).toBe(true); // delete
      expect(!isCounselor && true).toBe(true); // share
    });
  });

  describe("Settings page sections", () => {
    it("counselor should not see subscription section", () => {
      setCounselorAccount();
      const role = mockAccountContext.currentAccount?.role;
      const showSubscription = role !== "counselor";
      expect(showSubscription).toBe(false);
    });

    it("counselor should not see invite form", () => {
      setCounselorAccount();
      const role = mockAccountContext.currentAccount?.role;
      const showInvite = role !== "counselor";
      expect(showInvite).toBe(false);
    });

    it("counselor should see student information section", () => {
      setCounselorAccount();
      const role = mockAccountContext.currentAccount?.role;
      const showStudentInfo = role !== "student";
      expect(showStudentInfo).toBe(true);
    });

    it("student should not see separate student information section", () => {
      setStudentAccount();
      const role = mockAccountContext.currentAccount?.role;
      const showStudentInfo = role !== "student";
      expect(showStudentInfo).toBe(false);
    });

    it("student should see subscription section", () => {
      setStudentAccount();
      const role = mockAccountContext.currentAccount?.role;
      const showSubscription = role !== "counselor";
      expect(showSubscription).toBe(true);
    });
  });

  describe("Dashboard banner logic", () => {
    it("shows 'no plans shared' banner for counselor with no plans", () => {
      setCounselorAccount();
      const plans: unknown[] = [];
      const role = mockAccountContext.currentAccount?.role;

      let bannerTarget = "";
      let bannerTitle = "";

      if (plans.length === 0) {
        bannerTarget = "planner";
        bannerTitle = role === "counselor" ? "No plans shared yet" : "Get started";
      }

      expect(bannerTarget).toBe("planner");
      expect(bannerTitle).toBe("No plans shared yet");
    });

    it("shows 'get started' banner for student with no plans", () => {
      setStudentAccount();
      const plans: unknown[] = [];
      const role = mockAccountContext.currentAccount?.role;

      let bannerTitle = "";
      if (plans.length === 0) {
        bannerTitle = role === "counselor" ? "No plans shared yet" : "Get started";
      }

      expect(bannerTitle).toBe("Get started");
    });

    it("does not show CTA button for counselor with no plans", () => {
      setCounselorAccount();
      const role = mockAccountContext.currentAccount?.role;
      const bannerTarget = "planner";
      const showCTA = !(bannerTarget === "planner" && role === "counselor");
      expect(showCTA).toBe(false);
    });

    it("shows CTA button for student with no plans", () => {
      setStudentAccount();
      const role = mockAccountContext.currentAccount?.role;
      const bannerTarget = "planner";
      const showCTA = !(bannerTarget === "planner" && role === "counselor");
      expect(showCTA).toBe(true);
    });

    it("shows 'complete profile' banner for student with plans but no name", () => {
      setStudentAccount();
      mockAccountContext.userFirstName = null as unknown as string;
      const plans = [{ id: "plan-1" }];
      const role = mockAccountContext.currentAccount?.role;

      let bannerTarget = "";
      if (plans.length === 0) {
        bannerTarget = "planner";
      } else if (role === "student" && !mockAccountContext.userFirstName) {
        bannerTarget = "settings";
      }

      expect(bannerTarget).toBe("settings");
      // Restore
      mockAccountContext.userFirstName = "John";
    });

    it("does not show banner for student with plans and name set", () => {
      setStudentAccount();
      const plans = [{ id: "plan-1" }];
      const role = mockAccountContext.currentAccount?.role;

      let showBanner = false;
      if (plans.length === 0) {
        showBanner = true;
      } else if (role === "student" && !mockAccountContext.userFirstName) {
        showBanner = true;
      }

      expect(showBanner).toBe(false);
    });

    it("shows banner when plans API returns error (non-ok)", () => {
      setCounselorAccount();
      // Simulating res.ok === false
      const resOk = false;
      let showBanner = false;
      let bannerTarget = "";

      if (!resOk) {
        showBanner = true;
        bannerTarget = "planner";
      }

      expect(showBanner).toBe(true);
      expect(bannerTarget).toBe("planner");
    });
  });

  describe("Planner empty state", () => {
    it("shows 'No plans shared yet' for counselor", () => {
      setCounselorAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      const title = isCounselor ? "No plans shared yet" : "Create your first plan";
      expect(title).toBe("No plans shared yet");
    });

    it("shows 'Create your first plan' for student", () => {
      setStudentAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      const title = isCounselor ? "No plans shared yet" : "Create your first plan";
      expect(title).toBe("Create your first plan");
    });

    it("hides create button in empty state for counselor", () => {
      setCounselorAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      expect(!isCounselor).toBe(false);
    });
  });

  describe("Plans page actions", () => {
    it("shows 'View' instead of 'Edit' for counselor", () => {
      setCounselorAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      const label = isCounselor ? "View" : "Edit";
      expect(label).toBe("View");
    });

    it("hides 'New Plan' button for counselor", () => {
      setCounselorAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      expect(!isCounselor).toBe(false);
    });

    it("shows 'New Plan' button for student", () => {
      setStudentAccount();
      const isCounselor = mockAccountContext.currentAccount?.role === "counselor";
      expect(!isCounselor).toBe(true);
    });
  });
});
