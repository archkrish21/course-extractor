import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/get-user";

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  page: z.string().max(200).optional(),
});

/**
 * POST /api/v1/feedback
 * Submit in-app feedback (requires auth).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid feedback.", 400);
    }

    const { rating, comment, page } = parsed.data;

    await db.execute(
      sql`INSERT INTO feedback (user_id, rating, comment, page, created_at)
          VALUES (${user.id}, ${rating}, ${comment ?? null}, ${page ?? null}, NOW())`
    );

    return successResponse({ received: true }, undefined, 201);
  } catch (error) {
    console.error("[feedback] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
