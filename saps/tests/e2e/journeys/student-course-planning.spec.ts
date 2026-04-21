import { test, expect } from "@playwright/test";
import {
  createPlan,
  deletePlan,
  forceDeletePlan,
  listPlanCourses,
  addCourseToPlan,
  getSemesterCourses,
  resetToPrimaryPlanOnly,
  type Plan,
} from "../helpers/api-client";

/**
 * Student journey: add a graded completed course to a scratch plan and
 * verify the course data persists end-to-end.
 *
 * Plan creation happens INSIDE the test (not beforeAll) so it doesn't hold
 * a plan slot across parallel test files and hit the 3-plan launch cap.
 */
test.use({ storageState: "./tests/e2e/.auth/student.json" });

test("adding a completed+graded course persists and appears in planCourses", async ({ request }) => {
  await resetToPrimaryPlanOnly(request);
  let plan: Plan | null = null;
  try {
    plan = await createPlan(request, "E2E Journey Plan");
    const catalog = await getSemesterCourses(request, 20);
    const course = catalog[0];
    expect(course).toBeDefined();

    const res = await addCourseToPlan(request, plan.id, {
      courseId: course.id,
      gradeLevel: 11,
      semester: 1,
      status: "completed",
      plannedGrade: "A",
      forceAdd: true,
    });
    expect(res.status()).toBe(201);

    const courses = await listPlanCourses(request, plan.id);
    const added = courses.find((c) => c.courseId === course.id);
    expect(added).toBeDefined();
    expect(added!.status).toBe("completed");
    expect(added!.plannedGrade).toBe("A");
  } finally {
    if (plan?.id) await forceDeletePlan(request, plan.id);
  }
});
