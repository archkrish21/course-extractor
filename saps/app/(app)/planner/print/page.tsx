"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAccount } from "@/lib/account-context";
import { calculateGPA, formatGPA } from "@/lib/gpa/calc";
import { GRADE_OPTIONS } from "@/config/grade-scale";
import { UNOFFICIAL_DISCLAIMER } from "@/config/disclaimers";
import { PrintWatermark } from "@/components/print-watermark";

interface PlanCourse {
  id: string;
  courseId: string;
  code: string;
  name: string;
  creditType: string;
  creditValue: string;
  duration: string;
  gradeLevel: number;
  semester: number | null;
  status: string;
  plannedGrade?: string;
  isAp: boolean;
  isDualCredit: boolean;
  gpaWaiver: boolean;
  gpaWaiverApplied?: boolean;
}

// Sort order: Early Bird → Language Arts → Math → Science → World Lang → Electives → PE
const DIVISION_SORT: Record<string, number> = {
  "Communication Arts": 2,
  Mathematics: 3,
  Science: 4,
  "Multilingual Learning": 5,
  "Physical Welfare": 8,
  "Applied Arts": 6,
  "Computer Science, Engineering and Technology": 6,
  "Fine Arts": 6,
  "Social Studies": 6,
};

function sortCourses(courses: PlanCourse[]): PlanCourse[] {
  return [...courses].sort((a, b) => {
    const aEarly = (a.name ?? "").toLowerCase().includes("early bird") || /E\d$/.test(a.code ?? "") ? 0 : 1;
    const bEarly = (b.name ?? "").toLowerCase().includes("early bird") || /E\d$/.test(b.code ?? "") ? 0 : 1;
    if (aEarly !== bEarly) return aEarly - bEarly;
    const aDiv = DIVISION_SORT[(a as unknown as Record<string, string>).divisionName] ?? 6;
    const bDiv = DIVISION_SORT[(b as unknown as Record<string, string>).divisionName] ?? 6;
    if (aDiv !== bDiv) return aDiv - bDiv;
    return a.name.localeCompare(b.name);
  });
}

function creditPerRow(c: PlanCourse) {
  const val = parseFloat(c.creditValue) || 0;
  return val > 1 ? val / 2 : val;
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  enrolled: "Enrolled",
  completed: "Completed",
  dropped: "Dropped",
};

