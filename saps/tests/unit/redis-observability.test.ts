import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    pipeline: vi.fn().mockReturnValue({
      zremrangebyscore: vi.fn(),
      zadd: vi.fn(),
      zcard: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(),
    }),
  })),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Redis observability — startup check", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("logs error at startup when Redis is missing in production", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = "production";

    const { runStartupChecks } = await import("@/lib/api/startup-checks");
    runStartupChecks();

    expect(mockLoggerError).toHaveBeenCalledWith(
      { check: "redis" },
      expect.stringContaining("UPSTASH_REDIS_REST_URL not set in production")
    );
  });

  it("does not log when Redis is configured in production", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    process.env.NODE_ENV = "production";

    const { runStartupChecks } = await import("@/lib/api/startup-checks");
    runStartupChecks();

    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("does not log in development even without Redis", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = "development";

    const { runStartupChecks } = await import("@/lib/api/startup-checks");
    runStartupChecks();

    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});

describe("Redis observability — rate-limit fall-through warning", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("logs warning on fall-through when Redis is missing in production", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = "production";

    const { rateLimit } = await import("@/lib/api/rate-limit");
    const result = await rateLimit("test-key", 10, 60);

    expect(result.success).toBe(true);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ key: "test-key" }),
      expect.stringContaining("Redis not configured in production")
    );
  });

  it("does not log warning in development without Redis", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = "development";

    const { rateLimit } = await import("@/lib/api/rate-limit");
    await rateLimit("test-key", 10, 60);

    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});
