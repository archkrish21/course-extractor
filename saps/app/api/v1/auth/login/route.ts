import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { rateLimit } from "@/lib/api/rate-limit";
import { audit } from "@/lib/audit/log";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    // Rate limit: 5 requests/minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimitResult = await rateLimit(`auth:login:${ip}`, 5, 60);
    if (!rateLimitResult.success) {
      return errorResponse(
        "RATE_LIMITED",
        `Rate limit exceeded. Try again in ${rateLimitResult.resetAt - Math.floor(Date.now() / 1000)} seconds.`,
        429,
        { retry_after: rateLimitResult.resetAt - Math.floor(Date.now() / 1000) }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }

    const { email, password } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      await audit({
        userId: null,
        action: "auth.login_failed",
        metadata: { email },
        request,
      });
      return errorResponse("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    await audit({
      userId: data.user.id,
      action: "auth.login",
      request,
    });

    // Update last_login timestamp
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, data.user.id));

    return successResponse({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error("[login] Unexpected error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
