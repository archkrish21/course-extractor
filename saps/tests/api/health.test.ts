import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/v1/health/route";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/v1/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns healthy status when database is reachable", async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
  });

  it("returns unhealthy status when database is unreachable", async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("connection refused")
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
  });
});
