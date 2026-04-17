# SAPS Launch Checklist

Single source of truth for everything that must be true **before** flipping the production DNS. Work top-to-bottom, tick the boxes, and when the last one is green you can launch.

Each item links to the authoritative doc so details don't get duplicated here.

---

## Phase 1 — Supabase hosted project

**Source:** [`PRODUCTION_SETUP.md` §1–6](./PRODUCTION_SETUP.md), [`AUTH_HARDENING_PLAN.md` §5c](../plans/AUTH_HARDENING_PLAN.md)

### Project creation
- [x] Supabase project created (choose region close to users)
- [x] Credentials collected: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- [x] Schema applied: `npm run db:setup` + `db:migrate` against the hosted DB (done 2026-04-15)
- [x] Course catalog loaded and verified (361 active courses — 315 base + 46 summer, matches `saps/extractor/data/2026-courses-with-summer.json`. Backfilled 2026-04-15 after switching default catalog JSON.)
- [x] Legal documents seeded (3 rows — ToS, Privacy, Age Attestation, verified 2026-04-15)

### Auth configuration — Supabase dashboard
- [x] URL Configuration → Site URL set to `https://saps-archkrish21s-projects.vercel.app` (configured 2026-04-16)
- [x] URL Configuration → Redirect URLs include `https://*-archkrish21s-projects.vercel.app/**` for all preview/prod deployments (configured 2026-04-16)
- [x] Email provider → "Confirm email" enabled (configured 2026-04-16)
- [x] Email templates customized with SAPS branding — confirmation, invite, magic link, recovery, email change. All use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` for proper routing (updated 2026-04-16)
- [ ] OTP expiry: **10 minutes**
- [ ] Rate Limits → Emails/hour: **10**, Token verifications/5min: **30**, Signups/hour/IP: **10**
- [x] Password Policy → min length 8, `letters_digits` or stricter (configured 2026-04-15)
- [x] Attack Protection → hCaptcha configured in Supabase dashboard with site key `7cc8cd46-…-0f70c1bcf266` (secret set 2026-04-15)
- [x] CAPTCHA token wired through frontend signup/login/forgot-password forms — `@hcaptcha/react-hcaptcha` widget + token forwarded to Supabase; CSP allows `hcaptcha.com` origins (updated 2026-04-16 to include forgot-password)

### Secrets hygiene
- [ ] Service role key rotated if it was ever committed or shared
- [x] Service role key stored only in Vercel server-only env vars (never `NEXT_PUBLIC_`) — verified 2026-04-16

---

## Phase 2 — Third-party integrations

### Upstash Redis (required for rate limiting)
- [x] Upstash project created, Redis instance provisioned (2026-04-15)
- [x] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars (configured 2026-04-16)
- [x] Verified rate limiter works against Upstash — local 7× login curl returned 401 × 5, then 429 × 2 (2026-04-15)

### Stripe (paid subscriptions) — DEFERRED to post-launch
> Subscription tiers disabled for v1 (free-only launch). Moved to v1.1 milestone.
- [ ] ~~Stripe account in **live mode**, not test mode~~
- [ ] ~~`STRIPE_SECRET_KEY` (live `sk_live_…`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`) in Vercel env vars~~
- [ ] ~~Webhook endpoint registered in Stripe dashboard~~
- [ ] ~~`STRIPE_WEBHOOK_SECRET` in Vercel env vars~~
- [ ] ~~Products / prices for Plus and Elite tiers~~
- [ ] ~~Test subscription flow end-to-end~~

### Resend (transactional email)
- [ ] Domain added to Resend and DNS records verified (SPF, DKIM, DMARC)
- [x] `RESEND_API_KEY` in Vercel env vars (configured 2026-04-16)
- [ ] Supabase Auth → SMTP set to Resend (or equivalent), "from" address uses your verified domain
- [ ] Send a test confirmation email to yourself — arrives within 10 minutes, lands in inbox not spam

### Sentry + PostHog (monitoring)
- [x] Sentry project created (org `saps-57`, project `javascript-nextjs`); SDK wired for client/server/edge; verified locally (2026-04-15)
- [x] PostHog project created (default project on US Cloud); provider mounted in root layout; `$pageview` verified in Live Events (2026-04-15)
- [x] `NEXT_PUBLIC_SENTRY_DSN` in Vercel env vars (configured 2026-04-16). `SENTRY_AUTH_TOKEN` not yet set — source maps won't upload until this is added.
- [x] `NEXT_PUBLIC_POSTHOG_KEY` in Vercel env vars (configured 2026-04-16)
- [x] `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` in Vercel env vars (configured 2026-04-16)
- [ ] Sentry release tagged on first deploy (source-map upload configured via SENTRY_AUTH_TOKEN)
- [ ] Trigger a test error in production → confirmed in Sentry

---

## Phase 3 — Deploy to Vercel

**Source:** [`PRODUCTION_SETUP.md` §8](./PRODUCTION_SETUP.md)

- [x] GitHub repo connected to Vercel project (`archkrish21/course-extractor` → `saps` project, configured 2026-04-16)
- [x] Build command and install command use `saps/` as root (configured 2026-04-16)
- [x] All env vars from `saps/.env.local.example` set in Vercel — 22 vars for production + preview (configured 2026-04-16)
- [x] `NEXT_PUBLIC_APP_URL` = `https://saps.vercel.app` (configured 2026-04-16)
- [ ] `NEXT_PUBLIC_SUPPORT_URL` set — awaiting Ko-fi account setup (#37)
- [x] `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` = `7cc8cd46-ce44-47d6-a60c-0f70c1bcf266` (configured 2026-04-16)
- [ ] Custom domain added in Vercel, DNS pointing, SSL cert issued
- [x] First successful production deploy (2026-04-16)
- [x] CSP headers allow the hosted Supabase URL
- [x] Preview deployments working — auto-deploy on PR, preview URLs generated
- [x] CSRF origin check allows Vercel domains (VERCEL_URL + *.vercel.app)

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
- [ ] ~~Stripe checkout → deferred to post-launch (free-only v1)~~
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

**Last updated:** 2026-04-17
