import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Test data ───────────────────────────────────────────────────────────────

const TEST_USER = { id: "user-1", email: "student@test.com" };
const TEST_ACCOUNT_CTX = { accountId: "acc-1", role: "student" as const, canEdit: true };

const TEST_LEGAL_DOC_TOS = {
  id: "doc-tos-1",
  type: "terms_of_service",
  version: "1.0",
  effectiveDate: "2025-01-01",
  summaryOfChanges: "Initial terms",
  isCurrent: true,
};

const TEST_LEGAL_DOC_PP = {
  id: "doc-pp-1",
  type: "privacy_policy",
  version: "1.0",
  effectiveDate: "2025-01-01",
  summaryOfChanges: "Initial privacy policy",
  isCurrent: true,
};

const TEST_USER_ROW = {
  id: "user-1",
  email: "student@test.com",
  firstName: "John",
  lastName: "Doe",
  role: "student",
};

const TEST_ACCOUNT_UPDATED = {
  id: "acc-1",
  studentName: "Jane Doe",
  gradeLevel: 10,
  graduationYear: 2028,
};

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();

function createQueryChain(resolveValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.innerJoin = vi.fn().mockImplementation(self);
  chain.leftJoin = vi.fn().mockImplementation(self);
  chain.orderBy = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveValue))
  );
  chain.insert = vi.fn().mockImplementation(self);
  chain.values = mockValues.mockImplementation(self);
  chain.returning = mockReturning.mockResolvedValue([TEST_ACCOUNT_UPDATED]);
  chain.update = vi.fn().mockImplementation(self);
  chain.set = mockSet.mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  return chain;
}

let dbChain = createQueryChain();

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop in dbChain) {
          return (dbChain as Record<string, unknown>)[prop as string];
        }
        return undefined;
      },
    }
  ),
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireAuth: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  getAccountContext: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  users: {
    id: "u_id",
    email: "u_email",
    firstName: "u_firstName",
    lastName: "u_lastName",
    role: "u_role",
    tosAcceptedAt: "u_tosAcceptedAt",
    ppAcceptedAt: "u_ppAcceptedAt",
  },
  legalDocuments: {
    id: "ld_id",
    type: "ld_type",
    version: "ld_version",
    effectiveDate: "ld_effectiveDate",
    summaryOfChanges: "ld_summaryOfChanges",
    isCurrent: "ld_isCurrent",
  },
  consentRecords: {
    id: "cr_id",
    userId: "cr_userId",
    legalDocumentId: "cr_legalDocumentId",
    action: "cr_action",
    ipAddress: "cr_ipAddress",
    userAgent: "cr_userAgent",
    consentedAt: "cr_consentedAt",
  },
  accounts: {
    id: "a_id",
    studentName: "a_studentName",
    gradeLevel: "a_gradeLevel",
    graduationYear: "a_graduationYear",
    studentUserId: "a_studentUserId",
  },
  accountMembers: {
    accountId: "am_accountId",
    userId: "am_userId",
    role: "am_role",
    canEdit: "am_canEdit",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      type: "sql",
      strings,
    }),
    { raw: vi.fn() }
  ),
}));

import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { GET as getConsent, POST as postConsent } from "@/app/api/v1/auth/consent/route";
import { GET as getMe, PATCH as patchMe } from "@/app/api/v1/auth/me/route";
import { PATCH as patchAccount } from "@/app/api/v1/accounts/[id]/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

