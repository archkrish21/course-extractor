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
 * In both cases, marks the user's email as verified in our DB and redirects
 * to the login page with a success message.
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
  }
  // Flow 2: Direct token_hash verification
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "email",
    });
    if (error) {
      console.error("[auth/confirm] OTP verification failed:", error.message);
      return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
    }
  }
  // No valid params
  else {
    return NextResponse.redirect(`${origin}/login?error=invalid_confirmation_link`);
  }

  // Mark email as verified in the app's users table
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
