import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api/response";
import { db } from "@/lib/db";
import { accounts, accountMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AccountContext {
  accountId: string;
  role: 'student' | 'parent' | 'guardian' | 'counselor';
  canEdit: boolean;
}

/**
 * Reads the Supabase session from cookies.
 * Returns the authenticated user or null if not authenticated.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  if (!user.email) {
    throw new Error(
      "User has no email address — phone/anonymous auth not supported"
    );
  }

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Same as getAuthenticatedUser but returns a 401 error response if not authenticated.
 * Use in API routes: const user = await requireAuth(); if (user instanceof Response) return user;
 */
export async function requireAuth(): Promise<AuthenticatedUser | Response> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  return user;
}

/**
 * Resolves the account context for a user.
 *
 * - If `accountId` is provided, verifies the user is a member of that account.
 * - If `accountId` is not provided and user role is 'student', finds their account
 *   via accounts.studentUserId.
 * - If `accountId` is not provided and user role is 'parent', returns null
 *   (parent must specify which student account).
 *
 * Returns { accountId, role, canEdit } or null if not a member / no account found.
 */
export async function getAccountContext(
  userId: string,
  accountId?: string
): Promise<AccountContext | null> {
  if (accountId) {
    // Verify the user is a member of the specified account
    const membership = await db
      .select({
        accountId: accountMembers.accountId,
        role: accountMembers.role,
        canEdit: accountMembers.canEdit,
      })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, accountId),
          eq(accountMembers.userId, userId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!membership) {
      return null;
    }

    return {
      accountId: membership.accountId,
      role: membership.role as AccountContext["role"],
      canEdit: membership.canEdit,
    };
  }

  // No accountId provided — try to resolve automatically
  // First, look up the user's role
  const userRow = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!userRow) {
    return null;
  }

  if (userRow.role === "student") {
    // Find the account where this user is the student
    const account = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.studentUserId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!account) {
      return null;
    }

    // Look up their membership for role/canEdit
    const membership = await db
      .select({
        role: accountMembers.role,
        canEdit: accountMembers.canEdit,
      })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, account.id),
          eq(accountMembers.userId, userId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!membership) {
      // Student is the account owner but not yet in accountMembers — fallback
      return {
        accountId: account.id,
        role: "student",
        canEdit: true,
      };
    }

    return {
      accountId: account.id,
      role: membership.role as AccountContext["role"],
      canEdit: membership.canEdit,
    };
  }

  // For parent/guardian/counselor without a specified accountId, return null.
  // They must specify which student account they want to act on.
  return null;
}
