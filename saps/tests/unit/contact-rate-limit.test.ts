import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockRateLimit = vi.fn();

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/db", () => ({
  db: { execute: vi.fn().mockResolvedValue([]) },
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn(),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/v1/contact — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ success: false, remaining: 0 });

    const { POST } = await import("@/app/api/v1/contact/route");

    const request = new NextRequest("http://localhost:3000/api/v1/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({
        name: "Test",
        email: "test@example.com",
        message: "Hello",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("passes through when rate limit is not exceeded", async () => {
    mockRateLimit.mockResolvedValue({ success: true, remaining: 4 });

    const { POST } = await import("@/app/api/v1/contact/route");

    const request = new NextRequest("http://localhost:3000/api/v1/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({
        name: "Test",
        email: "test@example.com",
        message: "Hello",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("keys rate limit by caller IP", async () => {
    mockRateLimit.mockResolvedValue({ success: true, remaining: 4 });

    const { POST } = await import("@/app/api/v1/contact/route");

    const request = new NextRequest("http://localhost:3000/api/v1/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "5.6.7.8",
      },
      body: JSON.stringify({
        name: "Test",
        email: "test@example.com",
        message: "Hello",
      }),
    });

    await POST(request);
    expect(mockRateLimit).toHaveBeenCalledWith("contact:5.6.7.8", 5, 60);
  });
});
