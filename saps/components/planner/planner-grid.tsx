"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { PlanCourseCard } from "./plan-course-card";
import type { PlanCourse, Violation } from "./plan-course-card";
import { calculateGPA, formatGPA } from "@/lib/gpa/calc";

export type { PlanCourse, Violation };

interface PlannerGridProps {
  planId: string;
  courses: PlanCourse[];
  currentGradeLevel: number;
  lockedGradeLevels?: number[];
  onAddCourse: (gradeLevel: number, semester: number) => void;
  onRemoveCourse: (planCourseId: string) => void;
  onCourseClick: (planCourse: PlanCourse) => void;
  onStatusChange?: (planCourseId: string, status: PlanCourse["status"]) => void;
  onGradeChange?: (planCourseId: string, grade: string | null) => void;
  onClearSemester?: (gradeLevel: number, semester: number) => void;
  onClearGrade?: (gradeLevel: number) => void;
  onViewDetails?: (courseId: string) => void;
  onBulkStatusChange?: (planCourseIds: string[], status: PlanCourse["status"]) => void;
  onBulkGradeChange?: (planCourseIds: string[], grade: string | null) => void;
  onGpaWaiverToggle?: (planCourseId: string, applied: boolean) => void;
  onToggleGradeLock?: (gradeLevel: number, locked: boolean) => void;
  violations: Record<string, Violation[]>;
  semesterGaps?: Record<string, string[]>;
  focusGrade?: { grade: number; semester: number } | null;
  readOnly?: boolean;
}

const GRADE_LEVELS = [9, 10, 11, 12];
const SEMESTERS = [1, 2];

