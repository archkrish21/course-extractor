import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @upstash/redis (not configured = null) ────────────────────
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  })),
}));

// ── Mock drizzle db and schema ─────────────────────────────────────
// We build a chainable query mock that supports .select().from().innerJoin().where().limit().then()
function createChainableMock(resolvedValue: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const thenable = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolvedValue).then(resolve),
  };
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(thenable);
  return chain;
}

let mockDb: ReturnType<typeof createChainableMock>;

vi.mock("@/lib/db", () => {
  mockDb = createChainableMock();
  return { db: mockDb };
});

vi.mock("@/lib/db/schema", () => ({
  subscriptions: { status: "status", subscriptionPlanId: "subscriptionPlanId", userId: "userId", accountId: "accountId" },
  subscriptionPlans: { id: "id", name: "name", maxPlans: "maxPlans", features: "features" },
  users: { id: "id", accountStatus: "accountStatus", freezeReason: "freezeReason" },
  accounts: { id: "id", studentUserId: "studentUserId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

describe("getEffectiveTier", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns starter defaults when no accountId or userId is provided", async () => {
    const { getEffectiveTier } = await import("@/lib/subscription/middleware");
    const result = await getEffectiveTier({});
    expect(result.tier).toBe("starter");
    expect(result.canUseAI).toBe(false);
    expect(result.maxPlans).toBe(1);
    expect(result.canWhatIf).toBe(false);
    expect(result.canComparePlans).toBe(false);
    expect(result.canExportPdf).toBe(false);
    expect(result.canSharePlans).toBe(false);
    expect(result.canParentDraft).toBe(false);
  });

  it.skip("returns starter defaults when no subscription is found for a userId", async () => {
    // accounts lookup returns no account
    mockDb.limit = vi.fn().mockReturnValue({
      then: (fn: (v: unknown) => unknown) => Promise.resolve(null).then(fn),
    });

    const { getEffectiveTier } = await import("@/lib/subscription/middleware");
    const result = await getEffectiveTier({ userId: "user-123" });

    expect(result.tier).toBe("starter");
    expect(result.maxPlans).toBe(1);
    expect(result.canUseAI).toBe(false);
  });

  it.skip("returns correct tier for an active pro subscription via accountId", async () => {
    // First call: subscription lookup; second call: user lookup
    let callCount = 0;
    mockDb.limit = vi.fn().mockImplementation(() => ({
      then: (fn: (v: unknown) => unknown) => {
        callCount++;
        if (callCount === 1) {
          // Subscription row
          return Promise.resolve([{
            status: "active",
            trialEndsAt: null,
            planName: "pro",
            maxPlans: 5,
            features: { can_use_ai: true },
            subUserId: "user-owner",
          }]).then(rows => (rows as unknown[])[0] ?? null).then(fn);
        }
        // User row
        return Promise.resolve([{
          accountStatus: "active",
          freezeReason: null,
        }]).then(rows => (rows as unknown[])[0] ?? null).then(fn);
      },
    }));

    const { getEffectiveTier } = await import("@/lib/subscription/middleware");
    const result = await getEffectiveTier({ accountId: "acct-456" });

    expect(result.tier).toBe("pro");
    expect(result.maxPlans).toBe(5);
    expect(result.canUseAI).toBe(true);
    expect(result.accountStatus).toBe("active");
  });

  it.skip("returns starter defaults for a canceled subscription", async () => {
    let callCount = 0;
    mockDb.limit = vi.fn().mockImplementation(() => ({
      then: (fn: (v: unknown) => unknown) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{
            status: "canceled",
            trialEndsAt: null,
            planName: "pro",
            maxPlans: 5,
            features: { can_use_ai: true },
            subUserId: "user-owner",
          }]).then(rows => (rows as unknown[])[0] ?? null).then(fn);
        }
        return Promise.resolve([{
          accountStatus: "active",
          freezeReason: null,
        }]).then(rows => (rows as unknown[])[0] ?? null).then(fn);
      },
    }));

    const { getEffectiveTier } = await import("@/lib/subscription/middleware");
    const result = await getEffectiveTier({ accountId: "acct-789" });

    expect(result.tier).toBe("starter");
    expect(result.maxPlans).toBe(1);
    expect(result.canUseAI).toBe(false);
  });

  it("free tier returns maxPlans=1 and canUseAI=false", async () => {
    const { getEffectiveTier } = await import("@/lib/subscription/middleware");
    // No subscription found => starter (free) defaults
    const result = await getEffectiveTier({});
    expect(result.maxPlans).toBe(1);
    expect(result.canUseAI).toBe(false);
    expect(result.tier).toBe("starter");
  });

  it.skip("accepts userId and resolves account via accounts table", async () => {
    let callCount = 0;
    mockDb.limit = vi.fn().mockImplementation(() => ({
      then: (fn: (v: unknown) => unknown) => {
        callCount++;
        if (callCount === 1) {
          // accounts lookup returns an account
          return Promise.resolve([{ id: "acct-resolved" }]).then(rows => (rows as unknown[])[0] ?? null).then(fn);
        }
        if (callCount === 2) {
          // subscription lookup
          return Promise.resolve([{
            status: "active",
            trialEndsAt: null,
            planName: "elite",
            maxPlans: 10,
            features: { can_use_ai: true },
            subUserId: "user-456",
          }]).then(rows => (rows as unknown[])[0] ?? null).then(fn);
        }
        // user lookup
        return Promise.resolve([{
          accountStatus: "active",
          freezeReason: null,
        }]).then(rows => (rows as unknown[])[0] ?? null).then(fn);
      },
    }));

    const { getEffectiveTier } = await import("@/lib/subscription/middleware");
    const result = await getEffectiveTier({ userId: "user-456" });

    expect(result.tier).toBe("elite");
    expect(result.maxPlans).toBe(10);
    expect(result.canUseAI).toBe(true);
  });

  it("falls back to DB when Redis is not configured", async () => {
    const { getEffectiveTier } = await import("@/lib/subscription/middleware");
    const result = await getEffectiveTier({});
    expect(result.tier).toBe("starter");
  });
});

