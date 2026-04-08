import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ──────────────────────────────────────────────────────────────

const TEST_USER = { id: "user-1", email: "student@test.com" };

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockExecute = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings,
    }),
    { raw: vi.fn() }
  ),
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireAuth: vi.fn(),
}));

import { POST } from "@/app/api/v1/feedback/route";
import { requireAuth } from "@/lib/auth/get-user";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeJsonRequest(url: string, body: unknown, method = "POST"): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/v1/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
  });

  it("successfully submits feedback with rating and comment (201)", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/feedback",
      { rating: 4, comment: "Great tool!" }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.received).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("successfully submits feedback with rating only, no comment (201)", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/feedback",
      { rating: 3 }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.received).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for missing rating", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/feedback",
      { comment: "No rating provided" }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for rating out of range (0)", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/feedback",
      { rating: 0 }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for rating out of range (6)", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/feedback",
      { rating: 6 }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 })
    );

    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/feedback",
      { rating: 5 }
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
