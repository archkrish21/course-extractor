import { db } from "@/lib/db";
import {
  courses,
  coursePrerequisites,
  planCourses,
  fourYearPlans,
} from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Violation {
  type:
    | "prerequisite"
    | "corequisite"
    | "enrollment_rule"
    | "grade_level"
    | "duplicate";
  courseId: string;
  courseName: string;
  courseCode: string;
  message: string;
  details?: {
    missingPrerequisites?: Array<{ code: string; name: string; group: number }>;
    requiredGradeLevels?: number[];
    conflictingCourseId?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

export interface PlanIntegrityResult {
  valid: boolean;
  violations: Violation[];
}

interface PlanCourseRow {
  id: string;
  courseId: string;
  gradeLevel: number;
  semester: number | null;
  status: string | null;
  course: {
    id: string;
    code: string;
    name: string;
    duration: string;
    gradeLevels: number[];
    semestersOffered: number[] | null;
    catalogVersionId: string;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Convert semester to sort order: S1(1) → S2(2) → Summer1(3) → Summer2(4).
 * Summer semesters (-2, -1) come AFTER the school year, so they sort higher.
 */
function semesterSortOrder(sem: number | null): number {
  switch (sem) {
    case 1: return 1;
    case 2: return 2;
    case -2: return 3; // Summer Session 1
    case -1: return 4; // Summer Session 2
    default: return 1; // null/full-year → treat as S1 for prereq ordering
  }
}

/**
 * Returns true if slotA is earlier than slotB.
 * Ordering: grade_level is the primary key, semester is secondary.
 * Within a grade: S1 → S2 → Summer S1 → Summer S2.
 * semester=null means full-year (spans both), counts as S1 for prereq purposes.
 */
function isEarlierSlot(
  gradeLevelA: number,
  semesterA: number | null,
  gradeLevelB: number,
  semesterB: number | null
): boolean {
  if (gradeLevelA < gradeLevelB) return true;
  if (gradeLevelA > gradeLevelB) return false;
  return semesterSortOrder(semesterA) < semesterSortOrder(semesterB);
}

/**
 * Returns true if slotA is the same or earlier than slotB.
 */
function isSameOrEarlierSlot(
  gradeLevelA: number,
  semesterA: number | null,
  gradeLevelB: number,
  semesterB: number | null
): boolean {
  if (gradeLevelA < gradeLevelB) return true;
  if (gradeLevelA > gradeLevelB) return false;
  return semesterSortOrder(semesterA) <= semesterSortOrder(semesterB);
}

/**
 * Returns true if two slots are in the same grade-level and semester.
 */
function isSameSlot(
  gradeLevelA: number,
  semesterA: number | null,
  gradeLevelB: number,
  semesterB: number | null
): boolean {
  return gradeLevelA === gradeLevelB && semesterA === semesterB;
}

// ─── Core Validation ───────────────────────────────────────────────────────

/**
 * Validates adding a course to a plan.
 * Returns { valid, violations } where violations may be warnings or errors.
 */
export async function validateCourseAddition(
  planId: string,
  courseId: string,
  gradeLevel: number,
  semester: number | null
): Promise<ValidationResult> {
  const violations: Violation[] = [];

  // 1. Fetch the course being added
  const [targetCourse] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      duration: courses.duration,
      gradeLevels: courses.gradeLevels,
      semestersOffered: courses.semestersOffered,
      catalogVersionId: courses.catalogVersionId,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!targetCourse) {
    return {
      valid: false,
      violations: [
        {
          type: "prerequisite",
          courseId,
          courseName: "Unknown",
          courseCode: "Unknown",
          message: "Course not found.",
        },
      ],
    };
  }

  // 2. Fetch all existing courses in the plan (with course details)
  const existingPlanCourses = await db
    .select({
      id: planCourses.id,
      courseId: planCourses.courseId,
      gradeLevel: planCourses.gradeLevel,
      semester: planCourses.semester,
      status: planCourses.status,
      course: {
        id: courses.id,
        code: courses.code,
        name: courses.name,
        duration: courses.duration,
        gradeLevels: courses.gradeLevels,
        semestersOffered: courses.semestersOffered,
        catalogVersionId: courses.catalogVersionId,
      },
    })
    .from(planCourses)
    .innerJoin(courses, eq(planCourses.courseId, courses.id))
    .where(eq(planCourses.planId, planId));

  // 3. Check duplicate: same course in the plan
  // For full-year courses: allow same courseId at same grade in different semesters (expected pattern)
  // Block: same courseId at a different grade, or same courseId+grade+semester
  const duplicates = existingPlanCourses.filter(
    (pc) =>
      pc.courseId === courseId &&
      pc.status !== "dropped"
  );
  for (const dup of duplicates) {
    const isSameGradeDiffSemester =
      dup.gradeLevel === gradeLevel &&
      dup.semester !== semester &&
      targetCourse.duration === "full_year";

    if (isSameGradeDiffSemester) {
      // This is expected for full-year courses (sem 1 + sem 2 at same grade) — not a duplicate
      continue;
    }

    violations.push({
      type: "duplicate",
      courseId: targetCourse.id,
      courseName: targetCourse.name,
      courseCode: targetCourse.code,
      message: `${targetCourse.code} is already in the plan at Grade ${dup.gradeLevel}, Semester ${dup.semester ?? "full year"}.`,
      details: { conflictingCourseId: dup.id },
    });
    break; // One duplicate violation is enough
  }

  // Also check semester partner: same course name (e.g., CSC162 when CSC161 is already planned)
  const semesterPartner = existingPlanCourses.find(
    (pc) =>
      pc.courseId !== courseId &&
      pc.course.name === targetCourse.name &&
      pc.course.duration === "semester" &&
      targetCourse.duration === "semester" &&
      pc.status !== "dropped"
  );
  if (semesterPartner) {
    violations.push({
      type: "duplicate",
      courseId: targetCourse.id,
      courseName: targetCourse.name,
      courseCode: targetCourse.code,
      message: `${semesterPartner.course.code} (${semesterPartner.course.name}) is already in the plan. This is the same course offered in a different semester.`,
      details: { conflictingCourseId: semesterPartner.id },
    });
  }

  // 4. Check grade-level eligibility
  if (
    targetCourse.gradeLevels &&
    !targetCourse.gradeLevels.includes(gradeLevel)
  ) {
    violations.push({
      type: "grade_level",
      courseId: targetCourse.id,
      courseName: targetCourse.name,
      courseCode: targetCourse.code,
      message: `${targetCourse.code} is not available for grade ${gradeLevel}. Available grades: ${targetCourse.gradeLevels.join(", ")}.`,
      details: { requiredGradeLevels: targetCourse.gradeLevels },
    });
  }

  // 5. Check enrollment rule: full_year courses must exist in both semesters
  // (Each semester is stored as a separate row; both must be present)
  if (targetCourse.duration === "full_year" && semester !== null) {
    const otherSemester = semester === 1 ? 2 : 1;
    const hasOtherSemester = existingPlanCourses.some(
      (pc) =>
        pc.courseId === courseId &&
        pc.gradeLevel === gradeLevel &&
        pc.semester === otherSemester &&
        pc.status !== "dropped"
    );
    // Only warn if this is a single add (the other semester will be added by the UI)
    // No violation here — the planner page handles adding both semesters automatically
  }

  // Semester courses must have a semester specified (1 or 2)
  if (targetCourse.duration === "semester" && semester === null) {
    violations.push({
      type: "enrollment_rule",
      courseId: targetCourse.id,
      courseName: targetCourse.name,
      courseCode: targetCourse.code,
      message: `${targetCourse.code} is a semester course and must be placed in semester 1 or 2.`,
    });
  }

  // 6. Check prerequisite violations
  const prereqs = await db
    .select({
      prerequisiteId: coursePrerequisites.prerequisiteId,
      relationshipType: coursePrerequisites.relationshipType,
      requirementGroup: coursePrerequisites.requirementGroup,
      isRecommended: coursePrerequisites.isRecommended,
      minimumGrade: coursePrerequisites.minimumGrade,
      prereqCode: courses.code,
      prereqName: courses.name,
    })
    .from(coursePrerequisites)
    .innerJoin(courses, eq(coursePrerequisites.prerequisiteId, courses.id))
    .where(
      and(
        eq(coursePrerequisites.courseId, courseId),
        eq(
          coursePrerequisites.catalogVersionId,
          targetCourse.catalogVersionId
        )
      )
    );

  // Separate prerequisites and corequisites
  const prerequisites = prereqs.filter(
    (p) => p.relationshipType === "prerequisite" && !p.isRecommended
  );
  const corequisites = prereqs.filter(
    (p) => p.relationshipType === "corequisite" && !p.isRecommended
  );

  // Group prerequisites by requirement_group
  // Same group = OR (any one satisfies), Different groups = AND (all groups must be satisfied)
  const prereqGroups = new Map<
    number,
    Array<{
      prerequisiteId: string;
      prereqCode: string;
      prereqName: string;
      requirementGroup: number;
    }>
  >();

  for (const p of prerequisites) {
    const group = prereqGroups.get(p.requirementGroup) ?? [];
    group.push(p);
    prereqGroups.set(p.requirementGroup, group);
  }

  // For each group, check if at least one prerequisite is in the plan at an earlier slot
  for (const [groupNum, groupPrereqs] of prereqGroups) {
    const satisfied = groupPrereqs.some((p) => {
      return existingPlanCourses.some(
        (pc) =>
          pc.courseId === p.prerequisiteId &&
          pc.status !== "dropped" &&
          isEarlierSlot(pc.gradeLevel, pc.semester, gradeLevel, semester)
      );
    });

    if (!satisfied) {
      violations.push({
        type: "prerequisite",
        courseId: targetCourse.id,
        courseName: targetCourse.name,
        courseCode: targetCourse.code,
        message: `${targetCourse.code} requires ${groupPrereqs.length > 1 ? "one of " : ""}${groupPrereqs.map((p) => p.prereqCode).join(" or ")} to be completed in an earlier semester (requirement group ${groupNum}).`,
        details: {
          missingPrerequisites: groupPrereqs.map((p) => ({
            code: p.prereqCode,
            name: p.prereqName,
            group: groupNum,
          })),
        },
      });
    }
  }

  // 7. Check co-requisite violations: must be in the same semester
  const coreqGroups = new Map<
    number,
    Array<{
      prerequisiteId: string;
      prereqCode: string;
      prereqName: string;
      requirementGroup: number;
    }>
  >();

  for (const c of corequisites) {
    const group = coreqGroups.get(c.requirementGroup) ?? [];
    group.push(c);
    coreqGroups.set(c.requirementGroup, group);
  }

  for (const [groupNum, groupCoreqs] of coreqGroups) {
    const satisfied = groupCoreqs.some((c) => {
      return existingPlanCourses.some(
        (pc) =>
          pc.courseId === c.prerequisiteId &&
          pc.status !== "dropped" &&
          isSameSlot(pc.gradeLevel, pc.semester, gradeLevel, semester)
      );
    });

    if (!satisfied) {
      violations.push({
        type: "corequisite",
        courseId: targetCourse.id,
        courseName: targetCourse.name,
        courseCode: targetCourse.code,
        message: `${targetCourse.code} requires ${groupCoreqs.length > 1 ? "one of " : ""}${groupCoreqs.map((c) => c.prereqCode).join(" or ")} to be taken in the same semester (co-requisite group ${groupNum}).`,
        details: {
          missingPrerequisites: groupCoreqs.map((c) => ({
            code: c.prereqCode,
            name: c.prereqName,
            group: groupNum,
          })),
        },
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validates the entire plan for integrity. Returns all violations across all courses.
 * Useful after removing a course to detect transitive violations.
 */
export async function validatePlanIntegrity(
  planId: string
): Promise<PlanIntegrityResult> {
  const violations: Violation[] = [];

  // Fetch all courses in the plan with details
  const allPlanCourses = await db
    .select({
      id: planCourses.id,
      courseId: planCourses.courseId,
      gradeLevel: planCourses.gradeLevel,
      semester: planCourses.semester,
      status: planCourses.status,
      course: {
        id: courses.id,
        code: courses.code,
        name: courses.name,
        duration: courses.duration,
        gradeLevels: courses.gradeLevels,
        semestersOffered: courses.semestersOffered,
        catalogVersionId: courses.catalogVersionId,
      },
    })
    .from(planCourses)
    .innerJoin(courses, eq(planCourses.courseId, courses.id))
    .where(eq(planCourses.planId, planId));

  if (allPlanCourses.length === 0) {
    return { valid: true, violations: [] };
  }

  // Get all course IDs in the plan
  const courseIds = allPlanCourses.map((pc) => pc.courseId);

  // Fetch all prerequisite/corequisite relationships for courses in the plan
  const allPrereqs = await db
    .select({
      courseId: coursePrerequisites.courseId,
      prerequisiteId: coursePrerequisites.prerequisiteId,
      relationshipType: coursePrerequisites.relationshipType,
      requirementGroup: coursePrerequisites.requirementGroup,
      isRecommended: coursePrerequisites.isRecommended,
      prereqCode: courses.code,
      prereqName: courses.name,
    })
    .from(coursePrerequisites)
    .innerJoin(courses, eq(coursePrerequisites.prerequisiteId, courses.id))
    .where(inArray(coursePrerequisites.courseId, courseIds));

  // Validate each course
  for (const pc of allPlanCourses) {
    if (pc.status === "dropped") continue;

    const coursePrereqs = allPrereqs.filter(
      (p) => p.courseId === pc.courseId && !p.isRecommended
    );

    // Check grade-level eligibility
    if (
      pc.course.gradeLevels &&
      !pc.course.gradeLevels.includes(pc.gradeLevel)
    ) {
      violations.push({
        type: "grade_level",
        courseId: pc.course.id,
        courseName: pc.course.name,
        courseCode: pc.course.code,
        message: `${pc.course.code} is not available for grade ${pc.gradeLevel}. Available grades: ${pc.course.gradeLevels.join(", ")}.`,
        details: { requiredGradeLevels: pc.course.gradeLevels },
      });
    }

    // Check enrollment rules: full-year courses must have both semesters present
    if (pc.course.duration === "full_year" && pc.semester !== null) {
      const otherSem = pc.semester === 1 ? 2 : 1;
      const hasOther = allPlanCourses.some(
        (other) =>
          other.courseId === pc.courseId &&
          other.gradeLevel === pc.gradeLevel &&
          other.semester === otherSem &&
          other.status !== "dropped"
      );
      if (!hasOther) {
        violations.push({
          type: "enrollment_rule",
          courseId: pc.course.id,
          courseName: pc.course.name,
          courseCode: pc.course.code,
          message: `${pc.course.code} is a full-year course and must span both semesters.`,
        });
      }
    }
    if (pc.course.duration === "semester" && pc.semester === null) {
      violations.push({
        type: "enrollment_rule",
        courseId: pc.course.id,
        courseName: pc.course.name,
        courseCode: pc.course.code,
        message: `${pc.course.code} is a semester course and must be placed in semester 1 or 2.`,
      });
    }

    // Check prerequisites
    const prerequisites = coursePrereqs.filter(
      (p) => p.relationshipType === "prerequisite"
    );
    const prereqGroups = new Map<
      number,
      Array<{
        prerequisiteId: string;
        prereqCode: string;
        prereqName: string;
        requirementGroup: number;
      }>
    >();

    for (const p of prerequisites) {
      const group = prereqGroups.get(p.requirementGroup) ?? [];
      group.push(p);
      prereqGroups.set(p.requirementGroup, group);
    }

    for (const [groupNum, groupPrereqs] of prereqGroups) {
      const satisfied = groupPrereqs.some((p) => {
        return allPlanCourses.some(
          (other) =>
            other.courseId === p.prerequisiteId &&
            other.status !== "dropped" &&
            isEarlierSlot(
              other.gradeLevel,
              other.semester,
              pc.gradeLevel,
              pc.semester
            )
        );
      });

      if (!satisfied) {
        violations.push({
          type: "prerequisite",
          courseId: pc.course.id,
          courseName: pc.course.name,
          courseCode: pc.course.code,
          message: `${pc.course.code} requires ${groupPrereqs.length > 1 ? "one of " : ""}${groupPrereqs.map((p) => p.prereqCode).join(" or ")} to be completed in an earlier semester (requirement group ${groupNum}).`,
          details: {
            missingPrerequisites: groupPrereqs.map((p) => ({
              code: p.prereqCode,
              name: p.prereqName,
              group: groupNum,
            })),
          },
        });
      }
    }

    // Check corequisites
    const corequisites = coursePrereqs.filter(
      (p) => p.relationshipType === "corequisite"
    );
    const coreqGroups = new Map<
      number,
      Array<{
        prerequisiteId: string;
        prereqCode: string;
        prereqName: string;
        requirementGroup: number;
      }>
    >();

    for (const c of corequisites) {
      const group = coreqGroups.get(c.requirementGroup) ?? [];
      group.push(c);
      coreqGroups.set(c.requirementGroup, group);
    }

    for (const [groupNum, groupCoreqs] of coreqGroups) {
      const satisfied = groupCoreqs.some((c) => {
        return allPlanCourses.some(
          (other) =>
            other.courseId === c.prerequisiteId &&
            other.status !== "dropped" &&
            isSameSlot(
              other.gradeLevel,
              other.semester,
              pc.gradeLevel,
              pc.semester
            )
        );
      });

      if (!satisfied) {
        violations.push({
          type: "corequisite",
          courseId: pc.course.id,
          courseName: pc.course.name,
          courseCode: pc.course.code,
          message: `${pc.course.code} requires ${groupCoreqs.length > 1 ? "one of " : ""}${groupCoreqs.map((c) => c.prereqCode).join(" or ")} to be taken in the same semester (co-requisite group ${groupNum}).`,
          details: {
            missingPrerequisites: groupCoreqs.map((c) => ({
              code: c.prereqCode,
              name: c.prereqName,
              group: groupNum,
            })),
          },
        });
      }
    }

    // Check duplicates within the plan
    const duplicates = allPlanCourses.filter(
      (other) =>
        other.courseId === pc.courseId &&
        other.id !== pc.id &&
        other.gradeLevel === pc.gradeLevel &&
        other.semester === pc.semester &&
        other.status !== "dropped"
    );
    if (duplicates.length > 0) {
      // Only report once per pair (skip if this is the "later" id alphabetically)
      if (pc.id < duplicates[0].id) {
        violations.push({
          type: "duplicate",
          courseId: pc.course.id,
          courseName: pc.course.name,
          courseCode: pc.course.code,
          message: `${pc.course.code} appears multiple times at grade ${pc.gradeLevel}, semester ${pc.semester ?? "full year"}.`,
          details: { conflictingCourseId: duplicates[0].id },
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Returns all courses that transitively depend on a given course (blast radius).
 * Uses a recursive CTE with depth cap of 10.
 */
export async function getTransitiveDownstream(
  courseId: string,
  catalogVersionId: string
): Promise<
  Array<{
    courseId: string;
    courseCode: string;
    courseName: string;
    depth: number;
  }>
> {
  const result = await db.execute(sql`
    WITH RECURSIVE downstream_chain AS (
      SELECT
        cp.course_id,
        cp.prerequisite_id,
        c.code AS course_code,
        c.name AS course_name,
        1 AS depth,
        ARRAY[cp.prerequisite_id] AS visited_path
      FROM course_prerequisites cp
      JOIN courses c ON c.id = cp.course_id
      WHERE cp.prerequisite_id = ${courseId}
        AND cp.relationship_type = 'prerequisite'
        AND cp.catalog_version_id = ${catalogVersionId}

      UNION ALL

      SELECT
        cp.course_id,
        cp.prerequisite_id,
        c.code AS course_code,
        c.name AS course_name,
        dc.depth + 1,
        dc.visited_path || cp.prerequisite_id
      FROM course_prerequisites cp
      JOIN courses c ON c.id = cp.course_id
      JOIN downstream_chain dc ON dc.course_id = cp.prerequisite_id
      WHERE dc.depth < 10
        AND NOT cp.course_id = ANY(dc.visited_path)
        AND cp.relationship_type = 'prerequisite'
        AND cp.catalog_version_id = ${catalogVersionId}
    )
    SELECT DISTINCT ON (course_id)
      course_id,
      course_code,
      course_name,
      depth
    FROM downstream_chain
    ORDER BY course_id, depth
  `);

  return (result.rows as any[]).map((row) => ({
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    depth: row.depth,
  }));
}