export default function PrintPlanPage() {
  const { currentAccount } = useAccount();
  const [plan, setPlan] = useState<{ id: string; name: string; status: string; isPrimary: boolean } | null>(null);
  const [courses, setCourses] = useState<PlanCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Get the plan ID from URL params or use primary plan
        const params = new URLSearchParams(window.location.search);
        let planId = params.get("id");

        if (!planId) {
          // Fetch plans and use primary
          const plansRes = await apiFetch("/api/v1/plans");
          if (plansRes.ok) {
            const plansData = await plansRes.json();
            const planList = plansData.plans ?? plansData.data ?? [];
            const primary = planList.find((p: Record<string, unknown>) => p.isPrimary);
            const selected = primary ?? planList[0];
            if (selected) {
              planId = selected.id as string;
              setPlan(selected);
            }
          }
        }

        if (!planId) return;

        // Fetch plan details if not already set
        if (!plan) {
          const planRes = await apiFetch(`/api/v1/plans/${planId}`);
          if (planRes.ok) {
            const planData = await planRes.json();
            setPlan(planData.data?.plan ?? planData.data ?? null);
          }
        }

        // Fetch courses
        const coursesRes = await apiFetch(`/api/v1/plans/${planId}/courses`);
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          const rawCourses = coursesData.data ?? coursesData;

          // Flatten grouped courses
          const flat: PlanCourse[] = [];
          if (Array.isArray(rawCourses)) {
            for (const pc of rawCourses) {
              flat.push({
                id: pc.id,
                courseId: pc.courseId,
                code: pc.course?.code ?? "",
                name: pc.course?.name ?? "",
                creditType: pc.course?.creditType ?? "CP",
                creditValue: pc.course?.creditValue ?? "1",
                duration: pc.course?.duration ?? "semester",
                gradeLevel: pc.gradeLevel,
                semester: pc.semester,
                status: pc.status ?? "planned",
                plannedGrade: pc.plannedGrade,
                isAp: pc.course?.isAp ?? false,
                isDualCredit: pc.course?.isDualCredit ?? false,
                gpaWaiver: pc.course?.gpaWaiver ?? false,
                gpaWaiverApplied: pc.gpaWaiverApplied ?? false,
              });
            }
          } else if (typeof rawCourses === "object") {
            // Grouped by grade/semester
            for (const gradeKey of Object.keys(rawCourses)) {
              const semesters = rawCourses[gradeKey];
              if (typeof semesters === "object" && semesters !== null) {
                for (const semKey of Object.keys(semesters)) {
                  const semCourses = semesters[semKey];
                  if (Array.isArray(semCourses)) {
                    for (const pc of semCourses) {
                      flat.push({
                        id: pc.id,
                        courseId: pc.courseId,
                        code: pc.course?.code ?? pc.code ?? "",
                        name: pc.course?.name ?? pc.name ?? "",
                        creditType: pc.course?.creditType ?? pc.creditType ?? "CP",
                        creditValue: pc.course?.creditValue ?? pc.creditValue ?? "1",
                        duration: pc.course?.duration ?? pc.duration ?? "semester",
                        gradeLevel: pc.gradeLevel,
                        semester: pc.semester,
                        status: pc.status ?? "planned",
                        plannedGrade: pc.plannedGrade,
                        isAp: pc.course?.isAp ?? pc.isAp ?? false,
                        isDualCredit: pc.course?.isDualCredit ?? pc.isDualCredit ?? false,
                        gpaWaiver: pc.course?.gpaWaiver ?? pc.gpaWaiver ?? false,
                        gpaWaiverApplied: pc.gpaWaiverApplied ?? false,
                      });
                    }
                  }
                }
              }
            }
          }
          setCourses(flat);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Auto-trigger print after content loads
  useEffect(() => {
    if (!loading && courses.length > 0) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, courses.length]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!plan || courses.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No plan data to print.</p>
      </div>
    );
  }

  const totalPlannedCredits = courses
    .filter((c) => c.status !== "dropped")
    .reduce((sum, c) => sum + creditPerRow(c), 0);
  const totalEarnedCredits = courses
    .filter((c) => c.status === "completed")
    .reduce((sum, c) => sum + creditPerRow(c), 0);
  const gpaInput = courses.map((c) => ({
    creditValue: c.creditValue,
    creditType: c.creditType,
    plannedGrade: c.plannedGrade ?? null,
    status: c.status as "planned" | "enrolled" | "completed" | "dropped",
    gpaWaiver: c.gpaWaiver,
    gpaWaiverApplied: c.gpaWaiverApplied ?? false,
  }));
  const projectedGPA = calculateGPA(gpaInput, "projected");
  const actualGPA = calculateGPA(gpaInput, "actual");
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      {/* Screen-only layout for preview (print styles live in globals.css) */}
      <style>{`
        @media screen {
          .print-container { max-width: 1100px; margin: 0 auto; padding: 2rem; }
        }
      `}</style>

      <PrintWatermark alwaysVisible />

      <div className="print-container bg-white text-black">
        {/* Screen-only back button */}
        <div className="no-print mb-4 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Planner
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Print / Save as PDF
          </button>
        </div>

        {/* Header */}
        <div className="mb-4 border-b-2 border-black pb-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">Student Academic Planning System</h1>
              <h2 className="mt-1 text-lg font-semibold">
                {plan.name}{plan.isPrimary && <span className="ml-2 text-sm font-normal text-muted-foreground">★ Primary</span>}
              </h2>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{currentAccount?.studentName ?? "Student"}</p>
              {currentAccount?.gradeLevel && (
                <p>Grade {currentAccount.gradeLevel} | Graduating {currentAccount.graduationYear}</p>
              )}
              <p>Generated: {today}</p>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="mb-4 flex items-center gap-6 rounded border border-border bg-muted px-4 py-2 text-sm">
          <span>
            <strong>Credits:</strong>{" "}
            {totalPlannedCredits} planned
            {totalEarnedCredits > 0 && <>, {totalEarnedCredits} earned</>}
            {" "}/ 45 required
          </span>
          {projectedGPA.unweighted !== null && (
            <span>
              <strong>Projected GPA:</strong>{" "}
              {formatGPA(projectedGPA.unweighted)} UW / {formatGPA(projectedGPA.weighted)} W
            </span>
          )}
          {actualGPA.unweighted !== null && (
            <span>
              <strong>Actual GPA:</strong>{" "}
              {formatGPA(actualGPA.unweighted)} UW / {formatGPA(actualGPA.weighted)} W
            </span>
          )}
          <span>
            <strong>Courses:</strong> {courses.filter((c) => c.status !== "dropped").length}
          </span>
        </div>

        {/* Grade tables */}
        {[9, 10, 11, 12].map((grade) => {
          const gradeCourses = courses.filter((c) => c.gradeLevel === grade && c.status !== "dropped");
          // Merge summer into regular semesters: Session 1 (-2) → Semester 1, Session 2 (-1) → Semester 2
          const sem1Courses = sortCourses(gradeCourses.filter((c) => c.semester === 1));
          const sem2Courses = sortCourses(gradeCourses.filter((c) => c.semester === 2));
          const summer1Courses = sortCourses(gradeCourses.filter((c) => c.semester === -2));
          const summer2Courses = sortCourses(gradeCourses.filter((c) => c.semester === -1));
          const gradeCredits = gradeCourses.reduce((sum, c) => sum + creditPerRow(c), 0);
          const gradeEarned = gradeCourses.filter((c) => c.status === "completed").reduce((sum, c) => sum + creditPerRow(c), 0);
          const gradeGpaInput = gradeCourses.map((c) => ({
            creditValue: c.creditValue,
            creditType: c.creditType,
            plannedGrade: c.plannedGrade ?? null,
            status: c.status as "planned" | "enrolled" | "completed" | "dropped",
            gpaWaiver: c.gpaWaiver,
            gpaWaiverApplied: c.gpaWaiverApplied ?? false,
          }));
          const gradeGPA = calculateGPA(gradeGpaInput, "projected");

          return (
            <div key={grade} className="mb-4 print-grade-block">
              <div className="flex items-center gap-4 border-b border-gray-400 pb-1">
                <h3 className="text-base font-bold">Grade {grade}</h3>
                <span className="text-xs text-muted-foreground">
                  {gradeCredits} credits planned
                  {gradeEarned > 0 && <>, {gradeEarned} earned</>}
                </span>
                {gradeGPA.unweighted !== null && (
                  <span className="text-xs text-muted-foreground">
                    GPA: {formatGPA(gradeGPA.unweighted)} UW / {formatGPA(gradeGPA.weighted)} W
                  </span>
                )}
              </div>

              <div className="mt-1 grid grid-cols-2 gap-4">
                {[
                  { sem: 1, regular: sem1Courses, summer: summer1Courses },
                  { sem: 2, regular: sem2Courses, summer: summer2Courses },
                ].map(({ sem, regular, summer }) => (
                  <div key={sem}>
                    <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Semester {sem}</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="py-0.5 text-left font-semibold">Course</th>
                          <th className="py-0.5 text-left font-semibold w-16">Code</th>
                          <th className="py-0.5 text-center font-semibold w-10">Type</th>
                          <th className="py-0.5 text-center font-semibold w-12">Status</th>
                          <th className="py-0.5 text-center font-semibold w-10">Grade</th>
                          <th className="py-0.5 text-center font-semibold w-10">Cr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Summer courses — same rows, amber text */}
                        {summer.map((c) => (
                          <tr key={c.id} className="border-b border-gray-300">
                            <td className="py-0.5 truncate max-w-[200px] text-warning" title={c.name}>
                              ☀ {c.name}
                              {c.gpaWaiverApplied && <span className="ml-1 text-[9px] text-warning/60">(W)</span>}
                            </td>
                            <td className="py-0.5 text-warning/70">{c.code}</td>
                            <td className="py-0.5 text-center text-warning/70">{c.creditType}</td>
                            <td className="py-0.5 text-center text-warning/70">{STATUS_LABELS[c.status] ?? c.status}</td>
                            <td className="py-0.5 text-center font-semibold text-warning">{c.plannedGrade ?? "—"}</td>
                            <td className="py-0.5 text-center text-warning/70">{creditPerRow(c)}</td>
                          </tr>
                        ))}
                        {/* Regular courses */}
                        {regular.length === 0 && summer.length === 0 ? (
                          <tr><td colSpan={6} className="py-1 text-gray-400 italic">No courses</td></tr>
                        ) : regular.map((c) => (
                          <tr key={c.id} className="border-b border-gray-300">
                            <td className="py-0.5 truncate max-w-[200px]" title={c.name}>
                              {c.name}
                              {c.gpaWaiverApplied && <span className="ml-1 text-[9px] text-gray-400">(W)</span>}
                            </td>
                            <td className="py-0.5 text-gray-500">{c.code}</td>
                            <td className="py-0.5 text-center">{c.creditType}</td>
                            <td className="py-0.5 text-center">{STATUS_LABELS[c.status] ?? c.status}</td>
                            <td className="py-0.5 text-center font-semibold">{c.plannedGrade ?? "—"}</td>
                            <td className="py-0.5 text-center">{creditPerRow(c)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

            </div>
          );
        })}

        {/* Footer */}
        <div className="mt-4 border-t border-border pt-2 text-[10px] text-muted-foreground">
          <p>Generated by SAPS (Student Academic Planning System) — Stevenson High School | {today}</p>
          <p>(W) = GPA waiver applied | UW/W = Unweighted/Weighted | Cr = Credits per semester</p>
          <p className="mt-1 italic">{UNOFFICIAL_DISCLAIMER}</p>
        </div>
      </div>
    </>
  );
}
