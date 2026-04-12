import type { NextRequest } from "next/server";
import { verifyOrigin } from "./csrf";
import { errorResponse } from "./response";

/**
 * Guard for mutation routes. Returns a 403 error Response if the request
 * Origin header doesn't match an allowed origin, or null if the request
 * is safe to proceed.
 *
 * Usage in a route handler:
 *
 *     const csrf = requireSameOrigin(request);
 *     if (csrf) return csrf;
 *
 * Place this check after requireAuth() but before any DB work or side
 * effects. GET routes don't need this — they don't mutate state, and
 * browsers don't send CSRF-vulnerable GET requests.
 *
 * Exempt routes (handle their own verification or are legitimately
 * cross-origin):
 * - POST /api/v1/stripe/webhook — Stripe server-to-server, HMAC-signed
 * - POST /api/v1/contact — public marketing form
 * - POST /api/v1/school-request — public marketing form
 */
export function requireSameOrigin(request: NextRequest): Response | null {
  if (!verifyOrigin(request)) {
    return errorResponse("FORBIDDEN", "Invalid request origin.", 403);
  }
  return null;
}
