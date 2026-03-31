"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface LinkedCourse {
  id: string;
  code: string;
  name: string;
  semesters_offered: number[] | null;
}

interface CourseDetailData {
  prerequisites?: Array<{ id: string; course_id: string; name: string; code: string; relationship_type?: string; requirement_group: number }>;
  unlocks?: Array<{ course_id: string; name: string; code: string }>;
  linkedCourses?: LinkedCourse[];
}

interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  divisionId: string;
  divisionName: string;
  divisionCode: string;
  departmentId?: string;
  departmentName?: string;
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

function creditTypeBadgeVariant(type: string) {
  switch (type) {
    case "AP": return "ap" as const;
    case "Honors": return "honors" as const;
    case "Accelerated": return "accelerated" as const;
    default: return "default" as const;
  }
}

function CourseCodeLink({ id, code, name, onCourseClick }: { id: string; code: string; name: string; onCourseClick?: (courseId: string) => void }) {
  if (!onCourseClick) {
    return <span className="text-xs text-muted-foreground">({code})</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onCourseClick(id); }}
      className="text-xs text-primary hover:text-primary-hover underline underline-offset-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
      title={`View ${name}`}
    >
      {code}
    </button>
  );
}

function DetailGrid({ course, onCourseClick, onDivisionClick, onDepartmentClick }: {
  course: Course;
  onCourseClick?: (courseId: string) => void;
  onDivisionClick?: (divisionName: string) => void;
  onDepartmentClick?: (divisionName: string, departmentName: string) => void;
}) {
  const [detail, setDetail] = useState<CourseDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingDetail(true);
    fetch(`/api/v1/courses/${course.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!cancelled && json?.data) {
          setDetail({
            prerequisites: json.data.prerequisites ?? [],
            unlocks: json.data.unlocks ?? [],
            linkedCourses: json.data.linkedCourses ?? [],
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [course.id]);

  // Group prerequisites by requirement_group for OR display
  const prereqGroups: Record<number, Array<{ course_id: string; name: string; code: string }>> = {};
  for (const p of detail?.prerequisites ?? []) {
    const group = p.requirement_group ?? 1;
    if (!prereqGroups[group]) prereqGroups[group] = [];
    prereqGroups[group].push({ course_id: p.course_id, name: p.name, code: p.code });
  }
  const groupEntries = Object.entries(prereqGroups);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Division</p>
          {onDivisionClick ? (
            <button
              type="button"
              onClick={() => onDivisionClick(course.divisionName)}
              className="mt-1 text-sm font-medium text-primary hover:text-primary-hover underline underline-offset-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
              title={`Filter by ${course.divisionName}`}
            >
              {course.divisionName}
            </button>
          ) : (
            <p className="mt-1 text-sm font-medium text-foreground">{course.divisionName}</p>
          )}
        </div>
        {course.departmentName && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Department</p>
            {onDepartmentClick ? (
              <button
                type="button"
                onClick={() => onDepartmentClick(course.divisionName, course.departmentName!)}
                className="mt-1 text-sm font-medium text-primary hover:text-primary-hover underline underline-offset-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
                title={`Filter by ${course.departmentName}`}
              >
                {course.departmentName}
              </button>
            ) : (
              <p className="mt-1 text-sm font-medium text-foreground">{course.departmentName}</p>
            )}
          </div>
        )}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Credit Value</p>
          <p className="mt-1 text-sm font-medium text-foreground">{course.creditValue} credits</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Duration</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {course.duration === "full_year"
              ? "Full Year"
              : course.semestersOffered?.length === 1
                ? `Semester ${course.semestersOffered[0]} only`
                : "Semester 1 & 2"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Grade Levels</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {(course.gradeLevels ?? []).join(", ")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Credit Type</p>
          <p className="mt-1 text-sm font-medium text-foreground">{course.creditType}</p>
        </div>
      </div>

      {/* Linked courses (semester partners) */}
      {!loadingDetail && (detail?.linkedCourses ?? []).length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary-light/50 p-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <svg aria-hidden="true" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-1.135 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            Also available as
          </h4>
          <div className="flex flex-wrap gap-2">
            {(detail?.linkedCourses ?? []).map((lc) => {
              const semLabel = lc.semesters_offered?.length === 1
                ? `Semester ${lc.semesters_offered[0]}`
                : "Semester 1 & 2";
              return (
                <button
                  key={lc.id}
                  type="button"
                  onClick={() => onCourseClick?.(lc.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-card px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-light transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  title={`View ${lc.name} (${lc.code})`}
                >
                  <span className="font-semibold">{lc.code}</span>
                  <span className="text-xs text-muted-foreground">— {semLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dual credit info */}
      {course.isDualCredit && (
        <div className="rounded-lg border border-dual-credit/30 bg-dual-credit-light p-4">
          <h4 className="text-sm font-semibold text-dual-credit flex items-center gap-2">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347" />
            </svg>
            This course earns transferable college credit
          </h4>
        </div>
      )}

      {/* GPA waiver info */}
      {course.gpaWaiver && (
        <div className="rounded-lg border border-warning/30 bg-warning-light p-4">
          <h4 className="text-sm font-semibold text-warning flex items-center gap-2">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            GPA waiver available — this course can be excluded from GPA calculation
          </h4>
        </div>
      )}

      {/* Prerequisites — fetched from detail API */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Prerequisites</h4>
        {loadingDetail ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : groupEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prerequisites required.</p>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {groupEntries.map(([groupId, groupCourses]) => {
              // Merge semester pairs: group by name, combine codes
              const merged: Array<{ name: string; entries: Array<{ course_id: string; code: string }> }> = [];
              for (const prereq of groupCourses) {
                const existing = merged.find((m) => m.name === prereq.name);
                if (existing) {
                  existing.entries.push({ course_id: prereq.course_id, code: prereq.code });
                } else {
                  merged.push({ name: prereq.name, entries: [{ course_id: prereq.course_id, code: prereq.code }] });
                }
              }

              return (
                <li key={groupId} className="rounded-lg border border-border bg-muted/50 p-3">
                  {groupEntries.length > 1 && (
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Requirement {groupId}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {merged.map((item, i) => (
                      <span key={item.entries[0].course_id} className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground">
                          {item.name}
                          <span className="ml-1">
                            ({item.entries.map((entry, j) => (
                              <span key={entry.course_id}>
                                <CourseCodeLink id={entry.course_id} code={entry.code} name={item.name} onCourseClick={onCourseClick} />
                                {j < item.entries.length - 1 && <span className="text-muted-foreground"> / </span>}
                              </span>
                            ))})
                          </span>
                        </span>
                        {i < merged.length - 1 && (
                          <Badge variant="default" className="text-[10px]">OR</Badge>
                        )}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* What this unlocks */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">What This Unlocks</h4>
        {loadingDetail ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (detail?.unlocks ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No downstream courses require this as a prerequisite.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" role="list">
            {(() => {
              // Merge semester pairs by name
              const merged: Array<{ name: string; entries: Array<{ course_id: string; code: string }> }> = [];
              for (const item of detail?.unlocks ?? []) {
                const existing = merged.find((m) => m.name === item.name);
                if (existing) {
                  existing.entries.push({ course_id: item.course_id, code: item.code });
                } else {
                  merged.push({ name: item.name, entries: [{ course_id: item.course_id, code: item.code }] });
                }
              }
              return merged.map((item) => (
                <li key={item.entries[0].course_id} className="flex items-center gap-2 text-sm">
                  <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span className="text-foreground">{item.name}</span>
                  <span className="ml-1">
                    ({item.entries.map((entry, j) => (
                      <span key={entry.course_id}>
                        <CourseCodeLink id={entry.course_id} code={entry.code} name={item.name} onCourseClick={onCourseClick} />
                        {j < item.entries.length - 1 && <span className="text-muted-foreground"> / </span>}
                      </span>
                    ))})
                  </span>
                </li>
              ));
            })()}
          </ul>
        )}
      </div>
    </>
  );
}

interface PlanOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface AddToPlanResult {
  success: boolean;
  message?: string;
  warnings?: Array<{ type: string; message: string }>;
}

interface CourseDetailProps {
  course: Course;
  onCourseClick?: (courseId: string) => void;
  onDivisionClick?: (divisionName: string) => void;
  onDepartmentClick?: (divisionName: string, departmentName: string) => void;
  hideAddButton?: boolean;
  /** Provide plans for the "Add to Plan" form. If empty/undefined, form fetches plans itself. */
  plans?: PlanOption[];
  /** Called after a course is successfully added to a plan */
  onCourseAdded?: () => void;
  /** Called when the user clicks Cancel to close the detail view */
  onClose?: () => void;
}

export function CourseDetail({ course, onCourseClick, onDivisionClick, onDepartmentClick, hideAddButton = false, plans: externalPlans, onCourseAdded, onClose }: CourseDetailProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>(externalPlans ?? []);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<number>(course.gradeLevels[0] ?? 9);
  const [selectedSemester, setSelectedSemester] = useState<number>(
    course.semestersOffered?.[0] ?? 1
  );
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<AddToPlanResult | null>(null);

  // Reset form state when course changes (e.g., navigating via "Also available as")
  useEffect(() => {
    setSelectedGrade(course.gradeLevels[0] ?? 9);
    setSelectedSemester(course.semestersOffered?.[0] ?? 1);
    setShowAddForm(false);
    setAddResult(null);
  }, [course.id, course.gradeLevels, course.semestersOffered]);

  // Fetch plans when form opens (if not provided externally)
  useEffect(() => {
    if (showAddForm && plans.length === 0 && !externalPlans) {
      setLoadingPlans(true);
      fetch("/api/v1/plans")
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            const planList: PlanOption[] = (data.plans ?? data.data ?? []).map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (p: any) => ({ id: p.id, name: p.name, isPrimary: p.isPrimary })
            );
            setPlans(planList);
            // Default to primary plan
            const primary = planList.find((p) => p.isPrimary);
            setSelectedPlanId(primary?.id ?? planList[0]?.id ?? "");
          }
        })
        .finally(() => setLoadingPlans(false));
    }
  }, [showAddForm, plans.length, externalPlans]);

  // Set default plan when plans load
  useEffect(() => {
    if (externalPlans && externalPlans.length > 0 && !selectedPlanId) {
      const primary = externalPlans.find((p) => p.isPrimary);
      setSelectedPlanId(primary?.id ?? externalPlans[0]?.id ?? "");
    }
  }, [externalPlans, selectedPlanId]);

  async function handleAddToPlan() {
    if (!selectedPlanId) return;
    setAdding(true);
    setAddResult(null);

    try {
      if (course.duration === "full_year") {
        // Full-year: add to both semesters
        const res1 = await fetch(`/api/v1/plans/${selectedPlanId}/courses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: course.id,
            grade_level: selectedGrade,
            semester: 1,
            force_add: true,
          }),
        });
        const res2 = await fetch(`/api/v1/plans/${selectedPlanId}/courses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: course.id,
            grade_level: selectedGrade,
            semester: 2,
            force_add: true,
          }),
        });

        if (res1.ok && res2.ok) {
          setAddResult({ success: true, message: `Added to both semesters of Grade ${selectedGrade}` });
          onCourseAdded?.();
        } else {
          const data = await (res1.ok ? res2 : res1).json().catch(() => null);
          setAddResult({
            success: false,
            message: data?.error?.message ?? data?.violations?.[0]?.message ?? "Failed to add course",
            warnings: data?.violations,
          });
        }
      } else {
        // Semester course: add to selected semester
        const res = await fetch(`/api/v1/plans/${selectedPlanId}/courses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: course.id,
            grade_level: selectedGrade,
            semester: selectedSemester,
            force_add: true,
          }),
        });

        if (res.ok) {
          setAddResult({ success: true, message: `Added to Grade ${selectedGrade}, Semester ${selectedSemester}` });
          onCourseAdded?.();
        } else {
          const data = await res.json().catch(() => null);
          setAddResult({
            success: false,
            message: data?.error?.message ?? data?.violations?.[0]?.message ?? "Failed to add course",
            warnings: data?.violations,
          });
        }
      }
    } catch {
      setAddResult({ success: false, message: "Something went wrong" });
    } finally {
      setAdding(false);
    }
  }

  // Available semesters for semester courses
  const availableSemesters = course.duration === "full_year"
    ? []
    : course.semestersOffered && course.semestersOffered.length > 0
      ? course.semestersOffered
      : [1, 2];

  return (
    <div className="flex flex-col gap-6">
      {/* Description */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Description</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p>
      </div>

      {/* Course details grid */}
      <DetailGrid course={course} onCourseClick={onCourseClick} onDivisionClick={onDivisionClick} onDepartmentClick={onDepartmentClick} />

      {/* Add to Plan */}
      {!hideAddButton && (
        <div className="border-t border-border pt-4">
          {!showAddForm ? (
            <div className="flex gap-2">
              {onClose && (
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={onClose}
                >
                  Cancel
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={() => { setShowAddForm(true); setAddResult(null); }}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add to Plan
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="mb-3 text-sm font-semibold text-foreground">Add to Plan</h4>

              {loadingPlans ? (
                <div className="flex items-center justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                </div>
              ) : plans.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    No plans found.{" "}
                    <a href="/planner" className="text-primary underline underline-offset-2">
                      Create a plan
                    </a>{" "}
                    first.
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => { setShowAddForm(false); setAddResult(null); onClose?.(); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Plan + Grade + Semester in one line */}
                  <div className="flex flex-wrap items-end gap-3">
                    {/* Plan selector */}
                    <div className="min-w-0 flex-1">
                      <label htmlFor="add-plan-select" className="mb-1 block text-xs font-medium text-muted-foreground">
                        Plan
                      </label>
                      <select
                        id="add-plan-select"
                        value={selectedPlanId}
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.isPrimary ? " ★" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Grade level */}
                    <div className="shrink-0">
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Grade
                      </label>
                      <div className="flex gap-1">
                        {course.gradeLevels.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setSelectedGrade(g)}
                            className={`flex h-9 w-10 items-center justify-center rounded-lg border text-xs font-medium transition-colors
                              ${selectedGrade === g
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground hover:bg-muted"
                              }
                              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
                            aria-pressed={selectedGrade === g}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Semester (only for semester courses) */}
                    {course.duration === "semester" && (
                      <div className="shrink-0">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Semester
                        </label>
                        <div className="flex gap-1">
                          {availableSemesters.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSelectedSemester(s)}
                              className={`flex h-9 w-14 items-center justify-center rounded-lg border text-xs font-medium transition-colors
                                ${selectedSemester === s
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-foreground hover:bg-muted"
                                }
                                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
                            aria-pressed={selectedSemester === s}
                          >
                            Sem {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>

                  {course.duration === "full_year" && (
                    <p className="text-xs text-muted-foreground">
                      Full-year course — will be added to both semesters.
                    </p>
                  )}

                  {/* Result message */}
                  {addResult && (
                    <div
                      className={`rounded-lg p-2.5 text-sm ${
                        addResult.success
                          ? "bg-success-light text-success"
                          : "bg-destructive-light text-destructive"
                      }`}
                      role="status"
                    >
                      {addResult.message}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setShowAddForm(false); setAddResult(null); onClose?.(); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleAddToPlan}
                      disabled={adding || !selectedPlanId || addResult?.success === true}
                    >
                      {adding ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      ) : addResult?.success ? (
                        <>
                          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          Added
                        </>
                      ) : (
                        "Add to Plan"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
