import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  graduationRequirements,
  courseCatalogVersions,
  courses,
  divisions,
  planCourses,
  fourYearPlans,
  accounts,
  accountMembers,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";

// ─── Types ─────────────────────────────────────────────────────────────────

interface MatchingRule {
  type: "code_prefix" | "codes" | "division" | "multi_division" | "remainder";
  prefix?: string;
  codes?: string[];
  divisionNames?: string[];
}

interface PlanCourseEntry {
  courseId: string;
  divisionId: string;
  divisionName: string;
  code: string;
  name: string;
  creditValue: string;
  status: string | null;
}

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

/** Check if a course matches a requirement's matching rule */
function courseMatchesRule(
  course: PlanCourseEntry,
  rule: MatchingRule | null,
  divisionId: string
): boolean {
  if (!rule) {
    // Fallback: match by division_id (legacy behavior)
    return course.divisionId === divisionId;
  }

  switch (rule.type) {
    case "code_prefix":
      // Match course codes starting with the prefix
      return course.code.startsWith(rule.prefix ?? "");

    case "codes":
      // Match specific course codes
      return (rule.codes ?? []).includes(course.code);

    case "division":
      // Match all courses in the linked division
      return course.divisionId === divisionId;

    case "multi_division":
      // Match courses in any of the named divisions
      return (rule.divisionNames ?? []).includes(course.divisionName);

    case "remainder":
      // Handled separately — matches everything not claimed
      return true;

    default:
      return course.divisionId === divisionId;
  }
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

    // 2. Fetch graduation requirements
    const requirements = await db
      .select({
        id: graduationRequirements.id,
        divisionId: graduationRequirements.divisionId,
        name: graduationRequirements.requirementName,
        requiredCredits: graduationRequirements.requiredCredits,
        matchingRule: graduationRequirements.matchingRule,
        notes: graduationRequirements.notes,
      })
      .from(graduationRequirements)
      .where(eq(graduationRequirements.catalogVersionId, latestCatalog.id));

    if (requirements.length === 0) {
      return successResponse({
        requirements: [],
        totalRequired: 0,
        totalEarned: 0,
        totalPlanned: 0,
      });
    }

    // 3. Find plan — use planId query param if provided, otherwise primary plan
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

    // 4. Fetch plan courses with course + division details
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
          })
          .from(planCourses)
          .innerJoin(courses, eq(planCourses.courseId, courses.id))
          .innerJoin(divisions, eq(courses.divisionId, divisions.id))
          .where(eq(planCourses.planId, plan.id))
      ).filter((pc) => pc.status !== "dropped");
    }

    // 5. Process requirements — track claimed courses for "remainder" type
    const claimedCourseRowIds = new Set<number>(); // index into allPlanCourses
    let totalRequired = 0;
    let totalEarned = 0;
    let totalPlanned = 0;

    // Process non-remainder requirements first
    const nonRemainder = requirements.filter(
      (r) => !(r.matchingRule as MatchingRule | null)?.type || (r.matchingRule as MatchingRule).type !== "remainder"
    );
    const remainderReqs = requirements.filter(
      (r) => (r.matchingRule as MatchingRule | null)?.type === "remainder"
    );

    const resultMap = new Map<string, {
      id: string;
      name: string;
      requiredCredits: number;
      earnedCredits: number;
      plannedCredits: number;
      status: "met" | "in_progress" | "gap";
      notes: string | null;
      courses: Array<{ code: string; name: string; status: string }>;
    }>();

    for (const req of nonRemainder) {
      const reqCredits = parseFloat(req.requiredCredits);
      totalRequired += reqCredits;
      const rule = req.matchingRule as MatchingRule | null;

      // Find all matching courses (not yet claimed by a previous requirement)
      const matchingCourses: Array<{ index: number; course: PlanCourseEntry }> = [];
      for (let i = 0; i < allPlanCourses.length; i++) {
        if (!claimedCourseRowIds.has(i) && courseMatchesRule(allPlanCourses[i], rule, req.divisionId)) {
          matchingCourses.push({ index: i, course: allPlanCourses[i] });
        }
      }

      // Only claim courses up to the required credits (earned first, then planned)
      // This ensures excess courses flow to the "remainder" requirement
      const earnedMatches = matchingCourses.filter((mc) => mc.course.status === "completed");
      const plannedMatches = matchingCourses.filter((mc) => mc.course.status !== "completed");

      let earnedCredits = 0;
      let plannedCredits = 0;
      const claimedForReq: Array<{ index: number; course: PlanCourseEntry }> = [];

      // Claim earned courses first
      for (const mc of earnedMatches) {
        const credit = perRowCredit(mc.course.creditValue);
        earnedCredits += credit;
        claimedForReq.push(mc);
        claimedCourseRowIds.add(mc.index);
        if (earnedCredits >= reqCredits) break;
      }

      // Then claim planned courses up to the remaining need
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

      let status: "met" | "in_progress" | "gap";
      if (earnedCredits >= reqCredits) {
        status = "met";
      } else if (earnedCredits + plannedCredits >= reqCredits) {
        status = "in_progress";
      } else {
        status = "gap";
      }

      // Deduplicate course list
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
        status,
        notes: req.notes,
        courses: coursesList,
      });
    }

    // Process "remainder" requirements — unclaimed courses
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

      let status: "met" | "in_progress" | "gap";
      if (earnedCredits >= reqCredits) {
        status = "met";
      } else if (earnedCredits + plannedCredits >= reqCredits) {
        status = "in_progress";
      } else {
        status = "gap";
      }

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
        status,
        notes: req.notes,
        courses: coursesList,
      });
    }

    // Build final result in original order
    const result = requirements.map((req) => resultMap.get(req.id)!).filter(Boolean);

    return successResponse({
      requirements: result,
      totalRequired,
      totalEarned,
      totalPlanned,
    });
  } catch (error) {
    console.error("[requirements] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
