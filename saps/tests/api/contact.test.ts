import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────

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

import { POST } from "@/app/api/v1/contact/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeJsonRequest(url: string, body: unknown, method = "POST"): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/v1/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
  });

  it("successfully stores a contact message", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/contact",
      { name: "Jane Doe", email: "jane@example.com", message: "Hello there" }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.received).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for missing name", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/contact",
      { email: "jane@example.com", message: "Hello there" }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for missing email", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/contact",
      { name: "Jane Doe", message: "Hello there" }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for missing message", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/contact",
      { name: "Jane Doe", email: "jane@example.com" }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email format", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/contact",
      { name: "Jane Doe", email: "not-an-email", message: "Hello there" }
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
