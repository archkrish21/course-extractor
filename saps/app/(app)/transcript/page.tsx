"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";
import { GRADE_TO_POINTS } from "@/config/grade-scale";
import { CREDIT_TYPE_WEIGHT } from "@/config/gpa-weights";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanCourse {
  id: string;
  courseId: string;
  code: string;
  name: string;
  creditType: "CP" | "Accelerated" | "Honors" | "AP";
  creditValue: string;
  duration: "semester" | "full_year";
  gradeLevel: number;
  semester: number;
  status: string;
  plannedGrade: string | null;
  isAp: boolean;
  isDualCredit: boolean;
  gpaWaiver: boolean;
  gpaWaiverApplied: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function academicYearLabel(gradYear: number, gradeLevel: number): string {
  const startYear = gradYear - (12 - gradeLevel) - 1;
  return `${startYear}-${startYear + 1}`;
}

function semesterCredit(creditValue: string, duration: string): number {
  const val = parseFloat(creditValue) || 0;
  if (duration === "full_year" || val > 1) return val / 2;
  return val;
}

function creditTypeBadgeVariant(type: string) {
  switch (type) {
    case "AP": return "ap" as const;
    case "Honors": return "honors" as const;
    case "Accelerated": return "accelerated" as const;
    default: return "default" as const;
  }
}

function calcGPA(
  courses: PlanCourse[]
): { unweighted: number | null; weighted: number | null; credits: number; coursesUsed: number } {
  let totalUnweighted = 0;
  let totalWeighted = 0;
  let totalCredits = 0;
  let coursesUsed = 0;

  for (const c of courses) {
    if (c.status !== "completed") continue;
    if (c.gpaWaiverApplied) continue;
    const grade = c.plannedGrade;
    if (!grade) continue;
    const pts = GRADE_TO_POINTS[grade];
    if (pts === null || pts === undefined) continue;

    const credit = semesterCredit(c.creditValue, c.duration);
    const weight = CREDIT_TYPE_WEIGHT[c.creditType] ?? 0;
    totalUnweighted += pts * credit;
    totalWeighted += (pts + weight) * credit;
    totalCredits += credit;
    coursesUsed++;
  }

  if (totalCredits === 0) return { unweighted: null, weighted: null, credits: 0, coursesUsed: 0 };
  return {
    unweighted: totalUnweighted / totalCredits,
    weighted: totalWeighted / totalCredits,
    credits: totalCredits,
    coursesUsed,
  };
}

function fmtGpa(gpa: number | null): string {
  if (gpa === null) return "--";
  return gpa.toFixed(2);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GradesPage() {
  const { currentAccount } = useAccount();

  const [courses, setCourses] = useState<PlanCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState<string>("");
  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(new Set());

  const currentGradeLevel = currentAccount?.gradeLevel ?? 10;
  const graduationYear = currentAccount?.graduationYear ?? 2028;

  // Fetch primary plan courses
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Get primary plan
        const plansRes = await apiFetch("/api/v1/plans");
        if (!plansRes.ok) { setLoading(false); return; }
        const plansData = await plansRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planList = (plansData.plans ?? plansData.data ?? []) as any[];
        const primary = planList.find((p) => p.isPrimary ?? p.is_primary) ?? planList[0];
        if (!primary) { setLoading(false); return; }
        setPlanName(primary.name);

        // Get plan courses
        const coursesRes = await apiFetch(`/api/v1/plans/${primary.id}/courses`);
        if (!coursesRes.ok) { setLoading(false); return; }
        const coursesJson = await coursesRes.json();
        const grouped = coursesJson.data ?? coursesJson;

        const flat: PlanCourse[] = [];
        if (typeof grouped === "object" && !Array.isArray(grouped)) {
          for (const gradeKey of Object.keys(grouped)) {
            const semesters = grouped[gradeKey];
            if (!semesters || typeof semesters !== "object") continue;
            for (const semKey of Object.keys(semesters)) {
              const arr = semesters[semKey];
              if (!Array.isArray(arr)) continue;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const pc of arr as any[]) {
                flat.push({
                  id: pc.id,
                  courseId: pc.courseId ?? pc.course?.id ?? "",
                  code: pc.course?.code ?? pc.code ?? "",
                  name: pc.course?.name ?? pc.name ?? "",
                  creditType: pc.course?.creditType ?? pc.creditType ?? "CP",
                  creditValue: pc.course?.creditValue ?? pc.creditValue ?? "1",
                  duration: pc.course?.duration ?? pc.duration ?? "semester",
                  gradeLevel: pc.gradeLevel ?? Number(gradeKey),
                  semester: pc.semester ?? Number(semKey),
                  status: pc.status ?? "planned",
                  plannedGrade: pc.plannedGrade ?? pc.planned_grade ?? null,
                  isAp: pc.course?.isAp ?? false,
                  isDualCredit: pc.course?.isDualCredit ?? false,
                  gpaWaiver: pc.course?.gpaWaiver ?? false,
                  gpaWaiverApplied: pc.gpaWaiverApplied ?? false,
                });
              }
            }
          }
        }
        setCourses(flat);
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Expand current grade by default
  useEffect(() => {
    setExpandedGrades(new Set([currentGradeLevel]));
  }, [currentGradeLevel]);

  function toggleGrade(gl: number) {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(gl)) next.delete(gl);
      else next.add(gl);
      return next;
    });
  }

  // Only completed courses
  const completedCourses = courses.filter((c) => c.status === "completed");
  const cumGpa = calcGPA(completedCourses);
  const totalCreditsEarned = completedCourses.reduce((sum, c) => sum + semesterCredit(c.creditValue, c.duration), 0);

  // Group by grade → semester
  function groupedByGrade(): Map<number, Map<number, PlanCourse[]>> {
    const result = new Map<number, Map<number, PlanCourse[]>>();
    for (const c of completedCourses) {
      if (!result.has(c.gradeLevel)) result.set(c.gradeLevel, new Map());
      const semMap = result.get(c.gradeLevel)!;
      if (!semMap.has(c.semester)) semMap.set(c.semester, []);
      semMap.get(c.semester)!.push(c);
    }
    return result;
  }

  const grouped = groupedByGrade();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Transcript
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Completed courses and grades from your active plan
              {planName && <span className="font-medium"> — {planName}</span>}
            </p>
          </div>
          <Link href="/planner">
            <Button variant="outline" size="sm">
              <svg aria-hidden="true" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Edit in Planner
            </Button>
          </Link>
        </div>

        {/* Cumulative GPA cards */}
        <div className="mt-4 flex flex-wrap gap-4">
          <Card className="flex-1 min-w-[180px]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Unweighted GPA
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {fmtGpa(cumGpa.unweighted)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[180px]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Weighted GPA
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {fmtGpa(cumGpa.weighted)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[180px]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Credits Earned
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {totalCreditsEarned} <span className="text-base font-normal text-muted-foreground">/ 45</span>
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16" role="status" aria-label="Loading grades">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      )}

      {/* No completed courses */}
      {!loading && completedCourses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <svg
              aria-hidden="true"
              className="mb-3 h-12 w-12 text-muted-foreground/30"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
            </svg>
            <p className="text-sm font-medium text-foreground">No completed courses yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Mark courses as &quot;Completed&quot; and assign grades in the Planner to see them here.
            </p>
            <Link href="/planner" className="mt-4">
              <Button size="sm">Go to Planner</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Grade sections */}
      {!loading && completedCourses.length > 0 && (
        <div className="flex flex-col gap-4">
          {[9, 10, 11, 12].map((gl) => {
            const yearLabel = academicYearLabel(graduationYear, gl);
            const semMap = grouped.get(gl);
            const isExpanded = expandedGrades.has(gl);
            const glCourses = completedCourses.filter((c) => c.gradeLevel === gl);
            const glGpa = calcGPA(glCourses);
            const glCredits = glCourses.reduce((sum, c) => sum + semesterCredit(c.creditValue, c.duration), 0);

            if (glCourses.length === 0) return null;

            return (
              <Card key={gl}>
                <button
                  type="button"
                  onClick={() => toggleGrade(gl)}
                  className="flex w-full items-center justify-between p-4 sm:p-5 text-left min-h-[44px] hover:bg-muted/50 rounded-t-xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      aria-hidden="true"
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        Grade {gl}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">{yearLabel}</span>
                      </h2>
                    </div>
                    {gl === currentGradeLevel && <Badge variant="success">Current</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{glCourses.length} course{glCourses.length !== 1 ? "s" : ""}</span>
                    <span>{glCredits} credits</span>
                    <span>GPA: {fmtGpa(glGpa.unweighted)} / {fmtGpa(glGpa.weighted)}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {[1, 2].map((sem) => {
                      const semCourses = semMap?.get(sem) ?? [];
                      if (semCourses.length === 0) return null;
                      const semGpa = calcGPA(semCourses);

                      return (
                        <div key={sem} className="border-b border-border last:border-b-0">
                          <div className="bg-muted/30 px-4 py-2 sm:px-5">
                            <h3 className="text-sm font-semibold text-foreground">Semester {sem}</h3>
                          </div>

                          {/* Table header */}
                          <div className="hidden sm:grid sm:grid-cols-[1fr_120px_80px_60px_72px] gap-2 px-4 py-2 sm:px-5 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border/50">
                            <span>Course</span>
                            <span>Code</span>
                            <span>Type</span>
                            <span className="text-center">Grade</span>
                            <span className="text-center">Credits</span>
                          </div>

                          {/* Course rows */}
                          {semCourses.map((course, idx) => (
                            <div
                              key={course.id}
                              className={`
                                flex flex-col gap-1.5 px-4 py-2.5 sm:px-5
                                sm:grid sm:grid-cols-[1fr_120px_80px_60px_72px] sm:items-center sm:gap-2
                                ${idx % 2 === 1 ? "bg-muted/20" : ""}
                              `}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate" title={course.name}>
                                  {course.name}
                                  {course.gpaWaiverApplied && (
                                    <span className="ml-1 text-[10px] text-warning">(W)</span>
                                  )}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                                  <span className="text-xs text-muted-foreground">{course.code}</span>
                                  <Badge variant={creditTypeBadgeVariant(course.creditType)} className="text-[10px]">
                                    {course.creditType}
                                  </Badge>
                                </div>
                              </div>
                              <span className="hidden sm:block text-sm text-muted-foreground truncate">{course.code}</span>
                              <div className="hidden sm:block">
                                <Badge variant={creditTypeBadgeVariant(course.creditType)} className="text-[10px]">
                                  {course.creditType}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 sm:justify-center">
                                <span className="text-xs text-muted-foreground sm:hidden w-12 shrink-0">Grade</span>
                                <span className={`text-sm font-bold ${course.plannedGrade ? "text-success" : "text-muted-foreground"}`}>
                                  {course.plannedGrade ?? "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 sm:justify-center">
                                <span className="text-xs text-muted-foreground sm:hidden w-12 shrink-0">Credits</span>
                                <span className="text-sm text-foreground">
                                  {semesterCredit(course.creditValue, course.duration).toFixed(1)}
                                </span>
                              </div>
                            </div>
                          ))}

                          {/* Semester GPA footer */}
                          <div className="flex items-center justify-end gap-6 bg-muted/30 px-4 py-2 sm:px-5 text-sm">
                            <span className="text-muted-foreground">Semester {sem} GPA:</span>
                            <span className="font-medium">{fmtGpa(semGpa.unweighted)} / {fmtGpa(semGpa.weighted)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
