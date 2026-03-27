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
            {(course.gradeLevels ?? []).map((g: number) => `Grade ${g}`).join(", ")}
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

interface CourseDetailProps {
  course: Course;
  onCourseClick?: (courseId: string) => void;
  onDivisionClick?: (divisionName: string) => void;
  onDepartmentClick?: (divisionName: string, departmentName: string) => void;
  hideAddButton?: boolean;
}

export function CourseDetail({ course, onCourseClick, onDivisionClick, onDepartmentClick, hideAddButton = false }: CourseDetailProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Description */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Description</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p>
      </div>

      {/* Course details grid */}
      <DetailGrid course={course} onCourseClick={onCourseClick} onDivisionClick={onDivisionClick} onDepartmentClick={onDepartmentClick} />

      {/* Add to Plan button — hidden when opened from course picker or planner */}
      {!hideAddButton && (
        <div className="relative">
          <Button
            disabled
            className="w-full"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-describedby="add-plan-tooltip"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add to Plan
          </Button>
          {showTooltip && (
            <div
              id="add-plan-tooltip"
              role="tooltip"
              className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-md whitespace-nowrap"
            >
              Use the Planner to add courses to your plan
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
