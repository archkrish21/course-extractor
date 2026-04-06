import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";

const updateAccountSchema = z.object({
  student_name: z.string().min(1).max(200).optional(),
  grade_level: z.number().int().min(9).max(12).optional(),
  graduation_year: z.number().int().min(2024).max(2040).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/accounts/:id
 * Update account details. Requires canEdit permission.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const { id: accountId } = await context.params;

    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) {
      return errorResponse("FORBIDDEN", "Not a member of this account.", 403);
    }
    if (!accountCtx.canEdit) {
      return errorResponse("FORBIDDEN", "Read-only access.", 403);
    }

    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { student_name, grade_level, graduation_year } = parsed.data;
    if (!student_name && grade_level === undefined && graduation_year === undefined) {
      return errorResponse("VALIDATION_ERROR", "At least one field must be provided.", 400);
    }

    const updateValues: Record<string, unknown> = {};
    if (student_name) updateValues.studentName = student_name;
    if (grade_level !== undefined) updateValues.gradeLevel = grade_level;
    if (graduation_year !== undefined) updateValues.graduationYear = graduation_year;

    const [updated] = await db
      .update(accounts)
      .set(updateValues)
      .where(eq(accounts.id, accountId))
      .returning({
        id: accounts.id,
        studentName: accounts.studentName,
        gradeLevel: accounts.gradeLevel,
        graduationYear: accounts.graduationYear,
      });

    return successResponse(updated);
  } catch (error) {
    console.error("[accounts/:id] PATCH error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
