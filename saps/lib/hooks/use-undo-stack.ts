"use client";

import { useState, useCallback, useRef } from "react";

export interface UndoAction {
  type: "add_course" | "remove_course" | "clear_semester" | "clear_grade" | "change_status" | "change_grade";
}

export interface UndoAddCourse extends UndoAction {
  type: "add_course";
  planCourseIds: string[];
}

export interface UndoRemoveCourse extends UndoAction {
  type: "remove_course";
  courses: Array<{
    courseId: string;
    gradeLevel: number;
    semester: number;
    status: string;
    grade: string | null;
  }>;
}

export interface UndoClearSemester extends UndoAction {
  type: "clear_semester";
  courses: Array<{
    courseId: string;
    gradeLevel: number;
    semester: number;
    status: string;
    grade: string | null;
  }>;
}

export interface UndoClearGrade extends UndoAction {
  type: "clear_grade";
  courses: Array<{
    courseId: string;
    gradeLevel: number;
    semester: number;
    status: string;
    grade: string | null;
  }>;
}

export interface UndoChangeStatus extends UndoAction {
  type: "change_status";
  planCourseId: string;
  previousStatus: string;
}

export interface UndoChangeGrade extends UndoAction {
  type: "change_grade";
  planCourseId: string;
  previousGrade: string | null;
}

export type UndoEntry = {
  id: string;
  label: string;
  timestamp: number;
  action:
    | UndoAddCourse
    | UndoRemoveCourse
    | UndoClearSemester
    | UndoClearGrade
    | UndoChangeStatus
    | UndoChangeGrade;
};

const MAX_STACK_SIZE = 20;

export function useUndoStack() {
  const [stack, setStack] = useState<UndoEntry[]>([]);
  // Synchronous copy of the stack for pop() — React state updates are async
  const stackRef = useRef<UndoEntry[]>([]);
  const idCounter = useRef(0);

  const push = useCallback((label: string, action: UndoEntry["action"]) => {
    const entry: UndoEntry = {
      id: `undo-${++idCounter.current}-${Date.now()}`,
      label,
      timestamp: Date.now(),
      action,
    };
    const next = [entry, ...stackRef.current].slice(0, MAX_STACK_SIZE);
    stackRef.current = next;
    setStack(next);
    return entry;
  }, []);

  const pop = useCallback((): UndoEntry | null => {
    if (stackRef.current.length === 0) return null;
    const popped = stackRef.current[0];
    const next = stackRef.current.slice(1);
    stackRef.current = next;
    setStack(next);
    return popped;
  }, []);

  const peek = stack.length > 0 ? stack[0] : null;

  const clear = useCallback(() => {
    stackRef.current = [];
    setStack([]);
  }, []);

  return {
    stack,
    push,
    pop,
    peek,
    clear,
    canUndo: stack.length > 0,
    count: stack.length,
  };
}
