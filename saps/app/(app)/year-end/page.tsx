"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";
import { GRADE_OPTIONS } from "@/config/grade-scale";
import { isPassFailCourse, PASS_FAIL_OPTIONS } from "@/config/grade-scale";

interface CourseEntry {
  id: string;
  courseId: string;
  code: string;
  name: string;
  gradeLevel: number;
  semester: number;
  status: string;
  plannedGrade: string | null;
  creditValue?: string;
}

const STEPS = [
  { label: "Confirm Grades", number: 1 },
  { label: "Advance", number: 2 },
  { label: "Review", number: 3 },
] as const;

function StepIndicator({ currentStep, isGraduating }: { currentStep: number; isGraduating: boolean }) {
  const steps = STEPS.map((s) =>
    s.number === 2 ? { ...s, label: isGraduating ? "Graduation" : "Advance" } : s
  );
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
        {steps.map((s) => (
          <div
            key={s.number}
            className={`relative z-10 flex flex-col items-center gap-1.5 ${
              s.number <= currentStep ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 ${
                s.number < currentStep
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : s.number === currentStep
                  ? "border-2 border-primary bg-primary-light text-primary shadow-sm"
                  : "border-2 border-border bg-card text-muted-foreground"
              }`}
              aria-current={s.number === currentStep ? "step" : undefined}
            >
              {s.number < currentStep ? (
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
                s.number
              )}
            </div>
            <span
              className={`hidden text-xs font-medium sm:block ${
                s.number === currentStep
                  ? "text-primary font-semibold"
                  : s.number < currentStep
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function YearEndPage() {
  const { currentAccount, refetchAccounts } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gradeParam = searchParams.get("grade");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gradeLevel, setGradeLevel] = useState(9);
  const [isGraduating, setIsGraduating] = useState(false);
  const [currentYearCourses, setCurrentYearCourses] = useState<CourseEntry[]>([]);
  const [nextYearCourses, setNextYearCourses] = useState<CourseEntry[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const url = gradeParam ? `/api/v1/year-end?grade=${gradeParam}` : "/api/v1/year-end";
        const res = await apiFetch(url);
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          setGradeLevel(data.gradeLevel ?? 9);
          setIsGraduating(data.isGraduating ?? false);
          setCurrentYearCourses(data.currentYearCourses ?? []);
          setNextYearCourses(data.nextYearCourses ?? []);

          // Pre-fill grades from existing data
          const existingGrades: Record<string, string> = {};
          for (const c of data.currentYearCourses ?? []) {
            if (c.plannedGrade) existingGrades[c.id] = c.plannedGrade;
          }
          setGrades(existingGrades);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    fetchData();
  }, [currentAccount, gradeParam]);

  const handleGradeChange = (courseId: string, grade: string) => {
    setGrades((prev) => ({ ...prev, [courseId]: grade }));
  };

  const activeCourses = currentYearCourses.filter((c) => c.status !== "dropped");
  const allGraded = activeCourses.every((c) => grades[c.id] || c.plannedGrade);
  const ungraded = activeCourses.filter((c) => !grades[c.id] && !c.plannedGrade);

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const gradeEntries = Object.entries(grades).map(([planCourseId, grade]) => ({
        planCourseId,
        grade,
      }));

      const res = await apiFetch("/api/v1/year-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grades: gradeEntries,
          action: "complete",
          ...(gradeParam ? { grade: parseInt(gradeParam, 10) } : {}),
        }),
      });

      if (res.ok) {
        // Refresh account context so gradeLevel is up to date everywhere
        await refetchAccounts();
        // If came from planner lock, go back to planner; otherwise dashboard
        if (gradeParam) {
          router.push("/planner");
        } else {
          router.push("/dashboard?yearEndComplete=true");
        }
      }
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Year-End Review</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-12 rounded-full bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Year-End Review</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Complete your Grade {gradeLevel} year-end review to advance to {isGraduating ? "graduation" : `Grade ${gradeLevel + 1}`}.
      </p>

      <StepIndicator currentStep={step} isGraduating={isGraduating} />

      {/* Step 1: Confirm grades */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Confirm Final Grades — Grade {gradeLevel}</h2>
            <p className="text-sm text-muted-foreground">
              Review and confirm your final grades for each course. Courses will be locked after confirmation.
            </p>
          </CardHeader>
          <CardContent>
            {activeCourses.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No courses found for Grade {gradeLevel}.</p>
            ) : (
              <div className="space-y-4">
                {[1, 2].map((sem) => {
                  const semCourses = activeCourses.filter((c) => c.semester === sem);
                  if (semCourses.length === 0) return null;
                  return (
                    <div key={sem}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semester {sem}</p>
                      <div className="overflow-hidden rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Course</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {semCourses.map((c) => {
                              const isPF = isPassFailCourse(c.code);
                              const options = isPF ? PASS_FAIL_OPTIONS : GRADE_OPTIONS;
                              return (
                                <tr key={c.id} className="bg-card">
                                  <td className="px-3 py-2.5">
                                    <p className="font-medium text-foreground">{c.name}</p>
                                    <p className="text-xs text-muted-foreground">{c.code}</p>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    {c.status === "completed" ? (
                                      <Badge className="rounded-full bg-success/15 text-success">{c.plannedGrade ?? "—"}</Badge>
                                    ) : (
                                      <select
                                        value={grades[c.id] ?? c.plannedGrade ?? ""}
                                        onChange={(e) => handleGradeChange(c.id, e.target.value)}
                                        className="h-9 min-w-[80px] rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                      >
                                        <option value="">Select</option>
                                        {options.map((g) => (
                                          <option key={g} value={g}>{g}</option>
                                        ))}
                                      </select>
                                    )}
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
            )}

            {ungraded.length > 0 && (
              <p className="mt-3 text-xs text-warning">
                {ungraded.length} course{ungraded.length !== 1 ? "s" : ""} still need a grade before you can proceed.
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setStep(2)} disabled={!allGraded && activeCourses.length > 0}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Advance grade level */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">
              {isGraduating ? "Congratulations! 🎓" : `Advance to Grade ${gradeLevel + 1}`}
            </h2>
          </CardHeader>
          <CardContent>
            {isGraduating ? (
              <div className="space-y-4">
                <p className="text-sm text-foreground">
                  You've completed Grade 12! Your courses and grades will be locked as a permanent record.
                </p>
                <div className="rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-50 to-yellow-50 p-4">
                  <p className="font-bold text-amber-700">Graduation Complete</p>
                  <p className="mt-1 text-sm text-amber-600/80">
                    Your account will remain accessible as a read-only archive.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-foreground">
                  Your Grade {gradeLevel} courses will be locked with final grades.
                  You'll advance to <span className="font-semibold">Grade {gradeLevel + 1}</span>,
                  and your planned courses for next year will be marked as enrolled.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">Grade {gradeLevel}</p>
                  </div>
                  <svg aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                  <div className="flex-1 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Next Year</p>
                    <p className="mt-1 text-2xl font-bold text-primary">Grade {gradeLevel + 1}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Next</Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Review & Complete */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">
              {isGraduating ? "Final Review" : `Review & Complete`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isGraduating
                ? "Review your final course record before completing."
                : "Review everything below. This action cannot be undone."
              }
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Summary: courses that will be locked */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Courses to be locked — Grade {gradeLevel}
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Course</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Final Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeCourses.map((c) => (
                      <tr key={c.id} className="bg-card">
                        <td className="px-3 py-2">
                          <span className="font-medium text-foreground">{c.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{c.code}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge className="rounded-full bg-success/15 text-success">
                            {grades[c.id] ?? c.plannedGrade ?? "—"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Next year courses preview */}
            {!isGraduating && nextYearCourses.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Upcoming courses — Grade {gradeLevel + 1}
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border">
                      {nextYearCourses.map((c) => (
                        <tr key={c.id} className="bg-card">
                          <td className="px-3 py-2">
                            <span className="font-medium text-foreground">{c.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{c.code}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Badge className="rounded-full bg-primary/15 text-primary text-[10px]">Planned</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!isGraduating && nextYearCourses.length === 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                <p className="text-sm text-muted-foreground">No courses planned for Grade {gradeLevel + 1} yet.</p>
                <Link href="/planner">
                  <Button variant="ghost" size="sm" className="mt-2">Open Planner</Button>
                </Link>
              </div>
            )}

            {/* Consequence warning */}
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
              <p className="text-sm font-medium text-warning">
                {isGraduating
                  ? "This will finalize your academic record. Your account will become read-only."
                  : `Grade ${gradeLevel} courses and grades will be permanently locked. You will advance to Grade ${gradeLevel + 1}.`
                }
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button
              size="lg"
              onClick={handleComplete}
              disabled={submitting}
              className={isGraduating ? "bg-warning hover:bg-warning/90" : ""}
            >
              {submitting ? "Completing..." : isGraduating ? "Complete & Graduate 🎓" : "Complete Year-End Review"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
