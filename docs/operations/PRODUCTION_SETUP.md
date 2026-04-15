# Production Setup Guide

Step-by-step guide to provision and configure a production (or staging) deployment of SAPS. Written from lessons learned during the first hosted setup — every gotcha encountered is documented inline.

All commands run from `saps/` unless noted otherwise.

> **Launching to production?** Work from [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md) — it pulls together every `[ ]` item from this guide, the auth hardening plan, and the third-party integrations into one tickable list. Use this doc for the "how" and the checklist for the "what's left."

---

## Table of Contents

1. [Create Supabase Project](#1-create-supabase-project)
2. [Collect Credentials](#2-collect-credentials)
3. [Configure Environment](#3-configure-environment)
4. [Set Up the Database](#4-set-up-the-database)
5. [Configure Supabase Auth](#5-configure-supabase-auth)
6. [Configure Email (Resend SMTP)](#6-configure-email-resend-smtp)
7. [Test Locally Against Hosted DB](#7-test-locally-against-hosted-db)
8. [Deploy to Vercel](#8-deploy-to-vercel)
9. [Post-Deploy Verification](#9-post-deploy-verification)
10. [Switching Back to Local Dev](#10-switching-back-to-local-dev)
11. [Troubleshooting](#11-troubleshooting)
12. [Appendix: Manual Step-by-Step Seeding](#12-appendix-manual-step-by-step-seeding)

---

## 1. Create Supabase Project

1. Go to https://supabase.com/dashboard → **New Project**
2. Name: `saps-prod` (or `saps-staging` for a throwaway test)
3. Region: pick one close to your users (e.g., `us-east-2` for US)
4. Set a strong database password — **save it immediately**
5. **Do NOT enable** "Enable automatic RLS" — our migrations handle RLS with custom policies
6. Wait ~2 minutes for provisioning

---

## 2. Collect Credentials

From the Supabase dashboard, collect these 4 values:

| Credential | Where to find |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → **anon public** key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → **service_role secret** key |
| `DATABASE_URL` | Project Settings → Database → **Connection string** (URI tab) |

### DATABASE_URL — important details

- Use **Session mode** (port `5432`) for migrations and local development
- Use **Transaction mode** (port `6543`, append `?pgbouncer=true`) for Vercel serverless at runtime
- **If your database password contains special characters** (`@`, `#`, `!`, etc.), you **must** URL-encode them in the connection string. Common substitutions:
  - `@` → `%40`
  - `#` → `%23`
  - `!` → `%21`
  - Example: password `hello@world` → `hello%40world` in the URI

**Failure to encode special characters is the #1 cause of silent connection hangs.**

---

## 3. Configure Environment

### Option A: For local testing against hosted DB

Create `.env.hosted` from the template:

```bash
cp .env.local .env.hosted
```

Edit `.env.hosted` — replace the 4 Supabase values with hosted credentials. Keep everything else (Stripe test keys, Resend, etc.) the same.

To activate:
```bash
mv .env.local .env.local.bak
cp .env.hosted .env.local
```

**Always restart the dev server after changing `.env.local`** — `NEXT_PUBLIC_*` vars are baked into the client bundle at startup, not read at runtime.

### Option B: For Vercel deployment

Set environment variables in Vercel → Project Settings → Environment Variables. See [Step 8](#8-deploy-to-vercel) for the full list.

---

## 4. Set Up the Database

Two commands, in order:

### Step 4a: Create schema tables

```bash
npm run db:migrate
```

This runs Drizzle-managed migrations (`0000`–`0008`) that create all schema tables (users, accounts, plans, courses, etc.).

### Step 4b: Seed everything else

```bash
npm run db:setup
```

This single command handles **all remaining database setup** in the correct order:

1. **RLS policies** — applies hand-written migrations `0009` (Row Level Security on all 39 tables) and `0010` (creates `contact_messages` and `school_requests` tables with INSERT-only policies)
2. **Course catalog** — loads 315 courses from `extractor/data/2026-courses.json` with divisions, departments, and prerequisite links
3. **Subscription plans** — seeds 3 plans (starter, plus, elite)
4. **Graduation requirements** — seeds ~30 requirements tied to the catalog version (depends on courses from step 2)
5. **Plan templates** — seeds pre-built plan templates with course references (depends on courses from step 2)
6. **Legal documents** — seeds Terms of Service v1.0 and Privacy Policy v1.0 (required for signup to work)
7. **Account backfill** — creates account/membership rows for any existing student users

All operations use upserts (`ON CONFLICT`), so the script is **safe to re-run** at any time.

**The script prints a summary at the end:**
```
✓ Database setup complete.

  Summary:
    Courses:           315
    Divisions:         12
    Departments:       25
    Prerequisites:     204
    Sub plans:         3
    Grad requirements: 30
    Plan templates:    4
    Legal documents:   2
    RLS enabled:       39/39 tables
```

### Flags

| Flag | Effect |
|---|---|
| `npm run db:setup -- --skip-courses` | Skip course catalog load (if already loaded) |
| `npm run db:setup -- --skip-rls` | Skip RLS migration (if already applied) |
| `npm run db:setup -- --courses-only` | Only load course catalog, skip everything else |
| `npm run db:setup -- --dry-run` | Show what would be done without writing |

### Why two commands?

`npm run db:migrate` runs Drizzle-managed migrations tracked in `lib/db/migrations/meta/_journal.json`. The RLS policies and course catalog loader are hand-written and not tracked by Drizzle, so they live in `db:setup` instead. We keep them separate because:
- `db:migrate` is idempotent by design (Drizzle tracks which migrations have run)
- `db:setup` is also idempotent (all upserts) but handles a different category of data
- You might re-run `db:setup` to refresh course data without re-running schema migrations

### Verify

```sql
-- Run in Supabase SQL Editor
SELECT count(*) FROM pg_tables WHERE schemaname = 'public';
-- Expected: 39

SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity;
-- Expected: 39 (all tables have RLS enabled)

SELECT count(*) FROM courses WHERE is_active = true;
-- Expected: 315

SELECT count(*) FROM legal_documents WHERE is_current = true;
-- Expected: 2
```

After verifying, refresh the Supabase dashboard → Table Editor — all tables should show RLS as **enabled**.

---

## 5. Configure Supabase Auth

In the Supabase dashboard → Authentication:

### URL Configuration
- **Site URL:** `https://yourdomain.com` (or `http://localhost:3000` for local testing)
- **Redirect URLs:** `https://yourdomain.com/**`
- Remove any stale entries

### Providers → Email
- **Enable email confirmations:** Your choice. Turning it on means users must click a confirmation link before they can log in. Turning it off allows immediate login after signup.
  - For initial testing: leave it **off** (simpler)
  - For production launch: turn it **on**
- **OTP expiry:** 600 seconds (10 minutes)
- **Double confirm email changes:** On

### Rate Limits
- Emails per hour: **10**
- Token verifications per 5 min: **30**
- Signups per hour per IP: **10**

### Password Policy
- Minimum password length: **8**
- Password requirements: **letters_digits** (or stricter)

### Attack Protection (optional for initial testing)
- Enable **CAPTCHA** (hCaptcha or Cloudflare Turnstile)
- Requires wiring the captcha token through your frontend signup/login forms
- Defer this to post-launch if you want to test faster

---

## 6. Configure Email (Resend SMTP)

For sending confirmation, invite, and password-reset emails from a custom domain.

### Option A: Use Supabase's built-in email (for testing)

No setup needed. Supabase sends from a generic address. Limited to 2-3 emails/hour on the free tier. Fine for testing with a handful of accounts.

### Option B: Use Resend (for production)

**Prerequisites:**
- A custom domain verified in Resend (https://resend.com/domains)
- DNS records (SPF, DKIM, MX) configured and propagated

**In Supabase dashboard → Authentication → SMTP Settings:**

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | `noreply@yourdomain.com / onboarding@resend.dev` (must match a verified Resend domain) |
| Sender name | `SAPS` |

**Without domain verification, emails will fail silently.** DNS propagation can take hours — start this early.

---

## 7. Test Locally Against Hosted DB

### Swap environment files

```bash
mv .env.local .env.local.bak
cp .env.hosted .env.local
npm run dev    # MUST restart — NEXT_PUBLIC_ vars are baked at startup
```

### Verify the app connects to the hosted project

Open browser devtools → Console:
```js
// Should show your hosted Supabase URL, not localhost
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

### Smoke test checklist

- [ ] Sign up a new student account
- [ ] Complete onboarding (select grade, graduation year)
- [ ] Land on dashboard
- [ ] Open planner, create a plan
- [ ] Add courses from the catalog
- [ ] See `1/3 plans used` badge
- [ ] Create 3 plans → verify disabled "Create Plan" button
- [ ] Delete a plan → verify count drops
- [ ] Invite a parent from Settings → invite email arrives (or check Supabase Auth logs)
- [ ] Parent signs up via invite link
- [ ] Parent creates a plan on the student's account
- [ ] Remove parent → verify orphan plans are cleaned up
- [ ] Check Supabase dashboard → Table Editor for data
- [ ] Check Authentication → Users for auth records

### CSP note for local testing with hosted Supabase

The Content Security Policy in `next.config.ts` must allow connections to `*.supabase.co` in dev mode. This is already configured (line 14 includes `https://*.supabase.co` in the dev `connect-src`). If you see `Failed to fetch` errors with CSP violations in the console, verify the dev server was restarted after the config change.

---

## 8. Deploy to Vercel

### Import the repo

1. Vercel → New Project → Import from GitHub
2. **Root directory:** `saps`
3. **Build command:** `npm run build`
4. **Production branch:** `main`

### Environment variables

Set these in Vercel → Project Settings → Environment Variables:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key | |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret key | Server-only — do NOT prefix with `NEXT_PUBLIC_` |
| `DATABASE_URL` | Transaction mode pooler URL (port 6543, `?pgbouncer=true`) | **Not** the direct connection |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` | Used by CSRF origin check and invite email links |
| `RESEND_API_KEY` | Your Resend API key | |
| `STRIPE_SECRET_KEY` | Live or test key | |
| `STRIPE_WEBHOOK_SECRET` | From Stripe dashboard | Register `https://yourdomain.com/api/v1/stripe/webhook` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Live or test key | |
| `STRIPE_PRICE_*` | 6 price IDs | Same as local unless you create live prices |
| `UPSTASH_REDIS_REST_URL` | From Upstash | Optional — rate limiting fails open without it |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash | Optional |
| `SENTRY_DSN` | From Sentry | Recommended for error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | Same DSN | Client-side error tracking |
| `NEXT_PUBLIC_POSTHOG_KEY` | From PostHog | Optional — analytics |

**Critical: `DATABASE_URL` must use the Transaction mode pooler** (port 6543 with `?pgbouncer=true`) for Vercel serverless. The direct connection (port 5432) will exhaust connections under load. You used port 5432 for migrations — that's correct for one-time operations. The running app needs the pooler.

### Custom domain

1. Vercel → Domains → Add your domain
2. Configure DNS at your registrar (A record or CNAME)
3. Wait for SSL to provision
4. Update Supabase Auth → URL Configuration → Site URL to `https://yourdomain.com`
5. Update Supabase Auth → Redirect URLs to `https://yourdomain.com/**`

### First deploy

Deploy to a **preview** branch first, not production. Verify against the hosted DB, then promote to production.

---

## 9. Post-Deploy Verification

Run through this checklist on the live deployment:

- [ ] App loads at `https://yourdomain.com`
- [ ] Sign up works → confirmation email arrives (if enabled)
- [ ] Login works → redirects to dashboard
- [ ] Planner shows courses from the catalog
- [ ] Plan creation/deletion works
- [ ] Invite flow sends email and works end-to-end
- [ ] Sentry receives error reports (trigger a test error or check for any from the deploy)
- [ ] Check Supabase dashboard → Logs for any auth errors
- [ ] Verify RLS is active: in SQL Editor, `SET ROLE authenticated; SELECT * FROM users;` → should return 0 rows

### Stripe webhook (if using paid subscriptions)

1. Register `https://yourdomain.com/api/v1/stripe/webhook` in Stripe dashboard → Webhooks
2. Copy the signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`
3. Trigger a test event from Stripe to verify it's received

---

## 10. Switching Back to Local Dev

```bash
mv .env.local.bak .env.local   # Restore local Supabase credentials
npm run dev                     # Restart to pick up the change
```

Verify by checking the browser console — `NEXT_PUBLIC_SUPABASE_URL` should show `http://127.0.0.1:54321`.

Make sure the local Supabase stack is running:
```bash
npx supabase start
```

---

## 11. Troubleshooting

### Signup returns 500

**Most likely cause:** `legal_documents` table is empty. Run `npm run db:setup` (or `npm run db:setup -- --skip-courses --skip-rls` to only seed data).

**Second cause:** Orphan user from a previous failed attempt. The error log will show `duplicate key value violates unique constraint "users_email_unique"`. Clean up:

```sql
DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM users WHERE email = '<failed-email>';
  IF uid IS NOT NULL THEN
    DELETE FROM consent_records WHERE user_id = uid;
    DELETE FROM subscriptions WHERE user_id = uid;
    DELETE FROM student_profiles WHERE user_id = uid;
    DELETE FROM plan_shares WHERE user_id = uid;
    DELETE FROM account_members WHERE user_id = uid;
    DELETE FROM accounts WHERE student_user_id = uid;
    DELETE FROM accounts WHERE created_by = uid;
    DELETE FROM users WHERE id = uid;
  END IF;
END $$;
```

Also delete the auth user from Supabase dashboard → Authentication → Users (there may be multiple from repeated attempts).

### Login shows "Failed to fetch" / CSP violation

The browser can't reach the hosted Supabase URL. Two causes:

1. **Dev server not restarted** after changing `.env.local` — `NEXT_PUBLIC_*` vars are baked at startup. Always restart.
2. **CSP blocking the connection** — verify `next.config.ts` line 14 includes `https://*.supabase.co` in the dev `connect-src`. Must restart after changing.

### `db:migrate` hangs with no output

**Cause:** Unescaped special characters in `DATABASE_URL`. The `@` in the password is interpreted as the credential/host separator. URL-encode it: `@` → `%40`.

### `db:setup` shows "No catalog version found — skipping"

**Cause:** Course catalog failed to load (check earlier log output for errors). The graduation requirements and plan templates depend on courses. Fix the course load issue and re-run `npm run db:setup`.

### Supabase dashboard shows "RLS disabled" on tables

**Cause:** RLS migrations weren't applied. Run `npm run db:setup` (or `npm run db:setup -- --skip-courses` to only apply RLS + seed data).

### Onboarding returns 401 after signup

**Cause:** Email confirmation is enabled in Supabase Auth. The user signed up but hasn't confirmed their email, so no active session exists. Either:
- Disable email confirmation for testing (Authentication → Providers → Email)
- Or check your email for the confirmation link, click it, then log in via the login page

### Connection exhaustion on Vercel

**Cause:** Using the direct database connection (port 5432) instead of the pooler (port 6543). Vercel serverless functions create a new connection per invocation — without pooling, you'll hit the connection limit fast. Use the Transaction mode pooler URL with `?pgbouncer=true`.

### Rate limiting not working in production

**Cause:** `UPSTASH_REDIS_REST_URL` not set. Rate limiting fails open (allows all requests) when Redis is unavailable. This is by design for resilience, but you should configure Upstash for production. Check server logs for `[rate-limit] passing through — Redis not configured` warnings.

### Settings page shows wrong role for parent

**Cause:** Fixed in the auth-hardening branch. The settings page was falling back to hardcoded "student" when `currentAccount` was null (parent who hasn't joined a student account yet). Now falls back to `userRole` from the auth context.

---

## 12. Appendix: Manual Step-by-Step Seeding

If you prefer to run each seeding step individually (e.g., for debugging), or if `db:setup` fails partway through:

### A. Apply RLS manually

```bash
node -e "
import('dotenv').then(d => d.config({path:'.env.local'}));
import('fs').then(async (fs) => {
  const {Pool} = await import('pg');
  const p = new Pool({connectionString: process.env.DATABASE_URL});
  await p.query(fs.readFileSync('lib/db/migrations/0009_enable_rls.sql', 'utf-8'));
  console.log('0009 applied.');
  await p.query(fs.readFileSync('lib/db/migrations/0010_create_contact_school_tables.sql', 'utf-8'));
  console.log('0010 applied.');
  await p.end();
});
"
```

### B. Load course catalog (Python)

```bash
cd extractor
pip install psycopg2-binary
DATABASE_URL="<connection-string>" python loader.py data/2026-courses.json
cd ..
```

The loader detects `supabase.co` in the URL and prompts for confirmation — type `yes`.

### C. Seed reference data

```bash
npm run db:seed
```

Seeds subscription plans, divisions, departments, graduation requirements, and plan templates. **Requires courses to be loaded first** (Step B).

### D. Seed legal documents

```bash
npx tsx scripts/seed-legal-documents.ts
```

Seeds ToS v1.0 and Privacy Policy v1.0. **Required for signup to work.**

### Order

```
A (RLS) → B (courses) → C (reference data) → D (legal docs)
```

Steps B → C → D must run in that order. Step A can run at any time after `db:migrate`.

---

## Summary: Complete Setup

```
1. Create Supabase project (dashboard)
2. Collect 4 credentials
3. Configure .env.hosted / .env.local
4. npm run db:migrate          ← creates all schema tables
5. npm run db:setup            ← RLS + courses + seeds + legal docs (one command)
6. Configure Supabase Auth (dashboard)
7. Configure Resend SMTP (dashboard, optional)
8. Restart dev server and test
9. Deploy to Vercel
10. Post-deploy verification
```
