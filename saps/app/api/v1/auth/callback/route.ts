import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  users,
  studentProfiles,
  subscriptions,
  subscriptionPlans,
  accounts,
  accountMembers,
} from "@/lib/db/schema";
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
    // ── First-time Google OAuth user: provision all app records ──
    try {
      const email = authUser.email ?? "";
      // Default role for Google OAuth users: student
      // (parents/counselors can change role later in settings)
      const role = "student";
      const studentName =
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        email.split("@")[0];

      // Create users row
      await db.insert(users).values({
        id: authUser.id,
        email,
        role,
        isEmailVerified: true, // Google OAuth emails are pre-verified
      });

      // Default graduation year: current year + 4 (assumed grade 9)
      const currentYear = new Date().getFullYear();
      const defaultGradYear = currentYear + 4;

      // Create the student-centric account
      const [newAccount] = await db
        .insert(accounts)
        .values({
          studentName,
          gradeLevel: 9,
          graduationYear: defaultGradYear,
          studentUserId: authUser.id,
          createdBy: authUser.id,
          claimedAt: new Date(),
        })
        .returning({ id: accounts.id });

      // Create account membership (student role)
      await db.insert(accountMembers).values({
        accountId: newAccount.id,
        userId: authUser.id,
        role: "student",
        canEdit: true,
      });

      // Create student profile
      await db.insert(studentProfiles).values({
        userId: authUser.id,
        graduationYear: defaultGradYear,
        currentGradeLevel: 9,
      });

      // Create subscription: 14-day Elite trial
      const elitePlan = await db
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, "elite"))
        .limit(1)
        .then((rows) => rows[0]);

      if (elitePlan) {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);

        await db.insert(subscriptions).values({
          userId: authUser.id,
          accountId: newAccount.id,
          subscriptionPlanId: elitePlan.id,
          status: "trialing",
          trialEndsAt,
        });
      }

      console.log(
        `[auth/callback] Provisioned new Google OAuth user: ${email} (${authUser.id})`
      );

      // Redirect to consent page for first-time users (then onboarding)
      return NextResponse.redirect(`${origin}/consent?next=/onboarding`);
    } catch (provisionError) {
      console.error(
        "[auth/callback] Failed to provision OAuth user:",
        provisionError
      );
      // User is authenticated but provisioning failed — redirect to dashboard
      // and let the app handle the missing profile gracefully
      return NextResponse.redirect(`${origin}/dashboard?error=setup_incomplete`);
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
