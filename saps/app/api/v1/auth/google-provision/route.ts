import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { successResponse, errorResponse, serverError } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";

const bodySchema = z.object({
  redirect: z.string().nullable().optional(),
});

/**
 * Provision an app-level user record after Google Identity Services
 * sign-in. Called from the client after `supabase.auth.signInWithIdToken`
 * has established a session. Mirrors the first-time-user logic from the
 * legacy OAuth callback but reads the session from cookies instead of
 * exchanging an authorization code.
 *
 * Returns the path the client should navigate to: `/profile-setup` for
 * new users, or the requested redirect (or `/dashboard`) for existing.
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    const requestedRedirect = parsed.success ? parsed.data.redirect ?? null : null;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return errorResponse("UNAUTHORIZED", "No active session.", 401);
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!existingUser) {
      const email = authUser.email ?? "";
      const firstName =
        (authUser.user_metadata?.full_name as string | undefined) ??
        (authUser.user_metadata?.name as string | undefined) ??
        email.split("@")[0];

      await db.insert(users).values({
        id: authUser.id,
        email,
        firstName,
        role: "student",
        isEmailVerified: true,
      });

      return successResponse({ next: "/profile-setup", new_user: true });
    }

    return successResponse({
      next: requestedRedirect ?? "/dashboard",
      new_user: false,
    });
  } catch (error) {
    return serverError(error, "auth.google-provision");
  }
}
