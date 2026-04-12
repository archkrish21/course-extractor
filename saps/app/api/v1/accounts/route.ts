import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { accounts, accountMembers, studentProfiles, users, subscriptions, subscriptionPlans } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/require-same-origin";
import { requireAuth } from "@/lib/auth/get-user";

function generateClaimCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

const createAccountSchema = z.object({
  student_name: z.string().min(1).max(200),
  student_date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  grade_level: z.number().int().min(9).max(12),
  graduation_year: z.number().int().min(2024).max(2040),
});

/**
 * POST /api/v1/accounts
 * Parent creates a student account. Generates a claim code for the student.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const csrf = requireSameOrigin(request);
    if (csrf) return csrf;

    // Verify user is a parent
    const [userData] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userData || userData.role !== "parent") {
      return errorResponse("FORBIDDEN", "Only parents can create student accounts.", 403);
    }

    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { student_name, student_date_of_birth, grade_level, graduation_year } = parsed.data;

    // COPPA check: student must be at least 13 years old
    const dob = new Date(student_date_of_birth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 13) {
      return errorResponse(
        "FORBIDDEN",
        "Student must be at least 13 years old (COPPA compliance).",
        403
      );
    }

    // Generate claim code and expiration (90 days from now)
    const claimCode = generateClaimCode();
    const claimExpiresAt = new Date();
    claimExpiresAt.setDate(claimExpiresAt.getDate() + 90);

    // Create account, account member, and student profile in a transaction
    const result = await db.transaction(async (tx) => {
      // Create the account
      const [account] = await tx
        .insert(accounts)
        .values({
          studentName: student_name,
          studentDateOfBirth: student_date_of_birth,
          gradeLevel: grade_level,
          graduationYear: graduation_year,
          createdBy: user.id,
          billingContactId: user.id,
          claimCode,
          claimExpiresAt,
        })
        .returning();

      // Create account member for the parent
      await tx.insert(accountMembers).values({
        accountId: account.id,
        userId: user.id,
        role: "parent",
        canEdit: true,
      });

      return account;
    });

    return successResponse(
      {
        account: {
          id: result.id,
          student_name: result.studentName,
          claim_code: result.claimCode,
        },
        message: "Share the claim code with your child",
      },
      undefined,
      201
    );
  } catch (error) {
    console.error("[accounts] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * GET /api/v1/accounts
 * List accounts the authenticated user is a member of.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const results = await db
      .select({
        id: accounts.id,
        studentName: accounts.studentName,
        gradeLevel: accounts.gradeLevel,
        graduationYear: accounts.graduationYear,
        role: accountMembers.role,
        isClaimed: accounts.claimedAt,
        studentUserId: accounts.studentUserId,
        studentFirstName: sql<string | null>`(
          SELECT first_name FROM users WHERE id = ${accounts.studentUserId} LIMIT 1
        )`,
        studentLastName: sql<string | null>`(
          SELECT last_name FROM users WHERE id = ${accounts.studentUserId} LIMIT 1
        )`,
        state: accounts.state,
        schoolName: accounts.schoolName,
        subscriptionTier: sql<string | null>`(
          SELECT CASE WHEN s.status = 'trialing' THEN 'trial' ELSE sp.name END
          FROM subscriptions s
          JOIN subscription_plans sp ON s.subscription_plan_id = sp.id
          WHERE (s.account_id = ${accounts.id} OR s.user_id = ${accounts.studentUserId})
            AND s.status IN ('trialing', 'active', 'past_due')
          ORDER BY s.created_at DESC
          LIMIT 1
        )`,
      })
      .from(accountMembers)
      .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
      .where(eq(accountMembers.userId, user.id));

    const data = results.map((r) => ({
      id: r.id,
      student_name: r.studentName,
      grade_level: r.gradeLevel,
      graduation_year: r.graduationYear,
      role: r.role,
      is_claimed: r.isClaimed !== null,
      student_first_name: r.studentFirstName,
      student_last_name: r.studentLastName,
      state: r.state,
      school_name: r.schoolName,
      subscription_tier: r.subscriptionTier ?? "free",
    }));

    return successResponse(data);
  } catch (error) {
    console.error("[accounts] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
