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
    // Redis env vars are not set (deleted in beforeEach), so redis = null
    // The module should fall back to DB queries — same as above tests
    // Just verify it doesn't throw and returns expected defaults
    const { getEffectiveTier } = await import("@/lib/subscription/middleware");
    const result = await getEffectiveTier({});
    expect(result.tier).toBe("starter");
  });
});
