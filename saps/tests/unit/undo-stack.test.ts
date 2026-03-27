import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoStack, UndoEntry } from "@/lib/hooks/use-undo-stack";

const makeAction = (type: "add_course" = "add_course") =>
  ({ type, planCourseIds: ["pc-1"] }) as UndoEntry["action"];

describe("useUndoStack", () => {
  // ── Push ──────────────────────────────────────────────────────────
  describe("push", () => {
    it("pushes an entry and the stack has 1 item", () => {
      const { result } = renderHook(() => useUndoStack());
      act(() => {
        result.current.push("Add course", makeAction());
      });
      expect(result.current.stack).toHaveLength(1);
      expect(result.current.count).toBe(1);
    });

    it("entries have an id, label, timestamp, and action", () => {
      const { result } = renderHook(() => useUndoStack());
      let entry: UndoEntry | undefined;
      act(() => {
        entry = result.current.push("Add course", makeAction());
      });
      expect(entry!.id).toMatch(/^undo-/);
      expect(entry!.label).toBe("Add course");
      expect(entry!.timestamp).toBeGreaterThan(0);
      expect(entry!.action.type).toBe("add_course");
    });
  });

  // ── Pop ───────────────────────────────────────────────────────────
  describe("pop", () => {
    it("pops the most recently pushed entry", () => {
      const { result } = renderHook(() => useUndoStack());
      act(() => {
        result.current.push("First", makeAction());
        result.current.push("Second", makeAction());
      });
      let popped: UndoEntry | null = null;
      act(() => {
        popped = result.current.pop();
      });
      expect(popped!.label).toBe("Second");
      expect(result.current.stack).toHaveLength(1);
    });

    it("returns null when popping from an empty stack", () => {
      const { result } = renderHook(() => useUndoStack());
      let popped: UndoEntry | null = null;
      act(() => {
        popped = result.current.pop();
      });
      expect(popped).toBeNull();
    });

    it("returns entries in LIFO order", () => {
      const { result } = renderHook(() => useUndoStack());
      act(() => {
        result.current.push("First", makeAction());
        result.current.push("Second", makeAction());
        result.current.push("Third", makeAction());
      });
      const labels: string[] = [];
      act(() => {
        labels.push(result.current.pop()!.label);
        labels.push(result.current.pop()!.label);
        labels.push(result.current.pop()!.label);
      });
      expect(labels).toEqual(["Third", "Second", "First"]);
    });
  });

  // ── MAX_STACK_SIZE ────────────────────────────────────────────────
  describe("MAX_STACK_SIZE", () => {
    it("keeps only 20 entries when 25 are pushed", () => {
      const { result } = renderHook(() => useUndoStack());
      act(() => {
        for (let i = 0; i < 25; i++) {
          result.current.push(`Entry ${i}`, makeAction());
        }
      });
      expect(result.current.stack).toHaveLength(20);
      // Most recent should be entry 24 (last pushed)
      expect(result.current.stack[0].label).toBe("Entry 24");
    });
  });

  // ── Clear ─────────────────────────────────────────────────────────
  describe("clear", () => {
    it("empties the stack", () => {
      const { result } = renderHook(() => useUndoStack());
      act(() => {
        result.current.push("A", makeAction());
        result.current.push("B", makeAction());
      });
      expect(result.current.stack).toHaveLength(2);
      act(() => {
        result.current.clear();
      });
      expect(result.current.stack).toHaveLength(0);
      expect(result.current.count).toBe(0);
    });
  });

  // ── canUndo ───────────────────────────────────────────────────────
  describe("canUndo", () => {
    it("is false when the stack is empty", () => {
      const { result } = renderHook(() => useUndoStack());
      expect(result.current.canUndo).toBe(false);
    });

    it("is true when the stack has entries", () => {
      const { result } = renderHook(() => useUndoStack());
      act(() => {
        result.current.push("A", makeAction());
      });
      expect(result.current.canUndo).toBe(true);
    });

    it("becomes false after popping the last entry", () => {
      const { result } = renderHook(() => useUndoStack());
      act(() => {
        result.current.push("A", makeAction());
      });
      expect(result.current.canUndo).toBe(true);
      act(() => {
        result.current.pop();
      });
      expect(result.current.canUndo).toBe(false);
    });
  });

  // ── peek ──────────────────────────────────────────────────────────
  describe("peek", () => {
    it("returns null when the stack is empty", () => {
      const { result } = renderHook(() => useUndoStack());
      expect(result.current.peek).toBeNull();
    });

    it("returns the most recent entry without removing it", () => {
      const { result } = renderHook(() => useUndoStack());
      act(() => {
        result.current.push("First", makeAction());
        result.current.push("Second", makeAction());
      });
      expect(result.current.peek!.label).toBe("Second");
      // Stack should still have 2 items
      expect(result.current.stack).toHaveLength(2);
    });
  });

  // ── Multiple push/pop cycles ──────────────────────────────────────
  describe("multiple push/pop cycles", () => {
    it("works correctly across push and pop cycles", () => {
      const { result } = renderHook(() => useUndoStack());

      // Push 3, pop 2
      act(() => {
        result.current.push("A", makeAction());
        result.current.push("B", makeAction());
        result.current.push("C", makeAction());
      });
      act(() => {
        result.current.pop(); // C
        result.current.pop(); // B
      });
      expect(result.current.stack).toHaveLength(1);
      expect(result.current.peek!.label).toBe("A");

      // Push 2 more
      act(() => {
        result.current.push("D", makeAction());
        result.current.push("E", makeAction());
      });
      expect(result.current.stack).toHaveLength(3);

      // Pop all
      const labels: string[] = [];
      act(() => {
        labels.push(result.current.pop()!.label);
        labels.push(result.current.pop()!.label);
        labels.push(result.current.pop()!.label);
      });
      expect(labels).toEqual(["E", "D", "A"]);
      expect(result.current.canUndo).toBe(false);
    });
  });
});
