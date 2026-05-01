import { type APIRequestContext, expect } from "@playwright/test";

/**
 * Typed API wrappers for SAPS v1 endpoints. Used by tests to set up
 * deterministic state (create plans, add courses, etc.) without going
 * through the UI. Requires authenticated request context.
 */

export interface Plan {
  id: string;
  name: string;
  schoolYear: string | null;
  status: string;
  isPrimary: boolean;
  createdBy: string | null;
  courseCount?: number;
}

export interface PlanCourse {
  id: string;
  courseId: string;
  gradeLevel: number;
  semester: number | null;
  status: string;
  plannedGrade: string | null;
  gpaWaiverApplied: boolean;
  prereqOverridden?: boolean;
}

export interface GpaResult {
  cumulative: { unweighted: number; weighted: number; credits: number; courses: number };
  projected: { unweighted: number; weighted: number; credits: number; courses: number };
  plan: { totalCredits: number; earnedCredits: number; totalCourses: number };
  hasGrades: boolean;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  creditType: string;
  creditValue: string;
  duration: string;
  isAp: boolean;
}

// ── Plans ──────────────────────────────────────────────────────────────────

export async function listPlans(request: APIRequestContext): Promise<Plan[]> {
  const res = await request.get("/api/v1/plans");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data.plans ?? data.data ?? [];
}

export async function getPrimaryPlan(request: APIRequestContext): Promise<Plan> {
  const plans = await listPlans(request);
  const primary = plans.find((p) => p.isPrimary);
  if (!primary) throw new Error("No primary plan found");
  return primary;
}

export async function createPlan(
  request: APIRequestContext,
  name: string,
  opts: { schoolYear?: string; fromTemplateId?: string } = {}
): Promise<Plan> {
  const res = await request.post("/api/v1/plans", {
    data: {
      name,
      school_year: opts.schoolYear,
      from_template_id: opts.fromTemplateId,
    },
  });
  const body = await res.json();
  if (res.status() !== 201) {
    throw new Error(`createPlan failed (${res.status()}): ${JSON.stringify(body)}`);
  }
  return body.plan ?? body.data ?? body;
}

export async function deletePlan(request: APIRequestContext, planId: string) {
  const res = await request.delete(`/api/v1/plans/${planId}`);
  return res;
}

/**
 * Force-delete a plan: first removes all courses (including completed ones,
 * which the DELETE /plans/:id route rejects), then deletes the plan shell.
 */
export async function forceDeletePlan(
  request: APIRequestContext,
  planId: string
): Promise<void> {
  const courses = await listPlanCourses(request, planId).catch(() => []);
  for (const c of courses) {
    // Flip any completed course back to planned before removal so the
    // per-course delete endpoint (which also blocks completed removals)
    // accepts it.
    if (c.status === "completed") {
      await updatePlanCourse(request, planId, c.id, { status: "planned" }).catch(() => {});
    }
    await removePlanCourse(request, planId, c.id).catch(() => {});
  }
  await deletePlan(request, planId).catch(() => {});
}

/**
 * Delete all non-primary plans owned by the student. Used at the start of
 * mutation-heavy test files to ensure the plan count cap is not reached by
 * leftovers from prior runs or parallel tests. Uses forceDeletePlan so
 * plans with completed courses (which the DELETE route normally rejects)
 * are cleaned up too.
 */
export async function resetToPrimaryPlanOnly(request: APIRequestContext): Promise<void> {
  const plans = await listPlans(request);
  for (const plan of plans) {
    if (!plan.isPrimary) {
      await forceDeletePlan(request, plan.id);
    }
  }
}

// ── Courses (catalog) ──────────────────────────────────────────────────────

