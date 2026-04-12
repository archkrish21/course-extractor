import type { NextRequest } from "next/server";

/**
 * Set of origins allowed to make state-changing requests to this API.
 *
 * Rationale for each:
 * - NEXT_PUBLIC_APP_URL — the canonical production origin. Set during deploy.
 * - localhost:3000 + 127.0.0.1:3000 — both dev-loopback variants. A user
 *   visiting either gets a different Origin header, and we need both to
 *   work without special-casing in dev.
 *
 * Previews, staging, and any non-configured environments will be rejected
 * by the origin check in production. That's intentional — if you want a
 * preview deployment to accept browser mutations, set NEXT_PUBLIC_APP_URL
 * for that preview.
 */
const ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter(Boolean)
);

/**
 * Verifies the request Origin header matches an allowed origin.
 * Returns true if the request is safe to process, false otherwise.
 *
 * - With Origin header: must be in ALLOWED_ORIGINS
 * - Without Origin header: allowed only outside production (for local curl
 *   and server-side fetches). In production this is a hard fail because
 *   legitimate browser requests always include an Origin on non-GET.
 *
 * Apply to all mutation routes (POST/PATCH/PUT/DELETE). GET routes don't
 * need this because they don't mutate state.
 */
export function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }
  return ALLOWED_ORIGINS.has(origin);
}
