"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function YearEndPage() {
  const { currentAccount } = useAccount();
  const router = useRouter();
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
        const res = await apiFetch("/api/v1/year-end");
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
  }, [currentAccount]);

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
        body: JSON.stringify({ grades: gradeEntries, action: "complete" }),
      });

      if (res.ok) {
        router.push("/dashboard?yearEndComplete=true");
      }
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Year-End Review</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Year-End Review</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Complete your Grade {gradeLevel} year-end review to advance to {isGraduating ? "graduation" : `Grade ${gradeLevel + 1}`}.
      </p>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
              s < step ? "bg-success text-white" : s === step ? "bg-primary text-white" : "bg-muted text-muted-foreground"
            }`}>
              {s < step ? "✓" : s}
            </div>
            <span className={`text-sm ${s === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {s === 1 ? "Confirm Grades" : s === 2 ? (isGraduating ? "Graduation" : "Advance") : "Review Plan"}
            </span>
            {s < 3 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

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
              <div className="space-y-2">
                {[1, 2].map((sem) => {
                  const semCourses = activeCourses.filter((c) => c.semester === sem);
                  if (semCourses.length === 0) return null;
                  return (
                    <div key={sem}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Semester {sem}</p>
                      {semCourses.map((c) => {
                        const isPF = isPassFailCourse(c.code);
                        const options = isPF ? PASS_FAIL_OPTIONS : GRADE_OPTIONS;
                        return (
                          <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 mb-1">
                            <div>
                              <p className="text-sm font-medium text-foreground">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.code}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {c.status === "completed" ? (
                                <Badge className="bg-success/15 text-success">{c.plannedGrade ?? "—"}</Badge>
                              ) : (
                                <select
                                  value={grades[c.id] ?? c.plannedGrade ?? ""}
                                  onChange={(e) => handleGradeChange(c.id, e.target.value)}
                                  className="h-8 rounded border border-border bg-background px-2 text-sm"
                                >
                                  <option value="">Select</option>
                                  {options.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                </select>
                              )}
                              {isPF && <Badge className="bg-muted text-muted-foreground text-[10px]">P/F</Badge>}
                            </div>
                          </div>
                        );
                      })}
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

            <div className="mt-4 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!allGraded && activeCourses.length > 0}>
                Continue
              </Button>
            </div>
          </CardContent>
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
                <div className="rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 dark:from-amber-950/20 dark:to-yellow-950/20">
                  <p className="font-bold text-amber-700 dark:text-amber-400">Graduation Complete</p>
                  <p className="mt-1 text-sm text-amber-600/80 dark:text-amber-400/60">
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
                  <div className="flex-1 rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className="text-2xl font-bold text-foreground">Grade {gradeLevel}</p>
                  </div>
                  <svg aria-hidden="true" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                  <div className="flex-1 rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                    <p className="text-xs text-primary">Next Year</p>
                    <p className="text-2xl font-bold text-primary">Grade {gradeLevel + 1}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review next year plan */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">
              {isGraduating ? "Final Review" : `Review Grade ${gradeLevel + 1} Plan`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isGraduating
                ? "Review your final course record before completing."
                : "Review your upcoming courses. You can edit your plan in the planner after completing."
              }
            </p>
          </CardHeader>
          <CardContent>
            {nextYearCourses.length === 0 && !isGraduating ? (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">No courses planned for Grade {gradeLevel + 1} yet.</p>
                <Link href="/planner">
                  <Button variant="outline" size="sm" className="mt-2">Open Planner</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {[1, 2].map((sem) => {
                  const semCourses = nextYearCourses.filter((c) => c.semester === sem);
                  if (semCourses.length === 0) return null;
                  return (
                    <div key={sem}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Semester {sem}</p>
                      {semCourses.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 mb-1">
                          <div>
                            <p className="text-sm font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.code}</p>
                          </div>
                          <Badge className="bg-primary/15 text-primary text-[10px]">Planned</Badge>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button
                onClick={handleComplete}
                disabled={submitting}
                className={isGraduating ? "bg-amber-600 hover:bg-amber-700" : ""}
              >
                {submitting ? "Completing..." : isGraduating ? "Complete & Graduate 🎓" : "Complete Year-End Review"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
