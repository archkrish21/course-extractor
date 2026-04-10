import { describe, it, expect, vi } from "vitest";

// `@/lib/auth/plan-permissions` imports `@/lib/db`, which throws at module load
// time if DATABASE_URL is unset. `hasPermission` itself is pure and doesn't
// touch the db, so stub the db module before importing.
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({ planShares: {}, accountMembers: {} }));

import { hasPermission, type PlanPermission } from "@/lib/auth/plan-permissions";

describe("hasPermission", () => {
  // ── Owner has all permissions ─────────────────────────────────────
  describe("owner", () => {
    it("can view", () => {
      expect(hasPermission("owner", "view")).toBe(true);
    });

    it("can edit", () => {
      expect(hasPermission("owner", "edit")).toBe(true);
    });

    it("can delete", () => {
      expect(hasPermission("owner", "delete")).toBe(true);
    });

    it("satisfies owner requirement", () => {
      expect(hasPermission("owner", "owner")).toBe(true);
    });
  });

  // ── Delete permission ─────────────────────────────────────────────
  describe("delete", () => {
    it("can view", () => {
      expect(hasPermission("delete", "view")).toBe(true);
    });

    it("can edit", () => {
      expect(hasPermission("delete", "edit")).toBe(true);
    });

    it("can delete", () => {
      expect(hasPermission("delete", "delete")).toBe(true);
    });

    it("cannot act as owner", () => {
      expect(hasPermission("delete", "owner")).toBe(false);
    });
  });

  // ── Edit permission ───────────────────────────────────────────────
  describe("edit", () => {
    it("can view", () => {
      expect(hasPermission("edit", "view")).toBe(true);
    });

    it("can edit", () => {
      expect(hasPermission("edit", "edit")).toBe(true);
    });

    it("cannot delete", () => {
      expect(hasPermission("edit", "delete")).toBe(false);
    });

    it("cannot act as owner", () => {
      expect(hasPermission("edit", "owner")).toBe(false);
    });
  });

  // ── View permission ───────────────────────────────────────────────
  describe("view", () => {
    it("can view", () => {
      expect(hasPermission("view", "view")).toBe(true);
    });

    it("cannot edit", () => {
      expect(hasPermission("view", "edit")).toBe(false);
    });

    it("cannot delete", () => {
      expect(hasPermission("view", "delete")).toBe(false);
    });

    it("cannot act as owner", () => {
      expect(hasPermission("view", "owner")).toBe(false);
    });
  });

  // ── Hierarchy is strictly ordered ─────────────────────────────────
  describe("hierarchy", () => {
    const levels: PlanPermission[] = ["view", "edit", "delete", "owner"];

    it("higher permissions satisfy all lower requirements", () => {
      for (let i = 0; i < levels.length; i++) {
        for (let j = 0; j <= i; j++) {
          expect(hasPermission(levels[i], levels[j])).toBe(true);
        }
      }
    });

    it("lower permissions do not satisfy higher requirements", () => {
      for (let i = 0; i < levels.length; i++) {
        for (let j = i + 1; j < levels.length; j++) {
          expect(hasPermission(levels[i], levels[j])).toBe(false);
        }
      }
    });
  });
});
