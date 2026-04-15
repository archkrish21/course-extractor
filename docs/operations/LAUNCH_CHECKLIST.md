# SAPS Launch Checklist

Single source of truth for everything that must be true **before** flipping the production DNS. Work top-to-bottom, tick the boxes, and when the last one is green you can launch.

Each item links to the authoritative doc so details don't get duplicated here.

---

## Phase 1 — Supabase hosted project

**Source:** [`PRODUCTION_SETUP.md` §1–6](./PRODUCTION_SETUP.md), [`AUTH_HARDENING_PLAN.md` §5c](../plans/AUTH_HARDENING_PLAN.md)

### Project creation
- [ ] Supabase project created (choose region close to users)
- [ ] Credentials collected: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- [ ] Schema applied: `npm run db:setup` against the hosted DB
- [ ] Course catalog loaded and verified (≥ ~360 rows in `courses` where `is_active = true`)
- [ ] Legal documents seeded (`legal_documents` has rows)

### Auth configuration — Supabase dashboard
- [ ] URL Configuration → Site URL set to `https://yourdomain.com`
- [ ] URL Configuration → Redirect URLs include `https://yourdomain.com/**`, no stale `localhost` / `*.vercel.app`
- [ ] Email provider → "Confirm email" enabled
- [ ] Email templates customized with SAPS branding (confirmation, invite, magic link, recovery)
- [ ] OTP expiry: **10 minutes**
- [ ] Rate Limits → Emails/hour: **10**, Token verifications/5min: **30**, Signups/hour/IP: **10**
- [ ] Password Policy → min length 8, `letters_digits` or stricter
- [ ] Attack Protection → CAPTCHA (hCaptcha or Turnstile) enabled on sign-up and sign-in
- [ ] CAPTCHA token wired through frontend signup/login forms and tested end-to-end

### Secrets hygiene
- [ ] Service role key rotated if it was ever committed or shared
- [ ] Service role key stored only in Vercel server-only env vars (never `NEXT_PUBLIC_`)

---

## Phase 2 — Third-party integrations

### Upstash Redis (required for rate limiting)
- [ ] Upstash project created, Redis instance provisioned
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars
- [ ] Verified: rate limiter no longer fails open (see Phase 4 curl test)

