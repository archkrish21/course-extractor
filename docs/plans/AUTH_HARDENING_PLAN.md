# Auth Hardening Implementation Plan

Purpose: close the authentication and authorization gaps identified in the pre-prod audit before launch.

Scope: four items, focused specifically on **authentication, session management, and authorization**. Non-auth operational/production hardening (audit logs, spam rate limiting, ops observability) is tracked separately in [PROD_HARDENING_PLAN.md](PROD_HARDENING_PLAN.md).

Each step is self-contained with concrete files, code sketches, verification, and rollback notes.

| Step | Category | Priority |
|---|---|---|
| 1. Enable RLS on user-data tables | Authorization backstop | Launch blocker |
| 2. Rate-limit auth + invite endpoints | Auth abuse (brute force, invite spam) | Launch blocker |
| 3. Origin/CSRF check on mutation routes | Session riding protection | Should-fix |
| 4. Session refresh middleware | Session lifecycle | Should-fix |
| 5. Supabase dashboard auth config | Auth platform config | Launch blocker |

Work under `saps/` unless noted otherwise.

> **Prod-only items from this plan** (Step 2 curl, Step 5c/5d) are tracked in [`LAUNCH_CHECKLIST.md`](../operations/LAUNCH_CHECKLIST.md) alongside the other launch prerequisites. Check there before going live.

---

## Pre-work (once, before starting)

Branch off `main`:
```
git checkout -b auth-hardening
```

Snapshot the production DB (when it exists) before any RLS work. For local dev the existing Supabase stack is enough.

---

## Step 1 — Enable Row Level Security on user-data tables  *(launch blocker)*

**Goal:** Treat RLS as defense in depth. Every user-owned table gets RLS enabled with a policy that requires the session `auth.uid()` to match through a valid access path. Application code already enforces this, so RLS is a backstop against future mistakes.

### 1a. Audit the tables that need policies

User-data tables (25 tables — scoped by `auth.uid()` or account membership, `FOR ALL` policies):
- `users`, `accounts`, `account_members`, `account_invite_codes`
- `four_year_plans`, `plan_courses`, `plan_shares`, `plan_share_links`, `plan_history`
- `student_profiles`, `grade_entries`, `gpa_snapshots`
- `subscriptions`, `consent_records`
- `student_parent_links`, `counselor_student_links`
- `account_events`, `alerts`, `dual_credit_log`, `goals`, `notifications`
- `parent_invite_codes`, `requirement_progress`
- `student_requirement_opt_ins`, `student_requirement_status`

Reference-data tables (11 tables — `SELECT`-only for authenticated, no writes via RLS):
- `courses`, `divisions`, `departments`, `course_catalog_versions`, `course_prerequisites`
- `graduation_requirements`, `career_paths`, `career_path_courses`
- `grade_cohort_stats`
- `subscription_plans`, `legal_documents`

Log tables (2 tables — `INSERT`-only, no reads from app):
- `contact_messages`, `school_requests`

System tables (1 table — RLS enabled, no policy = zero access for non-superuser):
- `stripe_events`

### 1b. Decide how Drizzle will interact with RLS

The Drizzle pool at [saps/lib/db/index.ts](saps/lib/db/index.ts) currently connects via `DATABASE_URL` as the postgres superuser, which **bypasses RLS entirely**. Two options:

**Option A (recommended):** Keep Drizzle on the superuser connection, use RLS only as a last-line backstop when someone queries via the Supabase client, PostgREST, or the dashboard. Application code remains the primary enforcement. This is the path of least disruption and what most Next.js + Drizzle + Supabase apps do.

**Option B:** Create an `authenticated` DB role that respects RLS and set the role per-request via `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = ...;`. Higher safety bar but requires wrapping every Drizzle query in a transaction that sets the role — a significant refactor.

**Pick Option A for launch.** Revisit Option B in Q3 once the app is stable.

Under Option A, RLS matters for:
- Any query that reaches the DB *without* going through Drizzle (Supabase dashboard, PostgREST, direct `psql`)
- A future migration to a role-based connection
- Protection if `DATABASE_URL` leaks to a non-superuser path

### 1c. Write the migration

