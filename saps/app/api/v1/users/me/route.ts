import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/get-user";
import { successResponse, errorResponse } from "@/lib/api/response";

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
