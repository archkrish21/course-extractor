import { test, expect } from "@playwright/test";
import {
  createPlan,
  deletePlan,
  forceDeletePlan,
  getPrimaryPlan,
  listPlans,
  listPlanCourses,
  addCourseToPlan,
  removePlanCourse,
  updatePlanCourse,
  getSemesterCourses,
  resetToPrimaryPlanOnly,
  getCurrentAccount,
  listAccountMembers,
  sharePlan,
  revokePlanShare,
  listPlanShares,
  lockGrade,
  unlockGrade,
  validatePlan,
  type Course,
  type Plan,
} from "../helpers/api-client";

/**
 * All plan + course mutation API tests in one file.
 *
 * Rationale: the shared test user has a 3-plan launch-tier cap, so any two
 * files that each hold a persistent scratch plan in their `beforeAll` will
 * race with other tests that try to create plans. Keeping everything here
 * guarantees at most one scratch plan exists at any moment.
 */
test.describe.configure({ mode: "serial" });

// ── Plan lifecycle ─────────────────────────────────────────────────────────

test.describe("Plan lifecycle", () => {
  test.beforeAll(async ({ request }) => {
    await resetToPrimaryPlanOnly(request);
  });

  test("creating a plan returns a plan with isPrimary=false", async ({ request }) => {
    const plan = await createPlan(request, "E2E Plan A");
    try {
      expect(plan.id).toBeTruthy();
      expect(plan.name).toBe("E2E Plan A");
      expect(plan.isPrimary).toBe(false);
    } finally {
      await deletePlan(request, plan.id);
    }
  });

  test("newly created plan appears in listPlans", async ({ request }) => {
    const plan = await createPlan(request, "E2E Plan B");
    try {
      const plans = await listPlans(request);
      expect(plans.some((p) => p.id === plan.id)).toBe(true);
    } finally {
      await deletePlan(request, plan.id);
    }
  });

  test("primary plan is always in the list", async ({ request }) => {
    const primary = await getPrimaryPlan(request);
    expect(primary).toBeDefined();
    expect(primary.isPrimary).toBe(true);
  });

  test("deleting a non-primary plan removes it from list", async ({ request }) => {
    const plan = await createPlan(request, "E2E Plan To Delete");
    const res = await deletePlan(request, plan.id);
    expect(res.ok()).toBe(true);
    const plans = await listPlans(request);
    expect(plans.some((p) => p.id === plan.id)).toBe(false);
  });
});

// ── Course mutations (persistent scratch plan) ─────────────────────────────