Create `saps/lib/db/migrations/0009_enable_rls.sql`:

```sql
-- Enable RLS on all user-data tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE four_year_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gpa_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselor_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

-- users: a row is visible to itself only
CREATE POLICY users_self ON users
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- accounts: visible to any account_members row for the current user
CREATE POLICY accounts_member ON accounts
  FOR ALL TO authenticated
  USING (
    id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- account_members: a user can see their own membership rows and rows on
-- accounts they're a member of
CREATE POLICY account_members_self ON account_members
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (user_id = auth.uid());

-- four_year_plans: visible if the user is a member of the account OR has
-- a plan_shares row
CREATE POLICY four_year_plans_access ON four_year_plans
  FOR ALL TO authenticated
  USING (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    OR id IN (SELECT plan_id FROM plan_shares WHERE user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- plan_courses: cascade access from four_year_plans
CREATE POLICY plan_courses_via_plan ON plan_courses
  FOR ALL TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM four_year_plans
      WHERE account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
         OR id IN (SELECT plan_id FROM plan_shares WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM four_year_plans
      WHERE account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    )
  );

-- plan_shares: visible if the share is for you or for a plan you own
CREATE POLICY plan_shares_access ON plan_shares
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR plan_id IN (
      SELECT id FROM four_year_plans
      WHERE account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM four_year_plans
      WHERE account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    )
  );

-- subscription_plans and legal_documents: readable by all authenticated
-- users, writable by none (catalog data managed via migrations)
CREATE POLICY subscription_plans_read ON subscription_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY legal_documents_read ON legal_documents
  FOR SELECT TO authenticated USING (true);

-- Repeat similar policies for: plan_share_links, plan_history,
-- student_profiles, grade_entries, gpa_snapshots, subscriptions, consent_records,
-- account_invite_codes, student_parent_links, counselor_student_links.
-- Each one scopes either by user_id = auth.uid() or via account membership.
```

This is a sketch — fill in the remaining tables following the same pattern. For every user-scoped table, the `USING` clause defines read visibility and `WITH CHECK` defines write acceptance.

### 1d. Apply and verify

1. Run `npm run db:migrate` locally against the Supabase dev stack.
2. Open Supabase Studio → Table Editor → pick any table → verify RLS is enabled.
3. Run the full unit + e2e suites: `npm test && npm run test:e2e`. They must still pass because Drizzle connects as superuser.
4. Manually test the critical flows (planner create/edit, settings invite, plan delete) — again, Drizzle bypasses RLS so nothing should change behaviorally.
5. From the Supabase SQL editor with a different role, try to `SELECT * FROM four_year_plans` — should return 0 rows (proves RLS is active).

### 1e. Rollback

```sql
ALTER TABLE four_year_plans DISABLE ROW LEVEL SECURITY;
-- etc
```

Keep all `DROP POLICY` and `DISABLE ROW LEVEL SECURITY` statements in a sibling file `0009_disable_rls.sql` ready to run if something breaks.

### 1f. Exit criteria

- [x] All user-data tables have RLS enabled (37/37 + 2 newly created log tables = 39 total)
- [x] All tables have at least one policy that scopes by `auth.uid()` (36 user/ref policies + 2 INSERT-only log policies + 1 table intentionally policy-less = 39 tables covered)
- [x] All tests pass (432 unit tests)
- [x] Manual RLS verification via raw PostgREST: student can read own `student_profiles` row (count=1), parent reading the same row returns 0 — RLS enforcing correctly (verified 2026-04-15)

---

## Step 2 — Rate limit auth and invite endpoints  *(launch blocker)*

**Goal:** Make brute force, credential stuffing, and invite spam expensive. This step covers only endpoints where the *auth or identity* of the caller is being tested or changed — pure abuse protection on unauthenticated forms is in the prod plan.

### 2a. Endpoints to cover

| Route | Key | Limit | Window | Reason |
|---|---|---|---|---|
| `POST /api/v1/accounts/:id/members` | `invite:${userId}` | 20 | 3600s | Prevent invite-spam abuse |
| `POST /api/v1/accounts/:id/members/join` | `join:${ip}` | 10 | 3600s | Prevent invite-code brute force |
| `POST /api/v1/accounts/claim` | `claim:${ip}` | 10 | 3600s | Prevent claim-code brute force |

