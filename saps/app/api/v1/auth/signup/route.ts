import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import {
  users,
  studentProfiles,
  subscriptions,
  subscriptionPlans,
  accounts,
  accountMembers,
  legalDocuments,
  consentRecords,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { rateLimit } from "@/lib/api/rate-limit";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
    .regex(/[0-9]/, "Password must contain at least 1 digit")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least 1 special character"),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  role: z.enum(["student", "parent", "guardian", "counselor"]),
  name: z.string().min(1).max(200).optional(),
  state: z.string().length(2).optional(),
  school_name: z.string().min(1).max(200).optional(),
  tos_accepted: z.literal(true, {
    message: "You must agree to the Terms of Service and Privacy Policy.",
  }),
});

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export async function POST(request: NextRequest) {
  try {
    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    // Rate limit: 5 requests/minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimitResult = await rateLimit(`auth:signup:${ip}`, 5, 60);
    if (!rateLimitResult.success) {
      return errorResponse(
        "RATE_LIMITED",
        `Rate limit exceeded. Try again in ${rateLimitResult.resetAt - Math.floor(Date.now() / 1000)} seconds.`,
        429,
        { retry_after: rateLimitResult.resetAt - Math.floor(Date.now() / 1000) }
      );
    }

    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }

    const { email, password, date_of_birth, role: rawRole, name, state, school_name } = parsed.data;

    // Map "guardian" to "parent" for storage — they have identical behavior
    const role = rawRole === "guardian" ? "parent" : rawRole;

    // COPPA check: must be 13 or older
    const age = calculateAge(date_of_birth);
    if (age < 13) {
      return errorResponse(
        "COPPA_BLOCKED",
        "Users must be at least 13 years old to create an account.",
        403
      );
    }

    // Create user via Supabase Auth
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return errorResponse("EMAIL_EXISTS", "An account with this email already exists.", 409);
      }
      return errorResponse("AUTH_ERROR", authError.message, 400);
    }

    if (!authData.user) {
      return errorResponse("AUTH_ERROR", "Failed to create user account.", 500);
    }

    const userId = authData.user.id;
    const emailConfirmationPending = !authData.session;

    // Wrap all DB operations so we can clean up the Supabase auth user
    // if any insert fails — otherwise the user is stuck (email taken in
    // Supabase but no app-level records, so they can't re-register or log in).
    try {
      // Insert into users table
      const now = new Date();
      await db.insert(users).values({
        id: userId,
        email,
        firstName: name ?? email.split("@")[0],
        role,
        dateOfBirth: date_of_birth,
        isEmailVerified: false,
        tosAcceptedAt: now,
        ppAcceptedAt: now,
      });

      // Record consent for current legal documents
      const currentDocs = await db
        .select({ id: legalDocuments.id })
        .from(legalDocuments)
        .where(eq(legalDocuments.isCurrent, true));

      const userAgent = request.headers.get("user-agent") ?? null;
      for (const doc of currentDocs) {
        await db.insert(consentRecords).values({
          userId,
          legalDocumentId: doc.id,
          action: "accepted",
          ipAddress: ip,
          userAgent,
          consentedAt: now,
        });
      }

      if (role === "student") {
        // ── Student signup: create account, membership, profile, subscription ──

        // Derive student name from the `name` field or email prefix
        const studentName = name ?? email.split("@")[0];

        // Default graduation year: current year + 4 (assumed grade 9)
        const currentYear = new Date().getFullYear();
        const defaultGradYear = currentYear + 4;

        // Create the student-centric account
        const [newAccount] = await db
          .insert(accounts)
          .values({
            studentName,
            studentDateOfBirth: date_of_birth,
            gradeLevel: 9,
            graduationYear: defaultGradYear,
            state: state ?? "IL",
            schoolName: school_name ?? "Adlai E. Stevenson High School",
            studentUserId: userId,
            createdBy: userId,
            claimedAt: new Date(),
          })
          .returning({ id: accounts.id });

        // Create account membership (student role)
        await db.insert(accountMembers).values({
          accountId: newAccount.id,
          userId,
          role: "student",
          canEdit: true,
        });

        // Insert into student_profiles (as before)
        await db.insert(studentProfiles).values({
          userId,
          graduationYear: defaultGradYear,
          currentGradeLevel: 9,
        });

        // Create subscription on the account: 14-day trial on plus plan
        // Trial gives Plus-level features with restrictions (max 2 plans, no AI, no compare/export/share)
        const plusPlan = await db
          .select({ id: subscriptionPlans.id })
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.name, "plus"))
          .limit(1)
          .then((rows) => rows[0]);

        if (plusPlan) {
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);

          await db.insert(subscriptions).values({
            userId,
            accountId: newAccount.id,
            subscriptionPlanId: plusPlan.id,
            status: "trialing",
            trialEndsAt,
          });
        }

        return successResponse(
          {
            user: {
              id: userId,
              email,
              role,
            },
            account: {
              id: newAccount.id,
              student_name: studentName,
            },
            email_confirmation_pending: emailConfirmationPending,
          },
          undefined,
          201
        );
      }

      // ── Parent / Counselor signup: create user only, no account or subscription ──
      // Parents will either create an account for their child or join an existing one.

      return successResponse(
        {
          user: {
            id: userId,
            email,
            role,
          },
          email_confirmation_pending: emailConfirmationPending,
        },
        undefined,
        201
      );
    } catch (dbError) {
      // DB insert failed — delete the orphaned Supabase auth user so the
      // email isn't permanently claimed without usable app-level records.
      console.error("[signup] DB insert failed, rolling back auth user:", dbError);
      try {
        const supabaseAdmin = createSupabaseAdminClient();
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (cleanupError) {
        console.error("[signup] Failed to clean up orphaned auth user:", cleanupError);
      }
      throw dbError;
    }
  } catch (error) {
    console.error("[signup] Unexpected error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