### Stripe (paid subscriptions)
- [ ] Stripe account in **live mode**, not test mode
- [ ] `STRIPE_SECRET_KEY` (live `sk_live_…`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`) in Vercel env vars
- [ ] Webhook endpoint `https://yourdomain.com/api/v1/stripe/webhook` registered in Stripe dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` (live webhook signing secret) in Vercel env vars
- [ ] Products / prices for Plus and Elite tiers exist in live mode with correct amounts
- [ ] Test subscription flow end-to-end with a real card (use a small-amount test then refund)

### Resend (transactional email)
- [ ] Domain added to Resend and DNS records verified (SPF, DKIM, DMARC)
- [ ] `RESEND_API_KEY` in Vercel env vars
- [ ] Supabase Auth → SMTP set to Resend (or equivalent), "from" address uses your verified domain
- [ ] Send a test confirmation email to yourself — arrives within 10 minutes, lands in inbox not spam

### Sentry + PostHog (monitoring)
- [ ] Sentry project created, `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel env vars
- [ ] PostHog project created, `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_PERSONAL_API_KEY` in Vercel env vars
- [ ] Sentry release tagged on first deploy (source maps upload configured)
- [ ] Trigger a test error in production → confirmed in Sentry

---

## Phase 3 — Deploy to Vercel

**Source:** [`PRODUCTION_SETUP.md` §8](./PRODUCTION_SETUP.md)

- [ ] GitHub repo connected to Vercel project
- [ ] Build command and install command use `saps/` as root (or monorepo config applied)
- [ ] All env vars from `saps/.env.local.example` set in Vercel (production environment)
- [ ] `NEXT_PUBLIC_APP_URL` = `https://yourdomain.com`
- [ ] `NEXT_PUBLIC_SUPPORT_URL` set (or intentionally blank)
- [ ] Custom domain added in Vercel, DNS pointing, SSL cert issued
- [ ] First successful production deploy
- [ ] CSP headers allow the hosted Supabase URL (see [`PRODUCTION_SETUP.md` §7 CSP note](./PRODUCTION_SETUP.md))

---

## Phase 4 — Security verification (prod-only)

**Source:** [`AUTH_HARDENING_PLAN.md` §5d](../plans/AUTH_HARDENING_PLAN.md)

These are the items explicitly deferred to prod during auth hardening (local already verified where possible on 2026-04-15).

- [ ] Rate limit: 7 rapid `POST /api/v1/auth/login` requests — attempts 6-7 return 429 (command below)
- [ ] CAPTCHA appears on signup in incognito window
- [ ] 11 rapid signups from same IP → 11th is blocked
- [ ] Email confirmation arrives within 10 min
- [ ] Old service role key (if rotated) fails
- [ ] RLS active: in Supabase SQL Editor run `SET ROLE authenticated; SELECT * FROM users;` → 0 rows
- [ ] Session refresh middleware verified (optional — requires temporarily lowering JWT expiry to observe transparent refresh)

### Prod rate-limit curl (after Upstash is wired)
```bash
for i in $(seq 1 7); do
  echo "Attempt $i:"
  curl -s -o /dev/null -w "  HTTP %{http_code}\n" \
    -X POST https://yourdomain.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -H "Origin: https://yourdomain.com" \
    -d '{"email":"nobody@test.com","password":"wrong"}'
done
```

---

## Phase 5 — Functional smoke test

**Source:** [`PRODUCTION_SETUP.md` §9](./PRODUCTION_SETUP.md)

- [ ] App loads at `https://yourdomain.com`
- [ ] Signup → confirmation email arrives → link works → land on onboarding
- [ ] Onboarding (grade, graduation year, age attestation, ToS) completes
- [ ] Dashboard loads with no errors in Sentry
- [ ] Planner → create plan → add courses → save
- [ ] 3-plan limit enforced (disabled "Create Plan" after 3)
- [ ] Delete a plan → count drops, no orphan rows
- [ ] Invite parent from Settings → invite email arrives → parent signs up via link → lands on child's dashboard
- [ ] Parent can view plan; parent remove flow clears access
- [ ] Stripe checkout → complete purchase with real card → webhook fires → subscription tier reflects in UI
- [ ] Transcript, Progress, Year-End pages render correctly for a seeded grade-10 user
- [ ] Password reset flow end-to-end (request → email → update → login with new password)
- [ ] Login with wrong password 5× → rate limited (if Upstash wired)
- [ ] Check Supabase Auth Logs — no unexpected errors
- [ ] Check Sentry — no uncaught errors from the smoke test run

---

## Phase 6 — Launch day

- [ ] Final `npm test` passes on main branch
- [ ] Final `npm run test:e2e` passes on main branch
- [ ] Latest commit on `main` deployed to prod
- [ ] DNS TTL lowered to 5 minutes 24h before launch (easier rollback)
- [ ] Monitoring dashboards bookmarked and visible (Sentry, PostHog, Vercel, Supabase, Stripe)
- [ ] Rollback plan reviewed: revert Vercel deploy = instant; DB migrations are additive-only, no rollback needed for launch
- [ ] Support email / Ko-fi link working
- [ ] First user can sign up and complete onboarding without intervention

---

## Deferred / out of scope for launch

These are known limitations documented elsewhere, intentionally not blocking launch:

- Session refresh middleware manual verification ([auth plan §4d](../plans/AUTH_HARDENING_PLAN.md)) — requires temporarily lowering JWT expiry. Code path is covered by unit tests; defer until first prod JWT expiry incident if any.
- Per-test-account E2E isolation (currently 15 tests flake under parallel load, all pass on retry). Tracked as a post-launch improvement.

---

**Last updated:** 2026-04-15
