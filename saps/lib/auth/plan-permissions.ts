import { db } from "@/lib/db";
import { planShares, accountMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type PlanPermission = "owner" | "view" | "edit" | "delete";

export interface PlanAccess {
  permission: PlanPermission;
  isHidden: boolean;
}

const PERMISSION_LEVEL: Record<PlanPermission, number> = {
  view: 1,
  edit: 2,
  delete: 3,
  owner: 4,
};

/**
 * Check if a permission level satisfies a required permission.
 * Hierarchy: owner > delete > edit > view
 */
export function hasPermission(
  userPermission: PlanPermission,
  requiredPermission: PlanPermission
): boolean {
  return PERMISSION_LEVEL[userPermission] >= PERMISSION_LEVEL[requiredPermission];
}

/**
 * Get a user's access to a specific plan.
 * First checks plan_shares table, then falls back to account_members for backward compatibility.
 */
export async function getPlanAccess(
  userId: string,
  planId: string,
  accountId?: string | null
): Promise<PlanAccess | null> {
  // Check plan_shares first
  const [share] = await db
    .select({
      permission: planShares.permission,
      isHidden: planShares.isHidden,
    })
    .from(planShares)
    .where(and(eq(planShares.planId, planId), eq(planShares.userId, userId)))
    .limit(1);

  if (share) {
    return {
      permission: share.permission as PlanPermission,
      isHidden: share.isHidden,
    };
  }

  // Backward compatibility: if no plan_shares row, fall back to account membership
  if (accountId) {
    const [membership] = await db
      .select({
        role: accountMembers.role,
        canEdit: accountMembers.canEdit,
      })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.userId, userId),
          eq(accountMembers.accountId, accountId)
        )
      )
      .limit(1);

    if (membership) {
      return {
        permission: membership.canEdit ? "edit" : "view",
        isHidden: false,
      };
    }
  }

  return null;
}
