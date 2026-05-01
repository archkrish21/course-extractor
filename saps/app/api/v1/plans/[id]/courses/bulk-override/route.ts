import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fourYearPlans, planCourses, planHistory } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth } from "@/lib/auth/get-user";
import { getPlanAccess, hasPermission } from "@/lib/auth/plan-permissions";

const bulkOverrideSchema = z.object({
  plan_course_ids: z.array(z.string().uuid()).min(1).max(200),
  overridden: z.boolean(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/plans/:id/courses/bulk-override
 * Flips prereq_overridden on a list of plan_course rows in one trip. The
 * caller picks which rows to include — the planner's per-cell "Excuse all"
 * sends the rows currently surfaced as violations plus their full-year
 * sibling rows in the same grade, so paired courses stay consistent.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const { id: planId } = await context.params;

    const body = await request.json();
    const parsed = bulkOverrideSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { plan_course_ids, overridden } = parsed.data;

    const [plan] = await db
      .select()
      .from(fourYearPlans)
      .where(eq(fourYearPlans.id, planId))
      .limit(1);

    if (!plan) {
      return errorResponse("NOT_FOUND", "Plan not found.", 404);
    }

    const access = await getPlanAccess(user.id, planId, plan.accountId);
    if (!access || !hasPermission(access.permission, "edit")) {
      return errorResponse(
        "FORBIDDEN",
        "You do not have permission to edit this plan.",
        403
      );
    }

    // prereq_overridden is non-structural metadata, so we allow it through
    // even on locked grades — same policy as GPA-waiver toggles in the
    // single-course PATCH endpoint. Scoping the update to this plan's rows
    // (via planId in the WHERE clause) prevents a malicious payload from
    // touching another plan even if it guesses a plan_course_id.

    const updated = await db
      .update(planCourses)
      .set({ prereqOverridden: overridden })
      .where(
        and(
          eq(planCourses.planId, planId),
          inArray(planCourses.id, plan_course_ids)
        )
      )
      .returning({ id: planCourses.id });

    if (updated.length > 0) {
      await db.insert(planHistory).values({
        planId,
        changedBy: user.id,
        action: "change_status",
        beforeState: { prereqOverridden: !overridden },
        afterState: {
          prereqOverridden: overridden,
          affectedCount: updated.length,
          planCourseIds: updated.map((u) => u.id),
        },
      });
    }

    return successResponse({ updatedCount: updated.length, overridden });
  } catch (error) {
    console.error("[plans/:id/courses/bulk-override] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
