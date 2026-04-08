import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  accountMembers,
  fourYearPlans,
  planCourses,
  planShares,
  studentProfiles,
  gpaSnapshots,
  consentRecords,
  legalDocuments,
  subscriptions,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/get-user";
import { successResponse, errorResponse } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const notificationChannelSchema = z.object({
  email: z.boolean().optional(),
  in_app: z.boolean().optional(),
});

const updatePreferencesSchema = z.object({
  notification_preferences: z.record(z.string(), notificationChannelSchema),
});

// Valid notification preference keys (based on the DB default JSONB structure)
const VALID_NOTIFICATION_KEYS = new Set([
  "alert_triggered",
  "catalog_update",
  "grade_reminder",
  "prereq_gap",
  "gpa_digest",
  "plan_milestone",
  "course_removed",
  "grade_below_target",
  "dual_credit_opportunity",
  "year_end_reminder",
  "trial_expiry_warning",
  "account_frozen",
  "graduation_detected",
]);

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    const body = await request.json();
    const parsed = updatePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        400
      );
    }

    const { notification_preferences } = parsed.data;

    // Validate that all keys are recognized notification types
    const invalidKeys = Object.keys(notification_preferences).filter(
      (key) => !VALID_NOTIFICATION_KEYS.has(key)
    );
    if (invalidKeys.length > 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Unrecognized notification types: ${invalidKeys.join(", ")}`,
        400
      );
    }

    // Get current preferences
    const currentUser = await db
      .select({ notificationPreferences: users.notificationPreferences })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!currentUser) {
      return errorResponse("NOT_FOUND", "User not found.", 404);
    }

    // Merge new preferences with existing ones
    const currentPrefs =
      (currentUser.notificationPreferences as Record<
        string,
        { email: boolean; in_app: boolean }
      >) ?? {};
    const mergedPrefs = { ...currentPrefs };

    for (const [key, value] of Object.entries(notification_preferences)) {
      mergedPrefs[key] = {
        email: value.email ?? mergedPrefs[key]?.email ?? true,
        in_app: value.in_app ?? mergedPrefs[key]?.in_app ?? true,
      };
    }

    // Update user record
    await db
      .update(users)
      .set({ notificationPreferences: mergedPrefs })
      .where(eq(users.id, user.id));

    return successResponse({
      notification_preferences: mergedPrefs,
    });
  } catch (error) {
    console.error("[users/me] Unexpected error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}

/**
 * GET /api/v1/users/me
 * Export user data as JSON — user-friendly format without internal IDs.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const [userData] = await db
      .select({ email: users.email, role: users.role, dateOfBirth: users.dateOfBirth, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const userAccounts = await db
      .select({
        accountId: accountMembers.accountId,
        role: accountMembers.role,
        studentName: accounts.studentName,
        gradeLevel: accounts.gradeLevel,
        graduationYear: accounts.graduationYear,
      })
      .from(accountMembers)
      .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
      .where(eq(accountMembers.userId, user.id));

    // Fetch primary plan with courses for each account
    const accountPlans = [];
    for (const acct of userAccounts) {
      const [primaryPlan] = await db
        .select({ id: fourYearPlans.id, name: fourYearPlans.name, schoolYear: fourYearPlans.schoolYear })
        .from(fourYearPlans)
        .where(and(eq(fourYearPlans.accountId, acct.accountId), eq(fourYearPlans.isPrimary, true)))
        .limit(1);

      if (primaryPlan) {
        const courses = await db
          .select({
            code: sql<string>`(SELECT code FROM courses WHERE courses.id = ${planCourses.courseId})`,
            name: sql<string>`(SELECT name FROM courses WHERE courses.id = ${planCourses.courseId})`,
            gradeLevel: planCourses.gradeLevel,
            semester: planCourses.semester,
            status: planCourses.status,
            grade: planCourses.plannedGrade,
          })
          .from(planCourses)
          .where(eq(planCourses.planId, primaryPlan.id))
          .orderBy(planCourses.gradeLevel, planCourses.semester);

        // Calculate GPA
        const { calculateGPA } = await import("@/lib/gpa/calc");
        const gpaInput = courses.map((c) => ({
          creditValue: "1.0",
          creditType: "CP",
          code: c.code,
          plannedGrade: c.grade,
          status: c.status as "planned" | "enrolled" | "completed" | "dropped",
          gpaWaiver: false,
          gpaWaiverApplied: false,
        }));
        const cumulative = calculateGPA(gpaInput, "actual");
        const projected = calculateGPA(gpaInput, "projected");

        accountPlans.push({
          student_name: acct.studentName,
          plan_name: primaryPlan.name,
          school_year: primaryPlan.schoolYear,
          gpa: {
            cumulative_unweighted: cumulative.unweighted,
            cumulative_weighted: cumulative.weighted,
            projected_unweighted: projected.unweighted,
            projected_weighted: projected.weighted,
          },
          courses: courses.map((c) => ({
            code: c.code,
            name: c.name,
            grade_level: c.gradeLevel,
            semester: c.semester,
            status: c.status,
            grade: c.grade,
          })),
        });
      }
    }

    const consents = await db
      .select({
        documentType: legalDocuments.type,
        documentVersion: legalDocuments.version,
        action: consentRecords.action,
        consentedAt: consentRecords.consentedAt,
      })
      .from(consentRecords)
      .innerJoin(legalDocuments, eq(consentRecords.legalDocumentId, legalDocuments.id))
      .where(eq(consentRecords.userId, user.id));

    const [subscription] = await db
      .select({
        status: subscriptions.status,
        billingCycle: subscriptions.billingCycle,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt,
        planName: sql<string>`(SELECT name FROM subscription_plans WHERE id = ${subscriptions.subscriptionPlanId})`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    return successResponse({
      exported_at: new Date().toISOString(),
      user: {
        email: userData?.email,
        role: userData?.role,
        date_of_birth: userData?.dateOfBirth,
        account_created: userData?.createdAt,
      },
      accounts: userAccounts.map((a) => ({
        role: a.role,
        student_name: a.studentName,
        grade_level: a.gradeLevel,
        graduation_year: a.graduationYear,
      })),
      plans: accountPlans,
      consent_history: consents.map((c) => ({
        document: c.documentType === "terms_of_service" ? "Terms of Service" : "Privacy Policy",
        version: c.documentVersion,
        action: c.action,
        date: c.consentedAt,
      })),
      subscription: subscription
        ? {
            plan: subscription.planName?.charAt(0).toUpperCase() + subscription.planName?.slice(1),
            status: subscription.status,
            billing_cycle: subscription.billingCycle === "four_year" ? "4-Year" : subscription.billingCycle === "annual" ? "Annual" : "Monthly",
            period_start: subscription.currentPeriodStart,
            period_end: subscription.currentPeriodEnd,
            trial_ends: subscription.trialEndsAt,
            started: subscription.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[users/me] GET export error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * DELETE /api/v1/users/me
 * Permanently delete the user's account and all associated data.
 * Consent records are anonymized (userId set to null), not deleted.
 */
export async function DELETE() {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    // Cancel Stripe subscription and delete Stripe customer
    try {
      const [sub] = await db
        .select({
          stripeSubscriptionId: subscriptions.stripeSubscriptionId,
          stripeCustomerId: subscriptions.stripeCustomerId,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (sub) {
        const { requireStripe } = await import("@/lib/stripe/client");
        const stripe = requireStripe();
        // Cancel subscription first
        if (sub.stripeSubscriptionId) {
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        }
        // Delete customer (removes all payment methods, invoices from Stripe)
        if (sub.stripeCustomerId) {
          await stripe.customers.del(sub.stripeCustomerId);
        }
      }
    } catch (stripeErr) {
      console.error("[users/me] Stripe cleanup failed (non-fatal):", stripeErr);
    }

    // Collect account IDs before deletion (needed for Redis cleanup later)
    const userAccountIds = await db
      .select({ accountId: accountMembers.accountId })
      .from(accountMembers)
      .where(eq(accountMembers.userId, user.id));

    // Anonymize consent records (retain for audit, remove user link)
    await db
      .update(consentRecords)
      .set({ userId: null })
      .where(eq(consentRecords.userId, user.id));

    // Clean up FK references
    await db.delete(gpaSnapshots).where(eq(gpaSnapshots.studentId, user.id));
    await db.delete(planShares).where(eq(planShares.userId, user.id));
    await db.execute(sql`DELETE FROM plan_shares WHERE granted_by = ${user.id}`);
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.delete(studentProfiles).where(eq(studentProfiles.userId, user.id));
    await db.delete(accountMembers).where(eq(accountMembers.userId, user.id));

    // Null out FK references before deleting accounts
    await db.execute(sql`UPDATE accounts SET billing_contact_id = NULL WHERE billing_contact_id = ${user.id}`);
    await db.execute(sql`UPDATE four_year_plans SET created_by = NULL WHERE created_by = ${user.id}`);
    await db.execute(sql`UPDATE account_invite_codes SET created_by = NULL WHERE created_by = ${user.id}`);
    await db.execute(sql`UPDATE account_invite_codes SET claimed_by = NULL WHERE claimed_by = ${user.id}`);

    // Delete accounts where this user is the student (CASCADE handles plans, courses, etc.)
    await db.delete(accounts).where(eq(accounts.studentUserId, user.id));

    // Delete the user
    await db.delete(users).where(eq(users.id, user.id));

    // Delete from Supabase auth (requires service role key)
    try {
      const supabase = createSupabaseAdminClient();
      await supabase.auth.admin.deleteUser(user.id);
    } catch (authErr) {
      console.error("[users/me] Supabase auth deletion failed (non-fatal):", authErr);
    }

    // Clear Redis cache (subscription tier, rate limit keys)
    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (redisUrl && redisToken) {
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({ url: redisUrl, token: redisToken });
        // Delete all cache keys for this user's accounts (collected before deletion)
        for (const { accountId } of userAccountIds) {
          await redis.del(`account:${accountId}:subscription`);
        }
        // Delete rate limit keys
        await redis.del(`auth:signup:${user.id}`);
        await redis.del(`gpa-snapshots:get:${user.id}`);
        await redis.del(`gpa-snapshots:post:${user.id}`);
        await redis.del(`year-end:${user.id}`);
      }
    } catch (redisErr) {
      console.error("[users/me] Redis cleanup failed (non-fatal):", redisErr);
    }

    // Delete PostHog person data
    try {
      const posthogKey = process.env.POSTHOG_PERSONAL_API_KEY;
      const posthogProjectId = process.env.POSTHOG_PROJECT_ID;
      if (posthogKey && posthogProjectId) {
        await fetch(
          `https://us.posthog.com/api/projects/${posthogProjectId}/persons/?distinct_id=${user.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${posthogKey}` },
          }
        );
      }
    } catch (phErr) {
      console.error("[users/me] PostHog cleanup failed (non-fatal):", phErr);
    }

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("[users/me] DELETE error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
