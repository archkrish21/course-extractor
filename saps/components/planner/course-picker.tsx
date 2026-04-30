"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { creditTypeBadgeVariant } from "@/lib/badge-utils";
import { Spinner } from "@/components/ui/spinner";
import { findEquivalentInPlan } from "@/config/summer-equivalents";
import { isSummerSemester } from "@/config/semesters";

interface CourseResult {
  id: string;
  code: string;
  name: string;
  creditType: string;
  creditValue: string;
  duration: string;
  gradeLevels: number[];
  semestersOffered: number[] | null;
  isAp: boolean;
  isDualCredit: boolean;
  gpaWaiver: boolean;
  description?: string;
}

interface ValidationPreview {
  hasViolations: boolean;
  violations: Array<{
    type: string;
    message: string;
    severity: "error" | "warning";
  }>;
}

interface CoursePickerProps {
  isOpen: boolean;
  onClose: () => void;
  gradeLevel: number;
  semester: number;
  planId: string;
  otherSemesterAtMax?: boolean;
  existingCourseIds?: Set<string>;
  existingCourseNames?: Set<string>;
  existingCourseCodes?: string[];
  onAddCourse: (courseId: string, addAnyway?: boolean, courseDuration?: string) => Promise<ValidationPreview | null>;
  onViewDetails?: (courseId: string) => void;
  lastViewedCourseId?: string | null;
}

const CREDIT_TYPES = [
  "All",
  "CP",
  "Accelerated",
  "Honors",
  "AP",
  "Dual Credit",
];

const DIVISIONS = [
  "All Divisions",
  "Applied Arts",
  "Communication Arts",
  "Computer Science, Engineering and Technology",
  "Fine Arts",
  "Mathematics",
  "Multilingual Learning",
  "Physical Welfare",
  "Science",
  "Social Studies",
];

const DEPARTMENTS_BY_DIVISION: Record<string, string[]> = {
  "Applied Arts": ["Business Education", "Driver Education", "Family and Consumer Sciences"],
  "Communication Arts": ["English", "Journalism"],
  "Computer Science, Engineering and Technology": ["Computer Science", "Engineering and Technology"],
  "Fine Arts": ["Dance", "Music", "Theatre", "Visual Arts"],
  "Mathematics": ["Mathematics"],
  "Multilingual Learning": ["English Language Development", "French", "German", "Hebrew", "Latin", "Mandarin Chinese", "Spanish"],
  "Physical Welfare": ["Physical Education"],
  "Science": ["Science"],
  "Social Studies": ["Social Studies"],
};

const EMPTY_STRING_SET = new Set<string>();

