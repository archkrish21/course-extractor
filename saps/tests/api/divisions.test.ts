import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test fixtures ─────────────────────────────────────────────────────────

const TEST_USER = { id: "user-1", email: "student@test.com" };

const FAKE_VERSION = { id: "ver-2026" };

// Mirrors what the SQL would return for the local DB after the VOC fix:
// 9 user-facing divisions, with the new "Lake County Tech Campus" department
// nested under Applied Arts. Summer-only divisions (Student Learning
// Programs / Student Services / Special Education) are absent because the
// route's WHERE clause excludes them.
const FAKE_ROWS = [
  { divisionId: "d-aa", divisionName: "Applied Arts", divisionCode: "APPLIED_ARTS",
    departmentId: "dep-bus", departmentName: "Business Education" },
  { divisionId: "d-aa", divisionName: "Applied Arts", divisionCode: "APPLIED_ARTS",
    departmentId: "dep-de",  departmentName: "Driver Education" },
  { divisionId: "d-aa", divisionName: "Applied Arts", divisionCode: "APPLIED_ARTS",
    departmentId: "dep-fcs", departmentName: "Family and Consumer Sciences" },
  { divisionId: "d-aa", divisionName: "Applied Arts", divisionCode: "APPLIED_ARTS",
    departmentId: "dep-tc",  departmentName: "Lake County Tech Campus" },
  { divisionId: "d-fa", divisionName: "Fine Arts",   divisionCode: "FA",
    departmentId: "dep-dnc", departmentName: "Dance" },
  { divisionId: "d-fa", divisionName: "Fine Arts",   divisionCode: "FA",
    departmentId: "dep-mus", departmentName: "Music" },
];

// ── Mocks ─────────────────────────────────────────────────────────────────

let versionResolve: unknown = [FAKE_VERSION];
let rowsResolve: unknown = FAKE_ROWS;
let callCount = 0;

function buildChain(resolveValue: () => unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.selectDistinct = vi.fn().mockImplementation(self);
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.innerJoin = vi.fn().mockImplementation(self);
  chain.leftJoin = vi.fn().mockImplementation(self);
  chain.orderBy = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.then = vi.fn().mockImplementation(
    (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolveValue())),
  );
  return chain;
}

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, {
    get(_target, prop) {
      // First call to `db.select(...)` is the latestVersion fetch; the second
      // is the divisions/departments query. Switch the resolved value
      // accordingly so a single mock chain can serve both.
      callCount += 1;
      const value = callCount === 1 ? () => versionResolve : () => rowsResolve;
      const chain = buildChain(value);
      const fn = chain[prop as string];
      return fn;
    },
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  asc: vi.fn((col: unknown) => ({ type: "asc", col })),
  isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings: Array.from(strings),
    }),
    { raw: vi.fn() },
  ),
}));

vi.mock("@/lib/db/schema", () => ({
  courses: { isActive: "c.is_active", catalogVersionId: "c.catalog_version_id", divisionId: "c.division_id", departmentId: "c.department_id", semestersOffered: "c.semesters_offered" },
  divisions: { id: "d.id", name: "d.name", code: "d.code", displayOrder: "d.display_order" },
  departments: { id: "dept.id", name: "dept.name", displayOrder: "dept.display_order" },
  courseCatalogVersions: { id: "v.id", loadedAt: "v.loaded_at" },
}));

vi.mock("@/lib/auth/get-user", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

import { GET } from "@/app/api/v1/divisions/route";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";

function makeRequest() {
  return new NextRequest(new URL("http://localhost:3000/api/v1/divisions"));
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/v1/divisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callCount = 0;
    versionResolve = [FAKE_VERSION];
    rowsResolve = FAKE_ROWS;
    (getAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      resetAt: Math.floor(Date.now() / 1000) + 60,
    });
  });

  it("returns divisions grouped with their departments", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data).toHaveLength(2);
    const applied = body.data.find((d: { name: string }) => d.name === "Applied Arts");
    expect(applied).toBeDefined();
    expect(applied.departments.map((d: { name: string }) => d.name)).toEqual([
      "Business Education",
      "Driver Education",
      "Family and Consumer Sciences",
      "Lake County Tech Campus",
    ]);

    const fineArts = body.data.find((d: { name: string }) => d.name === "Fine Arts");
    expect(fineArts.departments.map((d: { name: string }) => d.name)).toEqual([
      "Dance",
      "Music",
    ]);
  });

  it("includes the Lake County Tech Campus department", async () => {
    // Regression: the user-facing dropdowns previously hardcoded the
    // department list and silently dropped this one.
    const res = await GET(makeRequest());
    const body = await res.json();
    const applied = body.data.find((d: { name: string }) => d.name === "Applied Arts");
    expect(
      applied.departments.some((d: { name: string }) => d.name === "Lake County Tech Campus"),
    ).toBe(true);
  });

  it("returns an empty list when no catalog version exists", async () => {
    versionResolve = [];
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("returns 429 when rate limited", async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      resetAt: Math.floor(Date.now() / 1000) + 30,
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("dedupes departments when the same row appears multiple times", async () => {
    rowsResolve = [
      ...FAKE_ROWS,
      // Duplicate row (e.g. from a join fanning out)
      { divisionId: "d-aa", divisionName: "Applied Arts", divisionCode: "APPLIED_ARTS",
        departmentId: "dep-tc", departmentName: "Lake County Tech Campus" },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    const applied = body.data.find((d: { name: string }) => d.name === "Applied Arts");
    const techCampusEntries = applied.departments.filter(
      (d: { name: string }) => d.name === "Lake County Tech Campus",
    );
    expect(techCampusEntries).toHaveLength(1);
  });
});