function makeJsonRequest(url: string, body: unknown, method = "POST"): NextRequest {
  return createRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function accountContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/v1/auth/consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
  });

  it("returns consent_required: false when user has accepted all current documents", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) {
        // Current legal documents
        return Promise.resolve(resolve([TEST_LEGAL_DOC_TOS, TEST_LEGAL_DOC_PP]));
      }
      if (queryIndex === 2) {
        // User consent records – has accepted both
        return Promise.resolve(resolve([
          { legalDocumentId: "doc-tos-1", consentedAt: new Date() },
          { legalDocumentId: "doc-pp-1", consentedAt: new Date() },
        ]));
      }
      return Promise.resolve(resolve([]));
    });

    const response = await getConsent();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.consent_required).toBe(false);
    expect(body.data.pending_documents).toHaveLength(0);
    expect(body.data.accepted_documents).toHaveLength(2);
  });

  it("returns consent_required: true with pending documents when user hasn't accepted", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) {
        // Current legal documents
        return Promise.resolve(resolve([TEST_LEGAL_DOC_TOS, TEST_LEGAL_DOC_PP]));
      }
      if (queryIndex === 2) {
        // User consent records – has accepted only TOS
        return Promise.resolve(resolve([
          { legalDocumentId: "doc-tos-1", consentedAt: new Date() },
        ]));
      }
      return Promise.resolve(resolve([]));
    });

    const response = await getConsent();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.consent_required).toBe(true);
    expect(body.data.pending_documents).toHaveLength(1);
    expect(body.data.pending_documents[0].id).toBe("doc-pp-1");
    expect(body.data.pending_documents[0].type).toBe("privacy_policy");
    expect(body.data.accepted_documents).toHaveLength(1);
  });
});

describe("POST /api/v1/auth/consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
  });

  it("successfully records consent for document IDs", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) {
        // User exists in users table
        return Promise.resolve(resolve([{ id: "user-1" }]));
      }
      if (queryIndex === 2) {
        // Current legal documents
        return Promise.resolve(resolve([
          { id: "doc-tos-1", type: "terms_of_service" },
          { id: "doc-pp-1", type: "privacy_policy" },
        ]));
      }
      // Insert consent records + update user (queries 3, 4, 5)
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/auth/consent",
      { document_ids: ["doc-tos-1", "doc-pp-1"] }
    );
    const response = await postConsent(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.accepted).toBe(2);
  });

  it("returns 400 for empty document_ids array", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) {
        // User exists
        return Promise.resolve(resolve([{ id: "user-1" }]));
      }
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/auth/consent",
      { document_ids: [] }
    );
    const response = await postConsent(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid document ID", async () => {
    let queryIndex = 0;
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      queryIndex++;
      if (queryIndex === 1) {
        // User exists
        return Promise.resolve(resolve([{ id: "user-1" }]));
      }
      if (queryIndex === 2) {
        // Current docs – only TOS exists
        return Promise.resolve(resolve([
          { id: "doc-tos-1", type: "terms_of_service" },
        ]));
      }
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/auth/consent",
      { document_ids: ["doc-tos-1", "nonexistent-doc"] }
    );
    const response = await postConsent(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("nonexistent-doc");
  });

  it("returns 404 when user doesn't exist in users table", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      // User not found in users table
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/auth/consent",
      { document_ids: ["doc-tos-1"] }
    );
    const response = await postConsent(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/v1/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
  });

  it("returns user email, first_name, last_name, role", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([TEST_USER_ROW]));
    });

    const response = await getMe();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.email).toBe("student@test.com");
    expect(body.data.first_name).toBe("John");
    expect(body.data.last_name).toBe("Doe");
    expect(body.data.role).toBe("student");
  });

  it("returns 404 when user not found", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([]));
    });

    const response = await getMe();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/v1/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
  });

  it("successfully updates first_name and last_name", async () => {
    dbChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      return Promise.resolve(resolve([]));
    });

    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/auth/me",
      { first_name: "Jane", last_name: "Smith" },
      "PATCH"
    );
    const response = await patchMe(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.updated).toBe(true);
  });

  it("returns 400 when no fields provided", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/auth/me",
      {},
      "PATCH"
    );
    const response = await patchMe(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/v1/accounts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbChain = createQueryChain();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_ACCOUNT_CTX);
  });

  it("successfully updates student_name", async () => {
    mockReturning.mockResolvedValue([TEST_ACCOUNT_UPDATED]);

    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/accounts/acc-1",
      { student_name: "Jane Doe" },
      "PATCH"
    );
    const response = await patchAccount(request, accountContext("acc-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.studentName).toBe("Jane Doe");
  });

  it("returns 403 for non-member", async () => {
    (getAccountContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/accounts/acc-1",
      { student_name: "Jane Doe" },
      "PATCH"
    );
    const response = await patchAccount(request, accountContext("acc-1"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 for empty body", async () => {
    const request = makeJsonRequest(
      "http://localhost:3000/api/v1/accounts/acc-1",
      {},
      "PATCH"
    );
    const response = await patchAccount(request, accountContext("acc-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