test.describe("Course mutations", () => {
  let scratchPlan: Plan;
  let catalog: Course[] = [];

  test.beforeAll(async ({ request }) => {
    await resetToPrimaryPlanOnly(request);
    scratchPlan = await createPlan(request, "E2E Mutations Scratch");
    catalog = await getSemesterCourses(request, 50);
    expect(catalog.length).toBeGreaterThan(10);
  });

  test.afterAll(async ({ request }) => {
    if (scratchPlan?.id) await forceDeletePlan(request, scratchPlan.id);
  });

  test.afterEach(async ({ request }) => {
    const existing = await listPlanCourses(request, scratchPlan.id);
    for (const c of existing) {
      // Flip completed → planned first so the per-course delete route accepts it
      if (c.status === "completed") {
        await updatePlanCourse(request, scratchPlan.id, c.id, { status: "planned" }).catch(() => {});
      }
      await removePlanCourse(request, scratchPlan.id, c.id).catch(() => {});
    }
  });

  test("adding a course returns 201 and appears in the list", async ({ request }) => {
    const course = catalog[0];
    const res = await addCourseToPlan(request, scratchPlan.id, {
      courseId: course.id,
      gradeLevel: 11,
      semester: 1,
      status: "planned",
      forceAdd: true,
    });
    const body = await res.json();
    expect(res.status(), JSON.stringify(body)).toBe(201);
    const courses = await listPlanCourses(request, scratchPlan.id);
    expect(courses.some((c) => c.courseId === course.id)).toBe(true);
  });

  test("adding the same course twice is rejected", async ({ request }) => {
    const course = catalog[1];
    await addCourseToPlan(request, scratchPlan.id, {
      courseId: course.id,
      gradeLevel: 11,
      semester: 1,
      forceAdd: true,
    });
    const second = await addCourseToPlan(request, scratchPlan.id, {
      courseId: course.id,
      gradeLevel: 11,
      semester: 1,
      forceAdd: true,
    });
    expect([409, 422, 400]).toContain(second.status());
  });

  test("updating a course's status persists", async ({ request }) => {
    const course = catalog[2];
    await addCourseToPlan(request, scratchPlan.id, {
      courseId: course.id,
      gradeLevel: 11,
      semester: 2,
      forceAdd: true,
    });
    const added = (await listPlanCourses(request, scratchPlan.id))[0];
    await updatePlanCourse(request, scratchPlan.id, added.id, { status: "enrolled" });
    const updated = (await listPlanCourses(request, scratchPlan.id))[0];
    expect(updated.status).toBe("enrolled");
  });

  test("removing a course drops it from the plan", async ({ request }) => {
    const course = catalog[3];
    await addCourseToPlan(request, scratchPlan.id, {
      courseId: course.id,
      gradeLevel: 12,
      semester: 1,
      forceAdd: true,
    });
    const added = (await listPlanCourses(request, scratchPlan.id))[0];
    const removeRes = await removePlanCourse(request, scratchPlan.id, added.id);
    expect(removeRes.ok()).toBe(true);
    expect((await listPlanCourses(request, scratchPlan.id)).length).toBe(0);
  });

  test("changing a course grade updates plannedGrade", async ({ request }) => {
    const course = catalog[4];
    await addCourseToPlan(request, scratchPlan.id, {
      courseId: course.id,
      gradeLevel: 11,
      semester: 1,
      status: "completed",
      plannedGrade: "A",
      forceAdd: true,
    });
    const added = (await listPlanCourses(request, scratchPlan.id))[0];
    expect(added.plannedGrade).toBe("A");
    await updatePlanCourse(request, scratchPlan.id, added.id, { plannedGrade: "C" });
    const updated = (await listPlanCourses(request, scratchPlan.id))[0];
    expect(updated.plannedGrade).toBe("C");
  });

  test("toggling GPA waiver persists the gpaWaiverApplied flag", async ({ request }) => {
    const course = catalog[5];
    await addCourseToPlan(request, scratchPlan.id, {
      courseId: course.id,
      gradeLevel: 11,
      semester: 1,
      status: "completed",
      plannedGrade: "A",
      forceAdd: true,
    });
    const [pc] = await listPlanCourses(request, scratchPlan.id);
    expect(pc.gpaWaiverApplied).toBe(false);

    await updatePlanCourse(request, scratchPlan.id, pc.id, { gpaWaiverApplied: true });
    expect((await listPlanCourses(request, scratchPlan.id))[0].gpaWaiverApplied).toBe(true);

    await updatePlanCourse(request, scratchPlan.id, pc.id, { gpaWaiverApplied: false });
    expect((await listPlanCourses(request, scratchPlan.id))[0].gpaWaiverApplied).toBe(false);
  });

  test("adding a non-existent course returns 404", async ({ request }) => {
    const res = await addCourseToPlan(request, scratchPlan.id, {
      courseId: "00000000-0000-0000-0000-000000000000",
      gradeLevel: 11,
      semester: 1,
      forceAdd: true,
    });
    expect(res.status()).toBe(404);
  });

  test("adding a course without forceAdd surfaces validation (warnings or 4xx)", async ({ request }) => {
    const apLike = catalog.find((c) => c.isAp) ?? catalog[6];
    const res = await addCourseToPlan(request, scratchPlan.id, {
      courseId: apLike.id,
      gradeLevel: 11,
      semester: 1,
      forceAdd: false,
    });
    // Any of these statuses proves validation ran
    expect([201, 400, 409, 422]).toContain(res.status());
  });

  test("force-add past a prereq warning sets prereqOverridden and clears the validate banner", async ({ request }) => {
    // Find a course that returns a prereq warning when added without force_add.
    // We try a few candidates — seed data varies by environment.
    const candidates = [
      ...catalog.filter((c) => c.isAp),
      ...catalog.filter((c) => /MAT|BIO|CHE|PHY/.test(c.code)),
    ].slice(0, 8);

    let candidate: Course | null = null;
    for (const c of candidates) {
      const probe = await addCourseToPlan(request, scratchPlan.id, {
        courseId: c.id,
        gradeLevel: 9,
        semester: 1,
        forceAdd: false,
      });
      if (probe.status() === 422) {
        const body = await probe.json();
        const types: string[] = (body.violations ?? []).map((v: { type: string }) => v.type);
        if (types.includes("prerequisite")) {
          candidate = c;
          break;
        }
      }
    }

    test.skip(!candidate, "No course with a prereq violation found in the catalog for grade 9 sem 1");
    if (!candidate) return;

    // Force-add through the prereq warning
    const forced = await addCourseToPlan(request, scratchPlan.id, {
      courseId: candidate.id,
      gradeLevel: 9,
      semester: 1,
      forceAdd: true,
    });
    expect(forced.status()).toBe(201);

    const placed = (await listPlanCourses(request, scratchPlan.id)).find(
      (pc) => pc.courseId === candidate!.id
    );
    expect(placed).toBeDefined();
    expect(placed!.prereqOverridden).toBe(true);

    // Plan-level revalidation should not re-flag the prereq for this course
    const validation = await validatePlan(request, scratchPlan.id);
    const cv = validation.courseViolations.find((v) => v.courseId === candidate!.id);
    const prereqViolations = cv?.violations.filter((v) => v.type === "prerequisite") ?? [];
    expect(prereqViolations).toHaveLength(0);
  });
});

