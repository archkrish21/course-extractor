"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PlannerGrid } from "@/components/planner/planner-grid";
import { CoursePicker } from "@/components/planner/course-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import type { PlanCourse, Violation } from "@/components/planner/plan-course-card";
import { CourseDetailModal } from "@/components/course-detail-modal";
import { useAccount } from "@/lib/account-context";
import { useTour } from "@/lib/hooks/use-tour";
import { TOUR_IDS, getPlannerTourSteps } from "@/config/tours";
import { apiFetch } from "@/lib/api-client";
import { calculateGPA, formatGPA } from "@/lib/gpa/calc";
import { useUndoStack } from "@/lib/hooks/use-undo-stack";
import { useToast } from "@/components/ui/toast";
import { useUpgradeModal, UpgradeModal } from "@/components/upgrade-modal";

interface Plan {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  isPrimary: boolean;
  courseCount: number;
  createdAt: string;
  createdFromTemplateId?: string | null;
  templateName?: string;
  createdBy?: string | null;
  creatorRole?: string | null;
  creatorEmail?: string | null;
  lockedGradeLevels?: number[];
  permission?: string | null;
  isHidden?: boolean | null;
}

interface PlanCoursesResponse {
  courses: PlanCourse[];
}

interface ValidationResponse {
  violations: Record<string, Violation[]>;
}

type PickerTarget = {
  gradeLevel: number;
  semester: number;
} | null;

