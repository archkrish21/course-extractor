"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { creditTypeBadgeVariant, creditTypeLabel } from "@/lib/badge-utils";
import { GRADE_OPTIONS, PASS_FAIL_OPTIONS, isPassFailCourse } from "@/config/grade-scale";
import { dedupeViolations } from "@/lib/planner/dedupe-violations";

export interface PlanCourse {
  id: string;
  courseId: string;
  code: string;
  name: string;
  creditType: string;
  creditValue: string;
  duration: string;
  gradeLevel: number;
  semester: number | null;
  status: "planned" | "enrolled" | "completed" | "dropped";
  plannedGrade?: string;
  isAp: boolean;
  isDualCredit: boolean;
  gpaWaiver: boolean;
  gpaWaiverApplied?: boolean;
  prereqOverridden?: boolean;
  gradeLevels?: number[];
  semestersOffered?: number[] | null;
  divisionName?: string;
}

export interface Violation {
  type: string;
  message: string;
  severity: "error" | "warning";
  relatedCourseId?: string;
  // Prereq/coreq violations carry the missing courses' codes + names so the
  // validation report can show a tooltip with the human name on hover.
  missingPrerequisites?: Array<{ code: string; name: string }>;
}

interface PlanCourseCardProps {
  course: PlanCourse;
  violations?: Violation[];
  ignoredViolations?: Violation[];
  onRemove?: () => void;
  onClick?: () => void;
  onStatusChange?: (status: PlanCourse["status"]) => void;
  onGradeChange?: (grade: string | null) => void;
  onGpaWaiverToggle?: (applied: boolean) => void;
  // When provided, the warning/excused icon is interactive: clicking the
  // warning icon excuses all of this course's prereq violations; clicking
  // the excused icon reflags them.
  onPrereqOverrideToggle?: (overridden: boolean) => void;
  readOnly?: boolean;
}