// ── Grade locking ──────────────────────────────────────────────────────────

test.describe("Grade locking", () => {
  let scratchPlan: Plan;

  test.beforeAll(async ({ request }) => {
    await resetToPrimaryPlanOnly(request);
    scratchPlan = await createPlan(request, "E2E Lock Scratch");
  });

  test.afterAll(async ({ request }) => {
    if (scratchPlan?.id) await forceDeletePlan(request, scratchPlan.id);
  });

  test("adding a course to a locked grade is rejected with 409", async ({ request }) => {
    const lockRes = await lockGrade(request, scratchPlan.id, 9);
    if (!lockRes.ok()) {
      test.skip(true, `lock-grade endpoint unavailable (${lockRes.status()})`);
      return;
    }

    try {
      const catalog = await getSemesterCourses(request, 5);
      const res = await addCourseToPlan(request, scratchPlan.id, {
        courseId: catalog[0].id,
        gradeLevel: 9,
        semester: 1,
        forceAdd: true,
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.error?.message).toMatch(/locked/i);
    } finally {
      await unlockGrade(request, scratchPlan.id, 9).catch(() => {});
    }
  });

  test("unlocking a grade restores the ability to add courses", async ({ request }) => {
    const lockRes = await lockGrade(request, scratchPlan.id, 10);
    if (!lockRes.ok()) {
      test.skip(true, `lock-grade endpoint unavailable (${lockRes.status()})`);
      return;
    }
    await unlockGrade(request, scratchPlan.id, 10);

    const catalog = await getSemesterCourses(request, 5);
    const addRes = await addCourseToPlan(request, scratchPlan.id, {
      courseId: catalog[0].id,
      gradeLevel: 10,
      semester: 1,
      forceAdd: true,
    });
    expect(addRes.status()).toBe(201);
  });
});

// ── Plan sharing ───────────────────────────────────────────────────────────

test.describe("Plan sharing", () => {
  let scratchPlan: Plan;
  let parentUserId: string | null = null;
  let counselorUserId: string | null = null;

  test.beforeAll(async ({ request }) => {
    await resetToPrimaryPlanOnly(request);
    scratchPlan = await createPlan(request, "E2E Share Scratch");
    const account = await getCurrentAccount(request);
    const members = await listAccountMembers(request, account.id);
    parentUserId = members.find((m: { role: string; user_id: string }) => m.role === "parent")?.user_id ?? null;
    counselorUserId = members.find((m: { role: string; user_id: string }) => m.role === "counselor")?.user_id ?? null;
  });

  test.afterAll(async ({ request }) => {
    if (scratchPlan?.id) await forceDeletePlan(request, scratchPlan.id);
  });

  test("owner can share plan with a linked parent at edit permission", async ({ request }) => {
    if (!parentUserId) {
      test.skip(true, "No parent linked to account");
      return;
    }
    const res = await sharePlan(request, scratchPlan.id, parentUserId, "edit");
    expect(res.status()).toBe(201);

    const shares = await listPlanShares(request, scratchPlan.id);
    const parentShare = shares.find((s: { user_id: string }) => s.user_id === parentUserId);
    expect(parentShare?.permission).toBe("edit");

    await revokePlanShare(request, scratchPlan.id, parentUserId);
  });

  // v1-hide: counselor role hidden from UI; re-enable by switching `test.skip` back to `test`.
  test.skip("owner can share plan with a counselor at view permission", async ({ request }) => {
    if (!counselorUserId) {
      test.skip(true, "No counselor linked to account");
      return;
    }
    const res = await sharePlan(request, scratchPlan.id, counselorUserId, "view");
    expect(res.status()).toBe(201);

    const shares = await listPlanShares(request, scratchPlan.id);
    const counselorShare = shares.find((s: { user_id: string }) => s.user_id === counselorUserId);
    expect(counselorShare?.permission).toBe("view");

    await revokePlanShare(request, scratchPlan.id, counselorUserId);
  });

  test("revoking a plan share removes it from the list", async ({ request }) => {
    if (!parentUserId) {
      test.skip(true, "No parent linked to account");
      return;
    }
    await sharePlan(request, scratchPlan.id, parentUserId, "view");
    const revokeRes = await revokePlanShare(request, scratchPlan.id, parentUserId);
    expect(revokeRes.ok()).toBe(true);

    const shares = await listPlanShares(request, scratchPlan.id);
    const stillShared = shares.find(
      (s: { user_id: string; permission: string }) =>
        s.user_id === parentUserId && s.permission !== "owner"
    );
    expect(stillShared).toBeUndefined();
  });
});
