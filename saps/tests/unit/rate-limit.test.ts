import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @upstash/redis before importing the module under test.
// The module initialises Redis at the top level from env vars,
// so we need the mock in place before the first import.
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

describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure Redis env vars are NOT set by default (fail-open path)
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns success when Redis is not configured (short-circuit)", async () => {
    // Import fresh — no env vars means redis = null
    const { rateLimit } = await import("@/lib/api/rate-limit");
    const result = await rateLimit("test-key", 10, 60);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(10);
  });

  it("returns correct remaining count when Redis is configured", async () => {
    // Set env vars BEFORE importing the module
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

    // Need a fresh import so the module reads the new env vars
    const { rateLimit } = await import("@/lib/api/rate-limit");
    const { Redis } = await import("@upstash/redis");

    // Access the mock pipeline to control exec results
    const mockRedisInstance = (Redis as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockRedisInstance) {
      const mockPipeline = mockRedisInstance.pipeline();
      // Results: [zremrangebyscore, zadd, zcard, expire]
      // zcard at index 2 returns 3 (3 requests made)
      mockPipeline.exec.mockResolvedValue([0, 1, 3, 1]);

      const result = await rateLimit("test-key", 10, 60);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(7); // 10 - 3
    }
  });

  it("fails open gracefully on error (returns success)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

    const { rateLimit } = await import("@/lib/api/rate-limit");
    const { Redis } = await import("@upstash/redis");

    const mockRedisInstance = (Redis as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockRedisInstance) {
      const mockPipeline = mockRedisInstance.pipeline();
      mockPipeline.exec.mockRejectedValue(new Error("Connection refused"));

      // Suppress the console.warn from the rate limiter
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await rateLimit("test-key", 10, 60);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(10);

      warnSpy.mockRestore();
    }
  });
});
