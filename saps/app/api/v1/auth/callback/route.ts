import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Handle Supabase OAuth callback (Google OAuth redirect).
 * Exchanges the authorization code for a session.
 * For first-time users: creates app-level records (users, accounts, profile, subscription)
 * and redirects to /onboarding.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] Failed to exchange code:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Get the authenticated user from the session
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Check if this user already has an app-level record
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (!existingUser) {
    // ── First-time Google OAuth user: create minimal users row ──
    // Full provisioning (accounts, profiles, subscriptions) happens in
    // /profile-setup after the user selects their role and confirms details.
    try {
      const email = authUser.email ?? "";
      const firstName =
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        email.split("@")[0];

      await db.insert(users).values({
        id: authUser.id,
        email,
        firstName,
        role: "student", // temporary default; updated during profile setup
        isEmailVerified: true, // Google OAuth emails are pre-verified
      });

      console.log(
        `[auth/callback] Created minimal record for Google OAuth user: ${email} (${authUser.id})`
      );

      // Redirect to profile setup (role selection, name, age confirmation)
      return NextResponse.redirect(`${origin}/profile-setup`);
    } catch (provisionError) {
      console.error(
        "[auth/callback] Failed to create OAuth user record:",
        provisionError
      );
      return NextResponse.redirect(`${origin}/login?error=setup_failed`);
    }
  }

  // ── Existing user: redirect to intended destination ──
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
