"use client";

import { useState, useCallback, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CompletedCourse {
  code: string;
  name: string;
  grade: string;
  academic_year: string;
  semester: number;
}

interface CourseSearchResult {
  id: string;
  code: string;
  name: string;
  creditType: string;
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

interface CollegeTargets {
  reach: string;
  match: string;
  safety: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const GRADE_LEVELS = [9, 10, 11, 12] as const;

// Import from central config — Stevenson uses A, B, C, D, F (no +/- variants)
import { GRADE_OPTIONS } from "@/config/grade-scale";
const LETTER_GRADES = GRADE_OPTIONS;

const STEPS = [
  { label: "About You", number: 1 },
  { label: "Past Courses", number: 2 },
  { label: "Starting Plan", number: 3 },
  { label: "Goals", number: 4 },
] as const;

// ─── Helper: academic year string from grade + graduation year ─────────

function getAcademicYear(gradeLevel: number, graduationYear: number): string {
  const startYear = graduationYear - (12 - gradeLevel) - 1;
  return `${startYear}-${startYear + 1}`;
}

// ─── Step Indicator ────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="mb-4 h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Step ${currentStep} of ${STEPS.length}`}
        />
      </div>
      {/* Step labels */}
      <div className="flex justify-between">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className={`flex flex-col items-center gap-1 ${
              step.number <= currentStep
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step.number < currentStep
                  ? "bg-primary text-primary-foreground"
                  : step.number === currentStep
                  ? "border-2 border-primary text-primary"
                  : "border-2 border-border text-muted-foreground"
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
            <span className="hidden text-xs font-medium sm:block">{step.label}</span>
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
  setGraduationYear,
}: {
  gradeLevel: number;
  setGradeLevel: (g: number) => void;
  graduationYear: number;
  setGraduationYear: (y: number) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-foreground">About You</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Tell us about your current status so we can personalize your experience.
      </p>

      {/* Grade level radio buttons */}
      <fieldset className="mb-6">
        <legend className="mb-3 text-sm font-medium text-foreground">
          Current grade level
        </legend>
        <div className="flex flex-wrap gap-3">
          {GRADE_LEVELS.map((g) => (
            <label
              key={g}
              className={`flex min-h-[44px] min-w-[72px] cursor-pointer items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                gradeLevel === g
                  ? "border-primary bg-primary/10 text-primary"
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
        min={2025}
        max={2035}
        value={graduationYear}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setGraduationYear(parseInt(e.target.value, 10) || graduationYear)
        }
        helperText="Auto-calculated from your grade level. You can adjust if needed."
      />
    </div>
  );
}

// ─── Step 2: Past Courses ──────────────────────────────────────────────────

function StepPastCourses({
  gradeLevel,
  graduationYear,
  completedCourses,
  setCompletedCourses,
  onSkip,
}: {
  gradeLevel: number;
  graduationYear: number;
  completedCourses: CompletedCourse[];
  setCompletedCourses: (c: CompletedCourse[]) => void;
  onSkip: () => void;
}) {
  const [courseSearch, setCourseSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CourseSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // Compute completed grades (grades before current grade)
  const completedGrades: number[] = [];
  for (let g = 9; g < gradeLevel; g++) {
    completedGrades.push(g);
  }

  const searchCourses = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/v1/courses?q=${encodeURIComponent(query)}&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            (data.data || []).map((c: Record<string, unknown>) => ({
              id: c.id,
              code: c.code,
              name: c.name,
              creditType: c.creditType,
            }))
          );
        }
      } catch {
        // Silently fail — user can retry
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (courseSearch.trim()) {
        searchCourses(courseSearch.trim());
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [courseSearch, searchCourses]);

  function addCourse(
    course: CourseSearchResult,
    targetGradeLevel: number,
    semester: number
  ) {
    const academicYear = getAcademicYear(targetGradeLevel, graduationYear);
    // Avoid duplicates
    const exists = completedCourses.some(
      (c) =>
        c.code === course.code &&
        c.academic_year === academicYear &&
        c.semester === semester
    );
    if (exists) return;

    setCompletedCourses([
      ...completedCourses,
      {
        code: course.code,
        name: course.name,
        grade: "A",
        academic_year: academicYear,
        semester,
      },
    ]);
    setCourseSearch("");
    setSearchResults([]);
    setActiveRowId(null);
  }

  function updateGrade(index: number, grade: string) {
    const updated = [...completedCourses];
    updated[index] = { ...updated[index], grade };
    setCompletedCourses(updated);
  }

  function removeCourse(index: number) {
    setCompletedCourses(completedCourses.filter((_, i) => i !== index));
  }

  if (gradeLevel === 9) {
    return (
      <div>
        <h2 className="mb-1 text-xl font-semibold text-foreground">Past Courses</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          As an incoming freshman, you don&apos;t have any high school courses to enter yet.
        </p>
        <div className="rounded-lg border border-border bg-muted/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No courses to enter for Grade 9 students. Continue to the next step.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-foreground">Enter Past Courses</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Enter the courses you have already completed so we can accurately calculate your GPA
        and track your progress. You can skip this and come back later.
      </p>

      {/* Bulk entry for each completed grade */}
      {completedGrades.map((g) => {
        const academicYear = getAcademicYear(g, graduationYear);
        const coursesForGrade = completedCourses.filter(
          (c) => c.academic_year === academicYear
        );

        return (
          <div key={g} className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Grade {g} ({academicYear})
            </h3>

            {/* Existing courses table */}
            {coursesForGrade.length > 0 && (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="pb-2 pr-3 text-left font-medium text-muted-foreground">
                        Course
                      </th>
                      <th scope="col" className="pb-2 pr-3 text-left font-medium text-muted-foreground">
                        Sem
                      </th>
                      <th scope="col" className="pb-2 pr-3 text-left font-medium text-muted-foreground">
                        Grade
                      </th>
                      <th scope="col" className="pb-2 text-right font-medium text-muted-foreground">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {coursesForGrade.map((course) => {
                      const globalIndex = completedCourses.indexOf(course);
                      return (
                        <tr key={`${course.code}-${course.semester}`} className="border-b border-border/50">
                          <td className="py-2 pr-3">
                            <span className="font-mono text-xs text-muted-foreground">{course.code}</span>{" "}
                            <span className="text-foreground">{course.name}</span>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            S{course.semester}
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              value={course.grade}
                              onChange={(e) => updateGrade(globalIndex, e.target.value)}
                              className="h-9 min-h-[44px] rounded-lg border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              aria-label={`Grade for ${course.name}`}
                            >
                              {LETTER_GRADES.map((lg) => (
                                <option key={lg} value={lg}>
                                  {lg}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeCourse(globalIndex)}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              aria-label={`Remove ${course.name}`}
                            >
                              <svg
                                aria-hidden="true"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add course search */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={activeRowId === `grade-${g}` ? courseSearch : ""}
                    onFocus={() => setActiveRowId(`grade-${g}`)}
                    onChange={(e) => {
                      setActiveRowId(`grade-${g}`);
                      setCourseSearch(e.target.value);
                    }}
                    placeholder="Search courses by name or code..."
                    className="h-11 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label={`Search courses for grade ${g}`}
                    role="combobox"
                    aria-expanded={activeRowId === `grade-${g}` && searchResults.length > 0}
                    aria-autocomplete="list"
                  />
                  {isSearching && activeRowId === `grade-${g}` && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    </div>
                  )}
                </div>
              </div>

              {/* Search dropdown */}
              {activeRowId === `grade-${g}` && searchResults.length > 0 && (
                <ul
                  className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
                  role="listbox"
                >
                  {searchResults.map((result) => (
                    <li key={result.id} role="option" aria-selected={false}>
                      <div className="flex items-center gap-2 border-b border-border/30 px-3 py-1">
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs text-muted-foreground">
                            {result.code}
                          </span>{" "}
                          <span className="text-sm text-foreground truncate">
                            {result.name}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({result.creditType})
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => addCourse(result, g, 1)}
                            className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            S1
                          </button>
                          <button
                            type="button"
                            onClick={() => addCourse(result, g, 2)}
                            className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            S2
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}

      {completedCourses.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {completedCourses.length} course{completedCourses.length !== 1 ? "s" : ""} entered
        </p>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="mt-4 min-h-[44px] text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        I&apos;m a freshman / skip for now
      </button>
    </div>
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
    <div>
      <h2 className="mb-1 text-xl font-semibold text-foreground">Choose a Starting Plan</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Pick a plan template that matches your interests. You can customize it later.
      </p>

      {isLoadingTemplates ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
          <span className="ml-3 text-sm text-muted-foreground">Loading templates...</span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
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
              <Card
                key={t.id}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20"
                    : "hover:border-secondary"
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-foreground">{t.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.courseCount} courses over 4 years
                      </p>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
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
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Expandable course preview */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : t.id);
                    }}
                    className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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

                  <Button
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTemplateId(isSelected ? null : t.id);
                    }}
                  >
                    {isSelected ? "Selected" : "Select this plan"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSelectedTemplateId(null)}
        className="mt-6 min-h-[44px] text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Start from scratch (no template)
      </button>
    </div>
  );
}

// ─── Step 4: Set Your Goals ────────────────────────────────────────────────

function StepGoals({
  gpaGoal,
  setGpaGoal,
  collegeTargets,
  setCollegeTargets,
  careerGoals,
  setCareerGoals,
}: {
  gpaGoal: string;
  setGpaGoal: (v: string) => void;
  collegeTargets: CollegeTargets;
  setCollegeTargets: (v: CollegeTargets) => void;
  careerGoals: string;
  setCareerGoals: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-foreground">Set Your Goals</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        These goals help us personalize recommendations. All fields are optional
        — you can set or change them anytime.
      </p>

      {/* GPA Target */}
      <div className="mb-6">
        <Input
          label="GPA Target"
          type="number"
          min={0}
          max={4.0}
          step={0.1}
          value={gpaGoal}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setGpaGoal(e.target.value)}
          placeholder="e.g., 3.5"
          helperText="Unweighted GPA on a 4.0 scale"
        />
      </div>

      {/* College targets */}
      <fieldset className="mb-6">
        <legend className="mb-3 text-sm font-medium text-foreground">
          College Targets
        </legend>
        <div className="flex flex-col gap-4">
          <Input
            label="Reach school"
            type="text"
            value={collegeTargets.reach}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setCollegeTargets({ ...collegeTargets, reach: e.target.value })
            }
            placeholder="e.g., MIT"
          />
          <Input
            label="Match school"
            type="text"
            value={collegeTargets.match}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setCollegeTargets({ ...collegeTargets, match: e.target.value })
            }
            placeholder="e.g., University of Illinois"
          />
          <Input
            label="Safety school"
            type="text"
            value={collegeTargets.safety}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setCollegeTargets({ ...collegeTargets, safety: e.target.value })
            }
            placeholder="e.g., Illinois State"
          />
        </div>
      </fieldset>

      {/* Career interest */}
      <div>
        <label htmlFor="career-goals" className="mb-1.5 block text-sm font-medium text-foreground">
          Career interest
        </label>
        <select
          id="career-goals"
          value={careerGoals}
          onChange={(e) => setCareerGoals(e.target.value)}
          className="h-11 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <option value="">Select an interest (optional)</option>
          <option value="engineering">Engineering</option>
          <option value="medicine">Medicine / Healthcare</option>
          <option value="computer_science">Computer Science / Technology</option>
          <option value="business">Business / Finance</option>
          <option value="law">Law / Government</option>
          <option value="arts">Arts / Design</option>
          <option value="education">Education</option>
          <option value="science">Science / Research</option>
          <option value="communications">Communications / Media</option>
          <option value="undecided">Undecided</option>
        </select>
      </div>
    </div>
  );
}

// ─── Main Onboarding Wizard ────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

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

  // Step 4
  const [gpaGoal, setGpaGoal] = useState("");
  const [collegeTargets, setCollegeTargets] = useState<CollegeTargets>({
    reach: "",
    match: "",
    safety: "",
  });
  const [careerGoals, setCareerGoals] = useState("");

  // Load templates when entering step 3
  useEffect(() => {
    if (currentStep === 3 && templates.length === 0) {
      loadTemplates();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTemplates() {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch("/api/v1/plans/templates");
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
    // On step 1 for freshmen, skip step 2
    if (currentStep === 1 && gradeLevel === 9) {
      setCurrentStep(3);
    } else {
      setCurrentStep(Math.min(currentStep + 1, STEPS.length));
    }
    setError(null);
  }

  function goPrevious() {
    // If on step 3 and was a freshman, go back to step 1
    if (currentStep === 3 && gradeLevel === 9) {
      setCurrentStep(1);
    } else {
      setCurrentStep(Math.max(currentStep - 1, 1));
    }
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

      const gpaNum = parseFloat(gpaGoal);
      if (!isNaN(gpaNum) && gpaNum >= 0 && gpaNum <= 4.0) {
        payload.gpa_goal = gpaNum;
      }

      const hasCollegeTargets =
        collegeTargets.reach || collegeTargets.match || collegeTargets.safety;
      if (hasCollegeTargets) {
        payload.college_targets = collegeTargets;
      }

      if (careerGoals) {
        payload.career_goals = careerGoals;
      }

      const res = await fetch("/api/v1/auth/onboarding", {
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

      // Success — redirect to planner
      router.push("/planner");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <StepIndicator currentStep={currentStep} />

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
            setGraduationYear={setGraduationYear}
          />
        )}

        {currentStep === 2 && (
          <StepPastCourses
            gradeLevel={gradeLevel}
            graduationYear={graduationYear}
            completedCourses={completedCourses}
            setCompletedCourses={setCompletedCourses}
            onSkip={goNext}
          />
        )}

        {currentStep === 3 && (
          <StepChoosePlan
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            isLoadingTemplates={isLoadingTemplates}
          />
        )}

        {currentStep === 4 && (
          <StepGoals
            gpaGoal={gpaGoal}
            setGpaGoal={setGpaGoal}
            collegeTargets={collegeTargets}
            setCollegeTargets={setCollegeTargets}
            careerGoals={careerGoals}
            setCareerGoals={setCareerGoals}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="ghost"
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
              Previous
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Skip button (except on step 1 which is required) */}
          {currentStep > 1 && currentStep < STEPS.length && (
            <Button
              type="button"
              variant="ghost"
              onClick={goNext}
              disabled={isSubmitting}
            >
              Skip
            </Button>
          )}

          {currentStep < STEPS.length ? (
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
                "Complete Setup"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
