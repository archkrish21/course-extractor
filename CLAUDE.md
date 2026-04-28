# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hard Rules

- **For any git-related actions** (branching, committing, pushing, PRs, conflict resolution), follow the rules in `/git-rules`.

## Project Overview

SAPS (Student Academic Planning System) is a Next.js web app for high school students, parents, and counselors to manage four-year academic plans, course selection, grade tracking, and GPA calculation. Currently targets Stevenson High School.

## Repository Layout

The main application lives in `saps/`. All commands should be run from `saps/`.

```
saps/
  app/              # Next.js App Router
    (app)/           # Authenticated routes (dashboard, planner, plans, transcript, etc.)
    (auth)/          # Login, signup, password reset
    (onboarding)/    # New user onboarding flow
    (public)/        # Landing pages
    api/v1/          # REST API routes (22 resource groups)
  lib/
    db/schema.ts     # Drizzle ORM schema (single file, all tables)
    db/migrations/   # SQL migration files
    auth/            # Session helpers, plan permissions
    supabase/        # Client factories (server.ts, client.ts, admin.ts)
    gpa/             # GPA calculation engine
    prereq/          # Prerequisite DAG validation
    api/             # API response utilities
    hooks/           # React hooks (tour, undo-stack)
    api-client.ts    # Frontend HTTP client
    account-context.tsx  # React context for user/account
  components/
    ui/              # shadcn-style base components
    planner/         # Course planner grid components
    plans/           # Plan management components
    charts/          # Recharts visualizations
    emails/          # Email templates (React)
  config/            # App config (subscription tiers, grade scales, tour defs, seeds)
  tests/
    unit/            # Vitest unit tests
    e2e/             # Playwright E2E tests
    setup.ts         # Vitest globals setup
  extractor/         # Python PDF extraction pipeline (separate from npm)
  scripts/           # Node utility scripts (seed, migrations)
  worker/            # Background job stubs (future)
```

Documentation lives in `docs/` — product specs in `docs/product/`, architecture in `docs/architecture/`, deploy/ops guides in `docs/operations/`, security audits in `docs/security/`, and implementation plans in `docs/plans/`.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack dev), React 19, TypeScript
- **Database:** PostgreSQL via Supabase, Drizzle ORM
- **Auth:** Supabase Auth (email/password, cookie-based sessions via `@supabase/ssr`)
- **Styling:** Tailwind CSS 4
- **Payments:** Stripe (test mode in dev)
- **Email:** Resend
- **State:** Zustand, React Context
- **Monitoring:** Sentry, PostHog, Pino logging
- **AI:** Anthropic Claude SDK (stubs, not yet implemented)

## Commands (run from `saps/`)

```bash
# Development
npm run dev                # Dev server with Turbopack (localhost:3000)
npm run build              # Production build
npm run lint               # ESLint via next lint

# Database
npm run db:generate        # Generate migrations from schema changes
npm run db:migrate         # Run pending migrations
npm run db:push            # Push schema directly (dev shortcut)
npm run db:seed            # Seed catalog, plans, subscriptions
npm run db:studio          # Drizzle Studio web UI

# Testing
npm test                   # Vitest unit tests (single run)
npm run test:watch         # Vitest watch mode
npm run test:coverage      # Coverage report (text + HTML)
npm run test:e2e           # Playwright E2E (headless)
npm run test:e2e:desktop   # Alias — same as test:e2e (desktop-only Chromium)
npm run test:e2e:ui        # Playwright with inspector UI
```

### Running a single test

```bash
# Unit test (Vitest)
npx vitest run tests/unit/gpa-calc.test.ts

# E2E test (Playwright)
npx playwright test tests/e2e/api/gpa.spec.ts         # API-tier test
npx playwright test tests/e2e/ui/planner.spec.ts      # UI-tier test
npx playwright test --grep "adding a course"          # by test name
```

### Python extractor (from `saps/extractor/`)

```bash
python extract.py <pdf-path> --year 2026 --out-dir ./data
python -m pytest tests/
```

