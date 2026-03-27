import { db } from "@/lib/db";
import {
  fourYearPlans,
  planCourses,
  courses,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";

/**
 * GET /api/v1/plans/templates
 *
 * Returns all plan templates with their course lists.
 * No authentication required — templates are public reference data.
 */
export async function GET() {
  try {
    // Get all template plans
    const templatePlans = await db
      .select({
        id: fourYearPlans.id,
        name: fourYearPlans.name,
        schoolYear: fourYearPlans.schoolYear,
      })
      .from(fourYearPlans)
      .where(eq(fourYearPlans.isTemplate, true))
      .orderBy(fourYearPlans.name);

    if (templatePlans.length === 0) {
      return successResponse([]);
    }

    // For each template, get its courses
    const result = await Promise.all(
      templatePlans.map(async (template) => {
        const templateCourses = await db
          .select({
            code: courses.code,
            name: courses.name,
            gradeLevel: planCourses.gradeLevel,
            semester: planCourses.semester,
            creditType: courses.creditType,
          })
          .from(planCourses)
          .innerJoin(courses, eq(planCourses.courseId, courses.id))
          .where(eq(planCourses.planId, template.id))
          .orderBy(planCourses.gradeLevel, planCourses.semester, planCourses.displayOrder);

        return {
          id: template.id,
          name: template.name,
          courseCount: templateCourses.length,
          courses: templateCourses,
        };
      })
    );

    return successResponse(result);
  } catch (error) {
    console.error("[plans/templates] Unexpected error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
