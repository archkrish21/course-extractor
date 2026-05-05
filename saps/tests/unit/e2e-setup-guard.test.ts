import { describe, it, expect } from "vitest";
import { isLocalUrl } from "../e2e/global-setup";

describe("isLocalUrl", () => {
  it.each([
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgres://postgres:postgres@localhost:54322/postgres",
    "postgresql://user:pw@host.docker.internal:5432/db",
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "https://localhost",
    "http://host.docker.internal:54321",
  ])("accepts local url: %s", (url) => {
    expect(isLocalUrl(url)).toBe(true);
  });

  it.each([
    "postgresql://postgres:pw@db.abcdefg.supabase.co:5432/postgres",
    "postgres://u:p@aws-0-us-west-1.pooler.supabase.com:5432/postgres",
    "https://abcdefg.supabase.co",
    "https://example.com",
    "http://10.0.0.1",
    "",
    undefined,
  ])("rejects non-local url: %s", (url) => {
    expect(isLocalUrl(url)).toBe(false);
  });

  it("does not match hosts that merely contain 'localhost' as a substring", () => {
    expect(isLocalUrl("https://localhost.evil.com")).toBe(false);
    expect(isLocalUrl("postgres://u:p@notlocalhost:5432/db")).toBe(false);
  });
});