Already rate-limited (verify still wired):
- `auth/signup`, `auth/login`, `auth/onboarding`

### 2b. For authenticated invite, key by userId

```ts
// saps/app/api/v1/accounts/[id]/members/route.ts, just after requireAuth
const rl = await rateLimit(`invite:${user.id}`, 20, 3600);
if (!rl.success) {
  return errorResponse("RATE_LIMITED", "Too many invite attempts. Try again later.", 429);
}
```

### 2c. For code-claiming routes, key by IP

`join` and `claim` are effectively "try an invite/claim code" endpoints — they're brute-force targets. Even though the caller may be logged in, key by IP because an attacker with multiple accounts could otherwise cycle. Belt-and-suspenders: key by `userId` *and* `ip` if you want to be strict.

```ts
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ?? request.headers.get("x-real-ip") ?? "unknown";
const rl = await rateLimit(`join:${ip}`, 10, 3600);
if (!rl.success) {
  return errorResponse("RATE_LIMITED", "Too many attempts. Try again later.", 429);
}
```

### 2d. Verify

1. Hit the invite endpoint 21 times from a logged-in session → 21st returns 429.
2. Hit `join` with a bogus code 11 times from the same IP → 11th returns 429.
3. Add a Vitest test that mocks `rateLimit` to return `{success: false}` for the invite route and asserts 429.

### 2e. Rollback

Revert the commit. Rate limits are additive.

### 2f. Exit criteria

- [x] `invite`, `join`, `claim` all have `rateLimit()` calls
- [x] `auth/signup`, `auth/login`, `auth/onboarding` still have their limits
- [x] New test covers 429 path for invite
- [x] Manual curl verification done — with Upstash Redis configured locally (REST URL + token in `.env.local`), 7 rapid `POST /api/v1/auth/login` attempts returned 401 on 1-5 and **429** on 6-7 (verified 2026-04-15). Same behavior will apply in prod once the same env vars are set in Vercel.

---

## Step 3 — Origin/CSRF protection on mutation routes  *(should-fix)*

**Goal:** Block same-site-lax bypass vectors (form POSTs from other origins) on every mutation route. Cheap to add, real defensive value.

### 3a. Create the helper

New file `saps/lib/api/csrf.ts`:

```ts
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL,
  "http://localhost:3000",
].filter(Boolean));

/**
 * Verifies the request Origin header matches an allowed origin.
 * Returns true if the request is safe to process, false otherwise.
 *
 * Apply to all mutation routes (POST/PATCH/PUT/DELETE). GET routes
 * don't need this because they don't mutate state.
 */
export function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  // No origin = probably server-side fetch or curl, reject in prod
  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }
  return ALLOWED_ORIGINS.has(origin);
}
```

### 3b. Apply to mutation routes

Create a small wrapper in `saps/lib/api/require-same-origin.ts`:

```ts
import type { NextRequest } from "next/server";
import { verifyOrigin } from "./csrf";
import { errorResponse } from "./response";

export function requireSameOrigin(request: NextRequest): Response | null {
  if (!verifyOrigin(request)) {
    return errorResponse("FORBIDDEN", "Invalid request origin.", 403);
  }
  return null;
}
```

Then in every mutation route, add one line right after `requireAuth`:

```ts
export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (user instanceof Response) return user;

  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  // ... existing handler
}
```

Routes to update — every non-GET handler in `saps/app/api/v1/**`. Likely 40+ files. Don't bulk-edit blindly:

1. Start with the highest-risk routes: `plans`, `plans/[id]`, `plans/[id]/courses`, `plans/[id]/shares`, `accounts/[id]/members`.
2. Expand to everything else.
3. **Skip `stripe/webhook`** — it comes from Stripe's servers, not a browser, and has its own signature verification.
4. **Skip `contact` and `school-request`** — they're unauthenticated public forms that can legitimately be submitted from any origin. Spam protection for these lives in the prod plan.

### 3c. Verify

