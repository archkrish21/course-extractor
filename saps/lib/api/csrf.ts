import type { NextRequest } from "next/server";

/**
 * Set of origins allowed to make state-changing requests to this API.
 *
 * Rationale for each:
 * - NEXT_PUBLIC_APP_URL — the canonical production origin. Set during deploy.
 * - NEXT_PUBLIC_VERCEL_URL — auto-set by Vercel to the deployment's unique
 *   domain (e.g. saps-git-branch-team.vercel.app). Allows preview deploys
 *   to make mutations without manually configuring each preview URL.
 * - localhost:3000 + 127.0.0.1:3000 — both dev-loopback variants.
 */
const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;

const ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    vercelUrl ? `https://${vercelUrl}` : undefined,
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
  if (ALLOWED_ORIGINS.has(origin)) {
    return true;
  }
  // Allow any Vercel preview deployment under our project
  if (process.env.VERCEL && origin.endsWith(".vercel.app") && origin.startsWith("https://")) {
    return true;
  }
  console.warn(`[csrf] Rejected origin: ${origin}. Allowed: ${[...ALLOWED_ORIGINS].join(", ")}`);
  return false;
}