## Skill Commands

Before starting new frontend or backend implementation work, run the corresponding skill command to load detailed patterns and conventions:

- **`/frontend`** — Run before building new UI pages, components, forms, or doing visual work. Covers component APIs (Button, Badge, Card, Input, Toast), design tokens, responsive patterns, accessibility requirements, state management, and form patterns.
- **`/backend`** — Run before adding API routes, DB queries, or business logic. Covers route handler anatomy, auth/permissions, Drizzle ORM query patterns, Zod validation, subscription tier checking, rate limiting, and Stripe/email integration.

These are not needed for small bug fixes or config changes — CLAUDE.md provides enough context for those.

## Architecture Notes

### Auth & Authorization
- Session is read server-side via `lib/auth/get-user.ts` using Supabase cookies
- Three Supabase client factories: `server.ts` (route handlers/RSC), `client.ts` (browser), `admin.ts` (service role)
- Role-based access: student, parent, guardian, counselor. Plan-level permissions in `lib/auth/plan-permissions.ts`
- Account model: students own accounts; parents/guardians/counselors join via invite codes through `account_members`

### API Pattern
- Routes under `app/api/v1/{resource}/route.ts`
- All routes authenticate via Supabase session, then perform Drizzle queries
- Consistent response shape via `lib/api/response.ts`

### Database
- Single schema file: `lib/db/schema.ts` (Drizzle ORM)
- Config reads `DATABASE_URL` from `.env.local`
- Local dev uses Supabase CLI (`npx supabase start` → PostgreSQL on port 54321)
- Key tables: `users`, `accounts`, `account_members`, `courses`, `four_year_plans`, `plan_courses`, `grades`, `subscriptions`

### Subscription Tiers
- Starter (free), Plus (trial → paid), Elite. Defined in `config/subscription-plans.ts`
- Stripe integration with webhook at `/api/v1/stripe/webhook`
- 14-day trial, no credit card required

### E2E Test Infrastructure
- Suite is organized into three tiers under `tests/e2e/`:
  - `api/` — pure API tests (fast, business logic)
  - `ui/` — per-page UI smoke tests (use pre-saved storageState)
  - `journeys/` — multi-page role-based flows
- `auth.setup.ts` creates `.auth/<role>.json` storageState files (one per role) that all tests inherit — no per-test UI login
- `global-setup.ts` seeds deterministic DB state; `global-teardown.ts` wipes non-primary scratch plans and orphans after runs
- Fixture helpers in `tests/e2e/helpers/api-client.ts` — use these to set up state instead of clicking through the UI
- Single command: `npm run test:e2e:desktop` (78 tests, ~3 min)
- Detailed guide: `tests/TEST_ORCHESTRATION.md`
- Suite runs against a **production build** (`next build && next start`), not the dev server. Eliminates Turbopack route-eviction flakes that plagued earlier dev-mode runs. First run pays a ~1-2 min build cost; subsequent runs reuse the running server (`reuseExistingServer: true` outside CI).
- Telemetry (Sentry, PostHog) is gated by `NEXT_PUBLIC_E2E_DISABLE_TELEMETRY=1`, set only by Playwright's webServer block — production deploys never see this flag, and `next.config.ts` fails the build if it's accidentally set in a Vercel production deploy.
- **Accessibility (a11y)**: NOT in the default gate. Axe scans were removed from the suite for speed and noise reasons. Run axe DevTools manually before merging a new page; a `test:a11y` nightly job is planned post-v1. See `tests/TEST_ORCHESTRATION.md#accessibility-a11y` for details.

### Path Alias
- `@/*` maps to `saps/` root (e.g., `@/lib/db/schema`, `@/components/ui/button`)

### Environment
- Copy `.env.local.example` to `.env.local` for local dev
- Key vars: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`
- Redis (Upstash) is optional and fails open

### Seed Script Safety
- `db:seed` checks for `PRODUCTION_DATABASE` env var and refuses to run against production
