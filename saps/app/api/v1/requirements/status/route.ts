import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  studentRequirementStatus,
  graduationRequirements,
  accountMembers,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";

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
 * PUT /api/v1/requirements/status
 * Toggle a non-course requirement's status (manual checkbox).
 * Body: { requirementId: string, status: "not_started" | "in_progress" | "completed" | "waived" }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const rl = await rateLimit(`requirements:status:${user.id}`, 30, 60);
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
    const { requirementId, status } = body;

    if (!requirementId || !status) {
      return errorResponse("VALIDATION_ERROR", "requirementId and status are required.", 400);
    }

    const validStatuses = ["not_started", "in_progress", "completed", "waived"];
    if (!validStatuses.includes(status)) {
      return errorResponse("VALIDATION_ERROR", `status must be one of: ${validStatuses.join(", ")}`, 400);
    }

    // Verify requirement exists and is a manual_checkbox type
    const [req] = await db
      .select({ id: graduationRequirements.id, evaluationType: graduationRequirements.evaluationType })
      .from(graduationRequirements)
      .where(eq(graduationRequirements.id, requirementId))
      .limit(1);

    if (!req) {
      return errorResponse("NOT_FOUND", "Requirement not found.", 404);
    }

    if (req.evaluationType !== "manual_checkbox") {
      return errorResponse("VALIDATION_ERROR", "Only manual_checkbox requirements can be toggled.", 400);
    }

    // Upsert status
    await db
      .insert(studentRequirementStatus)
      .values({
        accountId: accountCtx.accountId,
        requirementId,
        status,
        completedAt: status === "completed" ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [studentRequirementStatus.accountId, studentRequirementStatus.requirementId],
        set: {
          status,
          completedAt: status === "completed" ? new Date() : null,
        },
      });

    return successResponse({ requirementId, status });
  } catch (error) {
    console.error("[requirements/status] PUT error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