export default function PlannerPage() {
  const router = useRouter();
  const { currentAccount, refetchAccounts } = useAccount();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanIdState] = useState<string | null>(null);

  const setSelectedPlanId = useCallback((id: string | null) => {
    setSelectedPlanIdState(id);
    if (id) {
      sessionStorage.setItem("planner:selectedPlanId", id);
    } else {
      sessionStorage.removeItem("planner:selectedPlanId");
    }
  }, []);
  const [courses, setCourses] = useState<PlanCourse[]>([]);
  const [violations, setViolations] = useState<Record<string, Violation[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guided tour — adapts steps based on whether plans exist (only after loading)
  const hasPlans = !loading && plans.length > 0;
  const plannerTourSteps = useMemo(() => getPlannerTourSteps(hasPlans), [hasPlans]);
  useTour({ tourId: TOUR_IDS.planner, steps: plannerTourSteps, autoStart: !loading, delay: 1000 });
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [detailCourseId, setDetailCourseId] = useState<string | null>(null);
  const [lastViewedCourseId, setLastViewedCourseId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [templateCourseIds, setTemplateCourseIds] = useState<Set<string>>(new Set());
  const [coreRemoveConfirm, setCoreRemoveConfirm] = useState<{
    planCourseId: string;
    courseName: string;
    templateName: string;
  } | null>(null);
  const [resettingToTemplate, setResettingToTemplate] = useState(false);
  const [deletePlanConfirm, setDeletePlanConfirm] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [clearConfirm, setClearConfirm] = useState<{
    type: "semester" | "grade";
    gradeLevel: number;
    semester?: number;
    courseCount: number;
  } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [unlockConfirm, setUnlockConfirm] = useState<number | null>(null);
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const showProgressPanelRef = useRef(false);
  useEffect(() => { showProgressPanelRef.current = showProgressPanel; }, [showProgressPanel]);
  // Auto-open validation panel if URL has ?validation=open
  // Auto-open new plan modal if URL has ?newPlan=true
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("validation") === "open") {
      setShowProgressPanel(true);
    }
    if (params.get("newPlan") === "true") {
      openNewPlanModal();
    }
  }, []);
  const [progressData, setProgressData] = useState<{
    totalEarned: number;
    totalPlanned: number;
    totalRequired: number;
    requirements: Array<{
      name: string;
      earnedCredits: number;
      plannedCredits: number;
      requiredCredits: number;
      notes: string | null;
      evaluationType?: string;
      courses: Array<{ code: string; name: string; status: string }>;
      metadata?: Record<string, unknown>;
    }>;
    groups?: Array<{
      group: string;
      label: string;
      isOptIn: boolean;
      enabled: boolean;
      requirements: Array<{
        name: string;
        status: string;
        earnedCredits: number;
        plannedCredits: number;
        requiredCredits: number;
        notes: string | null;
        evaluationType?: string;
        courses: Array<{ code: string; name: string; status: string }>;
        metadata?: Record<string, unknown>;
      }>;
      totalRequired: number;
      totalEarned: number;
      totalPlanned: number;
    }>;
    gpaWaiverWarnings?: string[];
  } | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [gapsExpanded, setGapsExpanded] = useState(true);
  const [semesterIssuesExpanded, setSemesterIssuesExpanded] = useState(true);
  const [violationsExpanded, setViolationsExpanded] = useState(true);
  const [coveredExpanded, setCoveredExpanded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanTemplateId, setNewPlanTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; courseCount: number }>>([]);

  const undoStack = useUndoStack();
  const { modalState: upgradeModal, checkResponse: checkUpgrade, closeModal: closeUpgradeModal } = useUpgradeModal();
  const { showToast } = useToast();
  const performUndoRef = useRef<() => Promise<void>>(async () => {});
  const performUndo = useCallback(() => performUndoRef.current(), []);

  // Use grade level from account context, default to 10
  const currentGradeLevel = currentAccount?.gradeLevel ?? 10;

  // Fetch plans
  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await apiFetch("/api/v1/plans");
        if (res.ok) {
          const data = await res.json();
          const planList: Plan[] = data.plans ?? data.data ?? data ?? [];
          setPlans(planList);
          // Restore from URL param or sessionStorage, else select primary plan or first plan
          const urlPlanId = new URLSearchParams(window.location.search).get("planId")
            || sessionStorage.getItem("planner:selectedPlanId");
          const urlPlan = urlPlanId ? planList.find((p: Plan) => p.id === urlPlanId) : null;
          const primary = planList.find((p: Plan) => p.isPrimary);
          const initialId = urlPlan?.id ?? primary?.id ?? planList[0]?.id ?? null;
          setSelectedPlanIdState(initialId);
          if (initialId) sessionStorage.setItem("planner:selectedPlanId", initialId);
        } else {
          setPlans([]);
        }
      } catch {
        setError("Failed to load plans. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  // Fetch plan courses and validation when plan changes
  const fetchPlanData = useCallback(async (planId: string) => {
    try {
      const [coursesRes, validationRes] = await Promise.all([
        apiFetch(`/api/v1/plans/${planId}/courses`),
        apiFetch(`/api/v1/plans/${planId}/validate`),
      ]);

      if (coursesRes.ok) {
        const json = await coursesRes.json();
        // API returns { data: { gradeLevel: { semester: [...courses] } } }
        // Flatten into a PlanCourse[] array
        const grouped = json.data ?? json;
        const flatCourses: PlanCourse[] = [];
        for (const gradeLevel of Object.keys(grouped)) {
          const semesters = grouped[gradeLevel];
          if (!semesters || typeof semesters !== "object") continue;
          for (const sem of Object.keys(semesters)) {
            const coursesInCell = semesters[sem];
            if (!Array.isArray(coursesInCell)) continue;
            for (const pc of coursesInCell) {
              flatCourses.push({
                id: pc.id,
                courseId: pc.courseId ?? pc.course?.id,
                code: pc.course?.code ?? pc.code ?? "",
                name: pc.course?.name ?? pc.name ?? "",
                creditType: pc.course?.creditType ?? pc.creditType ?? "CP",
                creditValue: pc.course?.creditValue ?? pc.creditValue ?? "0.5",
                duration: pc.course?.duration ?? pc.duration ?? "semester",
                gradeLevel: pc.gradeLevel ?? Number(gradeLevel),
                semester: pc.semester,
                status: pc.status ?? "planned",
                plannedGrade: pc.plannedGrade,
                isAp: pc.course?.isAp ?? false,
                isDualCredit: pc.course?.isDualCredit ?? false,
                gpaWaiver: pc.course?.gpaWaiver ?? false,
                gpaWaiverApplied: pc.gpaWaiverApplied ?? false,
                gradeLevels: pc.course?.gradeLevels ?? [],
                semestersOffered: pc.course?.semestersOffered ?? null,
                divisionName: pc.course?.divisionName ?? "",
              });
            }
          }
        }
        setCourses(flatCourses);
      } else {
        setCourses([]);
      }

      if (validationRes.ok) {
        const json = await validationRes.json();
        // API returns { data: { valid, totalViolations, courseViolations: [...] } }
        // Convert courseViolations array to a Record<courseId, Violation[]>
        const validationData = json.data ?? json;
        const violationsMap: Record<string, Violation[]> = {};
        const courseViolations = validationData.courseViolations ?? validationData.violations ?? [];
        if (Array.isArray(courseViolations)) {
          for (const cv of courseViolations) {
            const key = cv.courseId ?? cv.course_id ?? "unknown";
            // Each courseViolation has a nested violations array with the actual Violation objects
            const innerViolations = cv.violations ?? [cv];
            if (!violationsMap[key]) violationsMap[key] = [];
            for (const v of innerViolations) {
              violationsMap[key].push({
                type: v.type ?? "unknown",
                message: v.message ?? "Validation issue",
                severity: v.severity ?? "warning",
                relatedCourseId: v.relatedCourseId,
              });
            }
          }
        }
        setViolations(violationsMap);
      } else {
        setViolations({});
      }

      // Fetch template courses if this plan was created from a template
      const plan = plans.find((p) => p.id === planId);
      if (plan?.createdFromTemplateId) {
        try {
          const templateRes = await apiFetch(`/api/v1/plans/${plan.createdFromTemplateId}/courses`);
          if (templateRes.ok) {
            const tJson = await templateRes.json();
            const tGrouped = tJson.data ?? tJson;
            const tCourseIds = new Set<string>();
            for (const gl of Object.keys(tGrouped)) {
              const sems = tGrouped[gl];
              if (!sems || typeof sems !== "object") continue;
              for (const sem of Object.keys(sems)) {
                const arr = sems[sem];
                if (!Array.isArray(arr)) continue;
                for (const pc of arr) {
                  tCourseIds.add(pc.courseId ?? pc.course?.id);
                }
              }
            }
            setTemplateCourseIds(tCourseIds);
          }
        } catch {
          // Template fetch failed — silently ignore
        }
      } else {
        setTemplateCourseIds(new Set());
      }
      // Auto-refresh validation report if the side panel is open
      if (showProgressPanelRef.current) {
        apiFetch(`/api/v1/requirements?planId=${planId}`).then(async (res) => {
          if (res.ok) {
            const json = await res.json();
            const d = json.data ?? json;
            setProgressData({
              totalEarned: d.totalEarned ?? 0,
              totalPlanned: d.totalPlanned ?? 0,
              totalRequired: d.totalRequired ?? 45,
              requirements: d.requirements ?? [],
              groups: d.groups ?? [],
              gpaWaiverWarnings: d.gpaWaiverWarnings ?? [],
            });
          }
        }).catch(() => { /* silent */ });
      }
    } catch {
      setError("Failed to load plan data.");
    }
  }, [plans]);

  const fetchProgress = useCallback(async () => {
    if (!selectedPlanId) return;
    setProgressLoading(true);
    try {
      const res = await apiFetch(`/api/v1/requirements?planId=${selectedPlanId}`);
      if (res.ok) {
        const json = await res.json();
        const d = json.data ?? json;
        setProgressData({
          totalEarned: d.totalEarned ?? 0,
          totalPlanned: d.totalPlanned ?? 0,
          totalRequired: d.totalRequired ?? 45,
          requirements: d.requirements ?? [],
          groups: d.groups ?? [],
          gpaWaiverWarnings: d.gpaWaiverWarnings ?? [],
        });
      }
    } catch {
      // ignore
    } finally {
      setProgressLoading(false);
    }
  }, [selectedPlanId]);

  const toggleProgressPanel = useCallback(() => {
    setShowProgressPanel((prev) => {
      if (!prev) fetchProgress();
      return !prev;
    });
  }, [fetchProgress]);

  // Fetch plan data and progress when plan selection changes
  useEffect(() => {
    if (selectedPlanId) {
      fetchPlanData(selectedPlanId);
      fetchProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId, fetchPlanData, fetchProgress]);

  // Clear undo stack ONLY when the user switches to a different plan
  const prevPlanIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPlanIdRef.current !== null && prevPlanIdRef.current !== selectedPlanId) {
      undoStack.clear();
    }
    prevPlanIdRef.current = selectedPlanId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId]);

  // Handlers
  const handleAddCourse = useCallback(
    (gradeLevel: number, semester: number) => {
      setPickerTarget({ gradeLevel, semester });
    },
    []
  );

  const handlePickerAddCourse = useCallback(
    async (courseId: string, addAnyway = false, courseDuration?: string) => {
      if (!selectedPlanId || !pickerTarget) return null;

      try {
        // Full-year courses: add to both semesters as separate rows
        if (courseDuration === "full_year") {
          const res1 = await apiFetch(`/api/v1/plans/${selectedPlanId}/courses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course_id: courseId, grade_level: pickerTarget.gradeLevel, semester: 1, force_add: addAnyway }),
          });
          const res2 = await apiFetch(`/api/v1/plans/${selectedPlanId}/courses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course_id: courseId, grade_level: pickerTarget.gradeLevel, semester: 2, force_add: addAnyway }),
          });

          const data1 = await res1.json();
          const data2 = await res2.json();

          if (res1.ok && res2.ok) {
            const addedIds: string[] = [];
            if (data1.data?.planCourse?.id) addedIds.push(data1.data.planCourse.id);
            else if (data1.data?.id) addedIds.push(data1.data.id);
            if (data2.data?.planCourse?.id) addedIds.push(data2.data.planCourse.id);
            else if (data2.data?.id) addedIds.push(data2.data.id);
            const courseName = data1.data?.planCourse?.courseName ?? data1.data?.course?.name ?? data1.name ?? "course";
            undoStack.push(`Add ${courseName}`, { type: "add_course", planCourseIds: addedIds });
            showToast(`Added ${courseName}`, () => performUndo());
            await fetchPlanData(selectedPlanId);
            return null;
          }

          // Check for validation warnings from either semester
          const violations = [...(data1.violations ?? []), ...(data2.violations ?? [])];
          if (violations.length > 0 && !addAnyway) {
            return { hasViolations: true, violations };
          }

          if (res1.ok || res2.ok) {
            const addedIds: string[] = [];
            if (res1.ok && data1.data?.planCourse?.id) addedIds.push(data1.data.planCourse.id);
            else if (res1.ok && data1.data?.id) addedIds.push(data1.data.id);
            if (res2.ok && data2.data?.planCourse?.id) addedIds.push(data2.data.planCourse.id);
            else if (res2.ok && data2.data?.id) addedIds.push(data2.data.id);
            const courseName = data1.data?.planCourse?.courseName ?? data1.data?.course?.name ?? data1.name ?? "course";
            undoStack.push(`Add ${courseName}`, { type: "add_course", planCourseIds: addedIds });
            showToast(`Added ${courseName}`, () => performUndo());
            await fetchPlanData(selectedPlanId);
            return null;
          }

          setError(data1?.error?.message ?? data2?.error?.message ?? "Failed to add course.");
          return null;
        }

        // Semester courses: add to one semester
        const semester = pickerTarget.semester;
        const res = await apiFetch(
          `/api/v1/plans/${selectedPlanId}/courses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              course_id: courseId,
              grade_level: pickerTarget.gradeLevel,
              semester,
              force_add: addAnyway,
            }),
          }
        );

        const data = await res.json();


        if (res.ok) {
          const addedIds: string[] = [];
          if (data.data?.planCourse?.id) addedIds.push(data.data.planCourse.id);
          else if (data.data?.id) addedIds.push(data.data.id);
          const courseName = data.data?.planCourse?.courseCode ?? data.data?.course?.name ?? data.data?.name ?? data.name ?? "course";
          undoStack.push(`Add ${courseName}`, { type: "add_course", planCourseIds: addedIds });
          showToast(`Added ${courseName}`, () => performUndo());
          await fetchPlanData(selectedPlanId);
          return null;
        }

        if (res.status === 422 && data.violations) {
          return {
            hasViolations: true,
            violations: data.violations,
          };
        }

        // Show error for non-422 failures
        setError(data?.error?.message ?? `Failed to add course (${res.status}).`);
        return null;
      } catch (err) {
        console.error("[planner] Add course error:", err);
        return null;
      }
    },
    [selectedPlanId, pickerTarget, fetchPlanData, undoStack, showToast, performUndo]
  );

  const doRemoveCourse = useCallback(
    async (planCourseId: string) => {
      if (!selectedPlanId) return;
      setRemovingId(planCourseId);
      try {
        // Find the course being removed — capture undo data BEFORE deleting
        const course = courses.find((c) => c.id === planCourseId);
        let undoCourses: Array<{ courseId: string; gradeLevel: number; semester: number; status: string; grade: string | null }> = [];
        if (course) {
          const relatedCourses = course.duration === "full_year"
            ? courses.filter(
                (c) => c.courseId === course.courseId && c.gradeLevel === course.gradeLevel
              )
            : [course];
          undoCourses = relatedCourses.map((c) => ({
            courseId: c.courseId,
            gradeLevel: c.gradeLevel,
            semester: c.semester ?? 1,
            status: c.status,
            grade: c.plannedGrade ?? null,
          }));
        }

        // Delete this semester's row
        const res = await apiFetch(
          `/api/v1/plans/${selectedPlanId}/courses/${planCourseId}`,
          { method: "DELETE" }
        );

        // If it's a full-year course, also delete the paired semester row
        if (res.ok && course?.duration === "full_year") {
          const pairedRow = courses.find(
            (c) => c.courseId === course.courseId
              && c.gradeLevel === course.gradeLevel
              && c.id !== planCourseId
          );
          if (pairedRow) {
            await apiFetch(
              `/api/v1/plans/${selectedPlanId}/courses/${pairedRow.id}`,
              { method: "DELETE" }
            );
          }
        }

        if (res.ok) {
          // Push undo AFTER successful delete
          if (course && undoCourses.length > 0) {
            const entry = undoStack.push(`Remove ${course.name}`, { type: "remove_course", courses: undoCourses });
            showToast(`Removed ${course.name}`, () => {
              performUndo();
            });
          }
          await fetchPlanData(selectedPlanId);
        } else {
          const data = await res.json().catch(() => null);
          if (data?.message) setError(data.message);
        }
      } catch {
        setError("Failed to remove course.");
      } finally {
        setRemovingId(null);
      }
    },
    [selectedPlanId, courses, fetchPlanData, undoStack, showToast, performUndo]
  );

  const handleRemoveCourse = useCallback(
    (planCourseId: string) => {
      // Check if this is a core template course
      const course = courses.find((c) => c.id === planCourseId);
      if (course && templateCourseIds.has(course.courseId)) {
        const plan = plans.find((p) => p.id === selectedPlanId);
        setCoreRemoveConfirm({
          planCourseId,
          courseName: course.name,
          templateName: plan?.templateName ?? plan?.name ?? "template",
        });
        return;
      }
      doRemoveCourse(planCourseId);
    },
    [courses, templateCourseIds, plans, selectedPlanId, doRemoveCourse]
  );

  const handleClearSemester = useCallback(
    (gradeLevel: number, semester: number) => {
      const toRemove = courses.filter(
        (c) => c.gradeLevel === gradeLevel && c.semester === semester
      );
      if (toRemove.length === 0) return;
      setClearConfirm({ type: "semester", gradeLevel, semester, courseCount: toRemove.length });
    },
    [courses]
  );

  const handleClearGrade = useCallback(
    (gradeLevel: number) => {
      const toRemove = courses.filter((c) => c.gradeLevel === gradeLevel);
      if (toRemove.length === 0) return;
      setClearConfirm({ type: "grade", gradeLevel, courseCount: toRemove.length });
    },
    [courses]
  );

  const executeClear = useCallback(async () => {
    if (!selectedPlanId || !clearConfirm) return;
    setClearing(true);
    try {
      const toRemove = clearConfirm.type === "semester"
        ? courses.filter((c) => c.gradeLevel === clearConfirm.gradeLevel && c.semester === clearConfirm.semester)
        : courses.filter((c) => c.gradeLevel === clearConfirm.gradeLevel);

      // Capture undo data before clearing
      const undoCourses = toRemove.map((c) => ({
        courseId: c.courseId,
        gradeLevel: c.gradeLevel,
        semester: c.semester ?? 1,
        status: c.status,
        grade: c.plannedGrade ?? null,
      }));

      const undoType = clearConfirm.type === "semester" ? "clear_semester" as const : "clear_grade" as const;
      const undoLabel = clearConfirm.type === "semester"
        ? `Clear Grade ${clearConfirm.gradeLevel} Semester ${clearConfirm.semester}`
        : `Clear Grade ${clearConfirm.gradeLevel}`;

      undoStack.push(undoLabel, { type: undoType, courses: undoCourses });

      for (const c of toRemove) {
        await apiFetch(`/api/v1/plans/${selectedPlanId}/courses/${c.id}`, { method: "DELETE" });
      }
      await fetchPlanData(selectedPlanId);
      showToast(undoLabel, () => performUndo());
      setClearConfirm(null);
    } catch {
      setError("Failed to clear courses.");
      setClearConfirm(null);
    } finally {
      setClearing(false);
    }
  }, [selectedPlanId, clearConfirm, courses, fetchPlanData, undoStack, showToast, performUndo]);

  const handleDeletePlan = useCallback(async () => {
    if (!selectedPlanId) return;
    setDeletingPlan(true);
    try {
      const res = await apiFetch(`/api/v1/plans/${selectedPlanId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = plans.filter((p) => p.id !== selectedPlanId);
        setPlans(remaining);
        setSelectedPlanId(remaining[0]?.id ?? null);
        setCourses([]);
        setViolations({});
        setDeletePlanConfirm(false);
        if (remaining.length > 0 && remaining[0]?.id) {
          await fetchPlanData(remaining[0].id);
        }
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Failed to delete plan.");
        setDeletePlanConfirm(false);
      }
    } catch {
      setError("Failed to delete plan.");
      setDeletePlanConfirm(false);
    } finally {
      setDeletingPlan(false);
    }
  }, [selectedPlanId, plans, fetchPlanData]);

  const handleResetToTemplate = useCallback(async () => {
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!selectedPlanId || !plan?.createdFromTemplateId) return;

    setResettingToTemplate(true);
    try {
      // Delete all current courses
      for (const course of courses) {
        await apiFetch(
          `/api/v1/plans/${selectedPlanId}/courses/${course.id}`,
          { method: "DELETE" }
        );
      }
      // Re-copy from template by fetching template courses and adding them
      const templateRes = await apiFetch(`/api/v1/plans/${plan.createdFromTemplateId}/courses`);
      if (templateRes.ok) {
        const tJson = await templateRes.json();
        const tGrouped = tJson.data ?? tJson;
        for (const gl of Object.keys(tGrouped)) {
          const sems = tGrouped[gl];
          if (!sems || typeof sems !== "object") continue;
          for (const sem of Object.keys(sems)) {
            const arr = sems[sem];
            if (!Array.isArray(arr)) continue;
            for (const pc of arr) {
              const courseId = pc.courseId ?? pc.course?.id;
              if (!courseId) continue;
              const semVal = pc.semester ?? (sem === "full_year" ? null : Number(sem));
              const res = await apiFetch(`/api/v1/plans/${selectedPlanId}/courses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  course_id: courseId,
                  grade_level: pc.gradeLevel ?? Number(gl),
                  semester: semVal,
                  force_add: true,
                  skip_validation: true,
                }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn(`[reset] Failed to add ${pc.course?.code ?? courseId}: ${err.error?.message ?? res.status}`);
              }
            }
          }
        }
      }
      await fetchPlanData(selectedPlanId);
    } catch {
      setError("Failed to reset plan to template.");
    } finally {
      setResettingToTemplate(false);
    }
  }, [selectedPlanId, plans, courses, fetchPlanData]);

  const handleCourseClick = useCallback((course: PlanCourse) => {
    // Could open a detail modal; for now, no-op
  }, []);

  const handleStatusChange = useCallback(
    async (planCourseId: string, newStatus: PlanCourse["status"]) => {
      if (!selectedPlanId) return;
      try {
        // Capture previous status for undo
        const course = courses.find((c) => c.id === planCourseId);
        if (course) {
          undoStack.push(`Change ${course.name} status to ${newStatus}`, {
            type: "change_status",
            planCourseId,
            previousStatus: course.status,
          });
        }

        const res = await apiFetch(
          `/api/v1/plans/${selectedPlanId}/courses/${planCourseId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          }
        );
        if (res.ok) {
          if (course) {
            showToast(`Changed ${course.name} to ${newStatus}`, () => performUndo());
          }
          await fetchPlanData(selectedPlanId);
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.error?.message ?? "Failed to update course status.");
        }
      } catch {
        setError("Failed to update course status.");
      }
    },
    [selectedPlanId, fetchPlanData, courses, undoStack, showToast, performUndo]
  );

  const handleGradeChange = useCallback(
    async (planCourseId: string, grade: string | null) => {
      if (!selectedPlanId) return;
      try {
        // Capture previous grade for undo
        const course = courses.find((c) => c.id === planCourseId);
        if (course) {
          undoStack.push(`Change ${course.name} grade to ${grade ?? "none"}`, {
            type: "change_grade",
            planCourseId,
            previousGrade: course.plannedGrade ?? null,
          });
        }

        const res = await apiFetch(
          `/api/v1/plans/${selectedPlanId}/courses/${planCourseId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planned_grade: grade }),
          }
        );
        if (res.ok) {
          await fetchPlanData(selectedPlanId);
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.error?.message ?? "Failed to update grade.");
        }
      } catch {
        setError("Failed to update grade.");
      }
    },
    [selectedPlanId, fetchPlanData, courses, undoStack]
  );

  // ─── Grade lock toggle ─────────────────────────────────────────────────────

  const handleToggleGradeLock = useCallback(
    async (gradeLevel: number, locked: boolean) => {
      if (!selectedPlanId) return;
      try {
        const res = await apiFetch(`/api/v1/plans/${selectedPlanId}/lock-grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grade_level: gradeLevel, locked }),
        });
        if (res.ok) {
          const data = await res.json();
          const updatedLocked = data?.data?.locked_grade_levels ?? data?.locked_grade_levels ?? [];
          setPlans((prev) =>
            prev.map((p) =>
              p.id === selectedPlanId ? { ...p, lockedGradeLevels: updatedLocked } : p
            )
          );
          // Refresh account context so gradeLevel stays in sync
          await refetchAccounts();
          showToast(locked ? `Grade ${gradeLevel} locked` : `Grade ${gradeLevel} unlocked`);
        }
      } catch {
        setError("Failed to toggle grade lock.");
      }
    },
    [selectedPlanId, showToast]
  );

  // ─── Undo logic ──────────────────────────────────────────────────────────────

  // Assign the actual undo implementation to the ref (keeps performUndo stable)
  performUndoRef.current = async () => {
    const entry = undoStack.pop();
    if (!entry || !selectedPlanId) {
      return;
    }

    try {
      switch (entry.action.type) {
        case "add_course": {
          // Undo add = delete the added courses
          for (const pcId of entry.action.planCourseIds) {
            const res = await apiFetch(`/api/v1/plans/${selectedPlanId}/courses/${pcId}`, {
              method: "DELETE",
            });
          }
          break;
        }
        case "remove_course":
        case "clear_semester":
        case "clear_grade": {
          // Undo remove/clear = re-add all the courses (skip validation to avoid duplicate checks)
          for (const c of entry.action.courses) {
            const body = {
              course_id: c.courseId,
              grade_level: c.gradeLevel,
              semester: c.semester,
              planned_grade: c.grade || undefined,
              skip_validation: true,
              status: c.status,
            };
            const res = await apiFetch(`/api/v1/plans/${selectedPlanId}/courses`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => null);
          }
          break;
        }
        case "change_status": {
          await apiFetch(
            `/api/v1/plans/${selectedPlanId}/courses/${entry.action.planCourseId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: entry.action.previousStatus }),
            }
          );
          break;
        }
        case "change_grade": {
          await apiFetch(
            `/api/v1/plans/${selectedPlanId}/courses/${entry.action.planCourseId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ planned_grade: entry.action.previousGrade }),
            }
          );
          break;
        }
      }
      showToast(`Undone: ${entry.label}`);
      await fetchPlanData(selectedPlanId);
    } catch {
      showToast("Undo failed");
    }
  };

  // Ctrl+Z / Cmd+Z keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [performUndo]);

  const openNewPlanModal = useCallback(async () => {
    setNewPlanName("");
    setNewPlanTemplateId(null);
    setShowNewPlanModal(true);
    // Fetch templates
    try {
      const res = await apiFetch("/api/v1/plans/templates");
      if (res.ok) {
        const json = await res.json();
        const tList = json.data ?? json ?? [];
        setTemplates(Array.isArray(tList) ? tList.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          name: t.name as string,
          courseCount: (t.courseCount as number) ?? 0,
        })) : []);
      }
    } catch { /* ignore */ }
  }, []);

  const handleCreatePlan = useCallback(async () => {
    if (!newPlanName.trim()) return;
    setCreatingPlan(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: newPlanName.trim() };
      if (newPlanTemplateId) body.from_template_id = newPlanTemplateId;

      const res = await apiFetch("/api/v1/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.ok) {
        const newPlan: Plan = json.data ?? json;
        setPlans((prev) => [...prev, newPlan]);
        setSelectedPlanId(newPlan.id);
        await fetchPlanData(newPlan.id);
        setShowNewPlanModal(false);
      } else if (res.status === 402) {
        // Show upgrade modal
        const data = json.data ?? json;
        await checkUpgrade(new Response(JSON.stringify(json), { status: 402 }), "Creating a new plan");
        setShowNewPlanModal(false);
      } else {
        setError(json?.error?.message ?? `Failed to create plan (${res.status}).`);
      }
    } catch {
      setError("Failed to create plan.");
    } finally {
      setCreatingPlan(false);
    }
  }, [newPlanName, newPlanTemplateId, fetchPlanData]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // Navigate to a grade+semester in the planner grid
  const [focusGradeTarget, setFocusGradeTarget] = useState<{ grade: number; semester: number } | null>(null);
  const navigateToGrade = useCallback((grade: number, semester: number = 1) => {
    // Set a new object reference each time to trigger useEffect even if same grade/sem
    setFocusGradeTarget({ grade, semester });
  }, []);
  const totalCourses = courses.length;
  // Count all warnings: API violations + course load gaps from API
  const apiViolationCount = Object.values(violations).flat().length;
  const courseLoadGroup = progressData?.groups?.find((g) => g.group === "course_load");

  // Build semester gaps map for PlannerGrid grade headers: "grade-semester" → messages[]
  const semesterGapsMap: Record<string, string[]> = {};
  for (const req of courseLoadGroup?.requirements ?? []) {
    if (req.status === "gap" && req.metadata) {
      const key = `${req.metadata.gradeLevel}-${req.metadata.semester}`;
      if (!semesterGapsMap[key]) semesterGapsMap[key] = [];
      semesterGapsMap[key].push(req.notes ?? req.name);
    }
  }
  // Also include GPA waiver warnings by semester
  for (const msg of progressData?.gpaWaiverWarnings ?? []) {
    const match = msg.match(/Grade (\d+) Sem (\d)/);
    if (match) {
      const key = `${match[1]}-${match[2]}`;
      if (!semesterGapsMap[key]) semesterGapsMap[key] = [];
      semesterGapsMap[key].push(msg);
    }
  }
  const courseLoadWarnings: string[] = (courseLoadGroup?.requirements ?? [])
    .filter((r) => r.status === "gap")
    .map((r) => {
      const gl = (r.metadata?.gradeLevel as number) ?? 0;
      const sem = (r.metadata?.semester as number) ?? 0;
      return `Gr ${gl} Sem ${sem}: ${r.notes ?? r.name}`;
    });
  const gpaWaiverWarnings = (progressData?.gpaWaiverWarnings ?? []).map((msg) =>
    msg.startsWith("Grade") ? msg.replace(/^Grade (\d+) Sem (\d)/, "Gr $1 Sem $2") : msg
  );
  // planWarnings = only prerequisite violations
  const planWarnings: string[] = [];
  for (const [courseId, vList] of Object.entries(violations)) {
    const course = courses.find((c) => c.courseId === courseId);
    const gl = course?.gradeLevel ?? 0;
    const sem = course?.semester ?? 0;
    const code = course?.code ?? course?.name ?? "";
    for (const v of vList) {
      planWarnings.push(`Gr ${gl} Sem ${sem}: ${code} — ${v.message}`);
    }
  }
  const totalViolations = apiViolationCount;
  const gradReqGapCount = progressData
    ? progressData.requirements.filter((r) => (r.earnedCredits ?? 0) + (r.plannedCredits ?? 0) < r.requiredCredits).length
    : 0;
  const semesterIssueCount = courseLoadWarnings.length + gpaWaiverWarnings.length;
  const hasIssues = totalViolations > 0 || gradReqGapCount > 0 || semesterIssueCount > 0;
  // Credit per row: full-year courses are stored as 2 rows with creditValue=2.0 each,
  // so each row represents 1 credit (half the course). Semester courses are 1 row = 1 credit.
  const creditPerRow = (c: PlanCourse) => {
    const val = parseFloat(c.creditValue) || 0;
    return val > 1 ? val / 2 : val;
  };
  const totalPlannedCredits = courses
    .filter((c) => c.status !== "dropped")
    .reduce((sum, c) => sum + creditPerRow(c), 0);
  const totalEarnedCredits = courses
    .filter((c) => c.status === "completed")
    .reduce((sum, c) => sum + creditPerRow(c), 0);
  const totalProjectedGPA = calculateGPA(courses, "projected");
  const totalActualGPA = calculateGPA(courses, "actual");

  // Status badge variant
  const statusVariant = selectedPlan?.status === "active" ? "success" : selectedPlan?.status === "archived" ? "default" : "warning";

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-8 w-8 animate-spin text-primary"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm text-muted-foreground">Loading your plans...</p>
          </div>
        </div>
      </div>
    );
  }

  const renderNewPlanModal = () => (
    <>
      <div
        className="fixed inset-0 z-40 bg-foreground/30"
        onClick={() => setShowNewPlanModal(false)}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
        <div
          className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Create new plan"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-lg font-semibold text-foreground">Create New Plan</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Name your plan and optionally start from a template.
            </p>
          </div>

          <div className="px-6 py-4 flex flex-col gap-4">
            <div>
              <label htmlFor="new-plan-name" className="mb-1 block text-sm font-medium text-foreground">
                Plan Name
              </label>
              <input
                id="new-plan-name"
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="e.g., My STEM Track"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPlanName.trim()) handleCreatePlan();
                }}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Start From
              </label>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewPlanTemplateId(null)}
                  className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors
                    ${newPlanTemplateId === null
                      ? "border-primary bg-primary-light text-primary"
                      : "border-border hover:bg-muted text-foreground"
                    }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-current opacity-50">
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium">Blank Plan</p>
                    <p className="text-xs text-muted-foreground">Start from scratch</p>
                  </div>
                </button>

                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setNewPlanTemplateId(t.id);
                      if (!newPlanName.trim()) setNewPlanName(`My ${t.name}`);
                    }}
                    className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors
                      ${newPlanTemplateId === t.id
                        ? "border-primary bg-primary-light text-primary"
                        : "border-border hover:bg-muted text-foreground"
                      }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                      {t.name.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.courseCount} courses</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
            <Button variant="ghost" size="sm" onClick={() => setShowNewPlanModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreatePlan}
              disabled={!newPlanName.trim() || creatingPlan}
            >
              {creatingPlan ? "Creating..." : "Create Plan"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  const hasNoPlans = plans.length === 0;

  if (hasNoPlans) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Course Planner
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan your four-year academic path</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light">
              <svg
                aria-hidden="true"
                className="h-8 w-8 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              Create Your First Plan
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Build a 4-year course plan to map out your academic path. Choose from
              templates or start from scratch.
            </p>
            <div className="mt-8">
              <Button onClick={openNewPlanModal} data-tour="create-first-plan" className="px-6 py-2.5 text-base">
                Get Started
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade modal */}
        <UpgradeModal
          isOpen={upgradeModal.isOpen}
          onClose={closeUpgradeModal}
          feature={upgradeModal.feature}
          minimumTier={upgradeModal.minimumTier}
          currentTier={upgradeModal.currentTier}
        />

        {/* New plan modal */}
        {showNewPlanModal && renderNewPlanModal()}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {selectedPlan?.name ?? "Course Planner"}
          </h1>
          {selectedPlan && (() => {
            const creatorName = selectedPlan.creatorEmail
              ? selectedPlan.creatorEmail.split("@")[0].charAt(0).toUpperCase() + selectedPlan.creatorEmail.split("@")[0].slice(1)
              : null;
            return (
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedPlan.creatorRole && selectedPlan.creatorRole !== "student"
                  ? `${creatorName ?? selectedPlan.creatorRole}'s plan`
                  : selectedPlan.createdFromTemplateId
                    ? "Created from template"
                    : `${currentAccount?.studentName ?? "Student"}'s plan`
                }
              </p>
            );
          })()}
          {selectedPlan && (
            <div className="mt-2 flex flex-col gap-1.5">
              {/* Line 1: Plan selector + status badges */}
              <div className="flex flex-wrap items-center gap-2">
                {plans.length > 1 ? (
                  <select
                    value={selectedPlanId ?? ""}
                    onChange={(e) => { setSelectedPlanId(e.target.value); setShowProgressPanel(false); setProgressData(null); }}
                    aria-label="Select a plan"
                    className="h-9 min-h-[44px] rounded-lg border border-border bg-background px-3 pr-8 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {plans.map((plan) => {
                      const creatorName = plan.creatorEmail
                        ? plan.creatorEmail.split("@")[0].charAt(0).toUpperCase() + plan.creatorEmail.split("@")[0].slice(1)
                        : null;
                      const creatorLabel = plan.creatorRole && plan.creatorRole !== "student"
                        ? ` (by ${creatorName ?? plan.creatorRole})`
                        : plan.createdFromTemplateId ? " (from template)" : "";
                      return (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}{plan.isPrimary ? " \u2605" : ""}{creatorLabel}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <span className="text-sm font-medium text-foreground">
                    {selectedPlan.name}
                  </span>
                )}
                <Badge variant={statusVariant} className="text-[10px]">
                  {selectedPlan.status}
                </Badge>
                {selectedPlan.isPrimary && (
                  <Badge variant="default" className="text-[10px]">
                    Primary
                  </Badge>
                )}
                {/* Set as Primary button — only for non-primary plans, student role only */}
                {!selectedPlan.isPrimary && currentAccount?.role === "student" && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await apiFetch(`/api/v1/plans/${selectedPlanId}/set-primary`, {
                          method: "PATCH",
                        });
                        if (res.ok) {
                          // Update local state: new primary becomes active, old primary becomes draft
                          setPlans((prev) =>
                            prev.map((p) => ({
                              ...p,
                              isPrimary: p.id === selectedPlanId,
                              status: p.id === selectedPlanId ? "active" as const : (p.isPrimary ? "draft" as const : p.status),
                            }))
                          );
                          showToast(`"${selectedPlan.name}" is now your active plan`);
                        } else {
                          const data = await res.json().catch(() => null);
                          setError(data?.error?.message ?? "Failed to set primary plan.");
                        }
                      } catch {
                        setError("Failed to set primary plan.");
                      }
                    }}
                    className="flex min-h-[44px] items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    title="Set as primary plan"
                    aria-label={`Set "${selectedPlan.name}" as primary plan`}
                  >
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                    Set Primary
                  </button>
                )}
              </div>

              {/* Line 2: Courses, credits, GPA, warnings */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs text-muted-foreground">
                  {totalCourses} course{totalCourses !== 1 ? "s" : ""}
                </span>
                <span className="text-border">|</span>
                <span className="text-xs font-medium text-foreground">
                  {totalEarnedCredits > 0 && totalEarnedCredits === totalPlannedCredits ? (
                    <span className="text-success">{totalEarnedCredits % 1 === 0 ? totalEarnedCredits : totalEarnedCredits.toFixed(1)} credits earned</span>
                  ) : totalEarnedCredits > 0 ? (
                    <>{totalPlannedCredits % 1 === 0 ? totalPlannedCredits : totalPlannedCredits.toFixed(1)} credits planned, <span className="text-success">{totalEarnedCredits % 1 === 0 ? totalEarnedCredits : totalEarnedCredits.toFixed(1)} earned</span></>
                  ) : (
                    <>{totalPlannedCredits % 1 === 0 ? totalPlannedCredits : totalPlannedCredits.toFixed(1)} credits planned</>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  / 45 required
                </span>
                {totalProjectedGPA.unweighted !== null && (
                  <>
                    <span className="text-border">|</span>
                    <span className="text-xs font-semibold text-primary" title="Projected GPA (all graded courses): Unweighted / Weighted">
                      Proj: {formatGPA(totalProjectedGPA.unweighted)} / {formatGPA(totalProjectedGPA.weighted)}
                    </span>
                  </>
                )}
                {totalActualGPA.unweighted !== null && (
                  <span className="text-xs font-semibold text-success" title="Actual GPA (completed only): Unweighted / Weighted">
                    Actual: {formatGPA(totalActualGPA.unweighted)} / {formatGPA(totalActualGPA.weighted)}
                  </span>
                )}
              <span className="text-border">|</span>
              {!hasIssues ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Valid
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Issues found
                </span>
              )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Validate progress */}
          {selectedPlanId && (
            <button
              type="button"
              onClick={toggleProgressPanel}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border bg-card hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${showProgressPanel ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
              title="Validation report"
              aria-label="Validation report"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
            </button>
          )}
          {/* Print plan — requires Plus+ (canExportPdf) */}
          {selectedPlanId && (() => {
            const canPrint = currentAccount?.subscriptionTier === "plus" || currentAccount?.subscriptionTier === "elite";
            return (
            <span title={canPrint ? "Print plan" : "Upgrade to Plus to print plans"}>
            <button
              type="button"
              onClick={() => canPrint && window.open(`/planner/print?id=${selectedPlanId}`, "_blank")}
              disabled={!canPrint}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                canPrint ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "text-muted-foreground/30 cursor-not-allowed"
              }`}
              aria-label="Print plan"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
            </button>
            </span>
            );
          })()}
          {undoStack.canUndo && (
            <button
              type="button"
              onClick={performUndo}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              title={`Undo: ${undoStack.peek?.label}`}
              aria-label={`Undo: ${undoStack.peek?.label}`}
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
            </button>
          )}

          <Button
            variant="outline"
            onClick={openNewPlanModal}
            aria-label="Create new plan"
            title="New Plan"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push("/plans")}
            aria-label="Manage plans"
            title="Manage Plans"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
          </Button>

          {selectedPlan?.createdFromTemplateId && (
            <Button
              variant="outline"
              onClick={handleResetToTemplate}
              disabled={resettingToTemplate}
              aria-label="Reset to template"
              title="Reset to template"
            >
              <svg aria-hidden="true" className={`h-4 w-4 ${resettingToTemplate ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
            </Button>
          )}

          {/* Delete plan button — if user has delete/owner permission */}
          {selectedPlan && (selectedPlan.permission === "owner" || selectedPlan.permission === "delete" || !selectedPlan.permission) && (
            <span title={selectedPlan.isPrimary ? "Cannot delete the primary plan. Set another plan as primary first." : "Delete this plan"}>
            <Button
              variant="outline"
              onClick={() => !selectedPlan.isPrimary && setDeletePlanConfirm(true)}
              disabled={selectedPlan.isPrimary}
              aria-label={`Delete plan: ${selectedPlan.name}`}
              className={selectedPlan.isPrimary ? "opacity-30 cursor-not-allowed" : "text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive-light"}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </Button>
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive-light p-3 text-sm text-destructive"
          role="alert"
        >
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
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto min-h-[44px] min-w-[44px] flex items-center justify-center text-destructive hover:text-destructive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Dismiss error"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Planner Grid + Validation Side Panel */}
      <div className="flex gap-4">
        {/* Main planner area */}
        <div className={`min-w-0 ${showProgressPanel ? "flex-1" : "w-full"}`}>

      {selectedPlanId && (
        <PlannerGrid
          planId={selectedPlanId}
          courses={courses}
          currentGradeLevel={currentGradeLevel}
          onAddCourse={handleAddCourse}
          onRemoveCourse={handleRemoveCourse}
          onCourseClick={handleCourseClick}
          onStatusChange={handleStatusChange}
          onGradeChange={handleGradeChange}
          onClearSemester={handleClearSemester}
          onClearGrade={handleClearGrade}
          onViewDetails={(courseId) => setDetailCourseId(courseId)}
          onBulkStatusChange={async (ids, status) => {
            if (!selectedPlanId) return;
            try {
              for (const id of ids) {
                await apiFetch(`/api/v1/plans/${selectedPlanId}/courses/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status }),
                });
              }
              showToast(`Set ${ids.length} courses to ${status}`);
              await fetchPlanData(selectedPlanId);
            } catch {
              setError("Failed to update course statuses.");
            }
          }}
          onBulkGradeChange={async (ids, grade) => {
            if (!selectedPlanId) return;
            try {
              for (const id of ids) {
                await apiFetch(`/api/v1/plans/${selectedPlanId}/courses/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ planned_grade: grade }),
                });
              }
              showToast(grade ? `Set ${ids.length} courses to grade ${grade}` : `Cleared grades for ${ids.length} courses`);
              await fetchPlanData(selectedPlanId);
            } catch {
              setError("Failed to update grades.");
            }
          }}
          onGpaWaiverToggle={async (planCourseId, applied) => {
            if (!selectedPlanId) return;
            try {
              await apiFetch(`/api/v1/plans/${selectedPlanId}/courses/${planCourseId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gpa_waiver_applied: applied }),
              });
              const course = courses.find((c) => c.id === planCourseId);
              showToast(applied ? `GPA waiver applied for ${course?.name ?? "course"}` : `GPA waiver removed for ${course?.name ?? "course"}`);
              await fetchPlanData(selectedPlanId);
            } catch {
              setError("Failed to update GPA waiver.");
            }
          }}
          lockedGradeLevels={selectedPlan?.lockedGradeLevels ?? []}
          onToggleGradeLock={(gradeLevel, locked) => {
            if (!locked) {
              // Unlocking — show confirmation first
              setUnlockConfirm(gradeLevel);
              return;
            }
            // Locking — redirect to year-end wizard to complete the grade
            router.push(`/year-end?grade=${gradeLevel}`);
          }}
          violations={violations}
          semesterGaps={semesterGapsMap}
          focusGrade={focusGradeTarget}
          readOnly={selectedPlan?.status === "archived" || selectedPlan?.permission === "view"}
        />
      )}
        </div>{/* end main planner area */}

        {/* Validation Side Panel */}
        {showProgressPanel && selectedPlanId && (
          <div className="hidden lg:block w-[380px] shrink-0">
            <div className="sticky top-4 flex max-h-[calc(100vh-6rem)] flex-col">
              <Card className="flex flex-col overflow-hidden">
                <CardContent className="flex flex-col overflow-hidden p-0">
                  {progressLoading ? (
                    <div className="animate-pulse space-y-2 p-5 py-2">
                      <div className="h-4 w-40 rounded bg-muted" />
                      <div className="h-3 w-full rounded-full bg-muted" />
                      <div className="h-3 w-48 rounded bg-muted" />
                    </div>
                  ) : progressData ? (
                    (() => {
                      const reqsWithStatus = progressData.requirements.map((req) => {
                        const earned = req.earnedCredits ?? 0;
                        const planned = req.plannedCredits ?? 0;
                        const required = req.requiredCredits ?? 0;
                        const covered = earned + planned;
                        const status = earned >= required ? "met" as const : covered >= required ? "in_progress" as const : "gap" as const;
                        const needed = Math.max(0, required - covered);
                        const ePct = required > 0 ? Math.min(100, Math.round((earned / required) * 100)) : 0;
                        const pPct = required > 0 ? Math.min(100 - ePct, Math.round((planned / required) * 100)) : 0;
                        return { ...req, earned, planned, required, covered, status, needed, ePct, pPct };
                      });

                      const gaps = reqsWithStatus.filter((r) => r.status === "gap");
                      const met = reqsWithStatus.filter((r) => r.status !== "gap");
                      const metCount = reqsWithStatus.filter((r) => r.status === "met").length;
                      const inProgressCount = reqsWithStatus.filter((r) => r.status === "in_progress").length;
                      const totalReqs = reqsWithStatus.length;
                      const gapCount = gaps.length;

                      const totalCovered = progressData.totalEarned + progressData.totalPlanned;
                      const overallEarnedPct = progressData.totalRequired > 0 ? Math.min(100, Math.round((progressData.totalEarned / progressData.totalRequired) * 100)) : 0;
                      const overallPlannedPct = progressData.totalRequired > 0 ? Math.min(100 - overallEarnedPct, Math.round((progressData.totalPlanned / progressData.totalRequired) * 100)) : 0;

                      return (
                        <>
                          {/* Sticky header */}
                          {/* Sticky title */}
                          <div className="shrink-0 border-b border-border bg-card px-5 py-3">
                            <h3 className="text-sm font-semibold text-foreground">Validation Report</h3>
                          </div>

                          {/* Scrollable body */}
                          <div className="flex-1 overflow-y-auto px-5 py-4">

                          {/* Summary — collapsible */}
                          <div className="mb-3 rounded-lg border border-border">
                            <button type="button" onClick={() => setSummaryExpanded((v) => !v)} className="flex w-full items-center justify-between p-2.5 text-left">
                              <span className="text-xs font-semibold text-muted-foreground">Summary</span>
                              <svg aria-hidden="true" className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${summaryExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>

                          {/* Collapsed: single-line with pipe separators */}
                          {!summaryExpanded && (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 pb-2.5 text-xs">
                              <span className="text-muted-foreground">Credits <span className="font-semibold text-foreground">{totalCovered}/{progressData.totalRequired}</span></span>
                              <span className="text-border">|</span>
                              <span className="text-muted-foreground">Reqs <span className="font-semibold text-foreground">{metCount}/{totalReqs}</span></span>
                              {gapCount > 0 && (<><span className="text-border">|</span><span className="text-destructive">Gaps <span className="font-semibold">{gapCount}</span></span></>)}
                              {(courseLoadWarnings.length + gpaWaiverWarnings.length + totalViolations) > 0 && (
                                <><span className="text-border">|</span><span className="text-warning">Warnings <span className="font-semibold">{courseLoadWarnings.length + gpaWaiverWarnings.length + totalViolations}</span></span></>
                              )}
                            </div>
                          )}

                          {/* Expanded: full grouped details */}
                          {summaryExpanded && (
                          <div className="space-y-3 px-2.5 pb-2.5 text-sm">
                            {/* Credits group */}
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Credits</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Total</span>
                                  <span className="font-semibold">{totalCovered}<span className="font-normal text-muted-foreground">/{progressData.totalRequired}</span></span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Earned</span>
                                  <span className="font-semibold text-success">{progressData.totalEarned}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Planned</span>
                                  <span className="font-semibold text-primary">{progressData.totalPlanned}</span>
                                </div>
                              </div>
                            </div>

                            {/* Graduation Requirements group */}
                            <div className="border-t border-border pt-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Graduation Requirements</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Met</span>
                                  <span className="font-semibold">{metCount}<span className="font-normal text-muted-foreground">/{totalReqs}</span></span>
                                </div>
                                {inProgressCount > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">In Progress</span>
                                    <span className="font-semibold text-primary">{inProgressCount}</span>
                                  </div>
                                )}
                                {gapCount > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-destructive">Gaps</span>
                                    <span className="font-semibold text-destructive">{gapCount}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Semester & Violations group */}
                            {((courseLoadWarnings.length + gpaWaiverWarnings.length) > 0 || totalViolations > 0) && (
                              <div className="border-t border-border pt-2">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Warnings</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                  {(courseLoadWarnings.length + gpaWaiverWarnings.length) > 0 && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-warning">Semester</span>
                                      <span className="font-semibold text-warning">{courseLoadWarnings.length + gpaWaiverWarnings.length}</span>
                                    </div>
                                  )}
                                  {totalViolations > 0 && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-warning">Prerequisite</span>
                                      <span className="font-semibold text-warning">{totalViolations}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          )}
                          </div>{/* end summary collapsible */}

                          {/* Graduation Requirement Gaps */}
                          {gaps.length > 0 && (
                            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5">
                              <button type="button" onClick={() => setGapsExpanded((v) => !v)} className="flex w-full items-center justify-between p-2.5 text-left">
                                <span className="text-xs font-semibold text-destructive">Graduation Gaps ({gaps.length})</span>
                                <svg aria-hidden="true" className={`h-3.5 w-3.5 text-destructive transition-transform ${gapsExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                              {gapsExpanded && (
                                <>
                                  <div className="mx-2.5 mb-3 border-b border-destructive/15 pb-3">
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Credit Progress</p>
                                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-destructive/10">
                                      {overallEarnedPct > 0 && <div className="h-full bg-success" style={{ width: `${overallEarnedPct}%` }} />}
                                      {overallPlannedPct > 0 && <div className="h-full bg-primary/50" style={{ width: `${overallPlannedPct}%` }} />}
                                    </div>
                                    <div className="mt-0.5 flex items-center justify-between text-[9px] text-muted-foreground">
                                      <span>Earned + Planned</span>
                                      <span>{overallEarnedPct + overallPlannedPct}%</span>
                                    </div>
                                  </div>
                                  <ul className="space-y-2 px-2.5 pb-2.5">
                                    {gaps.map((req) => (
                                      <li key={req.name}>
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-xs font-medium text-destructive">{req.name}</span>
                                          <span className="rounded bg-destructive/10 px-1 py-0.5 text-[10px] font-semibold text-destructive">{req.needed}cr needed</span>
                                        </div>
                                        <div className="flex h-1 w-full overflow-hidden rounded-full bg-destructive/10">
                                          {req.ePct > 0 && <div className="h-full bg-success" style={{ width: `${req.ePct}%` }} />}
                                          {req.pPct > 0 && <div className="h-full bg-primary/50" style={{ width: `${req.pPct}%` }} />}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          )}

                          {/* Semester Requirement Gaps */}
                          {(courseLoadWarnings.length > 0 || gpaWaiverWarnings.length > 0) && (
                            <div className="mb-3 rounded-lg border border-warning/30 bg-warning/5">
                              <button type="button" onClick={() => setSemesterIssuesExpanded((v) => !v)} className="flex w-full items-center justify-between p-2.5 text-left">
                                <span className="text-xs font-semibold text-warning">Semester Gaps ({courseLoadWarnings.length + gpaWaiverWarnings.length})</span>
                                <svg aria-hidden="true" className={`h-3.5 w-3.5 text-warning transition-transform ${semesterIssuesExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                              {semesterIssuesExpanded && (
                                <ul className="space-y-1 px-2.5 pb-2.5">
                                  {[...courseLoadWarnings, ...gpaWaiverWarnings].map((msg, i) => {
                                    const grMatch = msg.match(/^(Gr (\d+) Sem (\d+):)\s*(.*)/);
                                    return (
                                      <li key={i} className="flex items-start gap-1 text-xs text-foreground">
                                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-warning" />
                                        {grMatch ? (
                                          <span className="inline"><button type="button" onClick={() => navigateToGrade(Number(grMatch[2]), Number(grMatch[3]))} className="shrink-0 whitespace-nowrap font-medium text-primary hover:underline">{grMatch[1]}</button> {grMatch[4]}</span>
                                        ) : msg}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}

                          {/* Prerequisite Violations */}
                          {planWarnings.length > 0 && (
                            <div className="mb-3 rounded-lg border border-warning/30 bg-warning/5">
                              <button type="button" onClick={() => setViolationsExpanded((v) => !v)} className="flex w-full items-center justify-between p-2.5 text-left">
                                <span className="text-xs font-semibold text-warning">Prerequisite Violations ({planWarnings.length})</span>
                                <svg aria-hidden="true" className={`h-3.5 w-3.5 text-warning transition-transform ${violationsExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                              {violationsExpanded && (
                                <ul className="space-y-1 px-2.5 pb-2.5">
                                  {planWarnings.map((msg, i) => {
                                    const grMatch = msg.match(/^(Gr (\d+) Sem (\d+):)\s*(.*)/);
                                    return (
                                      <li key={i} className="flex items-start gap-1 text-xs text-foreground">
                                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-warning" />
                                        {grMatch ? (
                                          <span className="inline"><button type="button" onClick={() => navigateToGrade(Number(grMatch[2]), Number(grMatch[3]))} className="shrink-0 whitespace-nowrap font-medium text-primary hover:underline">{grMatch[1]}</button> {grMatch[4]}</span>
                                        ) : msg}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}

                          {/* Covered requirements */}
                          {met.length > 0 && (
                            <div className="rounded-lg border border-border">
                              <button type="button" onClick={() => setCoveredExpanded((v) => !v)} className="flex w-full items-center justify-between p-2.5 text-left">
                                <span className="text-xs font-semibold text-muted-foreground">Covered ({met.length})</span>
                                <svg aria-hidden="true" className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${coveredExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                              {coveredExpanded && (
                                <ul className="space-y-1.5 px-2.5 pb-2.5">
                                  {met.map((req) => (
                                    <li key={req.name}>
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className="flex items-center gap-1 text-xs">
                                          {req.status === "met" && <span className="text-success text-[10px]">&#x2713;</span>}
                                          {req.status === "in_progress" && <span className="text-primary text-[10px]">&#x25D0;</span>}
                                          {req.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{req.covered}/{req.required}</span>
                                      </div>
                                      <div className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
                                        {req.ePct > 0 && <div className="h-full bg-success" style={{ width: `${req.ePct}%` }} />}
                                        {req.pPct > 0 && <div className="h-full bg-primary/50" style={{ width: `${req.pPct}%` }} />}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {/* All clear message */}
                          {gaps.length === 0 && courseLoadWarnings.length === 0 && gpaWaiverWarnings.length === 0 && planWarnings.length === 0 && (
                            <div className="flex items-center gap-1.5 py-2 text-xs text-success">
                              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              All requirements met. No issues found.
                            </div>
                          )}
                          </div>{/* end scrollable body */}
                        </>
                      );
                    })()
                  ) : (
                    <p className="px-5 py-2 text-sm text-muted-foreground">Unable to load validation data.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </div>{/* end flex wrapper */}

      {/* Reset to Template button moved to plan header */}

      {/* Core course removal confirmation dialog */}
      {/* New plan modal */}
      {showNewPlanModal && renderNewPlanModal()}

      {/* Clear courses confirmation dialog */}
      {clearConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/30"
            onClick={() => setClearConfirm(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl"
              role="alertdialog"
              aria-modal="true"
              aria-label="Clear courses confirmation"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive-light">
                    <svg aria-hidden="true" className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {clearConfirm.type === "semester"
                        ? `Clear Semester ${clearConfirm.semester}?`
                        : `Clear Grade ${clearConfirm.gradeLevel}?`}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This will remove{" "}
                      <strong>
                        {clearConfirm.courseCount} course{clearConfirm.courseCount !== 1 ? "s" : ""}
                      </strong>{" "}
                      from{" "}
                      <strong>
                        {clearConfirm.type === "semester"
                          ? `Grade ${clearConfirm.gradeLevel}, Semester ${clearConfirm.semester}`
                          : `Grade ${clearConfirm.gradeLevel} (both semesters)`}
                      </strong>
                      . This action cannot be undone.
                    </p>
                    {selectedPlan?.createdFromTemplateId && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        You can restore courses using the &quot;Reset to Template&quot; button.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => setClearConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={executeClear}
                  disabled={clearing}
                >
                  {clearing ? "Clearing..." : `Clear ${clearConfirm.courseCount} Course${clearConfirm.courseCount !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete plan confirmation dialog */}
      {deletePlanConfirm && selectedPlan && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/30"
            onClick={() => setDeletePlanConfirm(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl"
              role="alertdialog"
              aria-modal="true"
              aria-label="Delete plan confirmation"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive-light">
                    <svg aria-hidden="true" className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Delete plan?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Are you sure you want to delete <strong>{selectedPlan.name}</strong>? This will permanently remove the plan and all its courses. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => setDeletePlanConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeletePlan}
                  disabled={deletingPlan}
                >
                  {deletingPlan ? "Deleting..." : "Delete Plan"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {coreRemoveConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/30"
            onClick={() => setCoreRemoveConfirm(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl"
              role="alertdialog"
              aria-modal="true"
              aria-label="Remove core course confirmation"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-light">
                    <svg aria-hidden="true" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Remove core course?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <strong>{coreRemoveConfirm.courseName}</strong> is part of the <strong>{coreRemoveConfirm.templateName}</strong> template. Removing it may change the purpose of this plan.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      You can always reset the plan back to the original template.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => setCoreRemoveConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const id = coreRemoveConfirm.planCourseId;
                    setCoreRemoveConfirm(null);
                    await doRemoveCourse(id);
                  }}
                >
                  Remove Anyway
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Course Picker */}
      {pickerTarget && selectedPlanId && (() => {
        const otherSem = pickerTarget.semester === 1 ? 2 : 1;
        const fullYearCount = courses.filter(
          (c) => c.gradeLevel === pickerTarget.gradeLevel && c.semester === null
        ).length;
        const otherSemCount = courses.filter(
          (c) => c.gradeLevel === pickerTarget.gradeLevel && c.semester === otherSem
        ).length + fullYearCount;
        const otherHasEarlyBird = courses
          .filter((c) => c.gradeLevel === pickerTarget.gradeLevel && (c.semester === otherSem || c.semester === null))
          .some((c) => (c.name ?? "").toLowerCase().includes("early bird") || /E\d$/.test(c.code ?? "") || /E\d\//.test(c.code ?? ""));
        const otherMax = otherHasEarlyBird ? 8 : 7;

        // Collect all course IDs and names already in the plan
        const existingIds = new Set(courses.map((c) => c.courseId));
        const existingNames = new Set(courses.map((c) => c.name));

        return (
          <CoursePicker
            isOpen={!!pickerTarget}
            onClose={() => setPickerTarget(null)}
            gradeLevel={pickerTarget.gradeLevel}
            semester={pickerTarget.semester}
            planId={selectedPlanId}
            otherSemesterAtMax={otherSemCount >= otherMax}
            existingCourseIds={existingIds}
            existingCourseNames={existingNames}
            onAddCourse={handlePickerAddCourse}
            onViewDetails={(courseId) => setDetailCourseId(courseId)}
            lastViewedCourseId={lastViewedCourseId}
          />
        );
      })()}

      {/* Course Detail Modal — stacks over planner and course picker */}
      {detailCourseId && (
        <CourseDetailModal
          courseId={detailCourseId}
          onClose={() => { setLastViewedCourseId(detailCourseId); setDetailCourseId(null); }}
          onCourseNavigate={(id) => setDetailCourseId(id)}
          zIndex={70}
          hideAddButton={!pickerTarget}
          onDirectAdd={pickerTarget ? (cid) => {
            handlePickerAddCourse(cid, true);
            setDetailCourseId(null);
          } : undefined}
        />
      )}
      {/* Unlock grade confirmation dialog */}
      {unlockConfirm !== null && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/30"
            onClick={() => setUnlockConfirm(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl"
              role="alertdialog"
              aria-modal="true"
              aria-label="Unlock grade confirmation"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-light">
                    <svg aria-hidden="true" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Unlock Grade {unlockConfirm}?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This will allow editing completed courses in Grade {unlockConfirm} — including
                      changing statuses, grades, and removing courses. You can re-lock it when done.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => setUnlockConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    handleToggleGradeLock(unlockConfirm, false);
                    setUnlockConfirm(null);
                  }}
                >
                  Unlock Grade {unlockConfirm}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={closeUpgradeModal}
        feature={upgradeModal.feature}
        minimumTier={upgradeModal.minimumTier}
        currentTier={upgradeModal.currentTier}
      />
    </div>
  );
}
