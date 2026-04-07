import { Redis } from "@upstash/redis";
import { db } from "@/lib/db";
import { subscriptions, subscriptionPlans, users, accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Only initialize Redis if credentials are configured
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisConfigured = !!(REDIS_URL && REDIS_TOKEN && REDIS_URL !== "undefined" && REDIS_TOKEN !== "undefined");
const redis = redisConfigured ? new Redis({ url: REDIS_URL!, token: REDIS_TOKEN! }) : null;
let subRedisAvailable = redisConfigured;

const CACHE_TTL_SECONDS = 300; // 5 minutes

export interface SubscriptionContext {
  tier: string;
  accountStatus: string;
  freezeReason: string | null;
  canUseAI: boolean;
  maxPlans: number;
  maxLinkedAccounts: number;
  canWhatIf: boolean;
  canComparePlans: boolean;
  canExportPdf: boolean;
  canSharePlans: boolean;
  canParentDraft: boolean;
  canViewPercentile: boolean;
  canRigorScoring: boolean;
  canCreateGoals: boolean;
}

const STARTER_DEFAULTS: SubscriptionContext = {
  tier: "starter",
  accountStatus: "active",
  freezeReason: null,
  canUseAI: false,
  maxPlans: 1,
  maxLinkedAccounts: 3,
  canWhatIf: false,
  canComparePlans: false,
  canExportPdf: false,
  canSharePlans: false,
  canParentDraft: false,
  canViewPercentile: false,
  canRigorScoring: false,
  canCreateGoals: false,
};

/**
 * Gets the effective subscription tier.
 *
 * Accepts either an accountId or a userId (or both). Resolution order:
 * 1. If `accountId` is provided, look up subscription by accountId.
 * 2. If only `userId` is provided, find the user's account via accounts.studentUserId
 *    (works for students; parents must provide accountId).
 * 3. Falls back to legacy userId-based lookup for backward compatibility.
 *
 * Checks Redis cache first (5-min TTL), falls back to DB.
 */
export async function getEffectiveTier(
  params: { accountId?: string; userId?: string }
): Promise<SubscriptionContext> {
  const { accountId, userId } = params;

  // Resolve the effective accountId
  let resolvedAccountId = accountId;

  if (!resolvedAccountId && userId) {
    // Try to find the user's account via accounts.studentUserId
    const account = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.studentUserId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (account) {
      resolvedAccountId = account.id;
    }
  }

  // If we have an accountId, use account-based lookup
  if (resolvedAccountId) {
    return getEffectiveTierByAccount(resolvedAccountId, userId);
  }

  // Fallback: legacy userId-based lookup for backward compatibility
  if (userId) {
    return getEffectiveTierByUserId(userId);
  }

  return STARTER_DEFAULTS;
}

/**
 * Account-based subscription lookup (new path).
 */
async function getEffectiveTierByAccount(
  accountId: string,
  userId?: string
): Promise<SubscriptionContext> {
  const cacheKey = `account:${accountId}:subscription`;

  try {
    const cached = redis && subRedisAvailable ? await redis.get<SubscriptionContext>(cacheKey) : null;
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn(
      "[subscription] Redis read failed, falling back to DB:",
      error
    );
  }

  // Query subscription by accountId
  const row = await db
    .select({
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
      planName: subscriptionPlans.name,
      maxPlans: subscriptionPlans.maxPlans,
      features: subscriptionPlans.features,
      subUserId: subscriptions.userId,
    })
    .from(subscriptions)
    .innerJoin(
      subscriptionPlans,
      eq(subscriptions.subscriptionPlanId, subscriptionPlans.id)
    )
    .where(eq(subscriptions.accountId, accountId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    return STARTER_DEFAULTS;
  }

  // Get account status from the subscription's user (billing contact / owner)
  const ownerUserId = userId ?? row.subUserId;
  const userRow = ownerUserId
    ? await db
        .select({
          accountStatus: users.accountStatus,
          freezeReason: users.freezeReason,
        })
        .from(users)
        .where(eq(users.id, ownerUserId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const tier = computeEffectiveTier({
    ...row,
    features: (row.features as Record<string, unknown>) ?? null,
    accountStatus: userRow?.accountStatus ?? "active",
    freezeReason: userRow?.freezeReason ?? null,
  });

  try {
    if (redis && subRedisAvailable) await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(tier));
  } catch (error) {
    console.warn("[subscription] Redis write failed:", error);
  }

  return tier;
}

/**
 * Legacy userId-based subscription lookup (backward compatibility).
 */
async function getEffectiveTierByUserId(
  userId: string
): Promise<SubscriptionContext> {
  const cacheKey = `user:${userId}:subscription`;

  try {
    const cached = redis && subRedisAvailable ? await redis.get<SubscriptionContext>(cacheKey) : null;
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn(
      "[subscription] Redis read failed, falling back to DB:",
      error
    );
  }

  // Cache miss: query DB
  const row = await db
    .select({
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
      planName: subscriptionPlans.name,
      maxPlans: subscriptionPlans.maxPlans,
      features: subscriptionPlans.features,
      accountStatus: users.accountStatus,
      freezeReason: users.freezeReason,
    })
    .from(subscriptions)
    .innerJoin(
      subscriptionPlans,
      eq(subscriptions.subscriptionPlanId, subscriptionPlans.id)
    )
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .where(eq(subscriptions.userId, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    return STARTER_DEFAULTS;
  }

  const tier = computeEffectiveTier({
    ...row,
    features: (row.features as Record<string, unknown>) ?? null,
  });

  try {
    if (redis && subRedisAvailable) await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(tier));
  } catch (error) {
    console.warn("[subscription] Redis write failed:", error);
  }

  return tier;
}

interface SubscriptionRow {
  status: string;
  trialEndsAt: Date | string | null;
  planName: string;
  maxPlans: number | null;
  features: Record<string, unknown> | null;
  accountStatus: string;
  freezeReason: string | null;
}

/**
 * Computes the effective tier from a subscription DB row.
 * Handles trialing (check trial_ends_at), active, past_due.
 * Defaults to starter for canceled/paused/expired trials.
 */
/** Extract all feature flags from a plan's features JSONB */
function extractFeatures(features: Record<string, unknown>, maxPlans: number | null): Omit<SubscriptionContext, "tier" | "accountStatus" | "freezeReason"> {
  return {
    canUseAI: !!features.can_use_ai,
    maxPlans: maxPlans ?? Infinity,
    maxLinkedAccounts: (features.max_linked_accounts as number) ?? 3,
    canWhatIf: !!features.can_what_if,
    canComparePlans: !!features.can_compare_plans,
    canExportPdf: !!features.can_export_pdf,
    canSharePlans: !!features.can_share_plans,
    canParentDraft: !!features.can_parent_draft,
    canViewPercentile: !!features.can_view_percentile,
    canRigorScoring: !!features.can_rigor_scoring,
    canCreateGoals: !!features.can_create_goals,
  };
}

function computeEffectiveTier(row: SubscriptionRow): SubscriptionContext {
  const features = (row.features ?? {}) as Record<string, unknown>;
  const accountStatus = row.accountStatus;
  const freezeReason = row.freezeReason;

  // Trialing: restricted Plus-level features (no compare/export/share, no AI, max 2 plans)
  if (row.status === "trialing") {
    const trialEnd = row.trialEndsAt
      ? new Date(row.trialEndsAt)
      : new Date(0);
    if (new Date() < trialEnd) {
      return {
        tier: "trial",
        accountStatus,
        freezeReason,
        canUseAI: false,
        maxPlans: 2,
        maxLinkedAccounts: 3,
        canWhatIf: true,
        canComparePlans: false,
        canExportPdf: false,
        canSharePlans: false,
        canParentDraft: true,
        canViewPercentile: false,
        canRigorScoring: false,
        canCreateGoals: true,
      };
    }
    // Trial expired: fall through to starter
  }

  // Active or past_due: use the subscription plan tier
  if (row.status === "active" || row.status === "past_due") {
    // Pro backward compatibility: treat as Plus
    const effectivePlanName = row.planName === "pro" ? "plus" : row.planName;
    return {
      tier: effectivePlanName,
      accountStatus,
      freezeReason,
      ...extractFeatures(features, row.maxPlans),
    };
  }

  // Canceled, paused, or expired trial: starter defaults
  return {
    ...STARTER_DEFAULTS,
    accountStatus,
    freezeReason,
  };
}

/**
 * Invalidate the cached subscription tier.
 * Call this after subscription changes (webhook, upgrade, etc.).
 * Pass accountId to invalidate the account-based cache, userId for the legacy cache, or both.
 */
export async function invalidateSubscriptionCache(
  params: { accountId?: string; userId?: string }
): Promise<void> {
  const keys: string[] = [];
  if (params.accountId) {
    keys.push(`account:${params.accountId}:subscription`);
  }
  if (params.userId) {
    keys.push(`user:${params.userId}:subscription`);
  }

  if (keys.length === 0) return;

  try {
    if (redis && subRedisAvailable) await Promise.all(keys.map((key) => redis.del(key)));
  } catch (error) {
    console.warn("[subscription] Redis invalidation failed:", error);
  }
}
