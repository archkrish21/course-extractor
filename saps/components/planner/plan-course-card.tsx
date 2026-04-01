"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { GRADE_OPTIONS, PASS_FAIL_OPTIONS, isPassFailCourse } from "@/config/grade-scale";

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
  gradeLevels?: number[];
  semestersOffered?: number[] | null;
  divisionName?: string;
}

export interface Violation {
  type: string;
  message: string;
  severity: "error" | "warning";
  relatedCourseId?: string;
}

interface PlanCourseCardProps {
  course: PlanCourse;
  violations?: Violation[];
  onRemove?: () => void;
  onClick?: () => void;
  onStatusChange?: (status: PlanCourse["status"]) => void;
  onGradeChange?: (grade: string | null) => void;
  onGpaWaiverToggle?: (applied: boolean) => void;
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

function getCreditBadgeVariant(creditType: string): BadgeVariant {
  const lower = creditType.toLowerCase();
  if (lower.includes("ap")) return "ap";
  if (lower.includes("honors")) return "honors";
  if (lower.includes("dual")) return "dual-credit";
  if (lower.includes("accelerated")) return "accelerated";
  return "default";
}

export function PlanCourseCard({
  course,
  violations = [],
  onRemove,
  onClick,
  onStatusChange,
  onGradeChange,
  onGpaWaiverToggle,
  readOnly = false,
}: PlanCourseCardProps) {
  const waiverApplied = course.gpaWaiverApplied ?? false;
  const statusConfig = STATUS_CONFIG[course.status];
  const hasViolations = violations.length > 0;
  const isDropped = course.status === "dropped";
  const isCompleted = course.status === "completed";
  const canRemove = !readOnly && !isCompleted && onRemove;
  const [showWarnings, setShowWarnings] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const warningRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!showWarnings) return;
    function handleClick(e: MouseEvent) {
      if (warningRef.current && !warningRef.current.contains(e.target as Node)) {
        setShowWarnings(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showWarnings]);

  // Close on Escape
  useEffect(() => {
    if (!showWarnings && !statusMenuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowWarnings(false);
        setStatusMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showWarnings, statusMenuOpen]);

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
        group relative flex min-h-[44px] cursor-pointer items-start gap-2 rounded-lg border p-2
        transition-colors duration-150
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
        ${hasViolations ? "border-warning bg-warning-light/50" : "border-border bg-card hover:bg-muted/50"}
        ${isDropped ? "opacity-60" : ""}
      `}
      aria-label={`${course.name} (${course.code}), ${statusConfig.label}${
        hasViolations ? `, ${violations.length} warning${violations.length > 1 ? "s" : ""}` : ""
      }${course.plannedGrade ? `, grade: ${course.plannedGrade}` : ""}`}
    >
      <div className="flex-1 min-w-0">
        {/* Course name and code */}
        <p
          className={`text-sm font-medium leading-tight text-foreground truncate ${
            isDropped ? "line-through" : ""
          }`}
          title={`${course.name} (${course.code})`}
        >
          {course.name} <span className="font-normal text-muted-foreground">({course.code})</span>
        </p>

        {/* Badges row */}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Badge
            variant={getCreditBadgeVariant(course.creditType)}
            className="text-[10px] px-1.5 py-0"
          >
            {course.creditType}
          </Badge>

          {course.isAp && course.creditType !== "AP" && (
            <Badge variant="ap" className="text-[10px] px-1.5 py-0">
              AP
            </Badge>
          )}

          {course.isDualCredit && (
            <Badge variant="dual-credit" className="text-[10px] px-1.5 py-0">
              DC
            </Badge>
          )}

          {/* Static GPA Waiver badge shown in read-only mode */}
          {course.gpaWaiver && (readOnly || !onGpaWaiverToggle) && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
              {waiverApplied ? "GPA Waived" : "GPA Waiver"}
            </Badge>
          )}

          {/* Status indicator — clickable dropdown */}
          {!readOnly && onStatusChange ? (
            <div ref={statusRef} className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStatusMenuOpen((prev) => !prev);
                }}
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusConfig.className}`}
                aria-label={`Status: ${statusConfig.label}. Click to change.`}
                aria-expanded={statusMenuOpen}
              >
                {statusConfig.icon}
                {statusConfig.label}
                <svg aria-hidden="true" className="h-2.5 w-2.5 ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {statusMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
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
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-medium ${statusConfig.className}`}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          )}

          {/* Grade selector — projected for planned/enrolled, actual for completed, hidden for dropped */}
          {!isDropped && !readOnly && onGradeChange ? (
            <select
              value={course.plannedGrade ?? ""}
              onChange={(e) => {
                e.stopPropagation();
                onGradeChange(e.target.value || null);
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`${isCompleted ? "Actual" : "Projected"} grade for ${course.name}`}
              className={`h-5 rounded border px-1 text-[10px] font-semibold cursor-pointer
                focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring
                ${course.plannedGrade
                  ? isCompleted
                    ? "border-success/50 bg-success-light text-success"
                    : "border-primary/50 bg-primary-light text-primary"
                  : "border-border bg-muted text-muted-foreground"
                }`}
            >
              <option value="">{isCompleted ? "Grade" : "Est."}</option>
              {(isPassFailCourse(course.code) ? PASS_FAIL_OPTIONS : GRADE_OPTIONS).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          ) : !isDropped && course.plannedGrade ? (
            <Badge
              variant={isCompleted ? "success" : "default"}
              className="text-[10px] px-1.5 py-0"
            >
              {course.plannedGrade}
            </Badge>
          ) : null}

          {/* GPA Waiver toggle — only for courses that count toward GPA */}
          {course.gpaWaiver && !isPassFailCourse(course.code) && !readOnly && onGpaWaiverToggle && (
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium cursor-pointer transition-colors bg-warning/20 text-warning hover:bg-warning/30`}
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

          {/* P/F indicator for non-academic courses */}
          {isPassFailCourse(course.code) && (
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground"
              title="Pass/Fail course — excluded from GPA and academic course count"
            >
              P/F
            </span>
          )}
        </div>

        {/* Info line: grades offered + semester */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
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
        </div>
      </div>

      {/* Right side: warning icon + remove button */}
      <div className="flex shrink-0 items-start gap-1">
        {hasViolations && (
          <div ref={warningRef} className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowWarnings((prev) => !prev);
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-warning hover:bg-warning-light transition-colors
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`${violations.length} warning${violations.length > 1 ? "s" : ""} — click for details`}
              aria-expanded={showWarnings}
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
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </button>

            {/* Warning details popover */}
            {showWarnings && (
              <div
                role="dialog"
                aria-label="Validation warnings"
                className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-warning/30 bg-card shadow-lg"
              >
                <div className="border-b border-warning/20 bg-warning-light px-3 py-2">
                  <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    {violations.length} Warning{violations.length > 1 ? "s" : ""}
                  </p>
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
            className="flex h-6 w-6 min-h-[44px] min-w-[44px] -m-[9px] items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover:opacity-100"
            aria-label={`Remove ${course.name} from plan`}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
