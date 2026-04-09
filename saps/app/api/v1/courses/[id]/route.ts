import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  courses,
  divisions,
  departments,
  coursePrerequisites,
} from "@/lib/db/schema";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getEquivalents } from "@/config/summer-equivalents";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return errorResponse("INVALID_ID", "Invalid course ID format.", 400);
    }

    // Fetch course with division and department
    const course = await db
      .select({
        id: courses.id,
        code: courses.code,
        name: courses.name,
        description: courses.description,
        creditValue: courses.creditValue,
        duration: courses.duration,
        gradeLevels: courses.gradeLevels,
        creditType: courses.creditType,
        isAp: courses.isAp,
        isDualCredit: courses.isDualCredit,
        isHonors: courses.isHonors,
        gpaWaiver: courses.gpaWaiver,
        semestersOffered: courses.semestersOffered,
        maxEnrollment: courses.maxEnrollment,
        isActive: courses.isActive,
        notes: courses.notes,
        catalogVersionId: courses.catalogVersionId,
        divisionId: courses.divisionId,
        divisionName: divisions.name,
        divisionCode: divisions.code,
        departmentId: courses.departmentId,
        departmentName: departments.name,
      })
      .from(courses)
      .innerJoin(divisions, eq(courses.divisionId, divisions.id))
      .leftJoin(departments, eq(courses.departmentId, departments.id))
      .where(eq(courses.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!course) {
      return errorResponse("NOT_FOUND", "Course not found.", 404);
    }

    // Fetch prerequisites (direct): courses this course requires
    const prerequisites = await db
      .select({
        id: coursePrerequisites.id,
        prerequisiteId: coursePrerequisites.prerequisiteId,
        relationshipType: coursePrerequisites.relationshipType,
        requirementGroup: coursePrerequisites.requirementGroup,
        minimumGrade: coursePrerequisites.minimumGrade,
        isRecommended: coursePrerequisites.isRecommended,
        notes: coursePrerequisites.notes,
        prerequisiteCode: sql<string>`prereq.code`.as("prerequisiteCode"),
        prerequisiteName: sql<string>`prereq.name`.as("prerequisiteName"),
      })
      .from(coursePrerequisites)
      .innerJoin(
        sql`courses AS prereq`,
        sql`prereq.id = ${coursePrerequisites.prerequisiteId}`
      )
      .where(
        and(
          eq(coursePrerequisites.courseId, id),
          eq(
            coursePrerequisites.catalogVersionId,
            course.catalogVersionId
          )
        )
      );

    // Fetch co-requisites
    const corequisites = prerequisites.filter(
      (p) => p.relationshipType === "corequisite"
    );
    const prereqs = prerequisites.filter(
      (p) => p.relationshipType === "prerequisite"
    );

    // Fetch downstream courses: courses that require this course as a prerequisite
    const downstream = await db
      .select({
        courseId: coursePrerequisites.courseId,
        courseCode: sql<string>`downstream.code`.as("downstreamCode"),
        courseName: sql<string>`downstream.name`.as("downstreamName"),
        relationshipType: coursePrerequisites.relationshipType,
      })
      .from(coursePrerequisites)
      .innerJoin(
        sql`courses AS downstream`,
        sql`downstream.id = ${coursePrerequisites.courseId}`
      )
      .where(
        and(
          eq(coursePrerequisites.prerequisiteId, id),
          eq(
            coursePrerequisites.catalogVersionId,
            course.catalogVersionId
          )
        )
      );

    // Fetch linked courses: same name (semester partners) + summer/regular equivalents
    const equivalentCodes = getEquivalents(course.code);

    const linkedCourses = await db
      .select({
        id: courses.id,
        code: courses.code,
        name: courses.name,
        semestersOffered: courses.semestersOffered,
      })
      .from(courses)
      .where(
        and(
          eq(courses.isActive, true),
          sql`${courses.id} != ${id}`,
          or(
            and(eq(courses.name, course.name), eq(courses.catalogVersionId, course.catalogVersionId)),
            equivalentCodes.length > 0 ? inArray(courses.code, equivalentCodes) : undefined,
          ),
        )
      );

    return successResponse({
      ...course,
      linkedCourses: linkedCourses.map((lc) => ({
        id: lc.id,
        code: lc.code,
        name: lc.name,
        semesters_offered: lc.semestersOffered,
      })),
      prerequisites: prereqs.map((p) => ({
        id: p.id,
        course_id: p.prerequisiteId,
        code: p.prerequisiteCode,
        name: p.prerequisiteName,
        requirement_group: p.requirementGroup,
        minimum_grade: p.minimumGrade,
        is_recommended: p.isRecommended,
        notes: p.notes,
      })),
      corequisites: corequisites.map((c) => ({
        id: c.id,
        course_id: c.prerequisiteId,
        code: c.prerequisiteCode,
        name: c.prerequisiteName,
        requirement_group: c.requirementGroup,
        notes: c.notes,
      })),
      unlocks: downstream.map((d) => ({
        course_id: d.courseId,
        code: d.courseCode,
        name: d.courseName,
        relationship_type: d.relationshipType,
      })),
    });
  } catch (error) {
    console.error("[courses/:id] Unexpected error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
