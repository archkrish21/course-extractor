# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run test:e2e:ui        # Playwright with inspector UI
```

### Running a single test

```bash
# Unit test (Vitest)
npx vitest run tests/unit/gpa-calc.test.ts

# E2E test (Playwright)
npx playwright test tests/e2e/planner.spec.ts
npx playwright test tests/e2e/planner.spec.ts --project=chromium  # desktop only
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
- Global setup (`tests/e2e/global-setup.ts`) resets the local DB and seeds test accounts
- Two Playwright projects: Desktop Chrome + iPhone 13 (mobile)
- Detailed test orchestration guide: `tests/TEST_ORCHESTRATION.md`
- Dev server auto-started by Playwright if not running

### Path Alias
- `@/*` maps to `saps/` root (e.g., `@/lib/db/schema`, `@/components/ui/button`)

### Environment
- Copy `.env.local.example` to `.env.local` for local dev
- Key vars: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`
- Redis (Upstash) is optional and fails open

### Seed Script Safety
- `db:seed` checks for `PRODUCTION_DATABASE` env var and refuses to run against production
