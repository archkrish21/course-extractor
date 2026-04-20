# Security Review — SAPS

> Generated: 2026-04-09
> Last updated: 2026-04-20
> Status: HIGH issues resolved, launch blockers cleared

---

## Scope

| Folder | Status |
|--------|--------|
| `saps/app/` | Reviewed |
| `saps/lib/` | Reviewed |
| `saps/components/` | Reviewed |
| `saps/config/`, `saps/scripts/`, `saps/tests/`, `saps/supabase/`, root configs | Reviewed |

---

## Overall Assessment: Good

Solid security foundations — Supabase Auth, Drizzle ORM (parameterized queries), Zod validation on most routes, Redis rate limiting, strong CSP headers. No SQL injection or XSS vulnerabilities found. Main areas to tighten: input validation gaps, subscription enforcement, rate limiter resilience, and pre-production credential hygiene.

---

## Issues Found

### app/ — API Routes

#### 1. [HIGH] ~~Missing Zod validation in year-end POST~~ — FIXED

**Status:** Resolved. Zod schema added with `z.literal("complete")` for action, `z.string().uuid()` for planCourseId, `z.enum(ALL_GRADES)` for grades, and `z.number().int().min(9).max(12)` for gradeOverride. See `app/api/v1/year-end/route.ts` lines 200-218.

---

#### 2. [MEDIUM] ~~gradeOverride allows graduation logic bypass~~ — MITIGATED

**Status:** Mitigated by Issue #1 fix. `gradeOverride` is now bounded to `z.number().int().min(9).max(12)` via Zod validation. Users can only specify valid grade levels (9-12).

---

#### 3. [MEDIUM] Race condition in account claiming

**File:** `app/api/v1/accounts/claim/route.ts`

The existence check and subsequent create/update are not wrapped in a database transaction. Two concurrent requests could both pass the check and create duplicate accounts.

**Fix:** Wrap in `db.transaction()` or add a unique DB constraint on `student_user_id`.

---

### lib/ — Core Library

#### 4. [HIGH] FREE_LAUNCH_MODE bypasses all subscription enforcement

**File:** `config/subscription-plans.ts` line 125

```typescript
export const FREE_LAUNCH_MODE = true;
```

When enabled, all users get premium features (3 plans, goals, what-if, PDF export, parent draft) for free. The `getEffectiveTier()` function in `lib/subscription/middleware.ts` (lines 64-82) short-circuits all tier lookups when this flag is true.

**Action:** Must be set to `false` before production launch. Add a CI check or startup warning for production builds.

---

#### 5. [MEDIUM] Rate limiter fails open on Redis outage

**File:** `lib/api/rate-limit.ts` lines 40-47

```typescript
if (!redis || !redisAvailable) {
  // ...
  return passThrough;  // Allows ALL requests
}
```

If Redis goes down, all rate limits are bypassed — unlimited login attempts, Stripe checkouts, API calls. The 60-second retry is optimistic (sets `redisAvailable = true` without testing connection).

**Fix options:**
- Fail closed: return `{ success: false }` when Redis is unavailable
- Add in-memory fallback rate limiter
- At minimum, log a warning when failing open

---

#### 6. [MEDIUM] Account status (frozen/deactivated) not enforced at API level

**File:** `lib/subscription/middleware.ts` line 282

`getEffectiveTier()` returns `accountStatus` but doesn't block access for frozen/deactivated accounts. Each route must check this independently, and some may not.

**Fix:** Add a shared middleware or guard that rejects requests from non-active accounts:
```typescript
if (tier.accountStatus !== "active") {
  return errorResponse("FORBIDDEN", `Account is ${tier.accountStatus}.`, 403);
}
```

---

#### 7. [MEDIUM] Supabase admin client not protected against client-side import

**File:** `lib/supabase/admin.ts`

The admin client uses `SUPABASE_SERVICE_ROLE_KEY`. If accidentally imported in a `"use client"` component, the key would be exposed to the browser.

**Fix:** Add a runtime guard at the top:
```typescript
if (typeof window !== "undefined") {
  throw new Error("createSupabaseAdminClient must only be used on the server");
}
```
Or rename to `admin.server.ts` (Next.js convention).

---

#### 8. [MEDIUM] Email templates don't sanitize interpolated values

**File:** `lib/email/templates.ts` lines 26-34

`inviteCode` and `claimUrl` are interpolated directly into HTML email templates without escaping. While email clients are safer than browsers, a malformed invite code or URL could inject HTML.

**Fix:** Validate `inviteCode` is alphanumeric, validate `claimUrl` is HTTPS, and HTML-escape all interpolated values.