export async function findCourseByCode(
  request: APIRequestContext,
  code: string
): Promise<Course | null> {
  // The catalog API uses `q` (not `search`) and ILIKEs against name+code.
  const res = await request.get(`/api/v1/courses?q=${encodeURIComponent(code)}&limit=100`);
  if (!res.ok()) return null;
  const data = await res.json();
  const courses: Course[] = data.courses ?? data.data ?? [];
  return courses.find((c) => c.code === code) ?? null;
}

export async function getCoursesByCredit(
  request: APIRequestContext,
  creditType: string,
  limit = 5
): Promise<Course[]> {
  const res = await request.get(`/api/v1/courses?credit_type=${creditType}&limit=${limit}`);
  if (!res.ok()) return [];
  const data = await res.json();
  return data.courses ?? data.data ?? [];
}

/**
 * Get semester-only courses (duration='semester') for safe single-slot adds.
 * Full-year courses (duration='full-year') require both semesters paired,
 * so tests that only add to one slot must use semester courses.
 */
export async function getSemesterCourses(
  request: APIRequestContext,
  limit = 20
): Promise<Course[]> {
  const res = await request.get(`/api/v1/courses?duration=semester&limit=${limit}`);
  if (!res.ok()) return [];
  const data = await res.json();
  const courses: Course[] = data.courses ?? data.data ?? [];
  return courses.filter((c) => c.duration === "semester");
}

// ── Plan courses ───────────────────────────────────────────────────────────

export async function listPlanCourses(
  request: APIRequestContext,
  planId: string
): Promise<PlanCourse[]> {
  const res = await request.get(`/api/v1/plans/${planId}/courses`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const raw = data.data ?? data;

  // Response can be flat array OR grouped by grade > semester. Flatten both.
  if (Array.isArray(raw)) return raw;
  const flat: PlanCourse[] = [];
  for (const gradeKey of Object.keys(raw)) {
    const semesters = raw[gradeKey];
    if (typeof semesters === "object" && semesters !== null) {
      for (const semKey of Object.keys(semesters)) {
        const arr = semesters[semKey];
        if (Array.isArray(arr)) flat.push(...arr);
      }
    }
  }
  return flat;
}

export async function addCourseToPlan(
  request: APIRequestContext,
  planId: string,
  payload: {
    courseId: string;
    gradeLevel: number;
    semester: number | null;
    plannedGrade?: string;
    status?: "planned" | "enrolled" | "completed" | "dropped";
    forceAdd?: boolean;
  }
) {
  const res = await request.post(`/api/v1/plans/${planId}/courses`, {
    data: {
      course_id: payload.courseId,
      grade_level: payload.gradeLevel,
      semester: payload.semester,
      planned_grade: payload.plannedGrade,
      status: payload.status,
      force_add: payload.forceAdd ?? false,
    },
  });
  return res;
}

export async function updatePlanCourse(
  request: APIRequestContext,
  planId: string,
  planCourseId: string,
  updates: Partial<{
    plannedGrade: string;
    status: "planned" | "enrolled" | "completed" | "dropped";
    gpaWaiverApplied: boolean;
    semester: number;
    prereqOverridden: boolean;
  }>
) {
  const body: Record<string, unknown> = {};
  if (updates.plannedGrade !== undefined) body.planned_grade = updates.plannedGrade;
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.gpaWaiverApplied !== undefined) body.gpa_waiver_applied = updates.gpaWaiverApplied;
  if (updates.semester !== undefined) body.semester = updates.semester;
  if (updates.prereqOverridden !== undefined) body.prereq_overridden = updates.prereqOverridden;

  const res = await request.patch(`/api/v1/plans/${planId}/courses/${planCourseId}`, {
    data: body,
  });
  // Surface the actual failure instead of letting silent non-2xx leak into
  // a confusing assertion later.
  if (!res.ok()) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `PATCH /api/v1/plans/${planId}/courses/${planCourseId} failed: ${res.status()} ${text.slice(0, 200)}`,
    );
  }
  return res;
}

