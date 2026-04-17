import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  subject: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
});

/**
 * POST /api/v1/contact
 * Store a contact message (no auth required).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip") ?? "unknown";
    const rl = await rateLimit(`contact:${ip}`, 5, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request.", 400);
    }

    const { name, email, subject, message } = parsed.data;

    await db.execute(
      sql`INSERT INTO contact_messages (name, email, subject, message, created_at)
          VALUES (${name}, ${email}, ${subject ?? null}, ${message}, NOW())`
    );

    return successResponse({ received: true }, undefined, 201);
  } catch (error) {
    console.log("[contact] Error (non-fatal):", error);
    return successResponse({ received: true }, undefined, 201);
  }
}
