import { db } from "@/lib/db";
import {
  gpaSnapshots,
  planCourses,
  courses,
} from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { calculateGPA } from "@/lib/gpa/calc";

/**
 * Create a semester_end GPA snapshot if one doesn't already exist today.
 * Called when:
 *   1. All courses in a semester are completed with grades
 *   2. Student clicks "Complete Semester" in year-end wizard
 *   3. Student locks a grade level in the planner
 *
 * Deduplicates by checking for an existing semester_end snapshot for the
 * same student on the same day.
 */
export async function maybeCreateSemesterSnapshot(params: {
  studentId: string;
  accountId: string;
  planId: string;
}): Promise<boolean> {
  const { studentId, accountId, planId } = params;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Run dedup check and course fetch in parallel
    const [existing, completedCourses] = await Promise.all([
      db
        .select({ id: gpaSnapshots.id })
        .from(gpaSnapshots)
        .where(
          and(
            eq(gpaSnapshots.studentId, studentId),
            eq(gpaSnapshots.trigger, "semester_end"),
            gte(gpaSnapshots.snapshotDate, today)
          )
        )
        .limit(1),
      db
        .select({
          creditValue: courses.creditValue,
          creditType: courses.creditType,
          plannedGrade: planCourses.plannedGrade,
          status: planCourses.status,
          gpaWaiver: courses.gpaWaiver,
        })
        .from(planCourses)
        .innerJoin(courses, eq(planCourses.courseId, courses.id))
        .where(
          and(eq(planCourses.planId, planId), eq(planCourses.status, "completed"))
        ),
    ]);

    if (existing.length > 0) return false; // Already snapshotted today
    if (completedCourses.length === 0) return false;

    const gpaInput = completedCourses.map((c) => ({
      creditValue: c.creditValue,
      creditType: c.creditType,
      plannedGrade: c.plannedGrade,
      status: "completed" as const,
      gpaWaiver: c.gpaWaiver ?? false,
      gpaWaiverApplied: false,
    }));

    const result = calculateGPA(gpaInput, "actual");
    if (result.unweighted === null) return false;

    await db.insert(gpaSnapshots).values({
      studentId,
      accountId,
      trigger: "semester_end",
      cumulativeGpa: String(result.unweighted),
      weightedGpa:
        result.weighted !== null ? String(result.weighted) : null,
      creditsEarned: String(result.totalCredits),
      creditsAttempted: String(result.totalCredits),
    });

    return true;
  } catch (err) {
    console.error("[snapshot] maybeCreateSemesterSnapshot failed:", err);
    return false;
  }
}

/**
 * Check if all courses in a specific semester of a plan are completed with grades.
 * Returns true if every course in (planId, gradeLevel, semester) has status "completed"
 * and a non-null plannedGrade.
 */
export async function allSemesterCoursesCompleted(params: {
  planId: string;
  gradeLevel: number;
  semester: number;
}): Promise<boolean> {
  const { planId, gradeLevel, semester } = params;

  const semCourses = await db
    .select({
      status: planCourses.status,
      plannedGrade: planCourses.plannedGrade,
    })
    .from(planCourses)
    .where(
      and(
        eq(planCourses.planId, planId),
        eq(planCourses.gradeLevel, gradeLevel),
        eq(planCourses.semester, semester)
      )
    );

  if (semCourses.length === 0) return false;

  return semCourses.every(
    (c) => c.status === "completed" && c.plannedGrade !== null
  );
}