const STATUS_CONFIG: Record<
  PlanCourse["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  planned: {
    label: "Planned",
    className: "bg-muted text-muted-foreground",
    icon: (
      <svg
        aria-hidden="true"
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
  enrolled: {
    label: "Enrolled",
    className: "bg-primary-light text-primary",
    icon: (
      <svg
        aria-hidden="true"
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"
        />
      </svg>
    ),
  },
  completed: {
    label: "Completed",
    className: "bg-success-light text-success",
    icon: (
      <svg
        aria-hidden="true"
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
  dropped: {
    label: "Dropped",
    className: "bg-destructive-light text-destructive",
    icon: (
      <svg
        aria-hidden="true"
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
};

export function PlanCourseCard({
  course,
  violations: rawViolations = [],
  ignoredViolations: rawIgnoredViolations = [],
  onRemove,
  onClick,
  onStatusChange,
  onGradeChange,
  onGpaWaiverToggle,
  onPrereqOverrideToggle,
  readOnly = false,
}: PlanCourseCardProps) {
  const waiverApplied = course.gpaWaiverApplied ?? false;
  const statusConfig = STATUS_CONFIG[course.status];
  const violations = dedupeViolations(rawViolations);
  const ignoredViolations = dedupeViolations(rawIgnoredViolations);
  const hasViolations = violations.length > 0;
  const hasIgnored = ignoredViolations.length > 0;
  const canToggleOverride = !readOnly && !!onPrereqOverrideToggle;
  const isDropped = course.status === "dropped";
  const isCompleted = course.status === "completed";
  const canRemove = !readOnly && onRemove;
  const [showWarnings, setShowWarnings] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [gradeMenuOpen, setGradeMenuOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);

  // Warnings + excused popovers are hover/focus-driven (mouse-enter/leave +
  // focus/blur on the wrapper), so we don't need the click-outside fallbacks
  // that the dropdown menus use below.

  // Close on Escape
  useEffect(() => {
    if (!showWarnings && !showIgnored && !statusMenuOpen && !gradeMenuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowWarnings(false);
        setShowIgnored(false);
        setStatusMenuOpen(false);
        setGradeMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showWarnings, showIgnored, statusMenuOpen, gradeMenuOpen]);

  // Close status menu on outside click
  useEffect(() => {
    if (!statusMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [statusMenuOpen]);

  // Close grade menu on outside click
  useEffect(() => {
    if (!gradeMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (gradeRef.current && !gradeRef.current.contains(e.target as Node)) {
        setGradeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [gradeMenuOpen]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`
        group relative flex flex-col cursor-pointer gap-1 rounded-xl border p-2.5 min-h-[44px]
        transition-all duration-150 shadow-sm hover:shadow-md
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
        ${hasViolations ? "border-warning/60 bg-warning-light/50" : "border-border bg-card hover:bg-muted/30"}
        ${isDropped ? "opacity-60" : ""}
      `}
      aria-label={`${course.name} (${course.code}), ${statusConfig.label}${
        hasViolations ? `, ${violations.length} warning${violations.length > 1 ? "s" : ""}` : ""
      }${course.plannedGrade ? `, grade: ${course.plannedGrade}` : ""}`}
    >
      {/* Row 1: course name (left) | remove (right) */}
      <div className="flex items-start gap-2">
        <p
          className={`flex-1 min-w-0 text-sm font-medium leading-tight text-foreground truncate ${
            isDropped ? "line-through" : ""
          }`}
          title={`${course.name} (${course.code})`}
        >
          {course.name} <span className="font-normal text-muted-foreground">({course.code})</span>
        </p>

        <div className="flex shrink-0 items-center gap-1">
          {canRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                }
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover:opacity-100"
              aria-label={`Remove ${course.name} from plan`}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: badges (left) | status + grade (right) — single line */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 min-w-0 items-center gap-1 overflow-hidden">
          <Badge variant={creditTypeBadgeVariant(course.creditType)} className="h-5 leading-4 text-[10px] px-1.5 py-0">
            {creditTypeLabel(course.creditType)}
          </Badge>

          {course.isAp && course.creditType !== "AP" && (
            <Badge variant="ap" className="h-5 leading-4 text-[10px] px-1.5 py-0">AP</Badge>
          )}

          {course.isDualCredit && (
            <Badge variant="dual-credit" className="h-5 leading-4 text-[10px] px-1.5 py-0">DC</Badge>
          )}

          {course.semestersOffered?.some((s: number) => s < 0) && (
            <Badge variant="warning" className="h-5 leading-4 text-[10px] px-1.5 py-0">Summer</Badge>
          )}

          {/* Static GPA Waiver badge shown in read-only mode */}
          {course.gpaWaiver && (readOnly || !onGpaWaiverToggle) && (
            <Badge variant="warning" className="h-5 leading-4 text-[10px] px-1.5 py-0">
              {waiverApplied ? "GPA Waived" : "GPA Waiver"}
            </Badge>
          )}

          {/* GPA Waiver toggle — only for non-P/F courses */}
          {course.gpaWaiver && !isPassFailCourse(course.code, course.creditType) && !readOnly && onGpaWaiverToggle && (
            <button
              type="button"
              className="inline-flex h-5 items-center gap-1 rounded-full px-1.5 py-0 text-[10px] leading-4 font-medium cursor-pointer transition-colors bg-warning/20 text-warning hover:bg-warning/30"
              title={waiverApplied ? "GPA waiver applied — click to remove" : "Click to apply GPA waiver"}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onGpaWaiverToggle(!waiverApplied);
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {waiverApplied ? (
                <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
                </svg>
              )}
              GPA Waiver
            </button>
          )}

          {/* P/F indicator for non-academic courses whose credit-type badge doesn't already say P/F (e.g. PE/Driver Ed show "CP"). */}
          {isPassFailCourse(course.code, course.creditType) && course.creditType !== "Pass/Fail" && (
            <span
              className="inline-flex h-5 items-center rounded-full px-1.5 py-0 text-[10px] leading-4 font-medium bg-muted text-muted-foreground"
              title="Pass/Fail course — excluded from GPA and academic course count"
            >
              P/F
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Status indicator — clickable dropdown */}
          {!readOnly && onStatusChange ? (
            <div ref={statusRef} className="relative inline-flex">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStatusMenuOpen((prev) => !prev);
                }}
                className={`inline-flex h-5 w-24 items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] leading-4 font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusConfig.className}`}
                aria-label={`Status: ${statusConfig.label}. Click to change.`}
                aria-expanded={statusMenuOpen}
              >
                {statusConfig.icon}
                {statusConfig.label}
                <svg aria-hidden="true" className="h-2.5 w-2.5 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {statusMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                  {(["planned", "enrolled", "completed", "dropped"] as const).map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const isActive = course.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isActive) onStatusChange(s);
                          setStatusMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium transition-colors
                          ${isActive ? "bg-primary-light text-primary" : "text-foreground hover:bg-muted"}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                        {isActive && (
                          <svg aria-hidden="true" className="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <span className={`inline-flex h-5 w-24 items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] leading-4 font-medium ${statusConfig.className}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          )}

          {/* Grade selector — projected for planned/enrolled, actual for completed, hidden for dropped */}
          {!isDropped && !readOnly && onGradeChange ? (
            <div ref={gradeRef} className="relative inline-flex">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setGradeMenuOpen((prev) => !prev);
                }}
                aria-label={`${isCompleted ? "Actual" : "Projected"} grade for ${course.name}${course.plannedGrade ? `: ${course.plannedGrade}` : ""}. Click to change.`}
                aria-expanded={gradeMenuOpen}
                className={`inline-flex h-5 w-12 items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] leading-4 font-semibold cursor-pointer hover:opacity-80 transition-opacity
                  ${course.plannedGrade
                    ? isCompleted
                      ? "bg-success-light text-success"
                      : "bg-primary-light text-primary"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                <span>{course.plannedGrade ?? "—"}</span>
                <svg aria-hidden="true" className="h-2.5 w-2.5 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {gradeMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-20 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                  {[null, ...(isPassFailCourse(course.code, course.creditType) ? PASS_FAIL_OPTIONS : GRADE_OPTIONS)].map((g) => {
                    const isActive = (course.plannedGrade ?? null) === g;
                    return (
                      <button
                        key={g ?? "clear"}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isActive) onGradeChange(g);
                          setGradeMenuOpen(false);
                        }}
                        className={`flex w-full items-center px-2.5 py-2 text-[11px] font-medium transition-colors
                          ${isActive ? "bg-primary-light text-primary" : "text-foreground hover:bg-muted"}`}
                      >
                        {g ?? "Clear"}
                        {isActive && (
                          <svg aria-hidden="true" className="ml-auto h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : !isDropped && course.plannedGrade ? (
            <Badge variant={isCompleted ? "success" : "default"} className="flex h-5 w-12 leading-4 text-[10px] px-1.5 py-0 items-center justify-center">
              {course.plannedGrade}
            </Badge>
          ) : (
            <span aria-hidden="true" className="h-5 w-12 shrink-0" />
          )}
        </div>
      </div>

      {/* Row 3: grade circles + duration (left) | excused + warning (right) */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        {course.gradeLevels && course.gradeLevels.length > 0 && (
          <span className="flex items-center gap-0.5">
            {course.gradeLevels.map((g) => (
              <span
                key={g}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-semibold"
              >
                {g}
              </span>
            ))}
          </span>
        )}
        <span>
          {course.duration === "full_year"
            ? "Full Year"
            : course.semestersOffered && course.semestersOffered.length === 1
              ? `Sem ${course.semestersOffered[0]} only`
              : "Sem 1 & 2"}
        </span>

        {/* Show the icons based on what actually exists in the validation
            response, not on the stored prereq_overridden flag. A course can
            have prereq_overridden=true with no remaining violations (e.g.,
            its prereq was completed later) — in that case nothing needs to
            be surfaced, so we hide the icon entirely. */}
        {(hasIgnored || hasViolations) && (
          <div className="ml-auto flex items-center gap-1">
            {hasIgnored && (
              <div
                className="relative inline-flex"
                onMouseEnter={() => setShowIgnored(true)}
                onMouseLeave={() => setShowIgnored(false)}
                onFocus={() => setShowIgnored(true)}
                onBlur={() => setShowIgnored(false)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canToggleOverride) onPrereqOverrideToggle!(false);
                  }}
                  disabled={!canToggleOverride}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default"
                  aria-label={
                    canToggleOverride
                      ? `${hasIgnored ? `${ignoredViolations.length} warning${ignoredViolations.length === 1 ? "" : "s"} excused — ` : ""}click to reflag`
                      : hasIgnored
                        ? `${ignoredViolations.length} warning${ignoredViolations.length === 1 ? "" : "s"} excused`
                        : "Warnings excused"
                  }
                  title={canToggleOverride ? "Click to reflag warnings" : undefined}
                >
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 0 0 3.844.148m-3.844-.148a23.856 23.856 0 0 1-5.455-1.31 8.964 8.964 0 0 0 2.3-5.542m3.155 6.852a3 3 0 0 0 5.667 1.97m1.965-2.277L21 21m-4.225-4.225a23.81 23.81 0 0 0 3.536-1.003A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6.53 6.53m10.245 10.245L6.53 6.53M3 3l3.53 3.53" />
                  </svg>
                </button>

                {showIgnored && hasIgnored && (
                  <div
                    role="tooltip"
                    aria-label="Excused warnings"
                    className="absolute right-0 bottom-full z-50 mb-1 w-72 rounded-xl border border-border bg-card shadow-xl"
                  >
                    <div className="border-b border-border bg-muted px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">
                        {ignoredViolations.length} Warning{ignoredViolations.length === 1 ? "" : "s"} excused
                      </p>
                      {canToggleOverride && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Click the icon to reflag.
                        </p>
                      )}
                    </div>
                    <ul className="max-h-48 overflow-y-auto p-2 flex flex-col gap-1.5">
                      {ignoredViolations.map((v, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs text-foreground">
                          <span className="mt-0.5 shrink-0 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground capitalize">
                            {(v.type ?? "warning").replace(/_/g, " ")}
                          </span>
                          <span className="leading-relaxed">{v.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {hasViolations && (
              <div
                className="relative inline-flex"
                onMouseEnter={() => setShowWarnings(true)}
                onMouseLeave={() => setShowWarnings(false)}
                onFocus={() => setShowWarnings(true)}
                onBlur={() => setShowWarnings(false)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canToggleOverride) onPrereqOverrideToggle!(true);
                  }}
                  disabled={!canToggleOverride}
                  className="flex h-5 w-5 items-center justify-center rounded text-warning hover:bg-warning-light transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default"
                  aria-label={
                    canToggleOverride
                      ? `${violations.length} warning${violations.length > 1 ? "s" : ""} — click to excuse`
                      : `${violations.length} warning${violations.length > 1 ? "s" : ""}`
                  }
                  title={canToggleOverride ? "Click to excuse warnings" : undefined}
                >
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </button>

                {showWarnings && (
                  <div
                    role="tooltip"
                    aria-label="Validation warnings"
                    className="absolute right-0 bottom-full z-50 mb-1 w-72 rounded-xl border border-warning/30 bg-card shadow-xl"
                  >
                    <div className="border-b border-warning/20 bg-warning-light px-3 py-2">
                      <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        {violations.length} Warning{violations.length > 1 ? "s" : ""}
                      </p>
                      {canToggleOverride && (
                        <p className="mt-0.5 text-[11px] text-warning/80">
                          Click the icon to excuse.
                        </p>
                      )}
                    </div>
                    <ul className="max-h-48 overflow-y-auto p-2 flex flex-col gap-1.5">
                      {violations.map((v, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs text-foreground">
                          <span className="mt-0.5 shrink-0 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning capitalize">
                            {(v.type ?? "warning").replace(/_/g, " ")}
                          </span>
                          <span className="leading-relaxed">{v.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
