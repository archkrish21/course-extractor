import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  graduationRequirements,
  courseCatalogVersions,
  courses,
  divisions,
  planCourses,
  fourYearPlans,
  accountMembers,
  studentRequirementStatus,
  studentRequirementOptIns,
  planShares,
} from "@/lib/db/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";
import { calculateGPA } from "@/lib/gpa/calc";
import { isPassFailCourse } from "@/config/grade-scale";

// ─── Types ─────────────────────────────────────────────────────────────────

interface MatchingRule {
  type: "code_prefix" | "codes" | "division" | "multi_division" | "remainder" | "gpa_threshold" | "course_load" | "pw_dance_check";
  prefix?: string;
  codes?: string[];
  divisionNames?: string[];
  codePrefixes?: string[];
  minGpa?: number;
  minCredits?: number;
  gradeLevel?: number;
  semester?: number;
  minCourses?: number;
  maxCourses?: number;
  maxWithEarlyBird?: number;
}

interface PlanCourseEntry {
  courseId: string;
  divisionId: string;
  divisionName: string;
  code: string;
  name: string;
  creditValue: string;
  status: string | null;
  gradeLevel: number;
  semester: number;
  creditType: string;
  plannedGrade: string | null;
  gpaWaiverApplied: boolean;
}

interface RequirementRow {
  id: string;
  divisionId: string | null;
  name: string;
  requiredCredits: string;
  matchingRule: unknown;
  notes: string | null;
  requirementGroup: string;
  evaluationType: string;
  displayOrder: number | null;
  isOptIn: boolean;
}

interface RequirementResult {
  id: string;
  name: string;
  requiredCredits: number;
  earnedCredits: number;
  plannedCredits: number;
  status: "met" | "in_progress" | "gap" | "not_started" | "completed";
  notes: string | null;
  evaluationType: string;
  courses: Array<{ code: string; name: string; status: string }>;
  metadata?: Record<string, unknown>;
}

interface GroupResult {
  group: string;
  label: string;
  isOptIn: boolean;
  enabled: boolean;
  requirements: RequirementResult[];
  totalRequired: number;
  totalEarned: number;
  totalPlanned: number;
}

