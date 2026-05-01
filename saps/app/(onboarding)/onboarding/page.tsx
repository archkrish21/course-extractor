"use client";

import { useState, useEffect, Suspense, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { creditTypeBadgeVariant } from "@/lib/badge-utils";
import { apiFetch } from "@/lib/api-client";
import { deriveCompletionSemesters } from "@/lib/onboarding/derive-completion-semesters";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CompletedCourse {
  code: string;
  name: string;
  grade: string;
  academic_year: string;
  semester: number;
}

interface PlanTemplateInfo {
  id: string;
  name: string;
  courseCount: number;
  courses: {
    code: string;
    name: string;
    gradeLevel: number;
    semester: number | null;
  }[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const GRADE_LEVELS = [9, 10, 11, 12] as const;

// Import from central config — Stevenson uses A, B, C, D, F (no +/- variants)
import { GRADE_OPTIONS, PASS_FAIL_OPTIONS, isPassFailCourse } from "@/config/grade-scale";
const LETTER_GRADES = GRADE_OPTIONS;

// Grade 9 flow: About You → Starting Plan (2 steps).
// Grade 10+ flow: About You → Past Courses → Assign Grades (3 steps).
function totalStepsFor(gradeLevel: number) {
  return gradeLevel === 9 ? 2 : 3;
}

type StepInfo = { label: string; number: number };

// ─── Helper: academic year string from grade + graduation year ─────────

function getAcademicYear(gradeLevel: number, graduationYear: number): string {
  const startYear = graduationYear - (12 - gradeLevel) - 1;
  return `${startYear}-${startYear + 1}`;
}

// ─── Step Indicator ────────────────────────────────────────────────────────

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: readonly StepInfo[] }) {
  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="mb-6 h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(currentStep / steps.length) * 100}%` }}
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Step ${currentStep} of ${steps.length}`}
        />
      </div>
      {/* Step labels with connecting line */}
      <div className="relative flex justify-between">
        {/* Connecting line behind circles */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-border" aria-hidden="true" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-300"
          style={{ width: currentStep > 1 ? `${((currentStep - 1) / (steps.length - 1)) * 100}%` : "0%" }}
          aria-hidden="true"
        />
        {steps.map((step) => (
          <div
            key={step.number}
            className={`relative z-10 flex flex-col items-center gap-1.5 ${
              step.number <= currentStep
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 ${
                step.number < currentStep
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : step.number === currentStep
                  ? "border-2 border-primary bg-primary-light text-primary shadow-sm"
                  : "border-2 border-border bg-card text-muted-foreground"
              }`}
              aria-current={step.number === currentStep ? "step" : undefined}
            >
              {step.number < currentStep ? (
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={`hidden text-xs font-medium sm:block ${
                step.number === currentStep
                  ? "text-primary font-semibold"
                  : step.number < currentStep
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: About You ─────────────────────────────────────────────────────

function StepAboutYou({
  gradeLevel,
  setGradeLevel,
  graduationYear,
}: {
  gradeLevel: number;
  setGradeLevel: (g: number) => void;
  graduationYear: number;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-bold text-foreground">About you</h2>
        <p className="text-sm text-muted-foreground">
          A few quick questions so I can tailor your plan to you.
        </p>
      </CardHeader>
      <CardContent>
        {/* Grade level radio buttons */}
        <fieldset className="mb-6">
          <legend className="mb-3 text-sm font-medium text-foreground">
            Current grade level
          </legend>
          <div className="flex flex-wrap gap-3">
            {GRADE_LEVELS.map((g) => (
              <label
                key={g}
                className={`flex min-h-[44px] min-w-[72px] cursor-pointer items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                  gradeLevel === g
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border bg-card text-foreground hover:border-secondary"
                }`}
              >
                <input
                  type="radio"
                  name="grade_level"
                  value={g}
                  checked={gradeLevel === g}
                  onChange={() => setGradeLevel(g)}
                  className="sr-only"
                />
                Grade {g}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Graduation year */}
        <Input
          label="Expected graduation year"
          type="number"
          value={graduationYear}
          readOnly
          helperText="Auto-calculated from your grade level."
        />
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Past Courses ──────────────────────────────────────────────────

interface ChecklistCourse {
  id: string;
  code: string;
  name: string;
  creditType: string;
  duration: string;
  divisionName: string;
  gradeLevels: number[];
  semestersOffered: number[] | null;
}

function StepPastCourses({
  gradeLevel,
  graduationYear,
  completedCourses,
  setCompletedCourses,
}: {
  gradeLevel: number;
  graduationYear: number;
  completedCourses: CompletedCourse[];
  setCompletedCourses: (c: CompletedCourse[]) => void;
}) {
  const [allCourses, setAllCourses] = useState<ChecklistCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("All");
  const [activeGrade, setActiveGrade] = useState<number>(gradeLevel > 9 ? gradeLevel - 1 : 9);
  const [showAllGrades, setShowAllGrades] = useState(false);

  // Compute completed grades (grades before current grade)
  const completedGrades: number[] = [];
  for (let g = 9; g < gradeLevel; g++) {
    completedGrades.push(g);
  }

  // Fetch all courses for the active grade (paginated)
  useEffect(() => {
    async function fetchAllCourses() {
      setLoadingCourses(true);
      const all: ChecklistCourse[] = [];
      let cursor: string | null = null;
      try {
        do {
          // When "Show all grade levels" is on, drop the grade filter so a
          // student can record courses completed at non-standard grades
          // (e.g., Algebra 1 taken in 8th grade, or Algebra 2 in 9th).
          const params = new URLSearchParams({ limit: "100" });
          if (!showAllGrades) params.set("grade_level", String(activeGrade));
          if (cursor) params.set("cursor", cursor);
          const res = await apiFetch(`/api/v1/courses?${params.toString()}`);
          if (!res.ok) break;
          const json = await res.json();
          for (const c of json.data ?? []) {
            all.push({
              id: c.id, code: c.code, name: c.name,
              creditType: c.creditType ?? "CP", duration: c.duration ?? "semester",
              divisionName: c.divisionName ?? "Other", gradeLevels: c.gradeLevels ?? [],
              semestersOffered: c.semestersOffered ?? null,
            });
          }
          cursor = json.meta?.next_cursor ?? null;
        } while (cursor);
      } catch { /* silent */ }
      setAllCourses(all);
      setLoadingCourses(false);
    }
    fetchAllCourses();
  }, [activeGrade, showAllGrades]);

  // Filter courses by search and division
  const filteredCourses = allCourses.filter((c) => {
    if (divisionFilter !== "All" && c.divisionName !== divisionFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    }
    return true;
  });

  const divisions = [...new Set(allCourses.map((c) => c.divisionName))].sort();
  const groupedByDivision: Record<string, ChecklistCourse[]> = {};
  for (const c of filteredCourses) {
    if (!groupedByDivision[c.divisionName]) groupedByDivision[c.divisionName] = [];
    groupedByDivision[c.divisionName].push(c);
  }

  const curAcademicYear = getAcademicYear(activeGrade, graduationYear);
  const selectedForGrade = [...new Set(completedCourses.filter((c) => c.academic_year === curAcademicYear).map((c) => c.code))];

  function isCourseSelected(code: string) {
    return completedCourses.some((c) => c.code === code && c.academic_year === curAcademicYear);
  }

  function toggleCourse(course: ChecklistCourse) {
    if (isCourseSelected(course.code)) {
      setCompletedCourses(completedCourses.filter((c) => !(c.code === course.code && c.academic_year === curAcademicYear)));
    } else {
      // Honor semestersOffered for full-year courses so pre-summer pairings
      // (e.g., World History SOC13S/SOC14S offered in [-2, -1]) land in the
      // pre-summer cells instead of being forced into regular Sem 1 / Sem 2.
      const semesters = deriveCompletionSemesters(course.duration, course.semestersOffered);
      const newEntries: CompletedCourse[] = semesters.map((semester) => ({
        code: course.code,
        name: course.name,
        grade: "A",
        academic_year: curAcademicYear,
        semester,
      }));
      setCompletedCourses([...completedCourses, ...newEntries]);
    }
  }

  if (gradeLevel === 9) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold text-foreground">Past courses</h2>
          <p className="text-sm text-muted-foreground">
            You&rsquo;re starting fresh &mdash; no high school courses to enter yet.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              All clear — nothing to enter yet. Click Next to continue.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-bold text-foreground">Your past courses</h2>
        <p className="text-sm text-muted-foreground">
          Check off the ones you&rsquo;ve completed. We&rsquo;ll fill in grades next.
        </p>
      </CardHeader>
      <CardContent>
        {/* Grade tabs */}
        <div className="mb-4 flex gap-2">
          {completedGrades.map((g) => {
            const yr = getAcademicYear(g, graduationYear);
            const count = [...new Set(completedCourses.filter((c) => c.academic_year === yr).map((c) => c.code))].length;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setActiveGrade(g)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  activeGrade === g
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Grade {g}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    activeGrade === g ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + division filter */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <svg aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter courses..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Filter courses by name or code"
            />
          </div>
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Filter by division"
          >
            <option value="All">All divisions</option>
            {divisions.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          <button
            type="button"
            aria-pressed={showAllGrades}
            onClick={() => setShowAllGrades(!showAllGrades)}
            title="Show courses from any grade level (e.g. if you completed it in middle school)"
            className={`h-10 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              showAllGrades
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            All grades
          </button>
        </div>

        {/* Course checklist */}
        {loadingCourses ? (
          <div className="space-y-3">{[...Array(8)].map((_, i) => (<div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />))}</div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {searchFilter || divisionFilter !== "All" ? "No courses match your filters." : "No courses available for this grade level."}
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
            {Object.entries(groupedByDivision).sort(([a], [b]) => a.localeCompare(b)).map(([division, courses]) => (
              <div key={division}>
                <div className="sticky top-0 z-10 bg-muted px-3 py-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{division}</p>
                </div>
                {courses.map((course) => {
                  const selected = isCourseSelected(course.code);
                  return (
                    <label key={course.id} className={`flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${selected ? "bg-primary-light/50" : ""}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleCourse(course)} className="h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{course.code}</span>
                      <span className="flex-1 text-sm text-foreground min-w-0 truncate">{course.name}</span>
                      <Badge variant={creditTypeBadgeVariant(course.creditType)} className="shrink-0">{course.creditType}</Badge>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Selection summary */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            {selectedForGrade.length} course{selectedForGrade.length !== 1 ? "s" : ""} selected for Grade {activeGrade}
            {completedCourses.length > 0 && selectedForGrade.length !== [...new Set(completedCourses.map((c) => c.code))].length && (
              <span className="ml-1 text-foreground font-medium">
                ({[...new Set(completedCourses.map((c) => c.code))].length} total across all grades)
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Choose a Starting Plan ────────────────────────────────────────

function StepChoosePlan({
  templates,
  selectedTemplateId,
  setSelectedTemplateId,
  isLoadingTemplates,
}: {
  templates: PlanTemplateInfo[];
  selectedTemplateId: string | null;
  setSelectedTemplateId: (id: string | null) => void;
  isLoadingTemplates: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-bold text-foreground">Pick a starting plan</h2>
        <p className="text-sm text-muted-foreground">
          Choose a template that matches your interests &mdash; you can tweak it later.
          Nothing fits? Click <span className="font-medium">Complete</span> to start from scratch.
        </p>
      </CardHeader>
      <CardContent>
        {isLoadingTemplates ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
            <span className="ml-3 text-sm text-muted-foreground">Loading templates...</span>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {templates.map((t) => {
              const isSelected = selectedTemplateId === t.id;
              const isExpanded = expandedId === t.id;

              // Group courses by grade level
              const coursesByGrade: Record<number, typeof t.courses> = {};
              for (const c of t.courses) {
                if (!coursesByGrade[c.gradeLevel]) coursesByGrade[c.gradeLevel] = [];
                coursesByGrade[c.gradeLevel].push(c);
              }

              return (
                <div
                  key={t.id}
                  className={`flex flex-col rounded-xl border bg-card shadow-sm transition-all duration-200 ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary-light/30"
                      : "border-border hover:border-secondary hover:shadow-md"
                  }`}
                >
                  <div className="flex flex-col flex-1 p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground">{t.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.courseCount} courses over 4 years
                        </p>
                      </div>
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                          isSelected ? "bg-primary" : "border-2 border-border"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5 text-primary-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={3}
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Expandable course preview */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : t.id);
                      }}
                      className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring self-start"
                      aria-expanded={isExpanded}
                      aria-controls={`template-courses-${t.id}`}
                    >
                      <svg
                        aria-hidden="true"
                        className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      {isExpanded ? "Hide" : "Preview"} courses
                    </button>

                    {isExpanded && (
                      <div
                        id={`template-courses-${t.id}`}
                        className="mb-3 max-h-48 overflow-y-auto rounded-lg bg-muted/50 p-3"
                      >
                        {GRADE_LEVELS.map((g) => {
                          const gradeCourses = coursesByGrade[g];
                          if (!gradeCourses || gradeCourses.length === 0) return null;
                          return (
                            <div key={g} className="mb-2 last:mb-0">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Grade {g}
                              </p>
                              <ul className="ml-2">
                                {gradeCourses.map((c, idx) => (
                                  <li key={idx} className="text-xs text-foreground">
                                    <span className="font-mono text-muted-foreground">{c.code}</span>{" "}
                                    {c.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Button pinned to bottom */}
                  <div className="p-5 pt-0 mt-auto">
                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplateId(isSelected ? null : t.id);
                      }}
                    >
                      {isSelected ? "Selected" : "Select this plan"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Assign Grades ─────────────────────────────────────────────────

function StepAssignGrades({
  gradeLevel,
  graduationYear,
  completedCourses,
  setCompletedCourses,
}: {
  gradeLevel: number;
  graduationYear: number;
  completedCourses: CompletedCourse[];
  setCompletedCourses: (c: CompletedCourse[]) => void;
}) {
  const completedGrades: number[] = [];
  for (let g = 9; g < gradeLevel; g++) completedGrades.push(g);

  function setGradeFor(index: number, grade: string) {
    setCompletedCourses(
      completedCourses.map((c, i) => (i === index ? { ...c, grade } : c))
    );
  }

  if (completedCourses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold text-foreground">Enter your grades</h2>
          <p className="text-sm text-muted-foreground">
            No past courses selected yet. Go back to add some, or continue to finish up.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-bold text-foreground">Enter your grades</h2>
        <p className="text-sm text-muted-foreground">
          Enter the final grade for each past course. I&rsquo;ll lock these once you&rsquo;re done &mdash;
          you can unlock them later in the planner if you need to make corrections.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {completedGrades.map((g) => {
            const yr = getAcademicYear(g, graduationYear);
            const entriesForYear = completedCourses
              .map((c, i) => ({ entry: c, index: i }))
              .filter(({ entry }) => entry.academic_year === yr);
            if (entriesForYear.length === 0) return null;

            const bySemester: Record<number, typeof entriesForYear> = {};
            for (const row of entriesForYear) {
              const s = row.entry.semester;
              if (!bySemester[s]) bySemester[s] = [];
              bySemester[s].push(row);
            }
            const semesterKeys = Object.keys(bySemester)
              .map((k) => parseInt(k, 10))
              .sort((a, b) => a - b);

            return (
              <div key={g}>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  Grade {g} · {yr}
                </p>
                {semesterKeys.map((sem) => {
                  const label =
                    sem === -2 ? "Pre-Summer Session 1" :
                    sem === -1 ? "Pre-Summer Session 2" :
                    `Semester ${sem}`;
                  return (
                    <div key={sem} className="mb-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </p>
                      <div className="overflow-hidden rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-border">
                            {bySemester[sem].map(({ entry, index }) => {
                              const options = isPassFailCourse(entry.code)
                                ? PASS_FAIL_OPTIONS
                                : GRADE_OPTIONS;
                              return (
                                <tr key={`${entry.code}-${entry.semester}-${index}`} className="bg-card">
                                  <td className="px-3 py-2.5">
                                    <p className="font-medium text-foreground">{entry.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{entry.code}</p>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <select
                                      value={entry.grade}
                                      onChange={(e) => setGradeFor(index, e.target.value)}
                                      className="h-9 min-w-[80px] rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                      aria-label={`Grade for ${entry.code}`}
                                    >
                                      {options.map((o) => (
                                        <option key={o} value={o}>{o}</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Onboarding Wizard ────────────────────────────────────────────────

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get("welcome") === "1";
  const [showWelcome, setShowWelcome] = useState(isNewUser);

  // Block re-entry once onboarding is complete — /onboarding is a one-shot
  // flow; returning users should be bounced to the main app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/v1/auth/me");
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const u = json.data ?? json;
        if (u?.onboarding_completed) router.replace("/dashboard");
      } catch { /* silent — let onboarding load */ }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Auto-dismiss welcome banner after 6 seconds
  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => setShowWelcome(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const currentYear = new Date().getFullYear();
  const [gradeLevel, setGradeLevel] = useState(9);
  const [graduationYear, setGraduationYear] = useState(currentYear + 3);

  // Auto-calculate graduation year when grade changes
  function handleGradeLevelChange(g: number) {
    setGradeLevel(g);
    setGraduationYear(currentYear + (12 - g));
  }

  // Step 2
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);

  // Step 3
  const [templates, setTemplates] = useState<PlanTemplateInfo[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Load templates when entering step 3
  useEffect(() => {
    if (currentStep === 2 && gradeLevel === 9 && templates.length === 0) {
      loadTemplates();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTemplates() {
    setIsLoadingTemplates(true);
    try {
      const res = await apiFetch("/api/v1/plans/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.data || []);
      }
    } catch {
      // If templates fail to load, user can still proceed with "start from scratch"
    } finally {
      setIsLoadingTemplates(false);
    }
  }

  function goNext() {
    setCurrentStep(Math.min(currentStep + 1, totalStepsFor(gradeLevel)));
    setError(null);
  }

  function goPrevious() {
    setCurrentStep(Math.max(currentStep - 1, 1));
    setError(null);
  }

  async function handleComplete() {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        grade_level: gradeLevel,
        graduation_year: graduationYear,
      };

      if (completedCourses.length > 0) {
        payload.courses_completed = completedCourses.map((c) => ({
          code: c.code,
          grade: c.grade,
          academic_year: c.academic_year,
          semester: c.semester,
        }));
      }

      if (selectedTemplateId) {
        payload.template_id = selectedTemplateId;
      }

      const res = await apiFetch("/api/v1/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data?.error?.message || "Something went wrong. Please try again."
        );
        return;
      }

      // Mark onboarding as complete
      await apiFetch("/api/v1/auth/onboarding-complete", { method: "POST" }).catch(() => {});

      // Success — check if user has existing plans (from linked accounts)
      try {
        const plansRes = await apiFetch("/api/v1/plans");
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          const plans = plansData?.data ?? plansData?.plans ?? plansData ?? [];
          if (Array.isArray(plans) && plans.length > 0) {
            router.push("/dashboard");
            return;
          }
        }
      } catch { /* fall through to planner */ }
      router.push("/planner");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {/* Welcome banner */}
      {showWelcome && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-success/30 bg-success-light p-3">
          <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <p className="flex-1 text-sm font-medium text-success">You&rsquo;re in. Let&rsquo;s get your plan started.</p>
          <button
            type="button"
            onClick={() => setShowWelcome(false)}
            className="flex h-6 w-6 items-center justify-center rounded text-success/60 hover:text-success transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Dismiss welcome message"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <StepIndicator
        currentStep={currentStep}
        steps={
          gradeLevel === 9
            ? [
                { label: "About you", number: 1 },
                { label: "Starting plan", number: 2 },
              ]
            : [
                { label: "About you", number: 1 },
                { label: "Past courses", number: 2 },
                { label: "Enter grades", number: 3 },
              ]
        }
      />

      {/* Error banner */}
      {error && (
        <div
          className="mb-6 rounded-lg border border-destructive/30 bg-destructive-light p-3 text-sm text-destructive"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
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
            {error}
          </span>
        </div>
      )}

      {/* Step content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && (
          <StepAboutYou
            gradeLevel={gradeLevel}
            setGradeLevel={handleGradeLevelChange}
            graduationYear={graduationYear}
          />
        )}

        {currentStep === 2 && gradeLevel === 9 && (
          <StepChoosePlan
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            isLoadingTemplates={isLoadingTemplates}
          />
        )}

        {currentStep === 2 && gradeLevel !== 9 && (
          <StepPastCourses
            gradeLevel={gradeLevel}
            graduationYear={graduationYear}
            completedCourses={completedCourses}
            setCompletedCourses={setCompletedCourses}
          />
        )}

        {currentStep === 3 && gradeLevel !== 9 && (
          <StepAssignGrades
            gradeLevel={gradeLevel}
            graduationYear={graduationYear}
            completedCourses={completedCourses}
            setCompletedCourses={setCompletedCourses}
          />
        )}

      </div>

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={goPrevious}
              disabled={isSubmitting}
            >
              <svg
                aria-hidden="true"
                className="mr-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep < totalStepsFor(gradeLevel) ? (
            <Button type="button" onClick={goNext} disabled={isSubmitting}>
              Next
              <svg
                aria-hidden="true"
                className="ml-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Saving...
                </>
              ) : (
                "Complete"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
