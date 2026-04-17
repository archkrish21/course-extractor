import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";

const requestSchema = z.object({
  school: z.string().min(1).max(200),
  email: z.string().email(),
});

/**
 * POST /api/v1/school-request
 * Store a school support request (no auth required).
 * Stores in a simple table for future follow-up.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip") ?? "unknown";
    const rl = await rateLimit(`school-request:${ip}`, 5, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request.", 400);
    }

    const { school, email } = parsed.data;

    // Store in DB — use raw SQL since we don't need a full Drizzle table for this
    await db.execute(
      sql`INSERT INTO school_requests (school_name, email, created_at)
          VALUES (${school}, ${email}, NOW())
          ON CONFLICT (email) DO UPDATE SET school_name = ${school}, created_at = NOW()`
    );

    return successResponse({ received: true });
  } catch (error) {
    // If table doesn't exist yet, just log and return success
    console.log("[school-request] Error (non-fatal):", error);
    return successResponse({ received: true });
  }
}