const GROUP_LABELS: Record<string, string> = {
  graduation: "Graduation Requirements",
  il_public_university: "IL Public University Admission",
  non_course: "Additional Requirements",
  course_load: "Semester Requirements",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resolveAccountId(
  request: NextRequest,
  userId: string
): Promise<string | null> {
  const headerAccountId = request.headers.get("X-Account-Id");
  if (headerAccountId) return headerAccountId;

  const [membership] = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(eq(accountMembers.userId, userId))
    .limit(1);

  return membership?.accountId ?? null;
}

function perRowCredit(creditValue: string): number {
  const val = parseFloat(creditValue) || 0;
  return val > 1 ? val / 2 : val;
}

function courseMatchesRule(
  course: PlanCourseEntry,
  rule: MatchingRule | null,
  divisionId: string | null
): boolean {
  if (!rule) {
    return divisionId ? course.divisionId === divisionId : false;
  }

  switch (rule.type) {
    case "code_prefix":
      return course.code.startsWith(rule.prefix ?? "");
    case "codes":
      return (rule.codes ?? []).includes(course.code);
    case "division":
      return divisionId ? course.divisionId === divisionId : false;
    case "multi_division":
      return (rule.divisionNames ?? []).includes(course.divisionName);
    case "remainder":
      return true;
    default:
      return divisionId ? course.divisionId === divisionId : false;
  }
}

function deriveStatus(earned: number, planned: number, required: number): "met" | "in_progress" | "gap" {
  if (earned >= required) return "met";
  if (earned + planned >= required) return "in_progress";
  return "gap";
}

/** Process course-match requirements (graduation, il_public_university) */
function processCourseMatchGroup(
  reqs: RequirementRow[],
  allPlanCourses: PlanCourseEntry[],
  claimedCourseRowIds: Set<number>,
): { results: RequirementResult[]; totalRequired: number; totalEarned: number; totalPlanned: number } {
  let totalRequired = 0;
  let totalEarned = 0;
  let totalPlanned = 0;

  const nonRemainder = reqs.filter(
    (r) => !(r.matchingRule as MatchingRule | null)?.type || (r.matchingRule as MatchingRule).type !== "remainder"
  );
  const remainderReqs = reqs.filter(
    (r) => (r.matchingRule as MatchingRule | null)?.type === "remainder"
  );

  const resultMap = new Map<string, RequirementResult>();

  for (const req of nonRemainder) {
    const reqCredits = parseFloat(req.requiredCredits);
    totalRequired += reqCredits;
    const rule = req.matchingRule as MatchingRule | null;

    const matchingCourses: Array<{ index: number; course: PlanCourseEntry }> = [];
    for (let i = 0; i < allPlanCourses.length; i++) {
      if (!claimedCourseRowIds.has(i) && courseMatchesRule(allPlanCourses[i], rule, req.divisionId)) {
        matchingCourses.push({ index: i, course: allPlanCourses[i] });
      }
    }

    const earnedMatches = matchingCourses.filter((mc) => mc.course.status === "completed");
    const plannedMatches = matchingCourses.filter((mc) => mc.course.status !== "completed");

    let earnedCredits = 0;
    let plannedCredits = 0;
    const claimedForReq: Array<{ index: number; course: PlanCourseEntry }> = [];

    for (const mc of earnedMatches) {
      const credit = perRowCredit(mc.course.creditValue);
      earnedCredits += credit;
      claimedForReq.push(mc);
      claimedCourseRowIds.add(mc.index);
      if (earnedCredits >= reqCredits) break;
    }

    const remaining = reqCredits - earnedCredits;
    if (remaining > 0) {
      for (const mc of plannedMatches) {
        const credit = perRowCredit(mc.course.creditValue);
        plannedCredits += credit;
        claimedForReq.push(mc);
        claimedCourseRowIds.add(mc.index);
        if (plannedCredits >= remaining) break;
      }
    }

    totalEarned += earnedCredits;
    totalPlanned += plannedCredits;

    const seenCodes = new Set<string>();
    const coursesList = claimedForReq
      .filter((mc) => {
        if (seenCodes.has(mc.course.code)) return false;
        seenCodes.add(mc.course.code);
        return true;
      })
      .map((mc) => ({
        code: mc.course.code,
        name: mc.course.name,
        status: mc.course.status === "completed" ? "earned" : "planned",
      }));

    resultMap.set(req.id, {
      id: req.id,
      name: req.name,
      requiredCredits: reqCredits,
      earnedCredits,
      plannedCredits,
      status: deriveStatus(earnedCredits, plannedCredits, reqCredits),
      notes: req.notes,
      evaluationType: req.evaluationType,
      courses: coursesList,
    });
  }

  for (const req of remainderReqs) {
    const reqCredits = parseFloat(req.requiredCredits);
    totalRequired += reqCredits;

    const unclaimedCourses: Array<{ index: number; course: PlanCourseEntry }> = [];
    for (let i = 0; i < allPlanCourses.length; i++) {
      if (!claimedCourseRowIds.has(i)) {
        unclaimedCourses.push({ index: i, course: allPlanCourses[i] });
      }
    }

    const earnedCredits = unclaimedCourses
      .filter((mc) => mc.course.status === "completed")
      .reduce((sum, mc) => sum + perRowCredit(mc.course.creditValue), 0);

    const plannedCredits = unclaimedCourses
      .filter((mc) => mc.course.status !== "completed")
      .reduce((sum, mc) => sum + perRowCredit(mc.course.creditValue), 0);

    totalEarned += earnedCredits;
    totalPlanned += plannedCredits;

    const seenCodes = new Set<string>();
    const coursesList = unclaimedCourses
      .filter((mc) => {
        if (seenCodes.has(mc.course.code)) return false;
        seenCodes.add(mc.course.code);
        return true;
      })
      .map((mc) => ({
        code: mc.course.code,
        name: mc.course.name,
        status: mc.course.status === "completed" ? "earned" : "planned",
      }));

    resultMap.set(req.id, {
      id: req.id,
      name: req.name,
      requiredCredits: reqCredits,
      earnedCredits,
      plannedCredits,
      status: deriveStatus(earnedCredits, plannedCredits, reqCredits),
      notes: req.notes,
      evaluationType: req.evaluationType,
      courses: coursesList,
    });
  }

  const results = reqs.map((r) => resultMap.get(r.id)!).filter(Boolean);
  return { results, totalRequired, totalEarned, totalPlanned };
}

/** Process non-course requirements (manual_checkbox, auto_from_course) */
function processNonCourseGroup(
  reqs: RequirementRow[],
  allPlanCourses: PlanCourseEntry[],
  manualStatuses: Map<string, { status: string; completedAt: Date | null }>,
): { results: RequirementResult[]; totalRequired: number; totalEarned: number; totalPlanned: number } {
  const results: RequirementResult[] = [];

  for (const req of reqs) {
    const rule = req.matchingRule as MatchingRule | null;

    if (req.evaluationType === "auto_from_course" && rule) {
      // Check if a matching course exists in the plan
      const matchingCompleted = allPlanCourses.some(
        (pc) => pc.status === "completed" && courseMatchesRule(pc, rule, req.divisionId)
      );
      const matchingPlanned = allPlanCourses.some(
        (pc) => pc.status !== "completed" && courseMatchesRule(pc, rule, req.divisionId)
      );

      results.push({
        id: req.id,
        name: req.name,
        requiredCredits: 0,
        earnedCredits: 0,
        plannedCredits: 0,
        status: matchingCompleted ? "completed" : matchingPlanned ? "in_progress" : "gap",
        notes: req.notes,
        evaluationType: req.evaluationType,
        courses: [],
      });
    } else {
      // manual_checkbox — read from student_requirement_status
      const manual = manualStatuses.get(req.id);
      const status = manual?.status ?? "not_started";

      results.push({
        id: req.id,
        name: req.name,
        requiredCredits: 0,
        earnedCredits: 0,
        plannedCredits: 0,
        status: status as RequirementResult["status"],
        notes: req.notes,
        evaluationType: req.evaluationType,
        courses: [],
      });
    }
  }

  return { results, totalRequired: 0, totalEarned: 0, totalPlanned: 0 };
}

/** Process course load requirements (course_load_check + pw_dance_check) */
function processCourseLoadGroup(
  reqs: RequirementRow[],
  allPlanCourses: PlanCourseEntry[],
): { results: RequirementResult[]; totalRequired: number; totalEarned: number; totalPlanned: number } {
  const results: RequirementResult[] = [];

  for (const req of reqs) {
    const rule = req.matchingRule as MatchingRule | null;
    if (!rule) continue;

    const gradeLevel = rule.gradeLevel ?? 9;
    const semester = rule.semester ?? 1;

    const semCourses = allPlanCourses.filter(
      (pc) => pc.gradeLevel === gradeLevel && pc.semester === semester
    );

    if (rule.type === "course_load") {
      const minCourses = rule.minCourses ?? 5;
      const maxCourses = rule.maxCourses ?? 7;
      const maxWithEarlyBird = rule.maxWithEarlyBird ?? 8;

      // Exclude PW/Dance/DriverEd from the academic course count
      // Per Stevenson: "at least five credits of coursework" + "a sixth supervised period (PW/Dance/DriverEd)"
      const isPwDanceDriverEd = (pc: PlanCourseEntry) =>
        pc.divisionName === "Physical Welfare" || pc.code.startsWith("DNC") || pc.code.startsWith("D/E");
      const academicCourses = semCourses.filter((c) => !isPwDanceDriverEd(c));

      const hasEarlyBird = academicCourses.some(
        (c) => c.name.toLowerCase().includes("early bird") || /E\d$/.test(c.code) || /E\d\//.test(c.code)
      );
      const effectiveMax = hasEarlyBird ? maxWithEarlyBird : maxCourses;
      const count = academicCourses.length;

      const isOk = count >= minCourses && count <= effectiveMax;
      let statusNote = `${count} course${count !== 1 ? "s" : ""} (min ${minCourses}, max ${effectiveMax})`;
      if (count < minCourses) {
        statusNote = `${count} course${count !== 1 ? "s" : ""} — underload (min ${minCourses})`;
      } else if (count > effectiveMax) {
        statusNote = `${count} course${count !== 1 ? "s" : ""} — overload (max ${effectiveMax})`;
      }

      results.push({
        id: req.id,
        name: req.name,
        requiredCredits: 0,
        earnedCredits: 0,
        plannedCredits: 0,
        status: isOk ? "met" : "gap",
        notes: statusNote,
        evaluationType: req.evaluationType,
        courses: [],
        metadata: { courseCount: count, min: minCourses, max: effectiveMax, gradeLevel, semester },
      });
    } else if (rule.type === "pw_dance_check") {
      // Check: at least one PW division course, Dance course (DNC prefix), or Driver Ed (D/E prefix)
      const matchDivisions = rule.divisionNames ?? ["Physical Welfare"];
      const matchPrefixes = rule.codePrefixes ?? ["DNC", "D/E"];

      const hasPwCourse = semCourses.some(
        (pc) =>
          matchDivisions.includes(pc.divisionName) ||
          matchPrefixes.some((prefix) => pc.code.startsWith(prefix))
      );

      const matchingCourses = semCourses.filter(
        (pc) =>
          matchDivisions.includes(pc.divisionName) ||
          matchPrefixes.some((prefix) => pc.code.startsWith(prefix))
      );

      results.push({
        id: req.id,
        name: req.name,
        requiredCredits: 0,
        earnedCredits: 0,
        plannedCredits: 0,
        status: hasPwCourse ? "met" : "gap",
        notes: hasPwCourse
          ? `${matchingCourses[0]?.name ?? "PW/Dance/DriverEd course"} enrolled`
          : "No Physical Welfare, Dance, or Driver Education course",
        evaluationType: req.evaluationType,
        courses: matchingCourses.slice(0, 1).map((c) => ({ code: c.code, name: c.name, status: c.status === "completed" ? "earned" : "planned" })),
        metadata: { gradeLevel, semester, hasPwCourse },
      });
    }
  }

  return { results, totalRequired: 0, totalEarned: 0, totalPlanned: 0 };
}

// ─── GET /api/v1/requirements ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const rl = await rateLimit(`requirements:get:${user.id}`, 30, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    }

    const accountId = await resolveAccountId(request, user.id);
    if (!accountId) {
      return errorResponse("NOT_FOUND", "No account found.", 404);
    }

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }

    // 1. Get latest catalog version
    const [latestCatalog] = await db
      .select({ id: courseCatalogVersions.id })
      .from(courseCatalogVersions)
      .orderBy(desc(courseCatalogVersions.loadedAt))
      .limit(1);

    if (!latestCatalog) {
      return errorResponse("NOT_FOUND", "No catalog version found.", 404);
    }

    // 2. Fetch ALL requirements (all groups)
    const allRequirements: RequirementRow[] = await db
      .select({
        id: graduationRequirements.id,
        divisionId: graduationRequirements.divisionId,
        name: graduationRequirements.requirementName,
        requiredCredits: graduationRequirements.requiredCredits,
        matchingRule: graduationRequirements.matchingRule,
        notes: graduationRequirements.notes,
        requirementGroup: graduationRequirements.requirementGroup,
        evaluationType: graduationRequirements.evaluationType,
        displayOrder: graduationRequirements.displayOrder,
        isOptIn: graduationRequirements.isOptIn,
      })
      .from(graduationRequirements)
      .where(eq(graduationRequirements.catalogVersionId, latestCatalog.id));

    if (allRequirements.length === 0) {
      return successResponse({
        requirements: [],
        totalRequired: 0,
        totalEarned: 0,
        totalPlanned: 0,
        groups: [],
      });
    }

    // 3. Find plan
    const requestedPlanId = request.nextUrl.searchParams.get("planId");
    let plan: { id: string } | undefined;

    if (requestedPlanId) {
      const [found] = await db
        .select({ id: fourYearPlans.id })
        .from(fourYearPlans)
        .where(
          and(
            eq(fourYearPlans.id, requestedPlanId),
            eq(fourYearPlans.accountId, accountCtx.accountId),
            eq(fourYearPlans.isTemplate, false)
          )
        )
        .limit(1);
      plan = found;
    } else {
      const [found] = await db
        .select({ id: fourYearPlans.id })
        .from(fourYearPlans)
        .where(
          and(
            eq(fourYearPlans.accountId, accountCtx.accountId),
            eq(fourYearPlans.isPrimary, true),
            eq(fourYearPlans.isTemplate, false)
          )
        )
        .limit(1);
      plan = found;
    }

    // 3b. Check plan access: user must be creator or have a plan_shares entry
    if (plan) {
      const hasAccess = await db
        .select({ id: fourYearPlans.id })
        .from(fourYearPlans)
        .leftJoin(planShares, and(eq(planShares.planId, plan.id), eq(planShares.userId, user.id)))
        .where(
          and(
            eq(fourYearPlans.id, plan.id),
            or(
              eq(fourYearPlans.createdBy, user.id),
              sql`${planShares.id} IS NOT NULL`
            )
          )
        )
        .limit(1);

      if (hasAccess.length === 0) {
        plan = undefined; // treat as no plan — user has no access
      }
    }

    // 4. Fetch plan courses
    let allPlanCourses: PlanCourseEntry[] = [];

    if (plan) {
      allPlanCourses = (
        await db
          .select({
            courseId: planCourses.courseId,
            divisionId: courses.divisionId,
            divisionName: divisions.name,
            code: courses.code,
            name: courses.name,
            creditValue: courses.creditValue,
            status: planCourses.status,
            gradeLevel: planCourses.gradeLevel,
            semester: planCourses.semester,
            creditType: courses.creditType,
            plannedGrade: planCourses.plannedGrade,
            gpaWaiverApplied: planCourses.gpaWaiverApplied,
          })
          .from(planCourses)
          .innerJoin(courses, eq(planCourses.courseId, courses.id))
          .innerJoin(divisions, eq(courses.divisionId, divisions.id))
          .where(eq(planCourses.planId, plan.id))
      ).filter((pc) => pc.status !== "dropped") as PlanCourseEntry[];
    }

    // 5. Fetch student requirement opt-ins
    const optIns = await db
      .select({ requirementGroup: studentRequirementOptIns.requirementGroup })
      .from(studentRequirementOptIns)
      .where(eq(studentRequirementOptIns.accountId, accountCtx.accountId));

    const optInGroups = new Set(optIns.map((o) => o.requirementGroup));

    // 6. Fetch manual requirement statuses
    const manualRows = await db
      .select({
        requirementId: studentRequirementStatus.requirementId,
        status: studentRequirementStatus.status,
        completedAt: studentRequirementStatus.completedAt,
      })
      .from(studentRequirementStatus)
      .where(eq(studentRequirementStatus.accountId, accountCtx.accountId));

    const manualStatuses = new Map(
      manualRows.map((r) => [r.requirementId, { status: r.status, completedAt: r.completedAt }])
    );

    // 7. Compute GPA for honors evaluation
    const gpaInput = allPlanCourses.map((pc) => ({
      creditValue: pc.creditValue,
      creditType: pc.creditType,
      plannedGrade: pc.plannedGrade,
      status: (pc.status ?? "planned") as "planned" | "enrolled" | "completed" | "dropped",
      gpaWaiver: false,
      gpaWaiverApplied: pc.gpaWaiverApplied ?? false,
    }));
    const actualGpa = calculateGPA(gpaInput, "actual");
    const totalPlanCredits = allPlanCourses.reduce((sum, pc) => sum + perRowCredit(pc.creditValue), 0);

    // 8. Group requirements and process each group
    const groupOrder = ["graduation", "course_load", "il_public_university", "non_course"];
    const reqsByGroup = new Map<string, RequirementRow[]>();
    for (const req of allRequirements) {
      const group = req.requirementGroup;
      if (!reqsByGroup.has(group)) reqsByGroup.set(group, []);
      reqsByGroup.get(group)!.push(req);
    }

    // Sort within each group by displayOrder
    for (const [, reqs] of reqsByGroup) {
      reqs.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }

    const groups: GroupResult[] = [];

    // Graduation group uses shared claiming (courses can only be claimed once)
    const graduationClaimedIds = new Set<number>();

    for (const groupKey of groupOrder) {
      const reqs = reqsByGroup.get(groupKey);
      if (!reqs || reqs.length === 0) continue;

      const isOptIn = reqs[0].isOptIn;
      const enabled = !isOptIn || optInGroups.has(groupKey);

      let groupResult: { results: RequirementResult[]; totalRequired: number; totalEarned: number; totalPlanned: number };

      if (groupKey === "graduation") {
        groupResult = processCourseMatchGroup(reqs, allPlanCourses, graduationClaimedIds);
      } else if (groupKey === "il_public_university") {
        // University reqs use independent claiming (not shared with graduation)
        const independentClaimed = new Set<number>();
        groupResult = processCourseMatchGroup(reqs, allPlanCourses, independentClaimed);
      } else if (groupKey === "non_course") {
        groupResult = processNonCourseGroup(reqs, allPlanCourses, manualStatuses);
      } else if (groupKey === "course_load") {
        groupResult = processCourseLoadGroup(reqs, allPlanCourses);
      } else {
        continue;
      }

      groups.push({
        group: groupKey,
        label: GROUP_LABELS[groupKey] ?? groupKey,
        isOptIn,
        enabled,
        requirements: groupResult.results,
        totalRequired: groupResult.totalRequired,
        totalEarned: groupResult.totalEarned,
        totalPlanned: groupResult.totalPlanned,
      });
    }

    // 9. GPA waiver eligibility check
    // Per Stevenson policy: must be enrolled in 4+ GPA-counted courses per semester to use a waiver
    const gpaWaiverWarnings: string[] = [];
    const semestersWithWaivers = new Set<string>();
    for (const pc of allPlanCourses) {
      if (pc.gpaWaiverApplied) {
        semestersWithWaivers.add(`${pc.gradeLevel}-${pc.semester}`);
      }
    }
    for (const key of semestersWithWaivers) {
      const [gl, sem] = key.split("-").map(Number);
      const semCourses = allPlanCourses.filter(
        (pc) => pc.gradeLevel === gl && pc.semester === sem
      );
      // GPA-counted = non-waivered, non-dropped, not P/F-only courses (PE, Driver Ed)
      const gpaCounted = semCourses.filter(
        (pc) => !pc.gpaWaiverApplied && pc.status !== "dropped" && !isPassFailCourse(pc.code)
      ).length;
      if (gpaCounted < 4) {
        gpaWaiverWarnings.push(
          `Grade ${gl} Sem ${sem}: Only ${gpaCounted} GPA-counted course${gpaCounted !== 1 ? "s" : ""} (minimum 4 required to use GPA waiver)`
        );
      }
    }

    // 10. Compute honors status (achievement badge, not a requirement)
    let honorsStatus: { tier: string; weightedGpa: number; totalCredits: number } | null = null;
    if (actualGpa.weighted !== null && totalPlanCredits >= 42) {
      if (actualGpa.weighted >= 4.0) {
        honorsStatus = { tier: "Highest Honors", weightedGpa: actualGpa.weighted, totalCredits: totalPlanCredits };
      } else if (actualGpa.weighted >= 3.75) {
        honorsStatus = { tier: "High Honors", weightedGpa: actualGpa.weighted, totalCredits: totalPlanCredits };
      } else if (actualGpa.weighted >= 3.5) {
        honorsStatus = { tier: "Honors", weightedGpa: actualGpa.weighted, totalCredits: totalPlanCredits };
      }
    }

    // 11. Build backwards-compatible flat graduation requirements
    const gradGroup = groups.find((g) => g.group === "graduation");

    return successResponse({
      // Backwards compatible: flat graduation-only
      requirements: gradGroup?.requirements ?? [],
      totalRequired: gradGroup?.totalRequired ?? 0,
      totalEarned: gradGroup?.totalEarned ?? 0,
      totalPlanned: gradGroup?.totalPlanned ?? 0,
      // New: all groups
      groups,
      // GPA waiver eligibility warnings
      gpaWaiverWarnings,
      // Honors achievement badge
      honorsStatus,
    });
  } catch (error) {
    console.error("[requirements] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
