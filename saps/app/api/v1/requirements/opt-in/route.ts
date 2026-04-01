import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  studentRequirementOptIns,
  accountMembers,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";

const VALID_OPT_IN_GROUPS = ["il_public_university", "ncaa", "seal_of_biliteracy"];

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

/**
 * PUT /api/v1/requirements/opt-in
 * Enable or disable an opt-in requirement group.
 * Body: { requirementGroup: string, enabled: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const rl = await rateLimit(`requirements:opt-in:${user.id}`, 20, 60);
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

    const body = await request.json();
    const { requirementGroup, enabled } = body;

    if (!requirementGroup || typeof enabled !== "boolean") {
      return errorResponse("VALIDATION_ERROR", "requirementGroup and enabled (boolean) are required.", 400);
    }

    if (!VALID_OPT_IN_GROUPS.includes(requirementGroup)) {
      return errorResponse("VALIDATION_ERROR", `requirementGroup must be one of: ${VALID_OPT_IN_GROUPS.join(", ")}`, 400);
    }

    if (enabled) {
      // Insert opt-in (ignore if already exists)
      await db
        .insert(studentRequirementOptIns)
        .values({
          accountId: accountCtx.accountId,
          requirementGroup,
        })
        .onConflictDoNothing();
    } else {
      // Remove opt-in
      await db
        .delete(studentRequirementOptIns)
        .where(
          and(
            eq(studentRequirementOptIns.accountId, accountCtx.accountId),
            eq(studentRequirementOptIns.requirementGroup, requirementGroup)
          )
        );
    }

    return successResponse({ requirementGroup, enabled });
  } catch (error) {
    console.error("[requirements/opt-in] PUT error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