1. Run existing e2e tests — they should pass because they run in Playwright's Chromium which sends a valid Origin.
2. Manual check with curl:
   ```
   curl -X POST http://localhost:3000/api/v1/plans \
     -H "Content-Type: application/json" \
     -H "Origin: https://evil.example" \
     -d '{"name":"x"}' \
     --cookie "sb-access-token=..."
   ```
   Should return 403.
3. Without an Origin header but logged in → 403 in prod, 200 in dev (so you can still curl-test locally).

### 3d. Rollback

Revert commit. Nothing persisted.

### 3e. Exit criteria

- [x] `verifyOrigin` helper + `requireSameOrigin` wrapper exist
- [x] All mutation routes call `requireSameOrigin` (30 route files, 40+ handlers)
- [x] `stripe/webhook`, `contact`, `school-request` explicitly documented as exempt
- [x] All unit tests pass (432)
- [x] Curl verification of 403 path done — `POST /api/v1/auth/signup` with `Origin: https://evil.example.com` returns 403; same request with `Origin: http://localhost:3000` proceeds to validation (400). Verified 2026-04-15.

---

## Step 4 — Session refresh middleware  *(should-fix)*

**Goal:** Users' sessions should refresh transparently on every request so expired access tokens don't silently log them out.

### 4a. Add `saps/middleware.ts`

Straight from the Supabase SSR docs, adapted:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Triggers token refresh if needed
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and Next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 4b. Verify

1. Log in locally.
2. Manually set the access token cookie's expiry to the past in browser devtools.
3. Reload a protected page → session should transparently refresh using the refresh token; no logout.
4. Delete both access and refresh tokens → should redirect to login.

### 4c. Rollback

Delete the file.

### 4d. Exit criteria

- [x] `saps/middleware.ts` exists
- [ ] Manual verification of transparent refresh (deferred — requires JWT expiry change)
- [x] All unit tests pass (432)

---

## Step 5 — Supabase dashboard auth configuration  *(launch blocker, configuration only)*

**Goal:** Lock down the Supabase Auth platform before opening signups. Split into two parts: items that can be audited against the local stack now, and items that must happen during prod provisioning against the hosted Supabase project.

### 5a. Local audit — DONE during auth-hardening work

Items verified now against the local stack ([saps/supabase/config.toml](saps/supabase/config.toml)):

- **Service role key codebase audit** — ✓ Clean. Only 4 references, all server-side:
  - [saps/lib/supabase/admin.ts](saps/lib/supabase/admin.ts) — factory, not a client
  - [saps/app/api/v1/users/me/route.ts](saps/app/api/v1/users/me/route.ts) — API route (server only)
  - [saps/app/api/v1/auth/signup/route.ts](saps/app/api/v1/auth/signup/route.ts) — API route (server only)
  - [saps/tests/e2e/global-setup.ts](saps/tests/e2e/global-setup.ts) — e2e setup, never ships
  - Env var lacks `NEXT_PUBLIC_` prefix → Next.js won't bundle it into client output even if accidentally imported
- **Anonymous sign-ins disabled** — ✓ `enable_anonymous_sign_ins = false`
- **Refresh token rotation enabled** — ✓ `enable_refresh_token_rotation = true`
- **Rate limits already stricter than prod plan targets** — ✓ `email_sent = 2/hr`, `token_verifications = 30/5min`, `token_refresh = 150/5min`, `sign_in_sign_ups = 30/5min`

### 5b. Local config changes deliberately NOT applied