export async function removePlanCourse(
  request: APIRequestContext,
  planId: string,
  planCourseId: string
) {
  const res = await request.delete(`/api/v1/plans/${planId}/courses/${planCourseId}`);
  return res;
}

export async function bulkOverridePrereqs(
  request: APIRequestContext,
  planId: string,
  planCourseIds: string[],
  overridden: boolean
): Promise<{ updatedCount: number; overridden: boolean }> {
  const res = await request.post(`/api/v1/plans/${planId}/courses/bulk-override`, {
    data: { plan_course_ids: planCourseIds, overridden },
  });
  if (!res.ok()) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `POST /api/v1/plans/${planId}/courses/bulk-override failed: ${res.status()} ${text.slice(0, 200)}`,
    );
  }
  const body = await res.json();
  return body.data ?? body;
}

// ── Validation ─────────────────────────────────────────────────────────────

export async function validatePlan(
  request: APIRequestContext,
  planId: string
): Promise<{
  valid: boolean;
  courseViolations: Array<{ courseId: string; violations: Array<{ type: string }> }>;
  ignoredCourseViolations: Array<{ courseId: string; violations: Array<{ type: string }> }>;
}> {
  const res = await request.get(`/api/v1/plans/${planId}/validate`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const v = data.data ?? data;
  return {
    valid: v.valid ?? false,
    courseViolations: v.courseViolations ?? v.violations ?? [],
    ignoredCourseViolations: v.ignoredCourseViolations ?? [],
  };
}

// ── GPA ────────────────────────────────────────────────────────────────────

export async function getGpa(request: APIRequestContext): Promise<GpaResult> {
  const res = await request.get("/api/v1/gpa");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data.data ?? data;
}

// ── Requirements ───────────────────────────────────────────────────────────

export async function getRequirements(request: APIRequestContext, planId?: string) {
  const url = planId ? `/api/v1/requirements?planId=${planId}` : "/api/v1/requirements";
  const res = await request.get(url);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data.data ?? data;
}

// ── Year-end ───────────────────────────────────────────────────────────────

export async function getYearEnd(request: APIRequestContext, grade?: number) {
  const url = grade ? `/api/v1/year-end?grade=${grade}` : "/api/v1/year-end";
  const res = await request.get(url);
  return res;
}

// ── Accounts ───────────────────────────────────────────────────────────────

export async function listAccountMembers(request: APIRequestContext, accountId: string) {
  const res = await request.get(`/api/v1/accounts/${accountId}/members`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data.data?.members ?? [];
}

export async function getCurrentAccount(request: APIRequestContext) {
  const res = await request.get("/api/v1/accounts");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const accounts = data.accounts ?? data.data ?? [];
  return accounts[0];
}

// ── Plan shares ────────────────────────────────────────────────────────────

export async function listPlanShares(
  request: APIRequestContext,
  planId: string
) {
  const res = await request.get(`/api/v1/plans/${planId}/shares`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data.shares ?? data.data ?? [];
}

export async function sharePlan(
  request: APIRequestContext,
  planId: string,
  userId: string,
  permission: "view" | "edit" | "delete"
) {
  return request.post(`/api/v1/plans/${planId}/shares`, {
    data: { user_id: userId, permission },
  });
}

export async function revokePlanShare(
  request: APIRequestContext,
  planId: string,
  userId: string
) {
  return request.delete(`/api/v1/plans/${planId}/shares/${userId}`);
}

// ── Grade lock ─────────────────────────────────────────────────────────────

export async function lockGrade(
  request: APIRequestContext,
  planId: string,
  gradeLevel: number
) {
  return request.post(`/api/v1/plans/${planId}/lock-grade`, {
    data: { grade_level: gradeLevel, locked: true },
  });
}

export async function unlockGrade(
  request: APIRequestContext,
  planId: string,
  gradeLevel: number
) {
  return request.post(`/api/v1/plans/${planId}/lock-grade`, {
    data: { grade_level: gradeLevel, locked: false },
  });
}
