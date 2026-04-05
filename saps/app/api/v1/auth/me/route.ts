import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/get-user";

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's basic info (email, role).
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    const [userData] = await db
      .select({ email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userData) {
      return errorResponse("NOT_FOUND", "User not found.", 404);
    }

    return successResponse({
      email: userData.email,
      role: userData.role,
    });
  } catch (error) {
    console.error("[auth/me] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