// Sort order for courses within a semester cell:
// 1. Early Bird  2. Language Arts (Communication Arts)  3. Math  4. Science
// 5. World Language (Multilingual Learning)  6. Electives  7. PE (Physical Welfare)
function getCourseSortOrder(course: PlanCourse): number {
  const name = (course.name ?? "").toLowerCase();
  const code = (course.code ?? "").toUpperCase();
  const div = (course.divisionName ?? "").toLowerCase();

  // 1. Early Bird courses (code contains E1/E2 pattern or name contains "early bird")
  if (name.includes("early bird") || /E\d$/.test(code) || /E\d\//.test(code)) return 0;

  // 2. Language Arts = Communication Arts division
  if (div.includes("communication arts")) return 1;

  // 3. Math
  if (div.includes("mathematics")) return 2;

  // 4. Science
  if (div.includes("science") && !div.includes("computer")) return 3;

  // 5. World Language = Multilingual Learning
  if (div.includes("multilingual")) return 4;

  // 7. PE = Physical Welfare (placed last)
  if (div.includes("physical welfare")) return 7;

  // 8. Social Studies
  if (div.includes("social studies")) return 5;

  // 6. Everything else = Electives (Applied Arts, CS/Engineering, Fine Arts)
  return 6;
}

function sortCourses(courses: PlanCourse[]): PlanCourse[] {
  return [...courses].sort((a, b) => getCourseSortOrder(a) - getCourseSortOrder(b));
}

function getSemesterCourses(
  courses: PlanCourse[],
  gradeLevel: number,
  semester: number
): PlanCourse[] {
  return courses.filter(
    (c) => c.gradeLevel === gradeLevel && c.semester === semester
  );
}

function getFullYearCourses(
  courses: PlanCourse[],
  gradeLevel: number
): PlanCourse[] {
  return courses.filter(
    (c) => c.gradeLevel === gradeLevel && c.semester === null
  );
}

// Keep for backward compat with mobile accordion
function getCoursesForCell(
  courses: PlanCourse[],
  gradeLevel: number,
  semester: number
): PlanCourse[] {
  return courses.filter(
    (c) =>
      c.gradeLevel === gradeLevel &&
      (c.semester === semester || c.semester === null)
  );
}

// ---- Desktop Grid ----

function DesktopGrid({
  planId,
  courses,
  currentGradeLevel,
  lockedGradeLevels = [],
  onAddCourse,
  onRemoveCourse,
  onCourseClick,
  onStatusChange,
  onGradeChange,
  onClearSemester,
  onClearGrade,
  onViewDetails,
  onBulkStatusChange,
  onBulkGradeChange,
  onGpaWaiverToggle,
  onToggleGradeLock,
  violations,
  semesterGaps,
  focusGrade,
  readOnly,
}: PlannerGridProps) {
  // Effective current grade = first unlocked grade level at or after account grade level
  const effectiveGrade = GRADE_LEVELS.find((g) => !lockedGradeLevels.includes(g)) ?? currentGradeLevel;
  const gridRef = useRef<HTMLDivElement>(null);
  const [collapsedGrades, setCollapsedGrades] = useState<Set<number>>(
    () => new Set(GRADE_LEVELS.filter((g) => g !== effectiveGrade))
  );
  const [highlightedSem, setHighlightedSem] = useState<{ grade: number; semester: number } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{
    row: number;
    col: number;
  }>({ row: 0, col: 0 });

  // When focusGrade changes, expand only that grade and highlight the semester
  useEffect(() => {
    if (!focusGrade) return;
    setCollapsedGrades(new Set(GRADE_LEVELS.filter((g) => g !== focusGrade.grade)));
    setHighlightedSem(focusGrade);
    // Scroll to the grade after a short delay for DOM update
    setTimeout(() => {
      const gradeSpan = document.querySelector(`[data-grade="${focusGrade.grade}"]`);
      gradeSpan?.closest('button[role="rowheader"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    // Clear highlight after 3 seconds
    const timer = setTimeout(() => setHighlightedSem(null), 3000);
    return () => clearTimeout(timer);
  }, [focusGrade]);

  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCellRef = useCallback(
    (row: number, col: number, el: HTMLDivElement | null) => {
      const key = `${row}-${col}`;
      if (el) {
        cellRefs.current.set(key, el);
      } else {
        cellRefs.current.delete(key);
      }
    },
    []
  );

  const focusCell = useCallback((row: number, col: number) => {
    const key = `${row}-${col}`;
    const cell = cellRefs.current.get(key);
    if (cell) {
      cell.focus();
      setFocusedCell({ row, col });
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      let newRow = row;
      let newCol = col;
      let handled = false;

      switch (e.key) {
        case "ArrowUp":
          newRow = Math.max(0, row - 1);
          handled = true;
          break;
        case "ArrowDown":
          newRow = Math.min(GRADE_LEVELS.length - 1, row + 1);
          handled = true;
          break;
        case "ArrowLeft":
          newCol = Math.max(0, col - 1);
          handled = true;
          break;
        case "ArrowRight":
          newCol = Math.min(SEMESTERS.length - 1, col + 1);
          handled = true;
          break;
        case "Enter":
        case " ":
          // Open course picker for this cell
          e.preventDefault();
          if (!readOnly) {
            onAddCourse(GRADE_LEVELS[row], SEMESTERS[col]);
          }
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        if (newRow !== row || newCol !== col) {
          focusCell(newRow, newCol);
        }
      }
    },
    [focusCell, onAddCourse, readOnly]
  );

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="Four-year course planner"
      className="hidden md:block"
    >
      {/* No separate column headers needed — semester labels are inside each expanded cell */}

      {/* Grade rows */}
      {GRADE_LEVELS.map((grade, rowIdx) => {
        const isCurrentGrade = grade === effectiveGrade;
        const isCollapsed = collapsedGrades.has(grade);
        const gradeCourses = courses.filter((c) => c.gradeLevel === grade);
        const gradeCourseCount = gradeCourses.length;
        // Credit per row: full-year courses stored as 2 rows with creditValue=2.0,
        // each row = 1 credit. Semester courses = 1 row = 1 credit.
        const creditPerRow = (c: PlanCourse) => {
          const val = parseFloat(c.creditValue) || 0;
          return val > 1 ? val / 2 : val;
        };
        const gradePlannedCredits = gradeCourses
          .filter((c) => c.status !== "dropped")
          .reduce((sum, c) => sum + creditPerRow(c), 0);
        const gradeEarnedCredits = gradeCourses
          .filter((c) => c.status === "completed")
          .reduce((sum, c) => sum + creditPerRow(c), 0);
        const gradeProjectedGPA = calculateGPA(gradeCourses, "projected");
        const gradeActualGPA = calculateGPA(gradeCourses, "actual");
        // Semester requirement gaps from API (course load, PW/Dance, GPA waiver)
        const normalizeMsg = (msg: string, defaultGrade: number, defaultSem: number) => {
          // Normalize "Grade X Sem Y:" to "Gr X Sem Y:"
          const normalized = msg.replace(/^Grade (\d+) Sem (\d)/, "Gr $1 Sem $2");
          // If already prefixed, return as-is
          if (/^Gr \d+ Sem \d/.test(normalized)) return normalized;
          // Otherwise add prefix
          return `Gr ${defaultGrade} Sem ${defaultSem}: ${msg}`;
        };
        const sem1Gaps = (semesterGaps?.[`${grade}-1`] ?? []).map((msg) => normalizeMsg(msg, grade, 1));
        const sem2Gaps = (semesterGaps?.[`${grade}-2`] ?? []).map((msg) => normalizeMsg(msg, grade, 2));

        // Prerequisite violations for courses in this grade (deduplicate full-year courses)
        const prereqWarnings: string[] = [];
        const seenCourseIds = new Set<string>();
        for (const c of courses.filter((c) => c.gradeLevel === grade)) {
          if (seenCourseIds.has(c.courseId)) continue;
          seenCourseIds.add(c.courseId);
          for (const v of violations[c.courseId] ?? []) {
            prereqWarnings.push(`Gr ${grade} Sem ${c.semester}: ${c.code ?? c.name} — ${v.message}`);
          }
        }

        const gradeWarnings = [...sem1Gaps, ...sem2Gaps, ...prereqWarnings];
        const totalWarnings = gradeWarnings.length;
        const isGradeLocked = lockedGradeLevels.includes(grade);

        const toggleCollapse = () =>
          setCollapsedGrades((prev) => {
            const next = new Set(prev);
            if (next.has(grade)) {
              next.delete(grade); // Expand this grade
            } else {
              next.add(grade); // Collapse this grade
            }
            return next;
          });

        return (
          <div key={grade} role="row" className="mb-3 rounded-xl border border-border overflow-hidden">
            {/* Grade header — full width, clickable toggle */}
            <button
              type="button"
              role="rowheader"
              aria-expanded={!isCollapsed}
              onClick={toggleCollapse}
              className={`flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-left
                min-h-[44px] cursor-pointer transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${isCurrentGrade ? "bg-primary-light text-primary" : "bg-muted/50 text-foreground hover:bg-muted"}`}
            >
              <svg
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              <span data-grade={grade}>Grade {grade}</span>
              {isCurrentGrade && (
                <span className="text-[10px] font-normal text-primary/70">(current)</span>
              )}

              {/* Clear grade button */}
              {!readOnly && !isGradeLocked && onClearGrade && gradeCourseCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClearGrade(grade); }}
                  className="ml-1 flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-normal text-muted-foreground hover:text-destructive hover:bg-destructive-light transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  title={`Clear all courses in Grade ${grade}`}
                >
                  <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Clear
                </button>
              )}

              {/* Lock/unlock toggle — only for current and previous grades */}
              {!readOnly && onToggleGradeLock && grade <= effectiveGrade && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleGradeLock(grade, !isGradeLocked);
                  }}
                  className={`ml-1 flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-normal transition-colors
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                    ${isGradeLocked
                      ? "text-warning hover:text-warning/80 hover:bg-warning-light"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  title={isGradeLocked ? `Grade ${grade} is locked — click to unlock` : `Lock Grade ${grade}`}
                  aria-label={isGradeLocked ? `Unlock Grade ${grade}` : `Lock Grade ${grade}`}
                >
                  {isGradeLocked ? (
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  )}
                  {isGradeLocked ? "Locked" : "Lock"}
                </button>
              )}

              {/* Warning icon with tooltip on hover */}
              {totalWarnings > 0 && (
                <span
                  className="relative group/warn flex items-center gap-1 text-warning"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span className="text-[10px] font-normal">{totalWarnings}</span>

                  {/* Tooltip */}
                  <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 w-max max-w-sm rounded-lg border border-warning/30 bg-card px-3 py-2 text-xs font-medium text-warning shadow-lg opacity-0 transition-opacity group-hover/warn:opacity-100">
                    {gradeWarnings.map((msg, i) => (
                      <span key={i} className="block whitespace-normal">{msg}</span>
                    ))}
                  </span>
                </span>
              )}

              <span className="ml-auto flex items-center gap-3 text-xs font-normal text-muted-foreground">
                <span>
                  {gradeEarnedCredits > 0 && gradeEarnedCredits === gradePlannedCredits ? (
                    <span className="text-success">{gradeEarnedCredits % 1 === 0 ? gradeEarnedCredits : gradeEarnedCredits.toFixed(1)} credits earned</span>
                  ) : gradeEarnedCredits > 0 ? (
                    <>{gradePlannedCredits % 1 === 0 ? gradePlannedCredits : gradePlannedCredits.toFixed(1)} credits planned, <span className="text-success">{gradeEarnedCredits % 1 === 0 ? gradeEarnedCredits : gradeEarnedCredits.toFixed(1)} earned</span></>
                  ) : (
                    <>{gradePlannedCredits % 1 === 0 ? gradePlannedCredits : gradePlannedCredits.toFixed(1)} credits planned</>
                  )}
                </span>
                {gradeProjectedGPA.unweighted !== null && (
                  <>
                    <span className="text-border">|</span>
                    <span className="text-primary" title="Projected GPA (all graded courses): Unweighted / Weighted">
                      Proj: {formatGPA(gradeProjectedGPA.unweighted)} / {formatGPA(gradeProjectedGPA.weighted)}
                    </span>
                  </>
                )}
                {gradeActualGPA.unweighted !== null && (
                  <span className="text-success" title="Actual GPA (completed only): Unweighted / Weighted">
                    Actual: {formatGPA(gradeActualGPA.unweighted)} / {formatGPA(gradeActualGPA.weighted)}
                  </span>
                )}
              </span>
            </button>

            {/* Expanded content */}
            {!isCollapsed && (() => {
              return (
              <div className="border-t border-border bg-card p-3">
                <div className="grid grid-cols-2 gap-3">
                {SEMESTERS.map((sem, colIdx) => {
                  const cellCourses = sortCourses(getSemesterCourses(courses, grade, sem));
                  const cellViolationCount = cellCourses.reduce(
                    (count, c) => count + (violations[c.courseId]?.length ?? 0),
                    0
                  );

                  // Course limit: 7 normally, 8 if early bird is included
                  const hasEarlyBird = cellCourses.some(
                    (c) => (c.name ?? "").toLowerCase().includes("early bird") ||
                           /E\d$/.test(c.code ?? "") || /E\d\//.test(c.code ?? "")
                  );
                  const maxCourses = hasEarlyBird ? 8 : 7;
                  const isAtMax = cellCourses.length >= maxCourses;
                  const isUnderload = cellCourses.length < 5;

                  return (
                    <div
                      key={sem}
                      ref={(el) => setCellRef(rowIdx, colIdx, el)}
                      role="gridcell"
                      tabIndex={
                        focusedCell.row === rowIdx && focusedCell.col === colIdx ? 0 : -1
                      }
                      aria-label={`Grade ${grade}, Semester ${sem} — ${cellCourses.length} course${
                        cellCourses.length !== 1 ? "s" : ""
                      } planned${
                        cellViolationCount > 0
                          ? `, ${cellViolationCount} warning${cellViolationCount !== 1 ? "s" : ""}`
                          : ""
                      }`}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                      onFocus={() => setFocusedCell({ row: rowIdx, col: colIdx })}
                      className={`
                        min-h-[100px] rounded-xl border-2 border-dashed p-3
                        transition-all duration-300
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                        ${
                          highlightedSem?.grade === grade && highlightedSem?.semester === sem
                            ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                            : cellViolationCount > 0
                              ? "border-warning/50 bg-warning-light/30"
                              : "border-border bg-background hover:border-primary/30"
                        }
                      `}
                    >
                      {/* Cell header */}
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            Semester {sem}
                          </p>
                          {!readOnly && !isGradeLocked && cellCourses.length > 0 && (
                            <>
                              {/* Bulk status */}
                              {onBulkStatusChange && (
                                <select
                                  className="h-4 rounded border-none bg-transparent px-0.5 text-[9px] text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                  title="Set status for all courses in this semester"
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    const ids = cellCourses.map((c) => c.id);
                                    onBulkStatusChange(ids, e.target.value as PlanCourse["status"]);
                                    e.target.value = "";
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="" disabled>Status</option>
                                  <option value="planned">All → Planned</option>
                                  <option value="enrolled">All → Enrolled</option>
                                  <option value="completed">All → Completed</option>
                                </select>
                              )}
                              {/* Bulk grade */}
                              {onBulkGradeChange && (
                                <select
                                  className="h-4 rounded border-none bg-transparent px-0.5 text-[9px] text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                  title="Set grade for all courses in this semester"
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    const ids = cellCourses.map((c) => c.id);
                                    onBulkGradeChange(ids, e.target.value === "clear" ? null : e.target.value);
                                    e.target.value = "";
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="" disabled>Grade</option>
                                  <option value="A">All → A</option>
                                  <option value="B">All → B</option>
                                  <option value="C">All → C</option>
                                  <option value="D">All → D</option>
                                  <option value="F">All → F</option>
                                  <option value="clear">Clear grades</option>
                                </select>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                        {!readOnly && !isGradeLocked && onClearSemester && cellCourses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onClearSemester(grade, sem)}
                            className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive-light transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            title={`Clear all courses in Semester ${sem}`}
                            aria-label={`Clear all courses in Grade ${grade}, Semester ${sem}`}
                          >
                            <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        )}
                        <span className={`text-[10px] font-medium ${
                          isAtMax ? "text-destructive" : isUnderload ? "text-warning" : "text-muted-foreground"
                        }`}>
                          {cellCourses.length}/{maxCourses}
                        </span>
                      </div>
                      </div>

                      {/* Underload/overload warnings are shown at the grade header level */}

                      {/* Course cards */}
                      <div className="flex flex-col gap-1.5">
                        {cellCourses.map((course) => (
                          <PlanCourseCard
                            key={course.id}
                            course={course}
                            violations={violations[course.courseId]}
                            onRemove={isGradeLocked ? undefined : () => onRemoveCourse(course.id)}
                            onClick={onViewDetails ? () => onViewDetails(course.courseId) : () => onCourseClick(course)}
                            onStatusChange={isGradeLocked ? undefined : (onStatusChange ? (s) => onStatusChange(course.id, s) : undefined)}
                            onGradeChange={isGradeLocked ? undefined : (onGradeChange ? (g) => onGradeChange(course.id, g) : undefined)}
                            onGpaWaiverToggle={onGpaWaiverToggle ? (applied) => onGpaWaiverToggle(course.id, applied) : undefined}
                            readOnly={readOnly}
                          />
                        ))}
                      </div>

                      {/* Add course button */}
                      {!readOnly && !isGradeLocked && (
                        <button
                          type="button"
                          onClick={() => !isAtMax && onAddCourse(grade, sem)}
                          disabled={isAtMax}
                          className={`
                            mt-1.5 flex min-h-[44px] w-full items-center justify-center gap-1.5
                            rounded-lg border border-dashed
                            text-sm transition-colors duration-150
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                            ${isAtMax
                              ? "border-border bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                              : "border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary-light/50 cursor-pointer"
                            }
                          `}
                          aria-label={isAtMax
                            ? `Maximum courses reached for Grade ${grade}, Semester ${sem}`
                            : `Add course to Grade ${grade}, Semester ${sem}`
                          }
                        >
                          {isAtMax ? (
                            <>
                              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              Max reached
                            </>
                          ) : (
                            <>
                              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                              Add Course
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

// ---- Mobile Accordion ----

function MobileAccordion({
  planId,
  courses,
  currentGradeLevel,
  lockedGradeLevels = [],
  onAddCourse,
  onRemoveCourse,
  onCourseClick,
  onStatusChange,
  onGradeChange,
  onClearSemester,
  onClearGrade,
  onViewDetails,
  onBulkStatusChange,
  onBulkGradeChange,
  onGpaWaiverToggle,
  onToggleGradeLock,
  violations,
  semesterGaps,
  focusGrade: _focusGrade,
  readOnly,
}: PlannerGridProps) {
  const effectiveGrade = GRADE_LEVELS.find((g) => !lockedGradeLevels.includes(g)) ?? currentGradeLevel;
  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(
    new Set([effectiveGrade])
  );

  const toggleGrade = useCallback((grade: number) => {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) {
        next.delete(grade);
      } else {
        next.add(grade);
      }
      return next;
    });
  }, []);

  return (
    <div className="md:hidden flex flex-col gap-2" role="grid" aria-label="Four-year course planner">
      {GRADE_LEVELS.map((grade) => {
        const isExpanded = expandedGrades.has(grade);
        const isCurrentGrade = grade === effectiveGrade;
        const gradeCoursesAll = courses.filter((c) => c.gradeLevel === grade);
        const gradeViolationCount = gradeCoursesAll.reduce(
          (count, c) => count + (violations[c.courseId]?.length ?? 0),
          0
        );
        const gradeSemGaps = [
          ...(semesterGaps?.[`${grade}-1`] ?? []),
          ...(semesterGaps?.[`${grade}-2`] ?? []),
        ];
        const mobileWarningCount = gradeViolationCount + gradeSemGaps.length;

        return (
          <div
            key={grade}
            role="row"
            className={`rounded-xl border ${
              isCurrentGrade ? "border-primary/30" : "border-border"
            } overflow-hidden`}
          >
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => toggleGrade(grade)}
              aria-expanded={isExpanded}
              aria-controls={`grade-${grade}-content`}
              className={`
                flex min-h-[44px] w-full items-center justify-between px-4 py-3
                text-left text-sm font-semibold
                transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${
                  isCurrentGrade
                    ? "bg-primary-light text-primary"
                    : "bg-muted/50 text-foreground hover:bg-muted"
                }
              `}
            >
              <span className="flex items-center gap-2">
                Grade {grade}
                {isCurrentGrade && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal text-primary">
                    Current
                  </span>
                )}
                <span className="text-xs font-normal text-muted-foreground">
                  {gradeCoursesAll.length} course
                  {gradeCoursesAll.length !== 1 ? "s" : ""}
                </span>
                {mobileWarningCount > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-warning">
                    <svg
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                      />
                    </svg>
                    {mobileWarningCount}
                  </span>
                )}
              </span>
              <svg
                aria-hidden="true"
                className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>

            {/* Accordion content */}
            {isExpanded && (
              <div id={`grade-${grade}-content`} className="border-t border-border px-4 pb-4 pt-3">
                {SEMESTERS.map((sem) => {
                  const cellCourses = getCoursesForCell(courses, grade, sem);
                  const cellViolationCount = cellCourses.reduce(
                    (count, c) =>
                      count + (violations[c.courseId]?.length ?? 0),
                    0
                  );

                  return (
                    <div key={sem} role="gridcell" className="mb-3 last:mb-0">
                      <h3
                        className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        aria-label={`Grade ${grade}, Semester ${sem} — ${cellCourses.length} course${
                          cellCourses.length !== 1 ? "s" : ""
                        } planned${
                          cellViolationCount > 0
                            ? `, ${cellViolationCount} warning${cellViolationCount !== 1 ? "s" : ""}`
                            : ""
                        }`}
                      >
                        Semester {sem}
                      </h3>

                      <div className="flex flex-col gap-1.5">
                        {cellCourses.map((course) => {
                          const mobileGradeLocked = lockedGradeLevels.includes(grade);
                          return (
                            <PlanCourseCard
                              key={course.id}
                              course={course}
                              violations={violations[course.courseId]}
                              onRemove={mobileGradeLocked ? undefined : () => onRemoveCourse(course.id)}
                              onClick={onViewDetails ? () => onViewDetails(course.courseId) : () => onCourseClick(course)}
                              onStatusChange={mobileGradeLocked ? undefined : (onStatusChange ? (s) => onStatusChange(course.id, s) : undefined)}
                              onGradeChange={mobileGradeLocked ? undefined : (onGradeChange ? (g) => onGradeChange(course.id, g) : undefined)}
                              onGpaWaiverToggle={onGpaWaiverToggle ? (applied) => onGpaWaiverToggle(course.id, applied) : undefined}
                              readOnly={readOnly}
                            />
                          );
                        })}
                      </div>

                      {!readOnly && !lockedGradeLevels.includes(grade) && (
                        <button
                          type="button"
                          onClick={() => onAddCourse(grade, sem)}
                          className="mt-1.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-primary hover:bg-primary-light/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          aria-label={`Add course to Grade ${grade}, Semester ${sem}`}
                        >
                          <svg
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 4.5v15m7.5-7.5h-15"
                            />
                          </svg>
                          Add Course
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Main PlannerGrid ----

export function PlannerGrid(props: PlannerGridProps) {
  const [liveMessage, setLiveMessage] = useState("");

  // Announce validation changes via live region
  useEffect(() => {
    const totalViolations = Object.values(props.violations).flat().length;
    if (totalViolations > 0) {
      setLiveMessage(
        `${totalViolations} validation warning${totalViolations !== 1 ? "s" : ""} found in your plan.`
      );
    } else {
      setLiveMessage("");
    }
  }, [props.violations]);

  return (
    <>
      {/* Live region for validation announcements */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      {/* Desktop grid */}
      <DesktopGrid {...props} />

      {/* Mobile accordion */}
      <MobileAccordion {...props} />
    </>
  );
}
