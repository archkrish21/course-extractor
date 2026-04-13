import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Handle Supabase email confirmation callback.
 *
 * Supports two flows:
 * 1. PKCE flow: Supabase redirects here with ?code=... after verifying the
 *    email token. We exchange the code for a session.
 * 2. Token hash flow: Direct ?token_hash=...&type=signup params for OTP
 *    verification.
 *
 * After verification:
 * - Recovery (password reset): redirect to /update-password
 * - Signup/email confirmation: mark email verified, redirect to /login
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createSupabaseServerClient();

  // Flow 1: PKCE code exchange (Supabase already verified the email)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/confirm] Code exchange failed:", error.message);
      return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
    }

    // Recovery flow — redirect to update-password page (user has a session now)
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/update-password`);
    }
  }
  // Flow 2: Direct token_hash verification
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "email" | "recovery",
    });
    if (error) {
      console.error("[auth/confirm] OTP verification failed:", error.message);
      return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
    }

    // Recovery flow — redirect to update-password page
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/update-password`);
    }
  }
  // No valid params
  else {
    return NextResponse.redirect(`${origin}/login?error=invalid_confirmation_link`);
  }

  // Mark email as verified in the app's users table (signup/email flows only)
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (authUser) {
    await db
      .update(users)
      .set({ isEmailVerified: true })
      .where(eq(users.id, authUser.id));
  }

  return NextResponse.redirect(`${origin}/login?confirmed=true`);
}
