"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CourseDetail } from "@/components/course-detail";
import { apiFetch } from "@/lib/api-client";

interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  divisionId: string;
  divisionName: string;
  divisionCode: string;
  creditType: "CP" | "Accelerated" | "Honors" | "AP";
  creditValue: string;
  duration: "semester" | "full_year";
  gradeLevels: number[];
  isAp: boolean;
  isDualCredit: boolean;
  isHonors: boolean;
  gpaWaiver: boolean;
  semestersOffered: number[] | null;
}

interface CoursesResponse {
  data: Course[];
  meta: {
    has_more: boolean;
    next_cursor?: string;
    total?: number;
  };
}

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

const CREDIT_TYPES = ["CP", "Accelerated", "Honors", "AP"] as const;
const GRADE_LEVELS = [9, 10, 11, 12];

function creditTypeBadgeVariant(type: string) {
  switch (type) {
    case "AP": return "ap" as const;
    case "Honors": return "honors" as const;
    case "Accelerated": return "accelerated" as const;
    default: return "default" as const;
  }
}

export default function CourseBrowserPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Pagination — track cursor per page so we can navigate back
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]); // index 0 = page 1 cursor (undefined = first page)

  // Filters
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("All Divisions");
  const [department, setDepartment] = useState("All Departments");
  const [creditTypes, setCreditTypes] = useState<Set<string>>(new Set());
  const [gradeLevels, setGradeLevels] = useState<Set<number>>(new Set());
  const [dualCreditOnly, setDualCreditOnly] = useState(false);
  const [gpaWaiverOnly, setGpaWaiverOnly] = useState(false);
  const [semesterFilter, setSemesterFilter] = useState<string>("all"); // "all" | "sem1" | "sem2" | "full_year"

  // Available departments for the selected division
  const availableDepartments = division !== "All Divisions"
    ? DEPARTMENTS_BY_DIVISION[division] ?? []
    : [];

  // Mobile filter panel
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Course detail
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCourses = useCallback(async (cursor?: string) => {
    setLoading(true);

    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (division !== "All Divisions") params.set("division", division);
    if (department !== "All Departments") params.set("department", department);
    if (creditTypes.size > 0) params.set("credit_type", Array.from(creditTypes).join(","));
    if (gradeLevels.size > 0) params.set("grade_level", Array.from(gradeLevels).join(","));
    if (dualCreditOnly) params.set("is_dual_credit", "true");
    if (gpaWaiverOnly) params.set("gpa_waiver", "true");
    if (semesterFilter === "sem1") params.set("semester_offered", "1");
    else if (semesterFilter === "sem2") params.set("semester_offered", "2");
    else if (semesterFilter === "sem_both") params.set("semester_both", "true");
    else if (semesterFilter === "full_year") params.set("duration", "full_year");
    if (cursor) params.set("cursor", cursor);
    params.set("limit", String(PAGE_SIZE));

    try {
      const res = await apiFetch(`/api/v1/courses?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch courses");
      const json: CoursesResponse = await res.json();

      setCourses(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
      setHasMore(json.meta?.has_more ?? false);

      // Store next page's cursor so we can navigate forward later
      return json.meta?.next_cursor;
    } catch {
      setCourses([]);
      setTotal(0);
      setHasMore(false);
      return undefined;
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [search, division, department, creditTypes, gradeLevels, dualCreditOnly, gpaWaiverOnly, semesterFilter]);

  // Reset to page 1 when filters change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCurrentPage(1);
      setCursorHistory([undefined]);
      const nextCursor = await fetchCourses(undefined);
      if (nextCursor) {
        setCursorHistory([undefined, nextCursor]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, division, department, creditTypes, gradeLevels, dualCreditOnly, gpaWaiverOnly, semesterFilter, fetchCourses]);

  async function goToPage(page: number) {
    const cursor = cursorHistory[page - 1]; // page 1 → index 0
    setCurrentPage(page);
    const nextCursor = await fetchCourses(cursor);
    // Store the cursor for the page after this one (if not already stored)
    if (nextCursor && cursorHistory.length <= page) {
      setCursorHistory((prev) => {
        const updated = [...prev];
        updated[page] = nextCursor;
        return updated;
      });
    }
    // Scroll to top of course list
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCourseCodeClick(courseId: string) {
    try {
      const res = await apiFetch(`/api/v1/courses/${courseId}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) {
        setSelectedCourse(json.data);
      }
    } catch {
      // Silently fail
    }
  }

  function handleDivisionClick(divisionName: string) {
    setSelectedCourse(null);
    setDivision(divisionName);
    setDepartment("All Departments");
  }

  function handleDepartmentClick(divisionName: string, departmentName: string) {
    setSelectedCourse(null);
    setDivision(divisionName);
    setDepartment(departmentName);
  }

  function toggleCreditType(type: string) {
    setCreditTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleGradeLevel(level: number) {
    setGradeLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setDivision("All Divisions");
    setCreditTypes(new Set());
    setGradeLevels(new Set());
    setDualCreditOnly(false);
    setGpaWaiverOnly(false);
    setSemesterFilter("all");
    setDepartment("All Departments");
  }

  const hasActiveFilters =
    division !== "All Divisions" ||
    department !== "All Departments" ||
    creditTypes.size > 0 ||
    gradeLevels.size > 0 ||
    dualCreditOnly ||
    gpaWaiverOnly ||
    semesterFilter !== "all";

  const activeFilterCount =
    (division !== "All Divisions" ? 1 : 0) +
    (department !== "All Departments" ? 1 : 0) +
    creditTypes.size +
    gradeLevels.size +
    (dualCreditOnly ? 1 : 0) +
    (gpaWaiverOnly ? 1 : 0) +
    (semesterFilter !== "all" ? 1 : 0);

  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  // Close mobile filters on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && filtersOpen) setFiltersOpen(false);
      if (e.key === "Escape" && selectedCourse) setSelectedCourse(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filtersOpen, selectedCourse]);

  const filterPanel = (
    <div className="flex flex-col gap-5">
      {/* Division */}
      <div>
        <label htmlFor="division-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Division
        </label>
        <select
          id="division-select"
          value={division}
          onChange={(e) => {
            setDivision(e.target.value);
            setDepartment("All Departments");
          }}
          className="h-11 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Department — only shown when a division is selected and has multiple departments */}
      {availableDepartments.length > 1 && (
        <div>
          <label htmlFor="department-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Department
          </label>
          <select
            id="department-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-11 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="All Departments">All Departments</option>
            {availableDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Credit Type */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credit Type</legend>
        <div className="flex flex-wrap gap-2">
          {CREDIT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="checkbox"
              aria-checked={creditTypes.has(type)}
              onClick={() => toggleCreditType(type)}
              className={`
                rounded-full border px-3 py-1.5 text-xs font-medium
                min-h-[44px] cursor-pointer transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${
                  creditTypes.has(type)
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-secondary"
                }
              `}
            >
              {type}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Grade Level */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grade Level</legend>
        <div className="flex flex-wrap gap-2">
          {GRADE_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="checkbox"
              aria-checked={gradeLevels.has(level)}
              onClick={() => toggleGradeLevel(level)}
              className={`
                rounded-full border px-3 py-1.5 text-xs font-medium
                min-h-[44px] min-w-[44px] cursor-pointer transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${
                  gradeLevels.has(level)
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-secondary"
                }
              `}
            >
              Grade {level}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Semester Offered */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semester Offered</legend>
        <div className="flex flex-wrap gap-2">
          {([
            { value: "all", label: "All" },
            { value: "sem1", label: "Sem 1" },
            { value: "sem2", label: "Sem 2" },
            { value: "sem_both", label: "Sem 1 & 2" },
            { value: "full_year", label: "Full Year" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={semesterFilter === opt.value}
              onClick={() => setSemesterFilter(opt.value)}
              className={`
                rounded-full border px-3 py-1.5 text-xs font-medium
                min-h-[44px] cursor-pointer transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${
                  semesterFilter === opt.value
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-secondary"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Toggle filters */}
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={dualCreditOnly}
            onChange={(e) => setDualCreditOnly(e.target.checked)}
            className="h-5 w-5 rounded border-border text-primary accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <span className="text-sm font-medium text-foreground">Dual credit only</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={gpaWaiverOnly}
            onChange={(e) => setGpaWaiverOnly(e.target.checked)}
            className="h-5 w-5 rounded border-border text-primary accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <span className="text-sm font-medium text-foreground">GPA waiver available</span>
        </label>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Course Browser
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search and explore available courses by division, level, and type
        </p>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar filters */}
        <aside className="hidden lg:block w-64 shrink-0" aria-label="Course filters">
          {filterPanel}
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search bar + mobile filter toggle */}
          <div className="mb-5 flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="course-search" className="sr-only">
                Search courses
              </label>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                ref={searchInputRef}
                id="course-search"
                type="search"
                placeholder="Search 300+ courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 min-h-[44px] w-full rounded-lg border border-border bg-background pl-10 pr-9 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:border-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); searchInputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-border hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Mobile filter button */}
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground min-h-[44px] lg:hidden hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => setFiltersOpen(true)}
              aria-label="Open filters"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="default" className="bg-primary text-primary-foreground">
                  {activeFilterCount}
                </Badge>
              )}
            </button>
          </div>

          {/* Results count */}
          {!initialLoad && (
            <p className="mb-3 text-sm text-muted-foreground">
              {total === 0 ? "No courses found" : `${total} course${total === 1 ? "" : "s"} found`}
              {search.trim() && ` for "${search.trim()}"`}
            </p>
          )}

          {/* Course list — single column by default, two columns on wide screens */}
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3" role="list" aria-label="Course results">
            {courses.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-xl"
                  onClick={() => setSelectedCourse(course)}
                  aria-label={`View details for ${course.name}`}
                >
                  <Card className="transition-colors duration-150 hover:border-primary/40 hover:shadow-md cursor-pointer h-full">
                    <CardContent className="flex h-full flex-col justify-between p-5">
                      {/* Top: name + code */}
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate" title={course.name}>
                          {course.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{course.code}</p>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {course.description}
                        </p>
                      </div>

                      {/* Bottom: badges + metadata */}
                      <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <Badge variant={creditTypeBadgeVariant(course.creditType)}>
                            {course.creditType}
                          </Badge>
                          {course.semestersOffered?.some((s: number) => s < 0) && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Summer</Badge>
                          )}
                          {course.isAp && course.creditType !== "AP" && <Badge variant="ap">AP</Badge>}
                          {course.isDualCredit && <Badge variant="dual-credit">Dual Credit</Badge>}
                          {course.gpaWaiver && <Badge variant="warning">GPA Waiver</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                          <span>{
                            course.duration === "full_year"
                              ? "Full Year"
                              : course.semestersOffered?.some((s: number) => s < 0)
                                ? "Summer"
                                : course.semestersOffered?.length === 1
                                  ? `Sem ${course.semestersOffered[0]} only`
                                  : "Sem 1 & 2"
                          }</span>
                          <span className="text-border">|</span>
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
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </li>
            ))}
          </ul>

          {/* Loading state — skeleton cards */}
          {loading && (
            <div role="status" aria-label="Loading courses">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i}>
                    <Card className="animate-pulse">
                      <CardContent className="flex flex-col gap-3 p-5">
                        <div className="h-4 w-3/4 rounded bg-muted" />
                        <div className="h-3 w-1/3 rounded bg-muted" />
                        <div className="h-3 w-full rounded bg-muted" />
                        <div className="flex items-center gap-2 pt-2">
                          <div className="h-5 w-12 rounded-full bg-muted" />
                          <div className="h-5 w-16 rounded-full bg-muted" />
                          <div className="ml-auto h-4 w-20 rounded bg-muted" />
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
              <span className="sr-only">Loading courses...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && !initialLoad && courses.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <svg
                aria-hidden="true"
                className="mb-3 h-12 w-12 text-muted-foreground/30"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-sm font-medium text-foreground">No courses found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                  Clear all filters
                </Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && !initialLoad && courses.length > 0 && (
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              {/* Page info */}
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{((currentPage - 1) * PAGE_SIZE) + courses.length}
                {total > 0 && ` of ${total}`} courses
              </p>

              {/* Page controls */}
              <nav className="flex items-center gap-1" role="navigation" aria-label="Pagination">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </Button>

                {/* Page number buttons */}
                {(() => {
                  const pages: (number | "ellipsis")[] = [];
                  const maxVisible = totalPages;
                  if (maxVisible <= 7) {
                    for (let i = 1; i <= maxVisible; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("ellipsis");
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(maxVisible - 1, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < maxVisible - 2) pages.push("ellipsis");
                    pages.push(maxVisible);
                  }
                  return pages.map((p, idx) =>
                    p === "ellipsis" ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground select-none">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => goToPage(p)}
                        disabled={!cursorHistory[p - 1] && p !== 1 && p > currentPage}
                        aria-label={`Page ${p}`}
                        aria-current={currentPage === p ? "page" : undefined}
                        className={`
                          flex h-9 min-w-[36px] items-center justify-center rounded-lg text-sm font-medium transition-colors
                          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                          ${currentPage === p
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted"
                          }
                          disabled:pointer-events-none disabled:opacity-50
                        `}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => goToPage(currentPage + 1)}
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </Button>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter slide-over */}
      {filtersOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-card shadow-xl lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Course filters"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-lg font-semibold text-foreground">Filters</h2>
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filters"
                >
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {filterPanel}
              </div>
              <div className="border-t border-border p-4">
                <Button className="w-full" onClick={() => setFiltersOpen(false)}>
                  Show results
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Course detail panel */}
      {selectedCourse && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSelectedCourse(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
            <div
              className="relative w-full max-w-5xl rounded-xl bg-card shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label={`Course details: ${selectedCourse.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 rounded-t-xl border-b border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-4">
                    <h2 className="text-lg font-semibold text-foreground truncate">
                      {selectedCourse.name}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">({selectedCourse.code})</span>
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() => setSelectedCourse(null)}
                    aria-label="Close course details"
                  >
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={creditTypeBadgeVariant(selectedCourse.creditType)}>
                    {selectedCourse.creditType}
                  </Badge>
                  {selectedCourse.semestersOffered?.some((s: number) => s < 0) && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Summer</Badge>
                  )}
                  {selectedCourse.isAp && selectedCourse.creditType !== "AP" && (
                    <Badge variant="ap">Advanced Placement</Badge>
                  )}
                  {selectedCourse.isDualCredit && (
                    <Badge variant="dual-credit">Dual Credit</Badge>
                  )}
                  {selectedCourse.gpaWaiver && (
                    <Badge variant="warning">GPA Waiver</Badge>
                  )}
                </div>
              </div>
              <div className="p-4 sm:p-6">
              <CourseDetail
                course={selectedCourse}
                onCourseClick={handleCourseCodeClick}
                onDivisionClick={handleDivisionClick}
                onDepartmentClick={handleDepartmentClick}
                onClose={() => setSelectedCourse(null)}
              />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
