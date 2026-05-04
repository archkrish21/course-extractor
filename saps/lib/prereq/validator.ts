import { db } from "@/lib/db";
import {
  courses,
  coursePrerequisites,
  planCourses,
  fourYearPlans,
} from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { findEquivalentInPlan } from "@/config/summer-equivalents";
import { isRepeatableCourse } from "@/config/grade-scale";

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
  severity?: "error" | "warning";
  // ID of the plan_courses row this violation was emitted from. Lets the
  // planner attribute warnings to a specific cell — important for paired
  // full-year courses where the same courseId appears in two cells.
  // Only populated by validatePlanIntegrity; validateCourseAddition runs
  // before a row exists.
  planCourseId?: string;
  details?: {
    missingPrerequisites?: Array<{ code: string; name: string; group: number }>;
    requiredGradeLevels?: number[];
    conflictingCourseId?: string;
    // Names + codes for any non-target course mentioned in `message`. Lets the
    // UI render the name with the code in a tooltip (search "ViolationMessage").
    // Target course's name/code are on the violation itself.
    referencedCourses?: Array<{ code: string; name: string }>;
  };
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

export interface PlanIntegrityResult {
  valid: boolean;
  violations: Violation[];
  // Violations that were suppressed because the row was force-added past them.
  // Surfaced separately so the UI can show them under a "warnings ignored"
  // affordance without re-flagging them as active issues.
  ignoredViolations: Violation[];
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
 * Returns true if slotA is earlier than slotB.
 * Ordering: grade_level is the primary key, semester is secondary.
 * Within a grade: Summer S1 (-2) → Summer S2 (-1) → S1 (1) → S2 (2).
 * Summer courses happen BEFORE the school year at that grade level.
 * semester=null means full-year, treated as S1 for prereq ordering.
 */
function isEarlierSlot(
  gradeLevelA: number,
  semesterA: number | null,
  gradeLevelB: number,
  semesterB: number | null
): boolean {
  if (gradeLevelA < gradeLevelB) return true;
  if (gradeLevelA > gradeLevelB) return false;
  // Same grade — natural numeric order works: -2 < -1 < 1 < 2
  const semA = semesterA ?? 1;
  const semB = semesterB ?? 1;
  return semA < semB;
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
  const semA = semesterA ?? 1;
  const semB = semesterB ?? 1;
  return semA <= semB;
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
      creditType: courses.creditType,
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
  // Repeatable PE courses (e.g. CHOICE P.E.) count toward the 3.5-credit PE
  // requirement each semester they're taken, so they're allowed in multiple
  // slots — but never twice in the exact same grade+semester.
  // Block: same courseId at a different grade, or same courseId+grade+semester
  const repeatable = isRepeatableCourse(targetCourse.code, targetCourse.creditType);
  const duplicates = existingPlanCourses.filter(
    (pc) => pc.courseId === courseId && pc.status !== "dropped"
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

    // Repeatable courses: only block exact same grade+semester; allow re-add in any other slot.
    if (
      repeatable &&
      !(dup.gradeLevel === gradeLevel && dup.semester === semester)
    ) {
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

  // Check summer/regular equivalent: e.g., adding SOC101 when SOC13S is already in the plan
  const existingCodes = existingPlanCourses
    .filter((pc) => pc.status !== "dropped")
    .map((pc) => pc.course.code);
  const equivalentInPlan = findEquivalentInPlan(targetCourse.code, existingCodes);
  if (equivalentInPlan) {
    const equivalentRow = existingPlanCourses.find(
      (pc) => pc.course.code === equivalentInPlan && pc.status !== "dropped"
    );
    violations.push({
      type: "duplicate",
      courseId: targetCourse.id,
      courseName: targetCourse.name,
      courseCode: targetCourse.code,
      message: `${targetCourse.code} is equivalent to ${equivalentInPlan} which is already in your plan.`,
      severity: "warning",
      details: equivalentRow
        ? {
            referencedCourses: [
              { code: equivalentRow.course.code, name: equivalentRow.course.name },
            ],
          }
        : undefined,
    });
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
      details: {
        conflictingCourseId: semesterPartner.id,
        referencedCourses: [
          { code: semesterPartner.course.code, name: semesterPartner.course.name },
        ],
      },
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
  const ignoredViolations: Violation[] = [];

  // Fetch all courses in the plan with details
  const allPlanCourses = await db
    .select({
      id: planCourses.id,
      courseId: planCourses.courseId,
      gradeLevel: planCourses.gradeLevel,
      semester: planCourses.semester,
      status: planCourses.status,
      prereqOverridden: planCourses.prereqOverridden,
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
    return { valid: true, violations: [], ignoredViolations: [] };
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

    // Check grade-level eligibility. Track in ignoredViolations when the user
    // explicitly placed this course at a non-standard grade via force_add.
    if (
      pc.course.gradeLevels &&
      !pc.course.gradeLevels.includes(pc.gradeLevel)
    ) {
      const v: Violation = {
        type: "grade_level",
        courseId: pc.course.id,
        courseName: pc.course.name,
        courseCode: pc.course.code,
        planCourseId: pc.id,
        message: `${pc.course.code} is not available for grade ${pc.gradeLevel}. Available grades: ${pc.course.gradeLevels.join(", ")}.`,
        details: { requiredGradeLevels: pc.course.gradeLevels },
      };
      (pc.prereqOverridden ? ignoredViolations : violations).push(v);
    }

    // Check enrollment rules: full-year courses must have both semesters present.
    // Like prereq/grade_level checks, route to ignoredViolations when the row
    // is overridden so the user's "Excuse" decision applies uniformly.
    if (pc.course.duration === "full_year" && pc.semester !== null) {
      // Pair semesters: 1↔2 for regular, -2↔-1 for summer
      const otherSem = pc.semester === 1 ? 2 : pc.semester === 2 ? 1 : pc.semester === -2 ? -1 : -2;
      const hasOther = allPlanCourses.some(
        (other) =>
          other.courseId === pc.courseId &&
          other.gradeLevel === pc.gradeLevel &&
          other.semester === otherSem &&
          other.status !== "dropped"
      );
      if (!hasOther) {
        const isSummer = pc.semester < 0;
        const v: Violation = {
          type: "enrollment_rule",
          courseId: pc.course.id,
          courseName: pc.course.name,
          courseCode: pc.course.code,
          planCourseId: pc.id,
          message: `${pc.course.code} is a full-year course and must span both ${isSummer ? "summer sessions" : "semesters"}.`,
        };
        (pc.prereqOverridden ? ignoredViolations : violations).push(v);
      }
    }
    if (pc.course.duration === "semester" && pc.semester === null) {
      const v: Violation = {
        type: "enrollment_rule",
        courseId: pc.course.id,
        courseName: pc.course.name,
        courseCode: pc.course.code,
        planCourseId: pc.id,
        message: `${pc.course.code} is a semester course and must be placed in a specific semester.`,
      };
      (pc.prereqOverridden ? ignoredViolations : violations).push(v);
    }

    // Check prerequisites. When the row is overridden, prereq misses go into
    // ignoredViolations rather than active violations so the UI can list them
    // under a "warnings ignored" affordance.
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
        const v: Violation = {
          type: "prerequisite",
          courseId: pc.course.id,
          courseName: pc.course.name,
          courseCode: pc.course.code,
          planCourseId: pc.id,
          message: `${pc.course.code} requires ${groupPrereqs.length > 1 ? "one of " : ""}${groupPrereqs.map((p) => p.prereqCode).join(" or ")} to be completed in an earlier semester (requirement group ${groupNum}).`,
          details: {
            missingPrerequisites: groupPrereqs.map((p) => ({
              code: p.prereqCode,
              name: p.prereqName,
              group: groupNum,
            })),
          },
        };
        (pc.prereqOverridden ? ignoredViolations : violations).push(v);
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
        const v: Violation = {
          type: "corequisite",
          courseId: pc.course.id,
          courseName: pc.course.name,
          courseCode: pc.course.code,
          planCourseId: pc.id,
          message: `${pc.course.code} requires ${groupCoreqs.length > 1 ? "one of " : ""}${groupCoreqs.map((c) => c.prereqCode).join(" or ")} to be taken in the same semester (co-requisite group ${groupNum}).`,
          details: {
            missingPrerequisites: groupCoreqs.map((c) => ({
              code: c.prereqCode,
              name: c.prereqName,
              group: groupNum,
            })),
          },
        };
        (pc.prereqOverridden ? ignoredViolations : violations).push(v);
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
        const v: Violation = {
          type: "duplicate",
          courseId: pc.course.id,
          courseName: pc.course.name,
          courseCode: pc.course.code,
          planCourseId: pc.id,
          message: `${pc.course.code} appears multiple times at grade ${pc.gradeLevel}, semester ${pc.semester ?? "full year"}.`,
          details: { conflictingCourseId: duplicates[0].id },
        };
        (pc.prereqOverridden ? ignoredViolations : violations).push(v);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    ignoredViolations,
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

  interface DownstreamRow {
    course_id: string;
    course_code: string;
    course_name: string;
    depth: number;
  }

  return (result.rows as unknown as DownstreamRow[]).map((row) => ({
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    depth: row.depth,
  }));
}