export function CoursePicker({
  isOpen,
  onClose,
  gradeLevel,
  semester,
  planId,
  otherSemesterAtMax = false,
  existingCourseIds = EMPTY_STRING_SET,
  existingCourseNames = EMPTY_STRING_SET,
  existingCourseCodes = [],
  onAddCourse,
  onViewDetails,
  lastViewedCourseId,
}: CoursePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [creditFilter, setCreditFilter] = useState("All");
  const [divisionFilter, setDivisionFilter] = useState("All Divisions");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [durationFilter, setDurationFilter] = useState<"all" | "full_year" | "semester">("all");
  const [earlyBirdOnly, setEarlyBirdOnly] = useState(false);
  const [gpaWaiverOnly, setGpaWaiverOnly] = useState(false);
  const [courses, setCourses] = useState<CourseResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const COURSES_PER_PAGE = 4;

  const availableDepartments = divisionFilter !== "All Divisions"
    ? DEPARTMENTS_BY_DIVISION[divisionFilter] ?? []
    : [];
  const [loading, setLoading] = useState(false);
  const [addingCourseId, setAddingCourseId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [addedInSession, setAddedInSession] = useState<Set<string>>(new Set());
  const [validationPreview, setValidationPreview] = useState<{
    courseId: string;
    preview: ValidationPreview;
  } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element and restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setAddedInSession(new Set()); // Reset session-added tracking
      // Focus the search input after opening
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Stable refs to avoid re-fetching when the sets are recreated
  const existingIdsRef = useRef(existingCourseIds);
  existingIdsRef.current = existingCourseIds;
  const existingNamesRef = useRef(existingCourseNames);
  existingNamesRef.current = existingCourseNames;

  // Raw courses from API (before client-side filtering)
  const [rawCourses, setRawCourses] = useState<CourseResult[]>([]);

  // Fetch courses — only when search/filter criteria change, NOT when existingCourseIds changes
  useEffect(() => {
    if (!isOpen) return;

    async function fetchCourses() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("grade_level", String(gradeLevel));
        // For summer semesters, filter to only summer-offered courses
        if (semester < 0) params.set("semester_offered", String(semester));
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (creditFilter !== "All") params.set("credit_type", creditFilter);
        if (divisionFilter !== "All Divisions") params.set("division", divisionFilter);
        if (departmentFilter !== "All Departments") params.set("department", departmentFilter);
        params.set("limit", "100");

        const res = await fetch(`/api/v1/courses?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const allCourses: CourseResult[] = data.courses ?? data.data ?? data ?? [];
          setRawCourses(allCourses);
          setCurrentPage(1);
        } else {
          setRawCourses([]);
          setCurrentPage(1);
        }
      } catch {
        setRawCourses([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, [isOpen, debouncedQuery, creditFilter, divisionFilter, departmentFilter, gradeLevel, semester]);

  // Apply client-side filters (runs on rawCourses change or filter toggle change, no API call)
  useEffect(() => {
    const filtered = rawCourses.filter((c) => {
      // Exclude already-added courses (from plan + added in this session)
      if (existingIdsRef.current.has(c.id)) return false;
      if (addedInSession.has(c.id)) return false;
      // Exclude semester partners of already-added courses (e.g., CSC162 if CSC161 is in plan)
      if (c.duration === "semester" && existingNamesRef.current.has(c.name)) return false;
      // Exclude summer/regular equivalents already in plan (e.g., hide SOC101/102 if SOC13S is planned)
      if (existingCourseCodes.length > 0 && findEquivalentInPlan(c.code, existingCourseCodes)) return false;
      // Exclude summer courses from regular semester pickers and vice versa
      const isSummerCourse = c.semestersOffered?.some(isSummerSemester) ?? false;
      if (semester > 0 && isSummerCourse) return false;
      if (semester < 0 && !isSummerCourse) return false;

      // Semester/duration filter
      if (c.duration === "full_year") {
        if (otherSemesterAtMax) return false;
        if (durationFilter === "semester") return false;
      } else {
        if (durationFilter === "full_year") return false;
        if (!c.semestersOffered || c.semestersOffered.length === 0) { /* show */ }
        else if (!c.semestersOffered.includes(semester)) return false;
      }

      // Early bird filter
      if (earlyBirdOnly) {
        const isEarlyBird = (c.name ?? "").toLowerCase().includes("early bird") ||
          /E\d$/.test(c.code ?? "") || /E\d\//.test(c.code ?? "");
        if (!isEarlyBird) return false;
      }

      // GPA waiver filter
      if (gpaWaiverOnly && !c.gpaWaiver) return false;

      return true;
    });
    setCourses(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [rawCourses, durationFilter, earlyBirdOnly, gpaWaiverOnly, semester, otherSemesterAtMax, addedInSession, existingCourseCodes]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  const handleAdd = useCallback(
    async (courseId: string, addAnyway = false, courseDuration?: string) => {
      setAddingCourseId(courseId);
      try {
        const result = await onAddCourse(courseId, addAnyway, courseDuration);
        if (result && result.hasViolations && !addAnyway) {
          setValidationPreview({ courseId, preview: result });
        } else {
          setValidationPreview(null);
          setJustAdded(courseId);
          setAddedInSession((prev) => new Set(prev).add(courseId));
          setTimeout(() => setJustAdded(null), 2000);
        }
      } catch (err) {
        console.error("[picker] handleAdd error:", err);
      } finally {
        setAddingCourseId(null);
      }
    },
    [onAddCourse]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/20 md:bg-foreground/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel - full screen on mobile, side panel on desktop */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Add course to Grade ${gradeLevel}, ${semester < 0 ? "Pre-Summer" : `Semester ${semester}`}`}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      >
        <div
          className="relative flex w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-xl"
          style={{ maxHeight: "calc(100vh - 3rem)" }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header with search */}
        <div className="sticky top-0 z-10 rounded-t-2xl border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring shrink-0"
              aria-label="Close course picker"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="shrink-0">
              <h2 className="text-lg font-semibold text-foreground">
                {semester < 0 ? "Add summer course" : "Add course"}
              </h2>
              <p className={`text-xs ${semester < 0 ? "text-warning" : "text-muted-foreground"}`}>
                Grade {gradeLevel}{semester === -2 ? ", Pre-Summer Session 1" : semester === -1 ? ", Pre-Summer Session 2" : `, Semester ${semester}`}
              </p>
            </div>
            <div className="flex-1">
              <Input
                ref={searchInputRef}
                label="Search courses"
                hideLabel
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="default" size="sm" onClick={onClose} className="shrink-0">
              Done
            </Button>
          </div>
        </div>

        {/* Filter chips — hidden for summer courses (only search applies) */}
        {semester >= 0 && (
        <div className="sticky top-[73px] z-10 border-b border-border bg-background px-4 py-3">

          {/* Filter chips — credit type + duration + flags */}
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Course filters">
            {/* Credit type chips */}
            {CREDIT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={creditFilter === type}
                onClick={() => setCreditFilter(type)}
                className={`
                  min-h-[36px] rounded-full px-3 py-1 text-xs font-medium
                  transition-colors duration-150
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                  ${creditFilter === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-border"
                  }
                `}
              >
                {type}
              </button>
            ))}

            {/* Divider */}
            <span className="self-center text-border">|</span>

            {/* Duration chips */}
            <button
              type="button"
              aria-pressed={durationFilter === "full_year"}
              onClick={() => setDurationFilter(durationFilter === "full_year" ? "all" : "full_year")}
              className={`
                min-h-[36px] rounded-full px-3 py-1 text-xs font-medium
                transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${durationFilter === "full_year"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border"
                }
              `}
            >
              Full year
            </button>
            <button
              type="button"
              aria-pressed={durationFilter === "semester"}
              onClick={() => setDurationFilter(durationFilter === "semester" ? "all" : "semester")}
              className={`
                min-h-[36px] rounded-full px-3 py-1 text-xs font-medium
                transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${durationFilter === "semester"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border"
                }
              `}
            >
              Sem only
            </button>

            {/* Divider */}
            <span className="self-center text-border">|</span>

            {/* Flag chips */}
            <button
              type="button"
              aria-pressed={earlyBirdOnly}
              onClick={() => setEarlyBirdOnly(!earlyBirdOnly)}
              className={`
                min-h-[36px] rounded-full px-3 py-1 text-xs font-medium
                transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${earlyBirdOnly
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border"
                }
              `}
            >
              Early bird
            </button>
            <button
              type="button"
              aria-pressed={gpaWaiverOnly}
              onClick={() => setGpaWaiverOnly(!gpaWaiverOnly)}
              className={`
                min-h-[36px] rounded-full px-3 py-1 text-xs font-medium
                transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${gpaWaiverOnly
                  ? "bg-warning text-white"
                  : "bg-muted text-muted-foreground hover:bg-border"
                }
              `}
            >
              GPA Waiver
            </button>
          </div>

          {/* Division & Department dropdowns */}
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              value={divisionFilter}
              onChange={(e) => {
                setDivisionFilter(e.target.value);
                setDepartmentFilter("All Departments");
              }}
              aria-label="Filter by division"
              className="h-9 min-h-[44px] flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {availableDepartments.length > 1 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                aria-label="Filter by department"
                className="h-9 min-h-[44px] flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <option value="All Departments">All Departments</option>
                {availableDepartments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Spinner variant="svg" className="h-6 w-6" />
              <p className="mt-2 text-sm">Searching courses...</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <svg
                aria-hidden="true"
                className="mb-2 h-8 w-8 opacity-40"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <p className="text-sm font-medium">No courses found</p>
              <p className="mt-1 text-xs">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <>
            <ul className="flex flex-col gap-2" role="list">
              {courses.slice((currentPage - 1) * COURSES_PER_PAGE, currentPage * COURSES_PER_PAGE).map((course) => {
                const isAdding = addingCourseId === course.id;
                const showPreview =
                  validationPreview?.courseId === course.id;

                return (
                  <li key={course.id}>
                    <div
                      role={onViewDetails ? "button" : undefined}
                      tabIndex={onViewDetails ? 0 : undefined}
                      onClick={onViewDetails ? () => onViewDetails(course.id) : undefined}
                      onKeyDown={onViewDetails ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onViewDetails(course.id);
                        }
                      } : undefined}
                      className={`
                        rounded-xl border p-3 transition-colors
                        ${onViewDetails ? "cursor-pointer" : ""}
                        ${showPreview ? "border-warning bg-warning-light/50" : lastViewedCourseId === course.id ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-muted/50"}
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate" title={`${course.name} (${course.code})`}>
                            {course.name} <span className="font-normal text-muted-foreground">({course.code})</span>
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <Badge
                              variant={creditTypeBadgeVariant(course.creditType)}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {course.creditType}
                            </Badge>
                            {course.semestersOffered?.some((s: number) => s < 0) && (
                              <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                                Summer
                              </Badge>
                            )}
                            {course.isAp && course.creditType !== "AP" && (
                              <Badge variant="ap" className="text-[10px] px-1.5 py-0">
                                AP
                              </Badge>
                            )}
                            {course.isDualCredit && (
                              <Badge variant="dual-credit" className="text-[10px] px-1.5 py-0">
                                Dual Credit
                              </Badge>
                            )}
                            {course.gpaWaiver && (
                              <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                                GPA Waiver
                              </Badge>
                            )}
                          </div>
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
                            <span className="text-border">|</span>
                            <span>
                              {course.duration === "full_year"
                                ? "Full year"
                                : course.semestersOffered && course.semestersOffered.length === 1
                                  ? `Sem ${course.semestersOffered[0]} only`
                                  : "Sem 1 & 2"}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleAdd(course.id, false, course.duration); }}
                          disabled={isAdding}
                          className="shrink-0"
                        >
                          {isAdding ? (
                            <Spinner variant="svg" className="h-4 w-4" />
                          ) : justAdded === course.id ? (
                            <span className="flex items-center gap-1 text-success">
                              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                              Added!
                            </span>
                          ) : (
                            "Add to plan"
                          )}
                        </Button>
                      </div>

                      {/* Validation preview */}
                      {showPreview && validationPreview.preview.violations.length > 0 && (
                        <div className="mt-2 rounded-lg border border-warning/50 bg-warning-light p-2.5">
                          <div className="flex items-start gap-2">
                            <svg
                              aria-hidden="true"
                              className="mt-0.5 h-4 w-4 shrink-0 text-warning"
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
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-warning">
                                Validation warnings
                              </p>
                              <ul className="mt-1 space-y-0.5">
                                {validationPreview.preview.violations.map(
                                  (v, i) => (
                                    <li
                                      key={i}
                                      className="text-xs text-foreground"
                                    >
                                      {v.message}
                                    </li>
                                  )
                                )}
                              </ul>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={(e) => { e.stopPropagation(); handleAdd(course.id, true, course.duration); }}
                                disabled={isAdding}
                              >
                                Add anyway
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            {courses.length > COURSES_PER_PAGE && (() => {
              const totalPages = Math.ceil(courses.length / COURSES_PER_PAGE);
              const btnClass = "min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md border border-border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
              return (
                <nav
                  className="mt-3 flex items-center justify-between border-t border-border pt-3"
                  aria-label="Course list pagination"
                >
                  <p className="text-xs text-muted-foreground">
                    {(currentPage - 1) * COURSES_PER_PAGE + 1}–{Math.min(currentPage * COURSES_PER_PAGE, courses.length)} of {courses.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(1)}
                      className={btnClass}
                      aria-label="First page"
                    >
                      «
                    </button>
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={btnClass}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    <span className="px-2 text-xs text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={btnClass}
                      aria-label="Next page"
                    >
                      ›
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className={btnClass}
                      aria-label="Last page"
                    >
                      »
                    </button>
                  </div>
                </nav>
              );
            })()}
            </>
          )}
        </div>
        </div>
      </div>
    </>
  );
}