---

### components/ — Frontend

#### 9. [MEDIUM] Open redirect in upgrade flow

**File:** `components/upgrade-modal.tsx` lines 56-59

```typescript
const url = json.data?.url ?? json.url;
if (url) window.location.href = url;
```

Redirects to a URL from the API response without validating it. If the API were compromised, users could be sent to a phishing site.

**Fix:** Validate the URL hostname is an expected domain (e.g., `checkout.stripe.com`) before redirecting.

---

#### 10. [LOW] UI-only readOnly gates on planner

**File:** `components/planner/planner-grid.tsx` lines 214-216

The `readOnly` prop only disables UI buttons — it doesn't prevent API mutations. **Not a vulnerability** as long as backend validates permissions (which it does via `getPlanAccess()`), but worth noting for defense-in-depth.

---

### Config, Tests, Scripts

#### 11. [LOW] `unsafe-inline` in production CSP `script-src`

**File:** `next.config.ts`

Production CSP includes `'unsafe-inline'` for `script-src`. Required for Stripe, but weakens XSS protection. Consider nonce-based CSP for other inline scripts.

---

#### 12. [LOW] Missing HSTS header

**File:** `next.config.ts`

No `Strict-Transport-Security` header configured. Add:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

---

#### 13. [LOW] Hardcoded test credentials in e2e tests

**File:** `tests/e2e/global-setup.ts` line 28

`TEST_PASSWORD = "Test1234!"` and test emails are hardcoded across 50+ test files. Acceptable for local dev with a private repo, but should be externalized to `.env.test` before the repo is made public.

---

#### 14. [LOW] Scripts lack production safety checks

**Files:** `scripts/seed.ts`, `scripts/cleanup-test-users.ts`, `scripts/migrate-plan-shares.ts`

Scripts use `DATABASE_URL` from env without checking `NODE_ENV` or prompting for confirmation. Could accidentally run against production DB.

**Fix:** Add `if (process.env.NODE_ENV === "production") throw new Error("...")` guard.

---

## Verified Non-Issues

- `.env.local` is **not** tracked in git (only `.env.local.example` is)
- All public routes (courses, health, contact) are intentionally unauthenticated and rate-limited
- `X-Account-Id` header is always validated via `getAccountContext()` before use
- Stripe webhook uses signature verification + idempotency checking
- No `dangerouslySetInnerHTML`, `eval()`, or `innerHTML` usage found anywhere
- All Drizzle raw SQL uses parameterized `sql` tagged templates — no SQL injection
- No secrets in `public/` folder (empty)
- `.gitignore` properly excludes `.env*.local`
- Supabase keys in `.env.local` are local-dev demo tokens (not production)

---

## Strengths

- Consistent `requireAuth()` + `getAccountContext()` pattern across all 43 API routes
- Zod `safeParse()` with field-level error reporting on all routes
- Redis sliding-window rate limiting on auth (5/min), courses (30/min), checkout (5/min), etc.
- Plan permission hierarchy: `view < edit < delete < owner`
- COPPA compliance check (age 13+) at signup
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- Stripe webhook idempotency via `stripe_events` table
- Server actions body size capped at 2MB
- No external scripts loaded in components
- Proper `credentials: "same-origin"` on all `apiFetch` calls

---

## Fix Priority

| # | Issue | Severity | Effort | When |
|---|-------|----------|--------|------|
| 1 | ~~Year-end Zod validation~~ | ~~HIGH~~ | ~~15 min~~ | **FIXED** |
| 4 | FREE_LAUNCH_MODE flag | HIGH | 2 min | Before paid subscriptions (v1.1) — stays `true` for free launch |
| 2 | ~~gradeOverride bounds~~ | ~~MEDIUM~~ | ~~5 min~~ | **FIXED** (via #1) |
| 3 | Account claim race condition | MEDIUM | 10 min | After e2e tests |
| 5 | Rate limiter fail-open | MEDIUM | 20 min | Before production |
| 6 | Account status enforcement | MEDIUM | 15 min | Before production |
| 7 | Admin client guard | MEDIUM | 2 min | Anytime |
| 8 | Email template sanitization | MEDIUM | 10 min | Before production |
| 9 | Upgrade redirect validation | MEDIUM | 5 min | Before production |
| 12 | HSTS header | LOW | 2 min | Before production |
| 11 | CSP unsafe-inline | LOW | Variable | Long-term |
| 10 | UI readOnly defense-in-depth | LOW | N/A | Backend already handles |
| 13 | Test credential externalization | LOW | 15 min | Before open-sourcing |
| 14 | Script production guards | LOW | 10 min | Before production |