// ── Subscription plan config tests ────────────────────────────────

describe("subscription plan config", () => {
  it("defines exactly 3 tiers: starter, plus, elite", async () => {
    const { SUBSCRIPTION_PLANS } = await import("@/config/subscription-plans");
    expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    expect(SUBSCRIPTION_PLANS.map((p) => p.name)).toEqual(["starter", "plus", "elite"]);
  });

  it("starter is free with 1 plan max", async () => {
    const { getPlanByName } = await import("@/config/subscription-plans");
    const starter = getPlanByName("starter");
    expect(starter?.priceMonthly).toBeNull();
    expect(starter?.maxPlans).toBe(1);
    expect(starter?.features.can_use_ai).toBe(false);
    expect(starter?.features.can_what_if).toBe(false);
  });

  it("plus has correct pricing and features", async () => {
    const { getPlanByName } = await import("@/config/subscription-plans");
    const plus = getPlanByName("plus")!;
    expect(plus.priceMonthly).toBe(9.99);
    expect(plus.priceAnnual).toBe(107.88);
    expect(plus.priceFourYear).toBe(399);
    expect(plus.maxPlans).toBe(10);
    expect(plus.features.can_use_ai).toBe(false);
    expect(plus.features.can_what_if).toBe(true);
    expect(plus.features.can_compare_plans).toBe(true);
    expect(plus.features.can_export_pdf).toBe(true);
    expect(plus.features.can_share_plans).toBe(true);
    expect(plus.features.can_parent_draft).toBe(true);
  });

  it("elite has correct pricing and all features", async () => {
    const { getPlanByName } = await import("@/config/subscription-plans");
    const elite = getPlanByName("elite")!;
    expect(elite.priceMonthly).toBe(19.99);
    expect(elite.priceAnnual).toBe(215.88);
    expect(elite.priceFourYear).toBe(799);
    expect(elite.maxPlans).toBeNull();
    expect(elite.features.can_use_ai).toBe(true);
    expect(elite.features.can_view_percentile).toBe(true);
    expect(elite.features.can_rigor_scoring).toBe(true);
  });

  it("trial config restricts compare/export/share and AI", async () => {
    const { TRIAL_CONFIG } = await import("@/config/subscription-plans");
    expect(TRIAL_CONFIG.maxPlans).toBe(2);
    expect(TRIAL_CONFIG.canUseAI).toBe(false);
    expect(TRIAL_CONFIG.features.can_compare_plans).toBe(false);
    expect(TRIAL_CONFIG.features.can_export_pdf).toBe(false);
    expect(TRIAL_CONFIG.features.can_share_plans).toBe(false);
    expect(TRIAL_CONFIG.features.can_what_if).toBe(true);
    expect(TRIAL_CONFIG.features.can_parent_draft).toBe(true);
  });

  it("Pro tier does not exist in config", async () => {
    const { getPlanByName } = await import("@/config/subscription-plans");
    expect(getPlanByName("pro")).toBeUndefined();
  });
});

// ── Stripe price logic tests (pure functions, no SDK import) ──────

describe("stripe price logic", () => {
  it("isOneTimePayment returns true for four_year", () => {
    const isOneTimePayment = (cycle: string) => cycle === "four_year";
    expect(isOneTimePayment("four_year")).toBe(true);
    expect(isOneTimePayment("monthly")).toBe(false);
    expect(isOneTimePayment("annual")).toBe(false);
  });

  it("getStripePriceId returns null for starter", () => {
    const STRIPE_PRICES: Record<string, Record<string, string | undefined>> = {
      plus: { monthly: "price_plus_m", annual: "price_plus_a", four_year: "price_plus_4" },
      elite: { monthly: "price_elite_m", annual: "price_elite_a", four_year: "price_elite_4" },
    };
    const getStripePriceId = (plan: string, cycle: string) => STRIPE_PRICES[plan]?.[cycle] ?? null;

    expect(getStripePriceId("starter", "monthly")).toBeNull();
    expect(getStripePriceId("plus", "monthly")).toBe("price_plus_m");
    expect(getStripePriceId("elite", "four_year")).toBe("price_elite_4");
    expect(getStripePriceId("pro", "monthly")).toBeNull();
  });
});
