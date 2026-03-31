"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { CourseDetail } from "@/components/course-detail";
import { apiFetch } from "@/lib/api-client";

interface CourseDetailModalProps {
  courseId: string;
  onClose: () => void;
  /** When a course code is clicked inside the detail, navigate to that course */
  onCourseNavigate?: (courseId: string) => void;
  /** Higher z-index for stacking over other modals (e.g., course picker) */
  zIndex?: number;
  /** Hide the "Add to Plan" button (e.g., when opened from planner/picker) */
  hideAddButton?: boolean;
  /** Direct add callback — skips the plan/grade/semester form. Used from course picker where context is known. */
  onDirectAdd?: (courseId: string) => void;
}

function creditTypeBadgeVariant(type: string) {
  switch (type) {
    case "AP": return "ap" as const;
    case "Honors": return "honors" as const;
    case "Accelerated": return "accelerated" as const;
    default: return "default" as const;
  }
}

export function CourseDetailModal({
  courseId,
  onClose,
  onCourseNavigate,
  zIndex = 50,
  hideAddButton = false,
  onDirectAdd,
}: CourseDetailModalProps) {
  const [course, setCourse] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCourse = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/courses/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) {
        setCourse(json.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourse(courseId);
  }, [courseId, fetchCourse]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleCourseCodeClick(id: string) {
    if (onCourseNavigate) {
      onCourseNavigate(id);
    } else {
      // Navigate within the same modal
      fetchCourse(id);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = course as any;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50"
        style={{ zIndex: zIndex - 1 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
        style={{ zIndex }}
      >
        <div
          className="relative w-full max-w-5xl rounded-xl bg-card shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label={c ? `Course details: ${c.name}` : "Loading course details"}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          ) : c ? (
            <>
              {/* Header */}
              <div className="sticky top-0 z-10 rounded-t-xl border-b border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-4">
                    <h2 className="text-lg font-semibold text-foreground truncate">
                      {c.name}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({c.code})
                      </span>
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={onClose}
                    aria-label="Close course details"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={creditTypeBadgeVariant(c.creditType)}>
                    {c.creditType}
                  </Badge>
                  {c.isAp && c.creditType !== "AP" && (
                    <Badge variant="ap">Advanced Placement</Badge>
                  )}
                  {c.isDualCredit && (
                    <Badge variant="dual-credit">Dual Credit</Badge>
                  )}
                  {c.gpaWaiver && (
                    <Badge variant="warning">GPA Waiver</Badge>
                  )}
                </div>
              </div>
              {/* Content */}
              <div className="p-4 sm:p-6">
                <CourseDetail
                  course={c}
                  onCourseClick={handleCourseCodeClick}
                  hideAddButton={hideAddButton}
                  onClose={onClose}
                  onDirectAdd={onDirectAdd ? () => onDirectAdd(courseId) : undefined}
                />
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              Course not found.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