- **`enable_confirmations = true`** — not flipped locally because 9 e2e test files exercise the real signup flow and would break. Test users are created via `supabase.auth.admin.createUser({ email_confirm: true })` at [global-setup.ts:146](saps/tests/e2e/global-setup.ts#L146) which bypasses confirmation, but real-signup e2e tests would fail at the confirmation gate. Defer to prod provisioning.
- **`minimum_password_length` / `password_requirements`** — leave loose locally for dev convenience. Tighten in prod config.
- **CAPTCHA** — not worth local setup. Do during prod provisioning.

### 5c. Prod provisioning checklist — TODO when creating the hosted Supabase project

These items must be applied to the hosted Supabase project, not `config.toml`. `config.toml` only configures the local stack; the hosted project has its own dashboard settings.

#### Authentication → URL Configuration
- [ ] Site URL: `https://yourdomain.com`
- [ ] Redirect URLs: `https://yourdomain.com/**`
- [ ] Remove any stale `localhost` or `*.vercel.app` entries

#### Authentication → Rate Limits
- [ ] Emails per hour: **10**
- [ ] Token verifications per 5 min: **30**
- [ ] Signups per hour per IP: **10**

#### Authentication → Providers → Email
- [ ] Enable "Confirm email"
- [ ] Customize the confirmation, invite, magic link, and recovery email templates with your branding
- [ ] Set OTP expiry to 10 minutes (default is 1 hour — unnecessarily long)

#### Authentication → Attack Protection
- [x] Enable **CAPTCHA** — hCaptcha provider configured in Supabase (secret set 2026-04-15)
- [x] Frontend wiring done — `@hcaptcha/react-hcaptcha` widget renders on `/signup` + `/login` when `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` is set; token forwarded via `signUp({ options: { captchaToken } })` on the server and `signInWithPassword({ options: { captchaToken } })` on the client. CSP updated to allow `hcaptcha.com` + `*.hcaptcha.com` origins.
- [ ] Test end-to-end in prod (site key set in Vercel, signup in incognito → widget appears → account created)

#### Authentication → Password Policy
- [x] `minimum_password_length = 8` (configured 2026-04-15)
- [x] `password_requirements = "letters_digits"` or stricter (configured 2026-04-15)

#### Project Settings → API
- [ ] Rotate the service role key if it has ever been committed or shared in chat history
- [ ] Store the new key in Vercel env vars (server-only, never `NEXT_PUBLIC_`)

### 5d. Prod smoke test — TODO during prod launch verification

- [ ] Sign up with throwaway email from incognito → CAPTCHA appears
- [ ] Sign up 11 times quickly from the same IP → blocked after 10
- [ ] Email confirmation arrives within 10 min
- [ ] Attempting to use the old service role key (if rotated) fails

### 5e. Exit criteria

- [x] 5a — local audit complete
- [ ] 5c — prod provisioning checklist applied (done during launch)
- [ ] 5d — prod smoke test passed (done during launch)

---

## Checklist — auth work complete

- [x] Step 1 — RLS enabled on all 39 tables (37 original + 2 newly created log tables), 38 policies in place, tests pass
- [x] Step 2 — Auth + invite endpoints rate-limited
- [x] Step 3 — Origin check on 30 route files (webhook + public forms exempt)
- [x] Step 4 — Session refresh middleware in place
- [ ] Step 5 — Supabase hardening
  - [x] 5a local audit (service role key, anon signups, refresh token rotation, rate limits)
  - [ ] 5c prod provisioning checklist (done during launch)
  - [ ] 5d prod smoke test (done during launch)

### Regression safety
- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes
- [ ] Rollback instructions for each step documented and tested

---

## Dependencies and sequencing with the prod plan

These auth items and the prod hardening items can be worked independently, but some natural orderings help:

- **Step 1 (RLS) migration** and **prod plan Step 3 (audit_log table)** both add schema — if doing them close together, generate a single migration to save one `npm run db:migrate` cycle. Otherwise, separate migrations are fine.
- **Step 2 (rate limits)** shares infrastructure with **prod plan Step 1 (spam rate limits)** and **prod plan Step 2 (fail-loud Redis check)**. If you're touching rate limiting, it's efficient to do all three in the same branch.
- **Step 3 (Origin check)** has no dependencies on the prod plan.
- **Step 4 (middleware)** has no dependencies on the prod plan.
- **Step 5 (Supabase dashboard)** is done during prod provisioning, alongside other env setup.

## What this plan explicitly does NOT cover

- Audit logging — moved to [PROD_HARDENING_PLAN.md](PROD_HARDENING_PLAN.md) Step 3
- Rate limiting for spam on `contact`/`school-request`/`feedback` — moved to [PROD_HARDENING_PLAN.md](PROD_HARDENING_PLAN.md) Step 1
- Redis fail-loud observability — moved to [PROD_HARDENING_PLAN.md](PROD_HARDENING_PLAN.md) Step 2
- Penetration testing, SOC 2 compliance, WAF/DDoS — out of scope for this launch.
