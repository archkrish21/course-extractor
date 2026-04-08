import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  fourYearPlans,
  planCourses,
  planShares,
  courses,
  courseCatalogVersions,
  accountMembers,
  accounts,
  users,
} from "@/lib/db/schema";
import { eq, and, sql, count, or } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { getEffectiveTier } from "@/lib/subscription/middleware";

const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  school_year: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "School year must be in format YYYY-YYYY")
    .optional(),
  catalog_version_id: z.string().uuid().optional(),
  from_template_id: z.string().uuid().optional(),
});

/**
 * Resolves the accountId for the current user.
 * Uses X-Account-Id header if present, otherwise finds the user's account.
 */
async function resolveAccountId(
  request: NextRequest,
  userId: string
): Promise<string | null> {
  const headerAccountId = request.headers.get("X-Account-Id");
  if (headerAccountId) return headerAccountId;

  // Fall back to the user's first account membership
  const [membership] = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(eq(accountMembers.userId, userId))
    .limit(1);

  return membership?.accountId ?? null;
}

/**
 * GET /api/v1/plans
 * List plans for the authenticated user's account.
 * Accepts X-Account-Id header to select account; otherwise uses default account.
 * Falls back to studentId-based query for pre-migration data.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const accountId = await resolveAccountId(request, user.id);

    const includeHidden = request.nextUrl.searchParams.get("include_hidden") === "true";

    // If we have an account context, verify membership and query by accountId
    if (accountId) {
      const accountCtx = await getAccountContext(user.id, accountId);
      if (!accountCtx) {
        return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
      }

      const plans = await db
        .select({
          id: fourYearPlans.id,
          name: fourYearPlans.name,
          schoolYear: fourYearPlans.schoolYear,
          catalogVersionId: fourYearPlans.catalogVersionId,
          createdFromTemplateId: fourYearPlans.createdFromTemplateId,
          status: fourYearPlans.status,
          isPrimary: fourYearPlans.isPrimary,
          isTemplate: fourYearPlans.isTemplate,
          activatedAt: fourYearPlans.activatedAt,
          createdAt: fourYearPlans.createdAt,
          updatedAt: fourYearPlans.updatedAt,
          createdBy: fourYearPlans.createdBy,
          lockedGradeLevels: fourYearPlans.lockedGradeLevels,
          permission: planShares.permission,
          isHidden: planShares.isHidden,
          creatorRole: sql<string | null>`(
            SELECT am.role FROM account_members am
            WHERE am.user_id = ${fourYearPlans.createdBy}
              AND am.account_id = ${fourYearPlans.accountId}
            LIMIT 1
          )`,
          creatorEmail: sql<string | null>`(
            SELECT u.email FROM users u
            WHERE u.id = ${fourYearPlans.createdBy}
            LIMIT 1
          )`,
          courseCount: sql<number>`(
            SELECT COUNT(*)::int FROM plan_courses
            WHERE plan_courses.plan_id = ${fourYearPlans.id}
          )`,
          sharedCount: sql<number>`(
            SELECT COUNT(*)::int FROM plan_shares ps
            WHERE ps.plan_id = ${fourYearPlans.id}
              AND ps.permission != 'owner'
          )`,
        })
        .from(fourYearPlans)
        .leftJoin(
          planShares,
          and(
            eq(planShares.planId, fourYearPlans.id),
            eq(planShares.userId, user.id)
          )
        )
        .where(
          and(
            eq(fourYearPlans.accountId, accountId),
            eq(fourYearPlans.isTemplate, false),
            // Only show plans the user has access to (via plan_shares or as creator)
            or(
              sql`${planShares.id} IS NOT NULL`,
              eq(fourYearPlans.createdBy, user.id)
            )
          )
        )
        .orderBy(fourYearPlans.createdAt);

      const filtered = includeHidden ? plans : plans.filter((p) => !p.isHidden);
      return successResponse(filtered);
    }

    // Backward compatibility: no account, fall back to studentId
    const plans = await db
      .select({
        id: fourYearPlans.id,
        name: fourYearPlans.name,
        schoolYear: fourYearPlans.schoolYear,
        catalogVersionId: fourYearPlans.catalogVersionId,
        createdFromTemplateId: fourYearPlans.createdFromTemplateId,
        status: fourYearPlans.status,
        isPrimary: fourYearPlans.isPrimary,
        isTemplate: fourYearPlans.isTemplate,
        activatedAt: fourYearPlans.activatedAt,
        createdAt: fourYearPlans.createdAt,
        updatedAt: fourYearPlans.updatedAt,
        createdBy: fourYearPlans.createdBy,
        lockedGradeLevels: fourYearPlans.lockedGradeLevels,
        permission: planShares.permission,
        isHidden: planShares.isHidden,
        creatorRole: sql<string | null>`(
          SELECT am.role FROM account_members am
          WHERE am.user_id = ${fourYearPlans.createdBy}
            AND am.account_id = ${fourYearPlans.accountId}
          LIMIT 1
        )`,
        creatorEmail: sql<string | null>`(
          SELECT u.email FROM users u
          WHERE u.id = ${fourYearPlans.createdBy}
          LIMIT 1
        )`,
        courseCount: sql<number>`(
          SELECT COUNT(*)::int FROM plan_courses
          WHERE plan_courses.plan_id = ${fourYearPlans.id}
        )`,
        sharedCount: sql<number>`(
          SELECT COUNT(*)::int FROM plan_shares ps
          WHERE ps.plan_id = ${fourYearPlans.id}
            AND ps.permission != 'owner'
        )`,
      })
      .from(fourYearPlans)
      .leftJoin(
        planShares,
        and(
          eq(planShares.planId, fourYearPlans.id),
          eq(planShares.userId, user.id)
        )
      )
      .where(
        and(
          eq(fourYearPlans.studentId, user.id),
          eq(fourYearPlans.isTemplate, false)
        )
      )
      .orderBy(fourYearPlans.createdAt);

    const filtered = includeHidden ? plans : plans.filter((p) => !p.isHidden);
    return successResponse(filtered);
  } catch (error) {
    console.error("[plans] GET error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}

/**
 * POST /api/v1/plans
 * Create a new plan. Checks subscription tier plan limit.
 * Sets accountId and createdBy on the new plan.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    // Parse body
    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body.",
        400,
        { details: parsed.error.flatten().fieldErrors }
      );
    }

    const { name, school_year, catalog_version_id, from_template_id } =
      parsed.data;

    // Resolve account context
    const accountId = await resolveAccountId(request, user.id);
    let accountCtx = accountId
      ? await getAccountContext(user.id, accountId)
      : null;

    // If we have an account context, verify canEdit
    if (accountCtx && !accountCtx.canEdit) {
      return errorResponse("FORBIDDEN", "Read-only access.", 403);
    }

    // Check subscription plan limit
    const tier = await getEffectiveTier({ accountId: accountCtx?.accountId, userId: user.id });

    // Parent plan draft gating: parents need canParentDraft (Plus+)
    if (accountCtx && accountCtx.role !== "student" && !tier.canParentDraft) {
      return errorResponse(
        "UPGRADE_REQUIRED",
        "Creating plan drafts as a parent requires a Plus or Elite subscription.",
        402,
        { minimum_tier: "plus", current_tier: tier.tier }
      );
    }

    // Count plans by accountId if available, otherwise by studentId
    const planCountCondition = accountId
      ? and(
          eq(fourYearPlans.accountId, accountId),
          eq(fourYearPlans.isTemplate, false)
        )
      : and(
          eq(fourYearPlans.studentId, user.id),
          eq(fourYearPlans.isTemplate, false)
        );

    const [planCountRow] = await db
      .select({ count: count() })
      .from(fourYearPlans)
      .where(planCountCondition);

    const currentCount = planCountRow?.count ?? 0;
    if (currentCount >= tier.maxPlans) {
      return errorResponse(
        "UPGRADE_REQUIRED",
        `Plan limit reached (${tier.maxPlans}). Upgrade your subscription to create more plans.`,
        402,
        { minimum_tier: "plus", current_count: currentCount, max: tier.maxPlans }
      );
    }

    // Resolve catalog version and school year: use provided or latest
    let catalogVersionId = catalog_version_id;
    let resolvedSchoolYear = school_year;
    if (!catalogVersionId || !resolvedSchoolYear) {
      const [latest] = await db
        .select({ id: courseCatalogVersions.id, schoolYear: courseCatalogVersions.schoolYear })
        .from(courseCatalogVersions)
        .orderBy(sql`${courseCatalogVersions.loadedAt} DESC`)
        .limit(1);
      if (!catalogVersionId) catalogVersionId = latest?.id;
      if (!resolvedSchoolYear) resolvedSchoolYear = latest?.schoolYear ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    }

    // If from_template_id, verify the template exists
    if (from_template_id) {
      const [template] = await db
        .select({ id: fourYearPlans.id, isTemplate: fourYearPlans.isTemplate })
        .from(fourYearPlans)
        .where(eq(fourYearPlans.id, from_template_id))
        .limit(1);

      if (!template || !template.isTemplate) {
        return errorResponse(
          "NOT_FOUND",
          "Template not found.",
          404
        );
      }
    }

    // Look up the account to get studentUserId
    let studentId: string | null = user.id;
    if (accountCtx) {
      const [account] = await db.select({ studentUserId: accounts.studentUserId })
        .from(accounts).where(eq(accounts.id, accountCtx.accountId)).limit(1);
      studentId = account?.studentUserId ?? null;
    }

    // Only set as primary if no primary plan exists for this student
    const existingPrimaryConditions = studentId
      ? eq(fourYearPlans.studentId, studentId)
      : accountId
        ? eq(fourYearPlans.accountId, accountId)
        : undefined;

    let hasPrimary = false;
    if (existingPrimaryConditions) {
      const [primaryRow] = await db
        .select({ id: fourYearPlans.id })
        .from(fourYearPlans)
        .where(and(existingPrimaryConditions, eq(fourYearPlans.isPrimary, true)))
        .limit(1);
      hasPrimary = !!primaryRow;
    }

    const isFirstPlan = currentCount === 0 && !hasPrimary;

    // Create the plan
    const [newPlan] = await db
      .insert(fourYearPlans)
      .values({
        studentId,
        accountId: accountId ?? undefined,
        createdBy: user.id,
        name,
        schoolYear: resolvedSchoolYear,
        catalogVersionId: catalogVersionId ?? undefined,
        createdFromTemplateId: from_template_id ?? undefined,
        isTemplate: false,
        status: isFirstPlan ? "active" : "draft",
        isPrimary: isFirstPlan,
        activatedAt: isFirstPlan ? new Date() : undefined,
      })
      .returning();

    // Auto-create owner share for the plan creator
    await db.insert(planShares).values({
      planId: newPlan.id,
      userId: user.id,
      grantedBy: user.id,
      permission: "owner",
    });

    // If from_template_id, copy template courses into the new plan
    if (from_template_id) {
      const templateCourses = await db
        .select({
          courseId: planCourses.courseId,
          gradeLevel: planCourses.gradeLevel,
          semester: planCourses.semester,
          plannedGrade: planCourses.plannedGrade,
          displayOrder: planCourses.displayOrder,
          notes: planCourses.notes,
        })
        .from(planCourses)
        .where(eq(planCourses.planId, from_template_id));

      if (templateCourses.length > 0) {
        await db.insert(planCourses).values(
          templateCourses.map((tc) => ({
            planId: newPlan.id,
            courseId: tc.courseId,
            gradeLevel: tc.gradeLevel,
            semester: tc.semester,
            status: "planned" as const,
            plannedGrade: tc.plannedGrade,
            displayOrder: tc.displayOrder,
            notes: tc.notes,
          }))
        );
      }
    }

    return successResponse(newPlan, undefined, 201);
  } catch (error) {
    console.error("[plans] POST error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
