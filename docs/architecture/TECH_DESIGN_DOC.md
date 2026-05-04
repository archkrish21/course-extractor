# Student Academic Planning System (SAPS)
## Technical Design Document

**Audience:** Engineering team
**Status:** Phase 3 In Progress — Active Development
**Last updated:** 2026-04-09

> **v1 scope note:** The **Counselor** role is **UI-hidden for v1** and postponed to a post-v1 release. The backend (`users.role` enum, `counselor_student_links` table, RLS policies, Zod schemas, permission gates) is unchanged — this is a soft-hide only. Counselor UI behavior documented below (3/4-role signup selector, invite dropdown, view-only dashboard, counselor-specific RLS) describes the eventual post-v1 state. Re-enable checklist: [docs/plans/v2-reenable-counselor.md](../plans/v2-reenable-counselor.md).

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Database Schema](#6-database-schema)
7. [Course Catalog Data Pipeline](#7-course-catalog-data-pipeline)
8. [API Design](#8-api-design)
9. [Subscription & Billing Engine](#9-subscription--billing-engine)
10. [Background Job Queue](#10-background-job-queue)
11. [Caching Strategy](#11-caching-strategy)
12. [AI Integration](#12-ai-integration)
13. [GPA Calculation Engine](#13-gpa-calculation-engine)
14. [Prerequisite DAG Engine](#14-prerequisite-dag-engine)
15. [Alert Engine](#15-alert-engine)
16. [Notification System](#16-notification-system)
17. [Real-Time Updates](#17-real-time-updates)
18. [PDF Export & Share Links](#18-pdf-export--share-links)
19. [Security Model](#19-security-model)
20. [Accessibility & Mobile Responsive Design](#20-accessibility--mobile-responsive-design)
21. [Testing Strategy](#21-testing-strategy)
22. [Deployment & Infrastructure](#22-deployment--infrastructure)
23. [Environment Configuration](#23-environment-configuration)
24. [Performance Considerations](#24-performance-considerations)
25. [Observability & Monitoring](#25-observability--monitoring)
26. [Resilience & Graceful Degradation](#26-resilience--graceful-degradation)
27. [Data Seeding Strategy](#27-data-seeding-strategy)
28. [Analytics & Event Tracking](#28-analytics--event-tracking)
29. [Data Privacy & Compliance](#29-data-privacy--compliance)

---

## 1. System Overview

SAPS is a multi-tenant SaaS platform built on Next.js (App Router) with Supabase (PostgreSQL + Auth), Upstash Redis (migrating to AWS ElastiCache at scale), BullMQ background jobs, and the Claude API for AI-powered advisory features.

**Core data flow:**
```
PDF catalog (annual) → Python extractor → courses.json → DB loader
                                                             ↓
User → Next.js frontend → API routes → PostgreSQL (Supabase + RLS)
                                    ↘ Redis (cached tier/GPA)
                                    ↘ BullMQ (async alerts, jobs)
                                    ↘ Claude API (AI features)
                                    ↘ Resend (email)
                                    ↘ Stripe (billing)
```

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                          │
│  Auth / Onboarding  │  Dashboard   │  4-yr Planner  │  Progress     │
│  Transcript         │  Req Checker │  AI Advisor    │ Notif Center  │
│  GPA Calc / What-If │ Course Search│  Prereq Graph  │ Plan Export   │
│  Plan Comparison    │  Homepage    │  About / Contact│              │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ REST /api/v1/...
┌──────────────────────────────────▼──────────────────────────────────┐
│                  API Layer (Next.js API routes)                      │
│  /auth          /courses        /plans          /transcript          │
│  /requirements  /gpa            /suggestions    /alerts              │
│  /notifications /ai             /users          /catalog-versions    │
│  /export        /dual-credit    /subscriptions  /stripe              │
└──────┬────────────────┬───────────────────┬────────────┬────────────┘
       │                │                   │            │
┌──────▼──────┐  ┌──────▼──────┐  ┌────────▼─────┐ ┌──▼────────────┐
│  Supabase   │  │  Redis      │  │  Claude API  │ │ Notification  │
│  Auth +     │  │(ElastiCache)│  │  (Anthropic) │ │ Service       │
│  PostgreSQL │  │  sub tier   │  │  Suggestions │ │ (Resend email │
│  RLS policies│  │  GPA cache  │  │  Career map  │ │  + in-app)    │
└─────────────┘  └─────────────┘  └──────────────┘ └───────────────┘
       ▲
┌──────┴──────────────────────┐
│         Job Queue (BullMQ)  │
│  Alert evaluation           │ ← plan save / grade entry
│  GPA recalculation          │ ← grade entry
│  Notification dispatch      │ ← alert trigger
│  req-progress-refresh       │ ← plan save
│  Weekly digest emails       │ ← cron: Sunday
│  Trial expiry check         │ ← cron: nightly
│  Graduation detection       │ ← cron: nightly
│  Payment lapse freeze       │ ← Stripe webhook (5-day delay)
│  Percentile stats rebuild   │ ← cron: nightly
│  Year-end state reset       │ ← handled inline at completion
                                       (advancing students reset to 'pending',
                                        graduating students stay 'completed')
└─────────────────────────────┘

┌────────────────────┐
│  PDF Extractor     │  (yearly CLI batch job — Python, standalone)
│  courses.json      │  loads directly into DB; does NOT use BullMQ
└────────────────────┘
```

---

## 3. Technology Stack

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| Frontend framework | Next.js (App Router) | 16.x | SSR + API routes in one; strong ecosystem; Turbopack dev server |
| UI components | shadcn/ui + Tailwind CSS v4 | latest | Accessible, unstyled-first; Tailwind v4 with `@theme` CSS variables for design tokens; critical for planner grid and DAG |
| State management | Zustand | 5.x | Lightweight; well-suited for planner/simulator ephemeral state |
| Auth | Supabase Auth | — | Same instance as app DB; RLS handles multi-tenant isolation; Google OAuth built-in |
| Database | PostgreSQL via Supabase | 15+ | Managed; RLS; recursive CTEs for DAG traversal |
| ORM | Drizzle ORM | 0.45.x | Type-safe SQL; schema-first; Supabase-compatible; avoids raw Supabase client for complex joins |
| Real-time | Supabase Realtime | — | Postgres change subscriptions → live in-app notifications, no polling |
| Cache | Redis via Upstash (early) → AWS ElastiCache (scale) | — | Upstash at <~500 users (serverless, no VPC, ~$0); migrate to ElastiCache `cache.t4g.micro` when VPC cost is justified |
| Background jobs | BullMQ (Node.js) | 5.x | Async alert eval, GPA recompute, notification dispatch; runs on AWS ECS Fargate |
| AI | Claude API (`claude-sonnet-4-6`) | — | Best reasoning; structured tool use for DB-validated suggestions |
| Email | Resend + React Email | — | Developer-friendly; React templates; generous free tier |
| DAG visualization | React Flow | 11.x | Purpose-built for node/edge graphs; prerequisite DAG and course unlock trees |
| Charts | Recharts | 3.x | Composable, Tailwind-friendly; GPA trend charts, credit progress rings |
| PDF generation | React-pdf | 3.x | Renders plan export PDFs server-side from React components |
| API validation | Zod | 4.x | Request/response validation |
| Error tracking | Sentry | — | Captures frontend, API, and BullMQ worker errors |
| Product analytics | PostHog | — | Event tracking, funnel analysis, feature flags; generous free tier (1M events/mo); self-hostable; GDPR-friendly |
| Guided tours | driver.js | 1.x | Lightweight (5KB) step-by-step feature walkthroughs; adaptive step counts; CSS-customizable popovers |
| PDF extractor | Python + pdfplumber | 3.12 / 0.11 | Standalone CLI; independent of web stack |
| Source control | GitHub | — | PR-based workflow; branch protection on `main` |
| CI/CD | GitHub Actions → AWS | — | Tests + voice-guardian copy review on every PR; deploy to Amplify + ECS on merge to `main` |
| Hosting (frontend/API) | AWS Amplify | — | Managed Next.js SSR hosting on AWS; preview deployments per PR |
| Hosting (BullMQ worker) | AWS ECS Fargate | — | Persistent containerised process; not serverless-compatible |
| Container registry | Amazon ECR | — | Docker images for ECS Fargate tasks |
| Secrets management | AWS Secrets Manager | — | All production secrets; referenced by Amplify env vars and ECS task definitions |

---

## 4. Project Structure

```
/
├── app/                        # Next.js App Router
│   ├── (public)/               # public pages group (no auth required)
│   │   ├── page.tsx            # Homepage — hero, stats, features, how-it-works, FAQ, CTA
│   │   ├── layout.tsx          # Public layout — sticky glass navbar, footer with social/legal columns
│   │   ├── about/              # About page — story, mission, Plan/Track/Connect cards, disclaimer
│   │   └── contact/            # Contact page (enabled — form + email notification via Resend)
│   ├── (auth)/                 # auth group
│   │   ├── login/
│   │   ├── signup/
│   │   ├── claim/              # Student claims account via code
│   │   └── consent/            # Legal consent interstitial
│   ├── (app)/                  # authenticated group
│   │   ├── dashboard/
│   │   ├── courses/
│   │   ├── plans/              # Plan management page (My Plans / Shared with Me tabs)
│   │   ├── planner/            # 4-year planner grid
│   │   │   └── print/          # Print-optimized plan view with watermark
│   │   ├── progress/           # Academic Progress page — two-column layout with filter bar, grouped sections, sticky sidebar (print button in header, Plus+ gated)
│   │   ├── year-end/           # Year-end transition wizard
│   │   ├── join/               # Join account via invite code
│   │   ├── settings/           # User settings + billing
│   │   └── transcript/         # read-only transcript page (print button in header, Plus+ gated)
│   └── api/v1/                 # API routes
│       ├── auth/
│       ├── contact/            # POST — contact form submission (no auth)
│       ├── courses/
│       ├── health/
│       └── users/
├── components/                 # shared UI components
│   ├── ui/                     # shadcn/ui base (button, input, badge, card)
│   ├── course-detail/
│   ├── trial-banner/
│   ├── planner/  # planner-grid.tsx, course-picker.tsx, plan-course-card.tsx
│   ├── tour-button.tsx          # Global "Tour" button for app header nav bar
│   ├── prereq-graph/           # (empty — planned for Phase 3+)
│   └── charts/                 # (empty — planned for Phase 3+)
├── lib/
│   ├── db/                     # Drizzle ORM schema + client
│   │   ├── schema.ts           # all table definitions
│   │   └── migrations/         # Drizzle migration files
│   ├── auth/                   # authentication helpers
│   ├── api/                    # shared API utilities
│   ├── supabase/               # Supabase client helpers
│   ├── subscription/           # tier enforcement, Redis cache
│   ├── analytics/              # event tracking utilities
│   ├── gpa/  # calc.ts — GPA calculation engine
│   ├── prereq/  # validator.ts — prerequisite DAG validation
│   ├── hooks/  # use-undo-stack.ts; tour stack: use-tour.ts + run-tour.ts + tour-state.ts (consent gate, driver.js orchestration, waitFor + finalCta semantics)
│   ├── account-context.tsx  # React context for account switching
│   ├── api-client.ts  # apiFetch with X-Account-Id header
│   ├── alerts/                 # (empty — planned for Phase 3+)
│   ├── ai/                     # (empty — planned for Phase 4)
│   └── stripe/                 # Stripe SDK singleton + price mapping
│       ├── client.ts           # Stripe SDK singleton (initialized from STRIPE_SECRET_KEY)
│       └── prices.ts           # Price ID mapping for all tier × interval combinations
├── worker/                     # BullMQ worker process (deployed separately)
│   └── jobs/                   # BullMQ job definitions (Phase 2+)
├── extractor/                  # Python PDF extractor (independent)
│   ├── extract.py              # Main catalog PDF extraction
│   ├── extract_summer.py       # Summer course extraction
│   ├── summer_courses_2026.py  # Curated summer course data (35+ courses)
│   ├── loader.py               # Load extracted JSON to DB with UPSERT
│   ├── tests/
│   └── data/
│       ├── 2025-courses.json
│       └── 2026-courses.json   # git-tracked yearly artifacts
├── config/
│   ├── gpa-weights.ts          # CONFIGURABLE — get from school before coding
│   ├── grade-scale.ts          # letter → GPA points mapping + isPassFailCourse() + PASS_FAIL_OPTIONS
│   ├── homepage.ts             # Feature flags: showTestimonials (false), showContactPage (true), showPricing (false)
│   ├── tours.ts                # Tour step definitions for Welcome (6 steps), Planner (2-5 adaptive), Progress (1-3 adaptive)
│   ├── semesters.ts            # Semester values (-2, -1, 1, 2), labels, isSummerSemester()
│   ├── summer-equivalents.ts   # 52 summer-to-regular course equivalency mappings
│   └── subscription-plans.ts   # tier feature flags (mirrors DB seed)
├── scripts/
│   └── seed.ts                 # Drizzle seed runner (npm run db:seed)
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/                    # Playwright
```

---

## 5. Authentication & Authorization

### Auth provider: Supabase Auth

- Email/password + Google OAuth (OAuth configured in Supabase dashboard)
- Email verification required before plan creation (enforced at API layer)
- JWTs issued by Supabase Auth; passed as `Authorization: Bearer <token>` on all API requests
- Session refresh handled by Supabase client SDK

All pages under the `(app)/` route group require authentication. The app layout checks the Supabase session on mount and redirects unauthenticated users to `/login?redirect=...`.

**Consent gate (Phase 3 — implemented):** The `(app)/layout.tsx` checks `/api/v1/auth/consent` on every authenticated page load. If `consent_required === true` (user hasn't accepted current legal document versions), the layout redirects to `/consent?next=${currentPathname}`. The consent interstitial (`/(auth)/consent/page.tsx`) displays pending documents (Terms of Service and Privacy Policy) with "View" links to `/terms` and `/privacy`, a required checkbox, and Accept/Decline buttons. On acceptance, `POST /api/v1/auth/consent` records the acceptance with IP address and user agent in `consent_records`, then redirects to the `next` URL param. The app layout blocks rendering until consent is verified (`consentChecked` state). If the consent check shows `isUpdate` (document version changed, summary differs from "Initial version"), a "We've Updated Our Terms" header with change summary is shown instead of the initial "Review Our Terms" flow.

**Terms of Service (`/terms`) and Privacy Policy (`/privacy`):** Static pages with versioned legal content (effective April 6, 2026, Version 1.0). Terms covers 12 sections: Acceptance, Description of Service, Accounts and Roles, User Responsibilities, Subscription and Payments, IP, Disclaimers, Limitation of Liability, Account Termination, Changes to Terms, Governing Law (Illinois, USA), and Contact (planwithgenie@gmail.com). Privacy covers 11 sections: Information We Collect, How We Use It, Information Sharing (Stripe/Resend/Supabase), Children's Privacy (COPPA, 13+), FERPA Statement, Your Rights (access/correct/delete/export, CCPA/CPRA), Data Security, Data Retention, Cookies (essential only, no tracking), Changes to Policy, and Contact (planwithgenie@gmail.com). Both pages use a centered max-width prose container with a `BackButton` component at the bottom (closes tab if opened via `target="_blank"`, otherwise falls back to browser history). Each page cross-links to the other.

**Public pages (Phase 3 — no auth required):** Pages under the `(public)/` route group are accessible without authentication. They share a public layout with a sticky navbar (glass blur effect, logo, nav links for About and FAQ section anchor, Sign in button, Get Started Free CTA) and a footer (Product/Legal/Connect columns, social media icons for Instagram/Facebook/Twitter/LinkedIn, feedback link pointing to /contact page, school request link, copyright with disclaimer). Mobile uses a hamburger menu. The homepage (`/`) includes a hero section with gradient text, animated stats bar, animated trial badge, "Why SAPS?" problem section, 5 feature cards with unique color accents, 4-step timeline how-it-works (Pick your grade level / Track grad progress / Run what-if scenarios / Loop in your family — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`), FAQ accordion, and final CTA. `html { scroll-padding-top: 5rem }` in globals.css ensures in-page anchors (#how-it-works, #pricing, #faq) land below the sticky public header. Feature-flagged pricing section dormant for v1 (`showPricing: false`). Testimonials section dormant (`showTestimonials: false` — no real testimonials yet). The about page (`/about`) has story, mission, what-we-do (Plan/Track/Connect cards), looking ahead, and disclaimer sections. The contact page (`/contact`) has a form with name/email/subject/message fields, submitted to `POST /api/v1/contact` (no auth) and stored in `contact_messages` table; on submission also sends a notification email to `planwithgenie@gmail.com` via Resend with `replyTo` set to the sender so one-click Reply works; enabled and linked from nav + footer.

**SEO (Phase 3):** Root layout includes meta description, keywords, and Open Graph tags (og:title, og:description, og:type, og:url). Optimized for search terms: "Stevenson High School course planner", "high school academic planner", "4-year plan tool".

**App header navigation:** The top navigation bar includes nav links (Dashboard, Courses, Planner, Progress, Transcript), a global "Tour" button (triggers the guided tour for the current page — detects page and adapts step count based on DOM state), and a user avatar dropdown (Settings, Billing, Sign out). Sign out calls `supabase.auth.signOut()`, clears the client session, and redirects to `/` (home page). The mobile hamburger menu also includes a Sign out option. Settings is no longer in the main navigation bar — it was moved into the avatar dropdown. The avatar and layout display the user's full name (from `firstName` + `lastName` columns) instead of the email prefix. For parent users: the avatar shows the parent's own name/email (not the student's), with a "Managing: StudentName · Gr X" subtitle below. "Add Another Child" removed from the dropdown.

**Settings page (Phase 3 — implemented):** Client component at `/(app)/settings/page.tsx` using `useAccount()` context. Layout uses flat sections with uppercase headers (no collapsible cards):
- **Profile section** — 3×3 grid: Name (inline editable) / Email / Password (show/hide toggle) / Role / Grade Level / Graduation Year / State (read-only, frozen to IL) / School (read-only, frozen to Stevenson). Inline name editing via `PATCH /api/v1/auth/me`.
- **Linked Accounts section** — renamed from "Family Members". Shows member list with roles and a usage counter ("2/5 linked accounts used"). Invite form for students (Parent/Guardian/Counselor) and parents (Child/Parent/Guardian/Counselor); hidden for counselors. Plan sharing selection during invite. Tier limits enforced: Starter/Trial 3, Plus 5, Elite 8 (402 UPGRADE_REQUIRED).
- **Subscription section** — current plan display, billing cycle, next payment date. Hidden for counselors.
- **Legal section** — links to Terms of Service and Privacy Policy with accepted version timestamps.
- **Danger Zone section** — account deletion with typed confirmation. Full cleanup: Stripe customer/subscription deleted, Supabase auth user deleted, Redis cache cleared, PostHog data removed, consent records anonymized.
Fetches data from: `/api/v1/accounts/{id}/members`, `/api/v1/subscriptions`, `/api/v1/plans`, `/api/v1/auth/consent`. For non-student roles: shows "Student Information" section instead of subscription/billing.

**User avatar dropdown (top nav):** Contains Settings, Billing (hidden for counselors), and Sign out. Displays user's full name (`firstName` + `lastName`). For parent users: shows parent's own name/email with "Managing: StudentName · Gr X" subtitle. Sign out calls `supabase.auth.signOut()` and redirects to `/` (home page). Mobile hamburger menu mirrors the same options.

**Signup page redesign (Phase 3):** Wider layout (max-w-lg), 2-column grids for credentials and personal info. Role selector with description cards (Student/Parent/Guardian/Counselor — 4 roles). Guardian maps to "parent" in DB for identical behavior. Frozen state (IL) and school (Stevenson) fields with "Request yours" link for unsupported schools. School request form submits to `POST /api/v1/school-request` (no auth) and stores in `school_requests` table. "Claim your account" link removed from signup page. Non-student roles skip onboarding and go directly to dashboard. Onboarding shows welcome banner ("Account created successfully!") with auto-dismiss. "Skip setup" link on onboarding page. Smart routing after onboarding: dashboard if plans exist, planner otherwise. **Invite-driven signups** (URL carries `?invite=...&account=...&role=...`): the form pre-selects the role from the `?role=` param on mount and disables the other tabs ("Role set by your invite" hint shown), so an invitee can't accidentally pick a different role than they were invited as.

**Google sign-in (Google Identity Services / ID-token flow):** Google authentication uses GIS rather than the Supabase OAuth redirect flow. The browser loads `accounts.google.com/gsi/client`, renders Google's branded button via the `<GoogleSignInButton>` component (`saps/components/auth/google-sign-in-button.tsx`), and on selection receives an ID token. The token is handed to `supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })` to establish the session. After the session is established the client calls `POST /api/v1/auth/google-provision`, which detects first-time Google users (no `users` row for the auth ID) and inserts a minimal users row (role: 'student' as a temporary default, `isEmailVerified: true`, `firstName` from `user_metadata.full_name` → `name` → email prefix). First-time users are redirected to `/profile-setup` to pick their role and complete details — the rest of the provisioning (`accounts`, `account_members`, `student_profiles`, `subscriptions`) happens there via the same path as email/password signup. Returning users go to the requested redirect (or `/dashboard`). The legacy `GET /api/v1/auth/callback` OAuth code-exchange route is unused in V1 and kept only for safety. The chooser screen ("to continue to …") shows `planwithgenie.com` because GIS uses the OAuth client's authorized JavaScript origin rather than a Supabase callback domain (which would have required a Supabase Pro custom-domain).

### User roles

```typescript
type UserRole = 'student' | 'parent' | 'counselor' | 'admin';
```

Role is stored on `users.role`. It is NOT embedded in the JWT (to allow role changes without token revocation). API routes read role from the DB on each request — this is covered by the Redis subscription cache pattern.

**Account context:**
- All authenticated API requests operate within an account context.
- For students: account context is their own account (derived from account_members WHERE user_id = auth.uid() AND role = 'student').
- For parents: account context is specified via the X-Account-Id header or derived from the route's resource ownership. Parents may be members of multiple accounts (one per child).
- For counselors: account context is derived from the route's resource, verified against counselor_student_links.

### Row Level Security (RLS)

Multi-tenant isolation is enforced at two layers: (1) API-layer authorization via `getAccountContext()` which verifies account membership on every request, and (2) PostgreSQL RLS policies as a defense-in-depth guard. In the current implementation (Phases 1-2), API-layer enforcement is the primary mechanism. RLS policies should be added as a safety net before production launch to prevent data leaks from any API bypass.

**Critical policies (account-based, must be implemented from day one):**

All data tables use `account_id` for access control. `account_members` is the single source of truth for authorization.

```sql
-- All data tables use account_id for access control
-- account_members is the single source of truth for authorization

-- Read access: any account member
CREATE POLICY account_read ON four_year_plans
  FOR SELECT USING (
    account_id IN (
      SELECT account_id FROM account_members WHERE user_id = auth.uid()
    )
    AND (visibility = 'shared' OR created_by = auth.uid())
  );

-- Write access: members with can_edit = TRUE
CREATE POLICY account_write ON four_year_plans
  FOR INSERT WITH CHECK (
    account_id IN (
      SELECT account_id FROM account_members
      WHERE user_id = auth.uid() AND can_edit = TRUE
    )
  );

-- Primary plan: student role only
CREATE POLICY set_primary ON four_year_plans
  FOR UPDATE USING (
    account_id IN (
      SELECT account_id FROM account_members
      WHERE user_id = auth.uid() AND role = 'student'
    )
  ) WITH CHECK (is_primary = TRUE OR is_primary = FALSE);

-- Grade entries: student only
CREATE POLICY grades_student_only ON grade_entries
  FOR ALL USING (
    account_id IN (
      SELECT account_id FROM account_members
      WHERE user_id = auth.uid() AND role = 'student'
    )
  );

-- Apply equivalent account_read policy to: grade_entries (SELECT), gpa_snapshots, alerts, goals, notifications, requirement_progress, dual_credit_log
-- Apply account_write to: plan_courses, plan_history
```

**Additional RLS policies (must also be implemented from day one):**

```sql
-- users: students see only their own row; parents/counselors see linked students
CREATE POLICY users_own ON users FOR ALL USING (id = auth.uid());

-- student_profiles: same as users
CREATE POLICY profiles_own ON student_profiles FOR ALL USING (user_id = auth.uid());

-- subscriptions: account-based
CREATE POLICY subscriptions_account ON subscriptions FOR ALL USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
);

-- goals: account-based read
CREATE POLICY goals_account ON goals FOR ALL USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
);

-- gpa_snapshots: account-based read
CREATE POLICY gpa_account ON gpa_snapshots FOR ALL USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
);

-- dual_credit_log: account-based read
CREATE POLICY dual_credit_account ON dual_credit_log FOR ALL USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
);
```

### Account status enforcement

Every authenticated API request goes through subscription middleware that:

1. Resolves the account context for the request (see `getAccountContext` below)
2. Checks Redis for `account:{accountId}:subscription` (5-min TTL)
3. On cache miss: reads `subscriptions JOIN subscription_plans` + `accounts` from DB; writes to Redis
4. Injects `{ tier, accountStatus, freezeReason, accountId, role, canEdit }` into request context

```typescript
// lib/subscription/middleware.ts
// Resolves subscription tier from account context, not user identity

export async function getEffectiveTier(params: { accountId?: string; userId?: string }): Promise<SubscriptionContext> {
  // Accepts accountId (preferred), userId (auto-resolves to account for students), or both.
  // Falls back to legacy userId-based lookup for backward compatibility.
  const accountId = params.accountId ?? (await resolveAccountId(params.userId!));
  const cacheKey = `account:${accountId}:subscription`;
  // Check Redis cache (5-min TTL), fallback to DB
  // Query: subscriptions WHERE account_id = accountId
  // JOIN subscription_plans for tier details
  // JOIN accounts for account_status
  // Parents derive their tier from the account they are currently viewing
}

export async function getAccountContext(userId: string, accountId?: string): Promise<AccountContext> {
  // If accountId provided (from header/route), verify membership
  // If not provided and user is a student, find their account
  // If not provided and user is a parent, return error (must specify account)
  // Returns: { accountId, role, canEdit, tier, maxLinkedAccounts }
}
```

**Per-plan permission enforcement (Phase 3):**

```typescript
// lib/plans/access.ts
export async function getPlanAccess(planId: string, userId: string): Promise<PlanAccess> {
  // 1. Check plan_shares for a row matching (planId, userId)
  // 2. If found, return { permission, isHidden } from the share row
  // 3. If not found (no plan_shares rows for this plan), fall back to accountCtx.canEdit
  //    - canEdit=true → 'edit' permission; canEdit=false → 'view' permission
  // 4. Permission hierarchy: owner > delete > edit > view
  //    - 'delete' implies edit + view; 'edit' implies view
  // Returns: { permission: 'owner'|'delete'|'edit'|'view', isHidden: boolean }
}
```

All plan mutation endpoints (POST/PATCH/DELETE on `/plans/:id/courses`, `lock-grade`) call `getPlanAccess()` and check the returned permission level instead of using `accountCtx.canEdit`. This enables per-plan permission control for shared plans. Owner shares are auto-created when a plan is created via `POST /api/v1/plans`.

> **Migration:** `lib/db/migrations/` contains a migration script that creates owner share rows in `plan_shares` for all existing plans, ensuring backward compatibility.

**API responses for gated access:**

| Condition | HTTP Status | Body |
|---|---|---|
| Feature requires higher tier | `402` | `{ "upgrade_required": true, "feature": "ai_suggestions", "minimum_tier": "elite" }` |
| Account frozen (any write) | `403` | `{ "account_frozen": true, "reason": "payment_lapsed", "reactivate_url": "..." }` |

> **Feature flag-based gating (Phase 2 update):** Subscription middleware exposes 8 feature flags: `canWhatIf`, `canExportPdf`, `canComparePlans`, `canSharePlans`, `canUseAi`, `canViewPercentile`, `canParentDraft`, `canCreateGoals`. API routes and server components check these flags rather than tier name strings. This decouples feature access from tier naming. Pro tier backward compatibility: middleware maps `pro` to `plus` so any legacy references still resolve correctly. **Print button gating (implemented):** The `canExportPdf` flag gates all print buttons across the app (planner, progress, transcript, dashboard "Print plan" quick action). Client-side check: `subscriptionTier === "plus" || "elite"`. Disabled buttons wrapped in `<span>` with `title="Upgrade to Plus to print"` tooltip for accessibility.

---

## 6. Database Schema

### Schema conventions

- All primary keys: `UUID DEFAULT gen_random_uuid()`
- All timestamps: `TIMESTAMPTZ` (never `TIMESTAMP`)
- Soft deletes: not used — use `status` columns with meaningful values (`archived`, `dropped`, etc.)
- All foreign keys must have explicit `ON DELETE` actions — never rely on the PostgreSQL default (`NO ACTION`)
- `NOT NULL` on every column that must always have a value
- **`updated_at` auto-update:** All tables with `updated_at` columns use Drizzle ORM's `.$onUpdate(() => new Date())` clause to auto-set on every UPDATE. Do not rely on manual setting in each query — this is error-prone. Alternatively, a PostgreSQL trigger can be used as a safety net:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each table with updated_at:
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Repeat for: users, student_profiles, goals, courses, grade_entries, dual_credit_log, four_year_plans
```

### Table: `users`

```sql
CREATE TABLE users (
  -- Authentication handled by Supabase Auth (auth.users); no credentials stored in public schema
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    TEXT UNIQUE NOT NULL,
  first_name               TEXT,              -- set from email prefix at signup; editable via PATCH /api/v1/auth/me
  last_name                TEXT,              -- editable via PATCH /api/v1/auth/me
  tour_state               JSONB DEFAULT '{}',  -- tracks tour completion + decline + last-step. Per-tour value is either legacy `true` (completed) or `{ "completed": true, "declined": false, "lastStep": 0 }`. Updated via PATCH /api/v1/auth/me with jsonb merge.
  role                     TEXT NOT NULL CHECK (role IN ('student','parent','counselor','admin')),
  is_email_verified        BOOLEAN DEFAULT FALSE,
  date_of_birth            DATE,
  account_status           TEXT NOT NULL DEFAULT 'active'
                             CHECK (account_status IN ('active','frozen','deactivated','suspended')),
  freeze_reason            TEXT CHECK (freeze_reason IN (
                             'payment_lapsed','subscription_canceled',
                             'graduation_complete','admin_action'
                           ) OR freeze_reason IS NULL),
  frozen_at                TIMESTAMPTZ,
  CHECK (
    (account_status = 'frozen' AND freeze_reason IS NOT NULL AND frozen_at IS NOT NULL)
    OR (account_status <> 'frozen' AND freeze_reason IS NULL AND frozen_at IS NULL)
  ),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  last_login               TIMESTAMPTZ,
  notification_preferences JSONB DEFAULT '{
    "alert_triggered":        {"email": true,  "in_app": true},
    "catalog_update":         {"email": true,  "in_app": true},
    "grade_reminder":         {"email": true,  "in_app": false},
    "prereq_gap":             {"email": false, "in_app": true},
    "gpa_digest":             {"email": true,  "in_app": false},
    "plan_milestone":         {"email": false, "in_app": true},
    "course_removed":         {"email": true,  "in_app": true},
    "grade_below_target":     {"email": true,  "in_app": true},
    "dual_credit_opportunity":{"email": false, "in_app": true},
    "year_end_reminder":      {"email": true,  "in_app": true},
    "trial_expiry_warning":   {"email": true,  "in_app": true},
    "account_frozen":         {"email": true,  "in_app": true},
    "graduation_detected":    {"email": true,  "in_app": true}
  }'
);
-- When new notification types are added, existing user rows will not have the new key
-- in their `notification_preferences` JSONB. The dispatch logic must treat missing keys
-- as `{email: true, in_app: true}` (opt-in by default). A backfill migration is not required.
```

### Table: `accounts`

```sql
CREATE TABLE accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name          TEXT NOT NULL,
  student_date_of_birth DATE,
  grade_level           SMALLINT CHECK (grade_level BETWEEN 9 AND 12),
  graduation_year       SMALLINT,
  school_id             UUID,
  state                 TEXT,              -- frozen to 'IL' at signup; for future multi-state expansion
  school_name           TEXT,              -- frozen to 'Stevenson' at signup; for future multi-school expansion
  student_user_id       UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_by            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  billing_contact_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  claim_code            VARCHAR(8) UNIQUE,
  claim_expires_at      TIMESTAMPTZ,
  claimed_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_student ON accounts (student_user_id) WHERE student_user_id IS NOT NULL;
CREATE INDEX idx_accounts_claim_code ON accounts (claim_code) WHERE claim_code IS NOT NULL AND claimed_at IS NULL;
```

### Table: `account_members`

```sql
CREATE TABLE account_members (
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('student', 'parent', 'guardian', 'counselor')),
  can_edit    BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, user_id)
);

CREATE INDEX idx_account_members_user ON account_members (user_id);
```

### Table: `account_invite_codes`

```sql
CREATE TABLE account_invite_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role   TEXT NOT NULL CHECK (target_role IN ('parent', 'guardian')),
  code          VARCHAR(8) NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  claimed_by    UUID REFERENCES users(id),
  claimed_at    TIMESTAMPTZ,
  shared_plans  JSONB DEFAULT '[]',  -- plans to share on invite claim: [{planId, permission}]
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- When an invite with shared_plans is claimed, the join endpoint creates
-- plan_shares rows for each plan in the array, granting the invited user
-- the specified permission level on each plan.
```

### Table: `school_requests`

```sql
CREATE TABLE school_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  school_name TEXT NOT NULL,
  state       TEXT NOT NULL,
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `contact_messages`

```sql
CREATE TABLE contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `feedback`

```sql
CREATE TABLE feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  page        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

> **Contact form (Phase 3):** The contact page (`/contact`) submits to `POST /api/v1/contact` (no auth required) and stores messages in the `contact_messages` table. After the DB insert, the route also sends a notification email to `planwithgenie@gmail.com` via Resend (see `lib/email/client.ts`) with `replyTo` set to the submitter's email so one-click Reply responds to the original sender; HTML in user input is escaped server-side. The page is gated behind `HOME_FEATURES.showContactPage` in `config/homepage.ts` (currently `true`). Footer feedback link points to `/contact` page instead of mailto.

> **In-app feedback widget (Phase 3):** Floating "Feedback" button on all authenticated app pages (bottom-right). Opens panel with 5-star rating + optional comment. Captures current page path. Stores in `feedback` table via `POST /api/v1/feedback` (auth required). Success animation, auto-closes.

> **Guided tour system (Phase 3, refreshed in tour-UX rework):** driver.js (5KB) plus shared orchestration in `lib/hooks/run-tour.ts`. Four adaptive tours: Welcome (dashboard, 7 steps including a Courses nav step), Courses (3-4 steps; mobile vs. desktop selector swap; card step dropped when filters yield no results), Planner (2-5 steps — 2 when no plans, 5 when plans exist), Progress (1-3 steps — 1 when no plan data, 3 when data exists). **Consent-first:** tours don't auto-fire — `<TourInvite />` (`components/tour-invite.tsx`) renders a bottom-right card asking the user to opt in. Skip persists per-tour (`{ declined: true }`) so the card stays dismissed. **Forward-action endings:** the last step's "Done!" is replaced by a labelled CTA — Welcome → "Start planning →" `/planner`, Planner → "Browse courses →" `/courses`, Courses → "See your progress →" `/progress`, Progress → "Refine your plan →" / "Start a plan →" `/planner`. Implemented via `onNextClick` interception in the runner. **Interactive moments:** courses search auto-advances on input (minLength 2); progress filter auto-advances on click. The runner's `attachWaitForListener` handles single + multi-target click via querySelectorAll, single-fire input via querySelector. **Mobile:** Tour button visible on every page (icon-only on `< sm`); popover capped at `min(90vw, 320px)` in `globals.css`. **Tour state:** `users.tourState` JSONB accepts the legacy `boolean` (`true` = completed) or the object form `{ completed, declined, lastStep }`. Reads/writes go through `lib/hooks/tour-state.ts` for back-compat normalization. PATCH `/api/v1/auth/me` merges deltas via jsonb `||`. Files: `lib/hooks/use-tour.ts`, `lib/hooks/run-tour.ts`, `lib/hooks/tour-state.ts`, `config/tours.ts`, `components/tour-invite.tsx`, `components/tour-button.tsx`. `data-tour` attributes on dashboard / courses / planner / progress. Tests: `tests/unit/tour-state.test.ts`, `tests/unit/tour-config.test.ts`, `tests/unit/run-tour.test.ts`, `tests/unit/tour-invite.test.tsx`.

> **School request system (Phase 3):** Signup page includes frozen state/school fields with a "Request yours" link. The school request form submits to `POST /api/v1/school-request` (no auth required) and stores requests in the `school_requests` table for future outreach and multi-school expansion.

> **Child invite flow (Phase 3):** Parents can invite a child (student) via email from Settings. When the student joins via the invite: (1) if the student already has an account, the parent is added as a member of the student's existing account; (2) if no account exists, a new account is created with both student and parent added as members. The active account auto-switches to the joined account.

> **Invite role enforcement (Phase 3 update):** For invite-driven signups (`invite_code + invite_account` in the request), `POST /api/v1/auth/signup` looks up the invite up-front and uses `invite.targetRole` as the source of truth — the form-supplied `role` is informational. Without this server-side override an invitee could submit a different role than the invite specified and end up with both a self-owned student account (with profile + trial subscription) AND parent membership in the inviter's account on the subsequent `/join` hop. Stale invites (missing, claimed, or expired) fail fast with `400 INVITE_INVALID` before Supabase Auth is touched. The signup form complements this with URL-driven preselect/lock (above), so the wrong choice can't happen in the UI either. **Email lookup case-handling:** `POST /api/v1/accounts/:id/members` compares email case-insensitively (`lower(users.email) = ?`) for both the already-linked check and the existing-user lookup that picks the email template — `users.email` is stored as typed at signup, so a mixed-case stored email previously caused the wrong (new-user) signup link to be sent and the recipient got stuck at signup with `EMAIL_EXISTS`.

> **Invite rate-limit placement (Phase 3 update):** The 20-invites-per-hour rate limit on `POST /api/v1/accounts/:id/members` now runs *after* the cheap pre-checks (auth, body validation, self-invite, already-linked, pending-dupe, plan-share ownership) so a user mistyping or hitting an `ALREADY_LINKED`/`ALREADY_INVITED` rejection no longer burns quota — only attempts that would actually create a new invite count. The 429 response still carries `retry_after` (seconds), and the settings page surfaces it in the toast as "Try again in N minutes/hours" so the inviter knows when they can retry.

> **Pending invites visibility (Phase 3 update):** `account_invite_codes` gained a nullable `target_email` column populated (lowercased) at invite-create time, and `GET /api/v1/accounts/:id/members` now returns `{ members: [...], pending_invites: [...] }` instead of a bare member array (existing clients that read the array shape continue to work via a fallback in the settings page client). Pending invites are filtered to unclaimed and not-yet-expired rows; expired ones are hidden because the inviter can't act on them. Each pending row includes `invite_id`, `email` (may be null for pre-migration rows), `role`, `expires_at`, `invited_by_user_id`, `invited_at`, and a computed `can_revoke` flag (students: any invite on their account; others: only invites they created — same rule as member removal). The settings "Shared with" list renders pending invites with a dashed mail-icon avatar, a `Pending` badge, and a small "Expires in N days" hint; an X button calls the new `DELETE /api/v1/accounts/:id/invites/:inviteId` endpoint to revoke. The send-invite confirmation no longer leaks the raw invite code in the UI; instead the toast names the recipient ("Invite emailed to {email}. They'll show up here once they accept.") and the new pending row provides the durable confirmation. **Duplicate-pending block:** `POST /api/v1/accounts/:id/members` returns `409 ALREADY_INVITED` when an unclaimed, unexpired invite already exists for the same email — the existing pending row is the source of truth and the inviter must either wait for acceptance or revoke it before re-sending.

> **Linked account member removal (Phase 3 update):** Any member can remove other members (except themselves). The previous restriction preventing student removal has been lifted — non-student members can remove the student. Remove button shows for all members except self.

> **Settings redesign (Phase 3):** Flat sections with uppercase headers (no collapsible cards). 3x3 profile grid: Name/Email/Password/Role/Grade/Graduation/State/School (state and school read-only). Clean linked accounts list (renamed from "Family Members") with usage counter ("2/5 linked accounts used"). Compact subscription/legal/danger zone sections. Settings hides subscription/billing for counselors, shows separate "Student Information" section for non-student roles. Students can invite Parent/Guardian/Counselor; parents can invite Child/Parent/Guardian/Counselor; counselors cannot invite anyone (view-only, invite form hidden). Invite form includes plan sharing: students select which plans to share (view/edit permission) when inviting.

> **Linked accounts tier limits (Phase 3):** Starter/Trial: 3, Plus: 5, Elite: 8. Enforced in invite API (402 UPGRADE_REQUIRED with code `UPGRADE_REQUIRED`). `maxLinkedAccounts` added to `SubscriptionContext` and tier config in `subscription_plans.features` JSONB.

> **Counselor role (Phase 3):** Counselors join accounts with `canEdit: false` (view-only). Can view plans, progress, grades but cannot modify. Cannot create plans, delete plans, share plans, invite others, or access billing. Sees "View" instead of "Edit" on plans; "No plans shared yet" empty states shown. Account switcher shows "Managing: Student Name · Gr X" like parents. Settings page hides subscription/billing for counselors, shows separate "Student Information" section for non-student roles. Invite form hidden for counselor role. Future: will be able to add comments/suggestions on shared plans.

> **Billing updates (Phase 3):** Pricing cards updated to show linked accounts per tier and PDF/print for Plus. 4-year subscription display shows "Expires" instead of "Renews" since it is a one-time payment (Stripe payment mode).

> **Migration note (Phase 2):** All data tables (`four_year_plans`, `subscriptions`, `grade_entries`, `gpa_snapshots`, `goals`, `alerts`, `notifications`, `requirement_progress`, `dual_credit_log`) gain an `account_id UUID REFERENCES accounts(id)` column. The `four_year_plans` table gains `created_by UUID REFERENCES users(id)` and `visibility TEXT DEFAULT 'shared' CHECK (visibility IN ('shared', 'private'))`. The `student_parent_links` and `parent_invite_codes` tables are deprecated in favor of `account_members` and `accounts.claim_code`. subscriptions gains an account_id column alongside the existing user_id (both retained for backward compatibility during migration). Existing data is migrated by creating an account row per existing student user and updating all foreign keys.

### Table: `student_profiles`

```sql
CREATE TABLE student_profiles (
  user_id                   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  graduation_year           SMALLINT NOT NULL,
  current_grade_level       SMALLINT NOT NULL CHECK (current_grade_level BETWEEN 9 AND 12),
  gpa_goal                  DECIMAL(3,2),
  college_targets           JSONB,
  career_goals              JSONB,
  sat_score                 SMALLINT,
  act_score                 SMALLINT,
  ap_exam_scores            JSONB,
  contributes_to_stats      BOOLEAN NOT NULL DEFAULT FALSE,
  rigor_score               DECIMAL(6,3),
  year_end_transition_state TEXT NOT NULL DEFAULT 'pending'
                              CHECK (year_end_transition_state IN ('pending','in_progress','completed')),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `student_parent_links`

```sql
CREATE TABLE student_parent_links (
  student_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  can_edit    BOOLEAN DEFAULT FALSE,
  linked_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, parent_id)
);
```

### Table: `counselor_student_links`

```sql
CREATE TABLE counselor_student_links (
  counselor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at     TIMESTAMPTZ DEFAULT NOW(),
  linked_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (counselor_id, student_id)
);
```

### Table: `subscription_plans` (seeded at deploy, never mutated by users)

```sql
CREATE TABLE subscription_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL UNIQUE,     -- 'starter','plus','elite' (Pro removed)
  display_name   TEXT NOT NULL,
  price_monthly  DECIMAL(6,2),             -- NULL = free. Plus: 9.99, Elite: 19.99
  price_annual   DECIMAL(7,2),             -- Plus: 107.88, Elite: 215.88 (save 10%)
  price_four_year DECIMAL(7,2),            -- Plus: 399.00, Elite: 799.00 (save 17%)
  max_plans      SMALLINT,                 -- 1 for Starter, 10 for Plus, NULL = unlimited (Elite)
  max_linked_accounts SMALLINT,           -- 3 for Starter/Trial, 5 for Plus, 8 for Elite
  features       JSONB NOT NULL
                 -- e.g., {"can_create_goals": true, "can_use_ai": false, "can_view_percentile": false,
                 --        "can_parent_draft": true, "can_what_if": true, "maxLinkedAccounts": 5, ...}
);
-- Trial: 14-day, Plus-level features except can_compare_plans/can_export_pdf/can_share_plans,
-- max 2 plans, no AI. Auto-downgrades to Starter at expiry.
```

### Table: `subscriptions`

```sql
CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  account_id             UUID REFERENCES accounts(id) ON DELETE SET NULL,
  subscription_plan_id   UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status                 TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','paused')),
  trial_ends_at          TIMESTAMPTZ NOT NULL,
  billing_cycle          TEXT CHECK (billing_cycle IN ('monthly','annual','four_year') OR billing_cycle IS NULL),
                                                -- four_year uses Stripe payment mode (not subscription)
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN DEFAULT FALSE,
  canceled_at            TIMESTAMPTZ,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
```

> On signup: `INSERT INTO subscriptions (user_id, subscription_plan_id, status, trial_ends_at) VALUES (:userId, :plusPlanId, 'trialing', NOW() + INTERVAL '14 days')`. The Accounts API returns "trial" as the tier name when `status = 'trialing'`, regardless of `subscription_plan_id`.

### Table: `stripe_events`

```sql
CREATE TABLE stripe_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  TEXT NOT NULL UNIQUE,
  event_type       TEXT NOT NULL,
  api_version      TEXT,
  payload          JSONB NOT NULL,
  processed        BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at     TIMESTAMPTZ,
  error_message    TEXT,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_events_unprocessed ON stripe_events (received_at) WHERE processed = FALSE;
```

### Table: `legal_documents`

```sql
CREATE TABLE legal_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL CHECK (type IN ('terms_of_service', 'privacy_policy')),
  version       TEXT NOT NULL,
  content_url   TEXT NOT NULL,             -- path to rendered page (e.g., /terms, /privacy)
  effective_at  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (type, version)
);
```

### Table: `consent_records`

```sql
CREATE TABLE consent_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_document_id   UUID NOT NULL REFERENCES legal_documents(id) ON DELETE RESTRICT,
  consented_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address          TEXT,
  user_agent          TEXT,
  UNIQUE (user_id, legal_document_id)
);

CREATE INDEX idx_consent_records_user ON consent_records (user_id);
```

> **Consent system (Phase 3):** `/terms` and `/privacy` pages render legal document content. `/consent` interstitial page shown to users who haven't accepted the current legal document versions — the app layout consent gate redirects unauthenticated-consent users before they can access any app page. Signup includes a consent checkbox. OAuth users are redirected to `/consent` after first login. Account deletion performs full cleanup: Stripe customer deleted, Supabase auth user deleted, Redis cache cleared, PostHog user data removed.

### Table: `account_events`

```sql
CREATE TABLE account_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN (
                 'account_frozen','account_reactivated','account_deactivated',
                 'account_suspended','suspension_lifted','graduation_detected',
                 'trial_expired','data_exported'
               )),
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('system','stripe_webhook','admin','user')),
  reason       TEXT,
  metadata     JSONB DEFAULT '{}',
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Table: `four_year_plans`

```sql
CREATE TABLE four_year_plans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  account_id               UUID REFERENCES accounts(id),
  created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  visibility               TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared', 'private')),
  name                     TEXT NOT NULL,
  school_year              TEXT NOT NULL,
  catalog_version_id       UUID REFERENCES course_catalog_versions(id) ON DELETE RESTRICT,
  created_from_template_id UUID REFERENCES four_year_plans(id) ON DELETE SET NULL,
  is_template              BOOLEAN DEFAULT FALSE,
  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','active','archived')),
  is_primary               BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  CHECK (is_template = TRUE OR student_id IS NOT NULL),
  locked_grade_levels      JSONB DEFAULT '[]'::jsonb,
                             -- Array of integer grade levels (9-12) that are locked.
                             -- Seeded in three places: (1) onboarding for returning students locks
                             -- all past grades up to currentGrade-1; (2) year-end completion adds
                             -- the completed grade; (3) manual toggle via POST /plans/:id/lock-grade.
                             -- Locked grades block all course modifications except GPA waiver toggles.
                             -- Lock is a pure UI/workflow gate — it does NOT trigger year-end and
                             -- does NOT mutate accounts.gradeLevel. Year-end is a separate explicit
                             -- flow surfaced via the dashboard banner.
                             -- Example: [9, 10] means grades 9 and 10 are locked.
  CHECK (is_primary = FALSE OR is_template = FALSE),
  CHECK (is_primary = FALSE OR activated_at IS NOT NULL)
);

-- One primary plan per student (enforced via partial unique index)
CREATE UNIQUE INDEX idx_one_primary_plan_per_student
  ON four_year_plans (student_id)
  WHERE is_primary = TRUE AND is_template = FALSE AND student_id IS NOT NULL;
```

**Switching primary plan (must be wrapped in a transaction):**

```sql
BEGIN;
  UPDATE four_year_plans
  SET    is_primary = FALSE
  WHERE  student_id = :student_id AND is_primary = TRUE;

  UPDATE four_year_plans
  SET    is_primary   = TRUE,
         status       = 'active',
         activated_at = NOW()
  WHERE  id = :new_primary_plan_id;
COMMIT;
```

The partial unique index makes this race-safe: two concurrent requests to set different plans as primary will result in one succeeding and one hitting a unique constraint error (to be retried).

### Table: `plan_shares`

```sql
CREATE TABLE plan_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES four_year_plans(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission  TEXT NOT NULL DEFAULT 'view'
                CHECK (permission IN ('owner', 'view', 'edit', 'delete')),
  is_hidden   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plan_id, user_id)
);

CREATE INDEX idx_plan_shares_plan_id ON plan_shares (plan_id);
CREATE INDEX idx_plan_shares_user_id ON plan_shares (user_id);
```

> **Permission hierarchy:** owner > delete > edit > view. A user with `delete` permission can also edit and view. A user with `edit` permission can also view. The `owner` permission is auto-created when a plan is created and cannot be changed or removed.
>
> **Backward compatibility:** Plans without any `plan_shares` rows fall back to `account_members.canEdit` for permission checks. This ensures existing plans work without migration, though a migration script (`lib/db/migrations/`) creates owner share rows for all existing plans.
>
> **`isHidden` toggle:** When `is_hidden = true`, the plan is excluded from the planner plan dropdown but remains accessible on the `/plans` page. Hiding does not affect permissions.

### Table: `plan_share_links`

```sql
CREATE TABLE plan_share_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES four_year_plans(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  token         TEXT NOT NULL UNIQUE,
  label         TEXT,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  last_accessed TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `plan_courses`

```sql
CREATE TABLE plan_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES four_year_plans(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  grade_level   SMALLINT NOT NULL CHECK (grade_level BETWEEN 9 AND 12),
  semester      SMALLINT CHECK (semester IN (-2, -1, 1, 2)),   -- NULL = full year; -2/-1 = summer sessions
  status        TEXT DEFAULT 'planned'
                  CHECK (status IN ('planned','enrolled','completed','dropped')),
  planned_grade TEXT CHECK (planned_grade IN ('A', 'B', 'C', 'D', 'F', 'P', 'I')
                  OR planned_grade IS NULL),
  display_order SMALLINT DEFAULT 0,
  notes         TEXT,
  gpa_waiver_applied BOOLEAN NOT NULL DEFAULT FALSE,
  prereq_overridden  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (plan_id, course_id, grade_level, semester)
  -- Allows retakes in different years; prevents duplicates within same grade/semester
);

CREATE INDEX idx_plan_courses_plan_id ON plan_courses (plan_id);
```

> **GPA waiver toggle:** Students can apply a GPA waiver per plan-course by toggling a checkbox on waiver-eligible course cards. The GPA calculation checks `gpa_waiver_applied` (student's choice on plan_courses) rather than `gpa_waiver` (catalog-level flag on courses). Only courses where the student explicitly applies the waiver are excluded from GPA. The GPA waiver checkbox is hidden for P/F-only courses (identified by `isPassFailCourse()`) since they are already excluded from GPA calculation.

> **Grade-level locking (replaces per-course completed-status locking):** After completing a grade via the year-end wizard, the grade level is added to `four_year_plans.locked_grade_levels`. When a grade is locked, the API enforces: `POST /api/v1/plans/:id/courses` returns 409 for that grade, `DELETE /api/v1/plans/:id/courses/:planCourseId` returns 409, `PATCH /api/v1/plans/:id/courses/:planCourseId` returns 409 for any change except `gpa_waiver_applied`. GPA waiver toggles are the only permitted modification on locked grades. The "current grade" in the planner is the first unlocked grade level. Lock/unlock is managed via `POST /api/v1/plans/:id/lock-grade` with body `{ grade_level, locked }`. Locking redirects to `/year-end?grade=X`; unlocking requires a confirmation dialog.

> **Full-year course storage (Phase 1b update):** Full-year courses are now stored as two rows (`semester=1` and `semester=2`) instead of one row with `semester=null`. This change was made to enable independent per-semester status and grade tracking. The `UNIQUE (plan_id, course_id, grade_level, semester)` constraint accommodates this pattern — each semester gets its own row. Adding a full-year course creates both rows; removing either semester removes both.

> **Cross-grade selection + warning override (Phase 3 update):** The course picker exposes an "All grades" toggle (planner + Grade 10+ onboarding past-courses) that drops the slot's grade-level filter, letting students place a course at a non-standard grade (e.g., Algebra 2 in Grade 9, or recording an 8th-grade Algebra 1 prereq). The `plan_courses.prereq_overridden` boolean is now user-controlled end-to-end:
> - Force-add still sets `prereq_overridden=true` at row creation when `force_add: true` is sent and the warning set contains a `prerequisite` or `grade_level` violation, so the existing add-time UX still works.
> - On the planner, each course card surfaces violations via a hover-revealed popover. Clicking the warning icon calls `POST /api/v1/plans/:id/courses/bulk-override` with the planCourseId(s) of the row and any same-course siblings in the grade (handles paired full-year rows) and `overridden: true`. Clicking the excused icon flips it back via the same endpoint.
> - The validation report groups violations by `(grade, semester)`. Each group has an "Excuse all" toggle that calls bulk-override on the violating rows in the cell (plus siblings); when all are excused, the toggle becomes "Reflag". `PATCH /api/v1/plans/:id/courses/:courseId` also accepts a `prereq_overridden` field for single-course updates.
> - `validatePlanIntegrity()` routes ALL violation types (`prerequisite`, `grade_level`, `corequisite`, `enrollment_rule`, `duplicate`) into `ignoredViolations` when the row is overridden, so excusing reliably silences every kind of warning on that row. Each emitted Violation also carries the `planCourseId` of the row that produced it, letting the planner attribute warnings to a specific cell instead of conflating multiple rows that share a courseId.
> - `onboarding-complete` no longer auto-sets the flag; users excuse warnings manually after the fact.

### Table: `plan_history`

```sql
CREATE TABLE plan_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES four_year_plans(id) ON DELETE CASCADE,
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT CHECK (action IN (
                'add_course','remove_course','change_planned_grade',
                'change_semester','change_status','rename_plan',
                'reorder_courses','set_primary'
              )),
  before_state JSONB,
  after_state  JSONB
);

CREATE INDEX idx_plan_history_plan_id_at ON plan_history (plan_id, changed_at DESC);
```

### Table: `grade_entries`

> **Phase 2 update:** The `midterm_grade` and `grade_type` columns have been removed. Stevenson uses a single final grade per semester (proficiency-based grading model) — there is no midterm grade. The primary grade source is now `plan_courses.planned_grade`, set via the planner page. The `grade_entries` table is retained for future use (e.g., onboarding bulk import, historical records) but is **not** the authoritative source for GPA calculation or transcript display. The Transcript page includes a Print button (printer icon) next to "Edit in planner" that triggers `window.print()`; the Progress page includes a Print button next to "Edit plan" with the same behavior. All print buttons are gated by `canExportPdf` (Plus+ only); Trial and Starter users see disabled buttons with "Upgrade to Plus to print" tooltip.

```sql
CREATE TABLE grade_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    UUID REFERENCES accounts(id),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  academic_year TEXT NOT NULL,
  semester      SMALLINT NOT NULL CHECK (semester IN (1, 2)),
  final_grade   TEXT CHECK (final_grade IN ('A', 'B', 'C', 'D', 'F', 'P', 'I')),
  credit_earned DECIMAL(3,1),
  -- Note: is_weighted is NOT stored here — weight is derived from the course's credit_type
  -- at GPA calculation time via the courses table join. Storing it here would create
  -- a denormalization that drifts if a course's credit_type is corrected.
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, course_id, academic_year, semester)
);

CREATE INDEX idx_grade_entries_student_id ON grade_entries (student_id);
```

### Table: `gpa_snapshots`

```sql
CREATE TABLE gpa_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id          UUID REFERENCES accounts(id),
  snapshot_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger             TEXT NOT NULL CHECK (trigger IN ('semester_end','manual','plan_save')),
  cumulative_gpa      DECIMAL(4,3),
  weighted_gpa        DECIMAL(4,3),
  semester_gpa        DECIMAL(4,3),
  credits_earned      DECIMAL(5,1),
  credits_attempted   DECIMAL(5,1)
);
```

### Table: `dual_credit_log`

```sql
CREATE TABLE dual_credit_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id          UUID REFERENCES accounts(id),
  plan_id             UUID REFERENCES four_year_plans(id) ON DELETE SET NULL,
  course_id           UUID REFERENCES courses(id) ON DELETE RESTRICT,
  partner_college     TEXT NOT NULL,
  college_course_code TEXT,
  college_credits     DECIMAL(3,1) NOT NULL,
  academic_year       TEXT NOT NULL,
  status              TEXT CHECK (status IN ('planned','enrolled','completed','transferred','dropped')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `goals`

```sql
CREATE TABLE goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id  UUID REFERENCES accounts(id),
  goal_type   TEXT NOT NULL CHECK (goal_type IN ('gpa','college','career','graduation','dual_credit')),
  target_gpa  DECIMAL(3,2),
  target_text TEXT,
  target_date DATE,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','achieved','abandoned')),
  achieved_at TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `alerts`

```sql
CREATE TABLE alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id        UUID REFERENCES accounts(id),
  alert_type        TEXT NOT NULL CHECK (alert_type IN (
                      'overload','underload','prereq_violation','coreq_violation',
                      'enrollment_rule','grade_level_ineligible','repeat_course',
                      'graduation_risk','catalog_change','grade_below_target',
                      'gpa_goal_at_risk','declining_gpa_trend',
                      'ap_capacity_underuse','dual_credit_opportunity',
                      'incomplete_grade'
                    )),
  severity          TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  message           TEXT NOT NULL,
  action_suggestion TEXT,
  related_plan_id   UUID REFERENCES four_year_plans(id) ON DELETE SET NULL,
  related_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  deduplication_key TEXT,
  is_read           BOOLEAN DEFAULT FALSE,
  is_dismissed      BOOLEAN DEFAULT FALSE,
  triggered_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_alerts_dedup
  ON alerts (student_id, deduplication_key)
  WHERE resolved_at IS NULL;

CREATE INDEX idx_alerts_student_unresolved ON alerts (student_id) WHERE resolved_at IS NULL;
```

### Table: `notifications`

```sql
CREATE TABLE notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  account_id          UUID REFERENCES accounts(id),
  channel             TEXT CHECK (channel IN ('in_app','email')),
  notification_type   TEXT NOT NULL CHECK (notification_type IN (
                        'alert_triggered','catalog_update','grade_reminder',
                        'prereq_gap','gpa_digest','plan_milestone',
                        'course_removed','grade_below_target','dual_credit_opportunity',
                        'year_end_reminder','trial_expiry_warning',
                        'account_frozen','graduation_detected'
                      )),
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id   UUID,
  metadata            JSONB DEFAULT '{}',
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  read_at             TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE read_at IS NULL;
```

### Table: `requirement_progress` (computed/cached)

```sql
CREATE TABLE requirement_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  account_id          UUID REFERENCES accounts(id),
  plan_id             UUID REFERENCES four_year_plans(id) ON DELETE CASCADE,
  requirement_id      UUID REFERENCES graduation_requirements(id) ON DELETE CASCADE,
  catalog_version_id  UUID REFERENCES course_catalog_versions(id) ON DELETE RESTRICT,
  required_credits    DECIMAL(3,1),
  completed_credits   DECIMAL(3,1),
  planned_credits     DECIMAL(3,1),
  status              TEXT CHECK (status IN ('met','in_progress','gap')),
  last_computed_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plan_id, requirement_id)
);
```

### Table: `grade_cohort_stats` (Elite nightly aggregate)

```sql
CREATE TABLE grade_cohort_stats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level SMALLINT NOT NULL,
  school_year TEXT NOT NULL,
  metric      TEXT NOT NULL CHECK (metric IN (
                'unweighted_gpa','weighted_gpa','ap_count','credit_count','rigor_score'
              )),
  sample_size INTEGER NOT NULL,    -- must be >= 50 before surfacing in UI
  p10         DECIMAL(6,3),
  p25         DECIMAL(6,3),
  p50         DECIMAL(6,3),
  p75         DECIMAL(6,3),
  p90         DECIMAL(6,3),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (grade_level, school_year, metric)
);
```

### Course catalog tables

```sql
CREATE TABLE divisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  code          TEXT NOT NULL UNIQUE,
  display_order SMALLINT DEFAULT 0
);

CREATE TABLE departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id   UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  display_order SMALLINT DEFAULT 0,
  UNIQUE (division_id, name)
);

CREATE TABLE course_catalog_versions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year         TEXT NOT NULL UNIQUE,
  source_pdf_url      TEXT,
  json_artifact_path  TEXT,
  loaded_at           TIMESTAMPTZ DEFAULT NOW(),
  loaded_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  courses_added       SMALLINT DEFAULT 0,
  courses_removed     SMALLINT DEFAULT 0,
  courses_modified    SMALLINT DEFAULT 0,
  change_summary      JSONB DEFAULT '[]'
);

CREATE TABLE courses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL,
  name               TEXT NOT NULL,
  division_id        UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
  department_id      UUID REFERENCES departments(id) ON DELETE RESTRICT,
  description        TEXT,
  credit_value       DECIMAL(3,1) NOT NULL DEFAULT 1.0,  -- 1.5 for AP Science lab courses
  duration           TEXT NOT NULL CHECK (duration IN ('semester','full_year')),
  grade_levels       SMALLINT[] NOT NULL,
  credit_type        TEXT NOT NULL CHECK (credit_type IN ('CP','Accelerated','Honors','AP','Pass/Fail')),
  is_ap              BOOLEAN DEFAULT FALSE,
  is_dual_credit     BOOLEAN DEFAULT FALSE,
  is_honors          BOOLEAN DEFAULT FALSE,
  gpa_waiver         BOOLEAN DEFAULT FALSE,
  semesters_offered  SMALLINT[],           -- [1], [2], or NULL; parsed from PDF semester patterns
  max_enrollment     SMALLINT,
  is_active          BOOLEAN DEFAULT TRUE,
  catalog_version_id UUID NOT NULL REFERENCES course_catalog_versions(id) ON DELETE RESTRICT,
  previous_code      TEXT,
  previous_name      TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (code, catalog_version_id)  -- course codes are unique within a catalog version, not globally
);

> **1.5 period AP Science courses:** Eight AP Science lab courses use 1.5 class periods and earn 3.0 credits per year (1.5 per semester): AP Physics 1 (SCI611/612), AP Biology (SCI631/632), AP Chemistry (SCI651/652), AP Physics C (SCI661/662), and their Early Bird variants (SCI61E1/E2, SCI63E1/E2, SCI65E1/E2, SCI66E1/E2). All other courses earn 1.0 credit per semester (2.0 per full year) or 1.0 per semester course.

-- Active course lookup: for the current catalog version, find a course by code
CREATE INDEX idx_courses_code_active ON courses (code) WHERE is_active = TRUE;

CREATE TABLE course_prerequisites (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  relationship_type  TEXT NOT NULL DEFAULT 'prerequisite'
                       CHECK (relationship_type IN ('prerequisite','corequisite')),
  requirement_group  SMALLINT NOT NULL DEFAULT 1,
  minimum_grade      TEXT CHECK (minimum_grade IN ('A','B','C','D') OR minimum_grade IS NULL),
  is_recommended     BOOLEAN NOT NULL DEFAULT FALSE,
  notes              TEXT,
  catalog_version_id UUID NOT NULL REFERENCES course_catalog_versions(id) ON DELETE CASCADE,
  UNIQUE (course_id, prerequisite_id, catalog_version_id),
  CHECK (course_id <> prerequisite_id)
);

CREATE TABLE graduation_requirements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id           UUID REFERENCES divisions(id) ON DELETE RESTRICT,  -- nullable for non-course and course_load requirements
  requirement_name      TEXT NOT NULL,
  required_credits      DECIMAL(3,1) NOT NULL,
  eligible_credit_types TEXT[],
  matching_rule         JSONB,  -- see Phase 2 matching rule types below
  requirement_group     TEXT NOT NULL DEFAULT 'graduation',   -- 'graduation', 'il_public_university', 'non_course', 'course_load'
  evaluation_type       TEXT NOT NULL DEFAULT 'course_match', -- 'course_match', 'manual_checkbox', 'auto_from_course', 'course_load_check'
  display_order         SMALLINT DEFAULT 0,
  is_opt_in             BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE for il_public_university group
  notes                 TEXT,
  catalog_version_id    UUID NOT NULL REFERENCES course_catalog_versions(id) ON DELETE RESTRICT,
  UNIQUE (catalog_version_id, requirement_name)
);

-- student_requirement_status: tracks manual checkbox state (for non_course requirements)
CREATE TABLE student_requirement_status (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES accounts(id),
  requirement_id  UUID NOT NULL REFERENCES graduation_requirements(id) ON DELETE CASCADE,
  is_checked      BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at      TIMESTAMPTZ,
  checked_by      UUID REFERENCES users(id),
  UNIQUE (student_id, requirement_id)
);

-- student_requirement_opt_ins: tracks which opt-in groups are enabled per student
CREATE TABLE student_requirement_opt_ins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id        UUID REFERENCES accounts(id),
  requirement_group TEXT NOT NULL,    -- e.g., 'il_public_university'
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, requirement_group)
);

-- Phase 2 matching_rule types (for course_match evaluation):
--   { "type": "code_prefix", "prefix": "ENG" }           — matches courses whose code starts with prefix (e.g., all ENG courses)
--   { "type": "codes", "codes": ["ART101", "ART102"] }   — matches specific course codes
--   { "type": "division", "division_id": "uuid" }        — matches all courses in a division
--   { "type": "multi_division", "division_ids": ["uuid1", "uuid2"] } — matches courses in any of the listed divisions
--   { "type": "remainder" }                               — catch-all: matches any course not claimed by another requirement (used for "Additional Credits and P.E.")
--
-- Phase 2 requirement groups (4 groups, 37 total requirements):
--   graduation (12): course_match — Stevenson graduation credit requirements (unchanged)
--   course_load (16): course_load_check — 8 course count checks (Grades 9-12 x Sem 1-2, min 5 / max 7-8,
--                                          counting academic courses only — PW division, DNC-prefix, D/E-prefix excluded)
--                                        + 8 PW/Dance/DriverEd checks (each semester must have at least one
--                                          Physical Welfare, Dance [DNC prefix], or Driver Education [D/E prefix] course)
--                     Display name: "Semester Requirements"
--   il_public_university (5): course_match, opt-in — IL public university admission (Science 6cr, Social Studies 6cr, Electives 4cr, English 8cr, Math 6cr)
--   non_course (4): manual_checkbox (ACT, FAFSA) + auto_from_course (46th Credit, Civics & Patriotism)
--
-- Note: honors_status was REMOVED from requirements — it is now an achievement badge computed from GPA
--
-- Evaluation types: course_match, manual_checkbox, auto_from_course, course_load_check
-- The requirements API uses matching rules for course_match types and specialized logic for other evaluation types.
-- API also returns gpaWaiverWarnings[] (P/F-only courses excluded from count) and honorsStatus (achievement, not requirement).
-- Group order: graduation, course_load, il_public_university, non_course.

CREATE TABLE career_paths (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  description      TEXT,
  related_careers  JSONB DEFAULT '[]',
  display_order    SMALLINT DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE career_path_courses (
  career_path_id      UUID NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  catalog_version_id  UUID NOT NULL REFERENCES course_catalog_versions(id),
  -- Mappings must be rebuilt during catalog reload
  priority            SMALLINT NOT NULL CHECK (priority IN (1, 2, 3)),
  notes               TEXT,
  PRIMARY KEY (career_path_id, course_id)
);
```

### Table: `parent_invite_codes`

> **Deprecated:** This table is superseded by `accounts.claim_code` (for student claims) and `account_invite_codes` (for member invitations). Retained for backward compatibility during migration.

```sql
CREATE TABLE parent_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_by UUID REFERENCES users(id),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (code)
);

CREATE INDEX idx_invite_codes_lookup ON parent_invite_codes (code) WHERE claimed_by IS NULL;
```

### Additional indexes

```sql
CREATE INDEX idx_gpa_snapshots_student_date ON gpa_snapshots (student_id, snapshot_date DESC);
CREATE INDEX idx_goals_student_active ON goals (student_id) WHERE status = 'active';
CREATE INDEX idx_dual_credit_student ON dual_credit_log (student_id);
CREATE INDEX idx_account_events_user ON account_events (user_id, occurred_at DESC);
CREATE INDEX idx_notifications_user_date ON notifications (user_id, created_at DESC);
CREATE INDEX idx_requirement_progress_student ON requirement_progress (student_id);
```

---

## 7. Course Catalog Data Pipeline

```
PDF (yearly) → extractor/extract.py → data/YYYY-courses.json
                                              ↓  git diff against previous year
                                       human review of diff
                                              ↓  approve
                                       extractor/loader.py [--dry-run | --force | --rollback]
                                              ↓
                              INSERT course_catalog_versions row
                              UPSERT divisions, departments, courses
                              UPSERT course_prerequisites (rebuild for version)
                              UPSERT graduation_requirements (rebuild for version)
                                              ↓
                              Evaluate all active plans against new catalog
                              Fire catalog_change alerts on affected plan_courses
```

### Extraction pipeline (extract.py)

The extractor runs a 3-phase pipeline over the PDF:

| Phase | Name | Description |
|---|---|---|
| **Phase 0** | Appendix name map | Build a lookup of 437 entries from course index pages (maps course names to codes) |
| **Phase 1** | Two-column extraction | Parse each page using column splitting to extract course blocks from the two-column PDF layout |
| **Phase 2** | Name cleanup | Strip credit-type suffixes, remove junk artifacts, apply title-casing |
| **Phase 3** | Prerequisite resolution | Match prerequisite text names to course codes using the appendix map; exclude semester-pair siblings to prevent prerequisite cycles |

**Output:** 345 courses, 334 prerequisite links, 159 GPA waiver courses. Semester breakdown: 89 Sem 1 only, 90 Sem 2 only, 136 full year, 6 Sem 1 exclusive, 6 Sem 2 exclusive, 168 available in both semesters. Structured `prerequisite_groups` (list of {group, type, codes}) with AND/OR semantics extracted; semester-pair siblings grouped as single OR group. `semesters_offered` integer array ([1], [2], or null) parsed from PDF code line patterns (e.g., "BUS411–Semester 1", "Semester 1 ONLY"). `gpa_waiver` boolean detected from "GPA WAIVER" in description/notes.

### Summer course support

Summer courses are fully supported in the planner and grade tracking. Two pre-summer sessions (`-2` = Summer Session 1, `-1` = Summer Session 2) occur before each grade level's regular semesters. Migration `0008_summer_semesters.sql` extends the `plan_courses` and `grade_entries` semester constraints to allow `-2` and `-1` values.

**Summer course equivalencies** (`config/summer-equivalents.ts`): 52 mappings link summer course codes (e.g., `SOC13S`, `MTH15S`) to their regular school-year equivalents (e.g., `SOC101/SOC102`, `MTH151/MTH152`). These mappings are used for:
- Preventing duplicate enrollment (cannot add regular course if summer equivalent already in plan)
- Showing "Also available as" in course detail views
- Graduation requirement matching (summer course satisfies same requirement as regular equivalent)

**Summer course extraction**: `extractor/extract_summer.py` parses summer catalogs, with curated overrides in `summer_courses_2026.py`. Summer courses cover Driver Education, Business, Computer Science, Fine Arts, Math, Sciences, Social Studies, Health/PE, and World Languages.

**Semester config** (`config/semesters.ts`): Defines `ALL_SEMESTERS = [-2, -1, 1, 2]`, `isSummerSemester()` helper, and display labels (`Sum 1`, `Sum 2`, `S1`, `S2`). The planner print view displays summer courses with amber-colored indicators.

### Loader validation steps

1. **Required fields**: every course must have `code`, `name`, `division`, `credit_value`, `duration`, `grade_levels` — abort and list violations on failure.
2. **Duplicate detection**: no duplicate `(code, catalog_version)` pairs — abort and list duplicates on failure.
3. **Credit range check**: credit values within expected range (0.25–2.0) — warn and require manual review.
4. **Grade level validation**: grade level arrays contain only values 9–12 — abort and list invalid entries.
5. **Topological sort** (Kahn's algorithm) on the full `course_prerequisites` graph. A detected cycle aborts the load entirely.
6. **Cycle guard in CTE**: even if a cycle somehow enters the DB, the recursive CTE has a depth cap of 10 and a `visited_path` cycle guard.
7. **Diff report**: `courses_added`, `courses_removed`, `courses_modified` counts + `change_summary` JSONB written to `course_catalog_versions`.

### Loader flags

- `--dry-run` — show the full diff (adds/removes/modifies) and prerequisite graph validation results without writing to the database.
- `--force` — proceed even when course count deviates ±20% from prior year.
- `--rollback` — revert to the previous `catalog_version_id` by soft-deleting the latest version's courses and restoring `is_active` on the prior version's courses (transactional).
- `--force-reload` — delete all courses and re-insert with new IDs (old behavior; breaks foreign key references from `plan_courses`, `grade_entries`, etc.). Only use for dev/testing.

> **UPSERT behavior (default):** The loader uses UPSERT (keyed on `code` + `catalog_version_id`) to preserve existing course IDs across reloads. Courses present in the DB but absent in the new JSON are deactivated (`is_active = FALSE`), not deleted. Prerequisites are always re-inserted. This prevents breaking foreign key references from `plan_courses`, `grade_entries`, and other tables that reference course IDs.

> **Rule:** Never auto-reload without human review of the diff. A removed or renamed course can silently break active student plans.

### Extractor error recovery & validation

The PDF extractor is the single point of entry for all course data. If it produces incorrect or incomplete output, every downstream feature (planner, prerequisites, GPA) is compromised. The following safeguards are required:

**Pre-load validation (extractor/extract.py output → courses.json):**

| Check | Action on failure |
|---|---|
| Course count within ±20% of prior year | Abort with warning; require manual override flag (`--force`) to proceed |
| Every course has: `code`, `name`, `division`, `credit_value`, `duration`, `grade_levels` | Abort; list all courses with missing required fields |
| No duplicate `(code, catalog_version)` pairs | Abort; list duplicates |
| All prerequisite references resolve to valid course codes within the same catalog version | Abort; list orphaned references |
| Credit values are within expected range (0.25–2.0) | Warn; require manual review |
| Grade level arrays contain only values 9–12 | Abort; list invalid entries |

**PDF format change detection:**

- The extractor must log confidence scores per parsed field (name, code, prerequisites, description). If the average confidence across all courses drops below 80%, the extractor aborts with: `"PDF structure may have changed. Manual review required."`
- Maintain a `extractor/schema_fingerprint.json` that records the expected PDF structure (header patterns, table column positions, section markers). On each run, compare the detected structure against the fingerprint. Mismatches produce a warning with a diff of what changed.
- The extractor produces a `data/YYYY-extraction-report.json` alongside `courses.json` containing: total courses parsed, field-level confidence scores, warnings, and a list of courses that required heuristic fallbacks.

**Manual fallback:**

- If the PDF format changes beyond the extractor's ability to parse, `courses.json` can be manually created or corrected. The loader (`extractor/loader.py`) accepts `courses.json` regardless of how it was produced.
- A `--dry-run` flag on the loader shows the full diff (adds/removes/modifies) and prerequisite graph validation results without writing to the database.
- A `--rollback` flag on the loader reverts to the previous `catalog_version_id` by soft-deleting the latest version's courses and restoring `is_active` on the prior version's courses. This is a transactional operation.

---

## 8. API Design

### Versioning

All routes: `/api/v1/...`. Version from day one.

### Response envelope

```typescript
// Success (cursor-based pagination)
{
  "data": [...],
  "meta": {
    "has_more": true,
    "next_cursor": "eyJpZCI6..."
  }
}

// Error
{ "error": { "code": "UPGRADE_REQUIRED", "message": "...", "minimum_tier": "elite" } }
```

### Key routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | — | Create user + subscription row (Plus plan, trialing status). Signup page: wider layout (max-w-lg), 2-column grids, role selector with description cards (Student/Parent/Guardian/Counselor — 4 roles). Guardian maps to "parent" in DB. Frozen state (IL) and school (Stevenson) fields. Sets firstName from email prefix. Sets `state` and `schoolName` on accounts. Non-student roles skip onboarding and go directly to dashboard. **Invite-driven signups** (`invite_code + invite_account` present): server looks up the invite and uses `invite.targetRole` as the source of truth (form-supplied role ignored); stale invites return `400 INVITE_INVALID`. |
| POST | `/api/v1/auth/google-provision` | session-only | Called by the client after Google Identity Services issues an ID token and `signInWithIdToken` establishes the session. Inserts a minimal `users` row for first-time Google users and returns `{ next: '/profile-setup', new_user: true }`; returning users get `{ next: requestedRedirect ?? '/dashboard', new_user: false }`. Body: `{ redirect?: string \| null }`. |
| ~~GET~~ | ~~`/api/v1/auth/callback`~~ | — | _Legacy Supabase OAuth code-exchange callback. Unused in V1 since the switch to GIS in PR #90; kept in the tree for safety._ |
| GET | `/api/v1/auth/me` | any authenticated | Returns logged-in user's email, role, first_name, last_name, and tourState. | Phase 3 |
| PATCH | `/api/v1/auth/me` | any authenticated | Update first_name, last_name, and/or tourState on the logged-in user. tourState values are per-tour and accept either the legacy `boolean` (`true` = completed) or the object form `{ completed, declined, lastStep }`. Server merges deltas via jsonb `\|\|` so partial updates are safe. | Phase 3 |
| GET | `/api/v1/auth/consent` | any authenticated | Returns pending legal documents requiring user consent (documents not yet accepted by user). | Phase 3 |
| POST | `/api/v1/auth/consent` | any authenticated | Records user acceptance of a legal document version. Stores IP address and user agent in `consent_records`. Updates `users.tosAcceptedAt` / `ppAcceptedAt`. | Phase 3 |
| GET | `/api/v1/plans` | member | List student's plans |
| POST | `/api/v1/plans` | member (can_edit) | Create plan (check plan limit) |
| PATCH | `/api/v1/plans/:id/set-primary` | student | Set plan as primary + active. Demotes old primary to draft. Student role only. Archived plans blocked (409). |
| GET | `/api/v1/plans/:id/courses` | student/parent/counselor | Plan courses |
| POST | `/api/v1/plans/:id/courses` | member (can_edit) | Add course to plan (returns 409 if grade is locked) |
| PATCH | `/api/v1/plans/:id/courses/:planCourseId` | member (can_edit) | Update a single plan course. Body fields: `semester`, `planned_grade`, `status`, `gpa_waiver_applied`, `prereq_overridden`. Locked grades accept only `gpa_waiver_applied` and `prereq_overridden` (non-structural metadata). |
| POST | `/api/v1/plans/:id/courses/bulk-override` | member (can_edit) | Flip `prereq_overridden` on a list of `plan_course_ids` in one trip; body `{ plan_course_ids, overridden }`. Used by the planner card click and the validation-report cell toggle. |
| DELETE | `/api/v1/plans/:id/courses/:planCourseId` | student | Remove course (reject if grade is locked — 409) |
| GET | `/api/v1/gpa` | student | Compute live GPA |
| POST | `/api/v1/gpa/snapshot` | student | Take manual GPA snapshot |
| POST | `/api/v1/gpa/what-if` | student (Plus+) | What-if GPA simulation (read-only); body: `{ "swaps": [{ "remove_course_id": "...", "add_course_id": "...", "planned_grade": "B+" }] }` |
| GET | `/api/v1/transcript` | student | Read-only transcript: completed courses from primary plan with grades, semester GPA, grade-level GPA, cumulative GPA, credits earned. Frontend has Print button (printer icon) next to "Edit in planner" that triggers `window.print()`. Print gated by `canExportPdf` (Plus+ only). | Phase 2 |
| POST | `/api/v1/transcript` | student | Bulk upsert grade entries (for onboarding import) | Phase 2 |
| GET | `/api/v1/gpa` | student | Live GPA from `plan_courses` on primary plan: cumulative (completed only), projected (all graded), plan totals (`totalCredits`, `earnedCredits`, `totalCourses`), `hasGrades` flag | Phase 2 |
| GET | `/api/v1/gpa/snapshots` | student | List GPA snapshot history (used by trend chart on Progress page; returns array of snapshots with unweighted + weighted GPA, ordered by date) | Phase 2 |
| POST | `/api/v1/gpa/snapshots` | student | Take manual GPA snapshot; also auto-triggered by year-end wizard with `semester_end` trigger | Phase 2 |
| POST | `/api/v1/gpa/what-if` | student (Plus+) | What-if GPA simulation (read-only) | Phase 2 |
| GET | `/api/v1/requirements` | student | Graduation progress with matching rules (code_prefix, codes, division, multi_division, remainder). Returns both flat `requirements[]` (backwards compatible) and `groups[]` array with group key, label, isOptIn, enabled, requirements[], and totals. Also returns `gpaWaiverWarnings[]` (validates 4+ GPA-counted courses per semester when waiver applied; P/F-only courses excluded from GPA-counted course count) and `honorsStatus` (achievement badge, not requirement). Optional `?planId=` query parameter to validate any plan (defaults to primary plan). 4 evaluation types: course_match, manual_checkbox, auto_from_course, course_load_check. Course load checks count only academic courses (PW division, DNC-prefix, D/E-prefix excluded). Group order: graduation, course_load, il_public_university, non_course. | Phase 2 |
| PUT | `/api/v1/requirements/status` | student | Toggle manual checkbox requirements (for non_course group). Body: `{ requirementId, isChecked }`. Updates `student_requirement_status`. | Phase 2 |
| PUT | `/api/v1/requirements/opt-in` | student | Enable/disable tracking for opt-in requirement groups. Body: `{ requirementGroup, enabled }`. Updates `student_requirement_opt_ins`. | Phase 2 |
| GET | `/api/v1/alerts` | student | Active alerts (unresolved) | **Not yet implemented** |
| PATCH | `/api/v1/alerts/:id/dismiss` | student | Dismiss alert | **Not yet implemented** |
| GET | `/api/v1/suggestions` | student (Elite) | Rule-based + AI course suggestions | **Not yet implemented** |
| POST | `/api/v1/ai/chat` | student (Elite) | AI advisor chat | **Not yet implemented** (directory exists, empty) |
| POST | `/api/v1/ai/plan-review` | student (Elite) | AI review of active plan | **Not yet implemented** |
| GET | `/api/v1/courses` | any | Course browser (search + filter). Params: `department` (UUID or name), `gpa_waiver` (true/false), `semester_offered` (1 or 2 — exclusive to that semester, excludes same-name partners), `semester_both` (true — courses with a same-name partner in the other semester), `duration` (semester or full_year). Returns `gpaWaiver`, `departmentId`, `departmentName`, `semestersOffered` per course; `total` count in pagination meta. Results sorted by name ascending, then code ascending. Cursor encoding: base64(JSON {name, code, id}) for composite sort. Accepts comma-separated values for `credit_type` and `grade_level` query parameters (e.g., `credit_type=AP,CP&grade_level=9,10`). Builds SQL IN(...) clause for multiple values. |
| GET | `/api/v1/courses/:id` | any | Course detail. Returns full course data plus `linkedCourses` array: other courses with the same name (semester partners), each with id, code, name, semesters_offered. |
| GET | `/api/v1/courses/:id/prereqs` | any | Full prerequisite chain (recursive CTE) |
| POST | `/api/v1/plans/:id/share` | student | Generate share link | **Not yet implemented** |
| GET | `/api/v1/share/:token` | unauthenticated | View shared plan (read-only) | **Not yet implemented** |
| POST | `/api/v1/stripe/webhook` | Stripe signature | Handle Stripe events (5 event types: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`). Idempotent via `stripe_events` table UNIQUE on `stripe_event_id`. | Phase 2 |
| POST | `/api/v1/stripe/checkout` | student | Create Stripe Checkout session. Subscription mode for monthly/annual; payment mode for 4-year. | Phase 2 |
| POST | `/api/v1/stripe/portal` | student | Create Stripe Billing Portal session for subscription management. | Phase 2 |
| GET | `/api/v1/subscriptions` | student | Current subscription state, tier, billing cycle, feature flags. | Phase 2 |
| GET | `/api/v1/export/plan/:id` | student | Generate plan PDF | **Not yet implemented** |
| GET | `/api/v1/percentile` | student (Elite) | Percentile stats | **Not yet implemented** |
| GET | `/api/v1/plans/:id` | student/parent/counselor | Get single plan detail | Phase 1b |
| PATCH | `/api/v1/plans/:id` | student | Rename plan, set active/archived | Phase 1b |
| DELETE | `/api/v1/plans/:id` | owner/delete permission | Delete a plan. Uses `getPlanAccess()` permissions — requires owner or delete permission; no student role override. Delete button shown on planner and manage plans pages, disabled for primary plans with tooltip. | Phase 1b |
| PATCH | `/api/v1/plans/:id/courses/:planCourseId` | student | Update course semester/status/grade. Returns 409 for non-waiver changes on locked grades. | Phase 1b |
| POST | `/api/v1/plans/:id/lock-grade` | student | Lock or unlock a grade level. Body: `{ grade_level: number, locked: boolean }`. Adds/removes grade from `locked_grade_levels` array. Locking triggers year-end wizard redirect. Unlocking requires confirmation. | Phase 2 |
| GET | `/api/v1/plans/:id/shares` | member | List all shares for a plan. Returns array of share rows with user info and permission level. | Phase 3 |
| POST | `/api/v1/plans/:id/shares` | owner | Create or update a share for a user on a plan. Body: `{ userId, permission }`. Cannot modify owner shares. | Phase 3 |
| PATCH | `/api/v1/plans/:id/shares/:userId` | owner | Update permission level for an existing share. Body: `{ permission }`. | Phase 3 |
| DELETE | `/api/v1/plans/:id/shares/:userId` | owner | Remove a share (revoke access). Cannot remove owner share. | Phase 3 |
| PATCH | `/api/v1/plans/:id/visibility` | member | Toggle plan visibility (hide/show). Body: `{ isHidden }`. Updates `plan_shares.is_hidden`. | Phase 3 |
| GET | `/api/v1/plans/:id/history` | student | Get plan change history (paginated) | **Not yet implemented** |
| PATCH | `/api/v1/users/me` | student | Update notification preferences | Phase 1a |
| PATCH | `/api/v1/users/me/profile` | student | Update student profile (goals in Phase 2; test scores in Phase 4) | **Not yet implemented** |
| GET | `/api/v1/goals` | student | List student's goals | **Not yet implemented** |
| POST | `/api/v1/goals` | student | Create a goal | **Not yet implemented** |
| PATCH | `/api/v1/goals/:id` | student | Update goal progress/status | **Not yet implemented** |
| DELETE | `/api/v1/goals/:id` | student | Delete a goal | **Not yet implemented** |
| GET | `/api/v1/dual-credit` | student | List student's dual credit entries | **Not yet implemented** |
| POST | `/api/v1/links/parents/invite` | student | Generate parent invite code | **Superseded by** `/api/v1/accounts/:id/members` |
| POST | `/api/v1/links/parents/claim` | parent | Claim invite code (parent) | **Superseded by** `/api/v1/accounts/:id/members/join` |
| DELETE | `/api/v1/links/parents/:linkId` | student/parent | Remove parent link | **Superseded by** `/api/v1/accounts/:id/members/:userId` |
| POST | `/api/v1/links/counselors/claim` | student | Link to counselor via code | **Not yet implemented** |
| DELETE | `/api/v1/links/counselors/:linkId` | student/counselor | Remove counselor link | **Not yet implemented** |
| GET | `/api/v1/export/my-data` | any authenticated | GDPR data export (all user data as JSON) | **Implemented as** `GET /api/v1/users/me` |
| POST | `/api/v1/accounts` | parent | Create account for a child (name, DOB, grade, year). COPPA check. Returns claim code. | 1b |
| POST | `/api/v1/accounts/claim` | student | Student claims account with claim code. Sets student_user_id. Starts trial. | 1b |
| GET | `/api/v1/accounts` | any | List accounts the user is a member of. Parents see multiple, students see one. | 1b |
| GET | `/api/v1/accounts/:id/members` | member | List members + pending invites. Returns `{ members: [...], pending_invites: [...] }`. Pending invites filtered to unclaimed and not-yet-expired; each carries `can_revoke` (students: any; others: own only). | 1b |
| POST | `/api/v1/accounts/:id/members` | member | Generate invite for new member. Stores recipient email lowercased on the invite row so it can surface in `pending_invites`. Returns `409 ALREADY_INVITED` if an unclaimed, unexpired invite already exists for the same email — the inviter must wait for acceptance or revoke the existing one. | 1b |
| POST | `/api/v1/accounts/:id/members/join` | any | Join account with invite code. When the invite has `shared_plans`, creates `plan_shares` rows for each plan. | 1b |
| DELETE | `/api/v1/accounts/:id/invites/:inviteId` | member | Revoke a single pending (unclaimed) invite. 404 if not found, 409 if already accepted, 403 if caller is not a student and didn't create the invite. | 3 |
| DELETE | `/api/v1/accounts/:id/members/:userId` | member | Remove a member. Any member can remove other members (except themselves). Students can be removed by non-student members. | 1b |
| PATCH | `/api/v1/accounts/:id` | member | Update account fields (student_name). | Phase 3 |
| POST | `/api/v1/school-request` | — (no auth) | Submit a school request (email, school_name, state, message). Stored in `school_requests` table for future outreach. | Phase 3 |
| GET | `/api/v1/year-end` | student/parent | Retrieve current year courses and transition state for year-end wizard | Phase 2 |
| POST | `/api/v1/year-end` | student | Complete year-end transition: lock grade, advance grade level, create GPA snapshot, promote next year courses from planned to enrolled | Phase 2 |
| POST | `/api/v1/contact` | — (no auth) | Submit a contact form message (name, email, subject, message). Stored in `contact_messages` table. Also sends notification email to `planwithgenie@gmail.com` via Resend with reply-to sender. Page gated behind `HOME_FEATURES.showContactPage` (currently `true`). | Phase 3 |
| POST | `/api/v1/feedback` | any authenticated | Submit feedback (rating 1-5, optional comment, page path). Stored in `feedback` table. | Phase 3 |
| PATCH | `/api/v1/accounts/:id/billing` | member | Transfer billing contact to another member. | 2 |
| POST | `/api/v1/auth/onboarding` | student/parent | Complete onboarding (grade level, template, goals) | 1b |
| GET | `/api/v1/plans/templates` | any | List all plan templates with courses | 1b |
| GET | `/api/v1/plans/:id/validate` | member | Full plan validation | 1b |
| GET | `/api/v1/accounts/:id/members` | member | List account members | 1b |
| GET | `/planner/print` | student/parent | Print-optimized plan view. Opens in new tab with landscape layout, auto-triggers browser print. Print button gated by `canExportPdf` (Plus+ only). | 1b |

> **Note:** All existing plan, grade, and GPA routes now require account context. For students, this is implicit (their one account). For parents, the account_id is derived from the route's resource or from the `X-Account-Id` request header.
>
> **Plan access gating (Phase 3):** GPA and Requirements APIs are gated behind plan access — non-student users without any `plan_shares` rows receive empty data instead of errors. This ensures counselors and parents only see data for plans explicitly shared with them.

> **Note:** `:planCourseId` in DELETE/PATCH `/api/v1/plans/:id/courses/:planCourseId` refers to `plan_courses.id`, not `courses.id`.

### Rate limits

| Endpoint | Limit |
|---|---|
| `/api/v1/ai/*` | 10 requests / user / hour |
| `/api/v1/gpa/*` | 100 requests / user / hour |
| `/api/v1/suggestions` | 100 requests / user / hour |
| All other endpoints | Standard AWS Amplify / ALB limits |
| Share link access (`/api/v1/share/:token`) | 20 requests/minute per IP |
| Invite code generation | 3 requests/hour per user |
| Auth endpoints (login/signup) | 5 requests/minute per IP |

**Implementation:** Rate limits are enforced via a sliding-window counter in Redis (Upstash). Each request increments `ratelimit:{userId}:{endpoint_group}:{window_key}` with a TTL matching the window size. When the limit is exceeded, the API returns:

```
HTTP 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again in X seconds.",
    "retry_after": 120
  }
}
```

Headers included on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

**Fallback:** If Redis is unavailable, rate limiting is bypassed (fail-open) to avoid blocking legitimate users. Log the Redis failure for monitoring.

### Pagination

All list endpoints (`/api/v1/plans`, `/api/v1/transcript`, `/api/v1/alerts`, `/api/v1/notifications`, `/api/v1/courses`, `/api/v1/plans/:id/courses`) use **cursor-based pagination**.

```typescript
// Request
GET /api/v1/alerts?limit=20&cursor=eyJpZCI6Ij...

// Response
{
  "data": [...],
  "meta": {
    "has_more": true,
    "next_cursor": "eyJpZCI6Ij...",
    "total": 42    // optional, included when inexpensive to compute
  }
}
```

- Default page size: **20** items
- Maximum page size: **100** items
- Cursor is an opaque base64-encoded token (typically encodes `id` + sort key). For `/api/v1/courses`, the cursor encodes `{name, code, id}` to support the composite name+code sort order
- Cursor-based pagination is preferred over offset-based because it handles inserts/deletes during pagination without skipping or duplicating rows

### Course search

Course browser search uses PostgreSQL trigram matching (`pg_trgm` extension) for fuzzy search by name or code:

```sql
-- Enable extension (run once in migration)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for fast trigram search
CREATE INDEX idx_courses_name_trgm ON courses USING GIN (name gin_trgm_ops);
CREATE INDEX idx_courses_code_trgm ON courses USING GIN (code gin_trgm_ops);

-- Query: fuzzy search by name or code
SELECT * FROM courses
WHERE (name % :query OR code % :query)
  AND is_active = TRUE
  AND catalog_version_id = :current_version_id
ORDER BY similarity(name, :query) DESC
LIMIT 20;
```

This supports typo-tolerant search (e.g., "Calclus" matches "Calculus"). For exact prefix matching (faster for autocomplete), use `LIKE :query || '%'` with a standard B-tree index.

---

## 9. Subscription & Billing Engine

### Stripe integration

**Implementation (Phase 2 complete):**
- **Stripe SDK singleton:** `lib/stripe/client.ts` — initializes Stripe from `STRIPE_SECRET_KEY` env var.
- **Price ID mapping:** `lib/stripe/prices.ts` — maps tier + billing interval to Stripe Price IDs.
- **Checkout:** `app/api/v1/stripe/checkout/route.ts` — creates Stripe Checkout sessions. Uses subscription mode for monthly/annual billing; payment mode for 4-year plans (one-time charge).
- **Webhook handler:** `app/api/v1/stripe/webhook/route.ts` — receives and processes Stripe events with signature verification.
- **Billing Portal:** `app/api/v1/stripe/portal/route.ts` — creates Stripe Billing Portal sessions for subscription management.
- **Subscriptions API:** `app/api/v1/subscriptions/route.ts` — returns current subscription state with tier and feature flags.
- **Billing page:** `app/(app)/settings/billing/page.tsx` — pricing cards with 3-interval toggle (monthly/annual/4-year), current plan indicator, upgrade/manage subscription CTAs. Pricing card buttons aligned at same level using flex layout. For trialing users: shows "Free Trial" with "X days left" badge; pricing cards suppress "Current Plan" indicator. Pricing cards show linked accounts per tier (3/5/8) and PDF/print for Plus. 4-year subscriptions display "Expires" instead of "Renews" (one-time payment).

**Webhook events handled** (all logged to `stripe_events` before processing):

| Event | Action |
|---|---|
| `customer.subscription.created` | Update `subscriptions` row |
| `customer.subscription.updated` | Update tier, billing cycle, period dates; invalidate Redis cache |
| `customer.subscription.deleted` | Set `subscriptions.status = 'canceled'`; freeze account |
| `invoice.payment_failed` | Set `subscriptions.status = 'past_due'`; enqueue 5-day freeze job |
| `invoice.paid` | Set `subscriptions.status = 'active'`; unfreeze account; clear Redis cache |

**Idempotency pattern:**

```typescript
// app/api/v1/stripe/webhook/route.ts
async function handleWebhook(rawBody: Buffer, signature: string) {
  const event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

  // Write to stripe_events FIRST (before any business logic)
  const { count } = await db.insert(stripeEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    payload: event,
    processed: false,
  }).onConflictDoNothing(); // UNIQUE on stripe_event_id

  if (count === 0) return; // duplicate — already processed

  // Process business logic
  await processStripeEvent(event);

  await db.update(stripeEvents)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(stripeEvents.stripeEventId, event.id));
}
```

### Account-based subscriptions

> **Account-based subscriptions:** The `subscriptions` table references `account_id` instead of `user_id`. One subscription per account. The billing contact (`accounts.billing_contact_id`) determines whose Stripe customer ID is used for checkout and portal. Billing transfer creates a new Stripe customer for the new billing contact and migrates the subscription at the next billing period.

### Downgrade behavior

- Excess plans are **never deleted**. They become `status = 'archived'` (read-only), in order from oldest `activated_at` first.
- Alert history, AI chat history, and prerequisite graph data are preserved. UI hides tier-gated display until the user upgrades.
- Existing `plan_share_links` for archived plans remain active.
- Tier-gated alert types (`ap_capacity_underuse`, `declining_gpa_trend`) are still evaluated and stored on downgrade — just not surfaced in the UI.

---

## 10. Background Job Queue

> **Implementation status:** The `worker/jobs/` directory exists but job definitions are **stubs only** — no BullMQ worker is deployed yet. The job definitions below describe the planned architecture. Currently, alert evaluation, GPA recalculation, and requirement progress refresh are handled inline in API routes. BullMQ implementation is planned for Phase 4+.

BullMQ will run on a **dedicated AWS ECS Fargate task** (not serverless). The task connects to the same Upstash Redis instance used for caching (migrate to AWS ElastiCache when user base exceeds ~500 active users). The Docker image is built by GitHub Actions and pushed to Amazon ECR on every merge to `main`.

**Important:** BullMQ requires a native Redis TCP connection (ioredis). Upstash offers a Redis-compatible TCP endpoint at `UPSTASH_REDIS_URL` (not the REST API). The BullMQ worker must be configured with the TCP endpoint. If TCP latency is unacceptable from ECS Fargate to Upstash, this becomes a trigger for early ElastiCache migration.

### Job definitions

```typescript
// worker/jobs/alert-evaluation.ts
// Triggered by: plan save, grade entry
// Input: { studentId, planId }
// Runs: full alert evaluation for a student's primary plan

// worker/jobs/gpa-recalculation.ts
// Triggered by: any grade entry
// Input: { studentId }
// Runs: recompute GPA; update Redis cache; optionally take snapshot

// worker/jobs/trial-expiry.ts
// Schedule: nightly (cron: '0 2 * * *')
// Finds: subscriptions WHERE status = 'trialing' AND trial_ends_at < NOW()
// Action: downgrade to Starter; insert account_events row; send email

// worker/jobs/graduation-detection.ts
// Schedule: nightly (cron: '0 3 * * *')
// Finds: student_profiles WHERE graduation_year < current_academic_year_start
//        AND users.account_status = 'active'
// Action: freeze account (graduation_complete); send graduation email

// worker/jobs/payment-lapse-freeze.ts
// Triggered by: invoice.payment_failed webhook (delayed 5 days via BullMQ delay)
// Checks: is invoice still unpaid?
// Action: freeze account (payment_lapsed); insert account_events row
// Race condition guard: Before freezing, the job queries the Stripe invoice via
// `stripe.invoices.retrieve(invoiceId)` to check current status. If the invoice
// status is `paid` (indicating a retry succeeded during the delay), the job exits
// without action and logs the resolution.

// worker/jobs/percentile-stats.ts
// Schedule: nightly (cron: '0 4 * * *')
// Builds: grade_cohort_stats aggregate (only contributes_to_stats = TRUE rows)

// worker/jobs/year-end-reset.ts
// Schedule: annually (cron: '0 6 1 8 *')  -- Aug 1 at 06:00
// Action: UPDATE student_profiles SET year_end_transition_state = 'pending' WHERE account_status = 'active'
// Note: The year-end API accepts a `grade` query param to complete a specific grade (not just current).
// On completion, the wizard adds the grade to four_year_plans.locked_grade_levels.
// Phase 2 update (US-24): On completion, also auto-creates a GPA snapshot with trigger 'semester_end'
// from completed plan_courses. Snapshot creation is non-fatal (try/catch, logged on failure).

// worker/jobs/weekly-digest.ts
// Schedule: weekly (cron: '0 9 * * 0')  -- Sunday 09:00
// Sends: GPA projection digest email to students + parents

// worker/jobs/stripe-reconciliation.ts
// Schedule: nightly (cron: '0 5 * * *')
// Fetches active Stripe subscriptions, compares against local `subscriptions` table,
// fixes drift from missed webhooks

// worker/jobs/req-progress-refresh.ts
// Triggered by: plan mutation
// Recalculates graduation requirement fulfillment for the affected student

// worker/jobs/stripe-events-purge.ts
// Schedule: weekly (cron: '0 6 * * 0')
// Deletes `stripe_events` rows older than 90 days per retention policy

// worker/jobs/unclaimed-account-freeze.ts
// Schedule: nightly (cron: '0 3 * * *')
// Finds: accounts WHERE student_user_id IS NULL AND created_at < NOW() - INTERVAL '90 days'
// Action: freeze account; send email to created_by with resend-invitation link
```

### Job failure handling

BullMQ retries failed jobs with exponential backoff (3 retries by default). Failed jobs after all retries land in the `failed` queue. A monitoring job should alert on failed queue depth > 0.

Worker downtime: jobs are not lost — BullMQ persists the queue in Redis. Jobs run on worker restart in FIFO order.

### Dead Letter Queue (DLQ) Handling

Jobs that fail after 3 retry attempts are moved to the `failed` set in BullMQ. Monitoring alerts fire when the failed count exceeds 10 in any 1-hour window.

**Inspection:** Deploy Bull Board (a BullMQ admin UI) behind admin auth at `/admin/queues` for job inspection, manual retry, and purge. In Phase 1, a CLI script (`scripts/inspect-failed-jobs.ts`) provides the same capability without a web UI.

**Auto-purge:** Failed jobs are retained for 7 days for debugging, then automatically purged.

### Connection pooling

The BullMQ worker must use Supabase's PgBouncer pooled connection string (`DATABASE_URL` with port 6543) to avoid exhausting the PostgreSQL connection limit. Direct connections are reserved for migrations only.

---

## 11. Caching Strategy

| Cache key | TTL | Invalidated on |
|---|---|---|
| `user:{userId}:subscription` | 5 min | Stripe webhook updates `subscriptions.status` |
| `user:{userId}:gpa` | 5 min | Any grade entry or plan save for this student |
| `plan:{planId}:requirements` | 10 min | Any plan save for this student, manual checkbox toggle, or opt-in group change. Requirements API accepts optional `?planId=` to cache per non-primary plan. |
| `course:{courseId}:prereqs` | 24 hr | Catalog reload (course_catalog_versions insert) |

All cache values are JSON-serialized. On cache miss, fall back to live DB query and re-populate. Never trust a cached value for write operations — always read from DB before mutating.

Cache invalidation is triggered from within the API routes (not from BullMQ jobs) to keep invalidation synchronous with the mutation that caused it.

---

## 12. AI Integration

### Provider

Claude API (`claude-sonnet-4-6`). Rate-limited to 10 requests/user/hour.

### Three AI features

**1. Career path course recommendations**

```typescript
// lib/ai/career-recommendations.ts
async function getCareerRecommendations(studentId: string, careerPathId: string) {
  const [student, careerCourses, completedCourses] = await Promise.all([
    db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, studentId) }),
    db.query.careerPathCourses.findMany({
      where: eq(careerPathCourses.careerPathId, careerPathId),
      with: { course: true }
    }),
    db.query.gradeEntries.findMany({ where: eq(gradeEntries.studentId, studentId) })
  ]);

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a high school academic advisor...`,
    messages: [{ role: 'user', content: buildPrompt(student, careerCourses, completedCourses) }]
  });

  // GUARDRAIL: validate every suggested course code against the full courses table
  const suggestions = parseSuggestions(response);
  const allCourses = new Set((await db.query.courses.findMany({
    where: eq(courses.isActive, true),
    columns: { code: true }
  })).map(c => c.code));
  const careerCourseSet = new Set(careerCourses.map(c => c.course.code));

  // Step 1: Validate all suggested courses exist in the current catalog
  const validCourses = suggestions.filter(s => allCourses.has(s.courseCode));
  // Step 2: Flag career-path relevance (informational, not a filter)
  const enriched = validCourses.map(s => ({
    ...s,
    isOnCareerPath: careerCourseSet.has(s.courseCode),
  }));
  // Step 3: Log any hallucinated course codes
  const hallucinated = suggestions.filter(s => !allCourses.has(s.courseCode));
  if (hallucinated.length > 0) logger.warn('AI hallucinated courses', { hallucinated });

  return enriched;
}
```

**2. Plan review**

AI receives: student's full plan (course list, grades, GPA, goals, career path) as structured context. Returns a JSON object with `strengths[]`, `concerns[]`, `suggestions[]`. Each suggestion is validated against the course DB.

**3. Chat interface**

AI chat is client-stateful at MVP: the browser stores the conversation in local component state (lost on page refresh). The last 5 messages from the current session are included in the API request for context continuity. No server-side chat history table exists at MVP. Persistent chat history (with an `ai_chat_messages` table) is a Phase 5 enhancement. Rate limited. All responses include: "These are suggestions only. Confirm all course decisions with your school counselor."

### AI guardrail rule (non-negotiable)

> Every AI-generated course name or code must be cross-validated against the `courses` table before display. If Claude returns a course not in the DB, suppress it and log the mismatch. Never show hallucinated course names as recommendations.

### AI context window management

Each AI request sends student context + course data to Claude. Context must be managed carefully to stay within token limits:

**Context budget allocation (claude-sonnet-4-6 — 200K context window):**

| Component | Approx. tokens | Strategy |
|---|---|---|
| System prompt + instructions | ~500 | Static |
| Student profile + goals + grades | ~500–1,000 | Full — always included |
| Current plan courses (all years) | ~500–1,500 | Full — always included |
| Career path + career courses | ~300–500 | Full — included when career-relevant |
| Course catalog (relevant subset) | ~3,000–8,000 | **Filtered**: only courses in the student's eligible grade levels and divisions relevant to their career path or query |
| Conversation history (chat only) | ~1,000–3,000 | Last 5 messages (stateless at MVP, but plan for context window) |

**Rules:**
- Never send the full course catalog (~300+ courses, ~50K+ tokens). Filter to a relevant subset based on the student's grade level, division, and query intent.
- Use Claude's structured tool use to let the model request specific course lookups by code/name when it needs data outside the pre-loaded subset.
- If context exceeds 30K tokens (conservative budget), truncate conversation history first, then reduce catalog subset.
- Log input token counts per request for cost monitoring.

**Graceful degradation:** If the Claude API returns a 5xx error or times out (30s), return a user-friendly message: "AI suggestions are temporarily unavailable. Please try again in a few minutes." Never block the page load on an AI request — load AI features asynchronously.

---

## 13. GPA Calculation Engine

### Configuration (must be confirmed with school before coding)

```typescript
// config/gpa-weights.ts
// THESE VALUES ARE ILLUSTRATIVE — get exact values from school before implementing
export const CREDIT_TYPE_WEIGHT: Record<string, number> = {
  'CP':           0.0,   // College Prep — standard weight
  'Accelerated':  0.5,   // +0.5 bonus
  'Honors':       0.5,   // +0.5 bonus (placeholder — confirm with school)
  'AP':           1.0,   // +1.0 bonus
  'Pass/Fail':    0.0,   // excluded from GPA
};

// config/grade-scale.ts
export const GRADE_TO_POINTS: Record<string, number | null> = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F':  0.0,
  'P':  null,  // Pass — excluded from GPA
  'I':  null,  // Incomplete — excluded until resolved
};

// P/F-only course identification
export function isPassFailCourse(code: string): boolean { ... }
// Returns true for regular PE (PED121, PED122, PED451, PED452, PED111, PED112)
// and Driver Ed (D/E231, D/E232).
// Health (PED201/202), Applied Health (PED231/232), Adventure Ed (PED331/332),
// Lifeguard (PED501), and Leadership courses still get letter grades.

export const PASS_FAIL_OPTIONS = [
  { value: 'P', label: 'P' },
  { value: 'F', label: 'F' },
];
```

### Calculation logic

```
Unweighted GPA = SUM(gradePoints × creditValue) / SUM(creditValue)
                 for all courses WHERE gradePoints IS NOT NULL
                 AND gpa_waiver_applied = FALSE
                 AND isPassFailCourse(code) = FALSE
                 AND status != 'dropped'

Weighted GPA   = SUM((gradePoints + weightBonus) × creditValue) / SUM(creditValue)
                 for same set of courses
```

GPA is **always recomputed from `plan_courses` on the primary plan at read time**. Snapshots in `gpa_snapshots` are historical markers for the trend chart only — never used for the live GPA display. **Phase 2 update (US-23/US-24):** Snapshots are auto-created when the year-end wizard completes (trigger: `semester_end`). The GPA trend chart on the Progress page right sidebar uses a Recharts `LineChart` showing unweighted (primary color) and weighted (success color) GPA lines; renders only when 2+ snapshots exist; data from `GET /api/v1/gpa/snapshots`.

> **Phase 2 update:** The GPA API (`GET /api/v1/gpa`) reads exclusively from `plan_courses` on the primary plan — not from `grade_entries`. Grades are set via the planner page (status dropdown + grade dropdown on each course card) and stored in `plan_courses.planned_grade`. The API returns cumulative GPA (completed courses only), projected GPA (all courses with grades), plan totals (`totalCredits`, `earnedCredits`, `totalCourses` with per-row adjusted credits), and a `hasGrades` boolean flag.

> **Implementation status (Phase 1b):** GPA calculation is implemented in `lib/gpa/calc.ts`. Full-year courses are stored as two `plan_courses` rows; the calculation uses `creditValue / 2` per row to avoid double-counting. GPA is displayed in the planner UI at both the grade header level (per-grade projected + actual weighted GPA) and the plan header level (total projected + actual).
>
> **P/F-only course exclusion (Phase 2 update):** `calculateGPA()` now skips courses where `isPassFailCourse(code)` returns true, in addition to existing exclusions (dropped, GPA waiver applied, P/I grades). The `CourseForGPA` interface includes an optional `code` field to support this. P/F-only courses (regular PE: PED121/122/451/452/111/112; Driver Ed: D/E231/232) show only P/F in the grade dropdown via `PASS_FAIL_OPTIONS`. The GPA waiver checkbox is hidden for these courses. They display a grey "P/F" badge with tooltip "Pass/Fail course — excluded from GPA and academic course count".

### Three GPA views

| View | Source |
|---|---|
| Cumulative GPA | All `plan_courses` on primary plan with `status = 'completed'` and a grade set |
| Projected GPA | All `plan_courses` on primary plan with any grade set (completed + enrolled + planned) |
| What-If GPA | Same as Projected but computed in-memory from a temporary course swap — never persisted |

---

## 14. Prerequisite DAG Engine

### Storage: adjacency list

Each row in `course_prerequisites` is one direct edge. Multi-level chains are stored as individual edges and traversed at query time.

### `requirement_group` semantics

- Same `course_id` + same `requirement_group` → **OR** (any one satisfies)
- Same `course_id` + different `requirement_group` → **AND** (all groups must be satisfied independently)

### Recursive CTE (full upstream chain)

```sql
WITH RECURSIVE prereq_chain AS (
  SELECT cp.prerequisite_id,
         cp.course_id        AS required_by,
         cp.requirement_group,
         cp.minimum_grade,
         cp.is_recommended,
         1                   AS depth,
         ARRAY[cp.course_id] AS visited_path
  FROM   course_prerequisites cp
  WHERE  cp.course_id         = :target_course_id
    AND  cp.relationship_type = 'prerequisite'
    AND  cp.catalog_version_id = :active_version_id

  UNION ALL

  SELECT cp.prerequisite_id,
         cp.course_id,
         cp.requirement_group,
         cp.minimum_grade,
         cp.is_recommended,
         pc.depth + 1,
         pc.visited_path || cp.course_id
  FROM   course_prerequisites cp
  JOIN   prereq_chain pc ON pc.prerequisite_id = cp.course_id
  WHERE  pc.depth            < 10
    AND  NOT cp.course_id = ANY(pc.visited_path)
    AND  cp.relationship_type = 'prerequisite'
    AND  cp.catalog_version_id = :active_version_id
)
SELECT * FROM prereq_chain ORDER BY depth;
```

Swap `course_id`/`prerequisite_id` for the downstream (blast radius) query.

### Plan validator algorithm

For each course C in the plan:
1. Fetch full transitive prerequisites (hard requirements only: `is_recommended = FALSE`)
2. Group by `requirement_group`:
   - For each group: at least one prerequisite must appear in the plan with a slot earlier than C (for `prerequisite`) or same slot (for `corequisite`)
   - If `minimum_grade` is set and the prerequisite has `status = 'completed'`, check `grade_entries`
3. Any unsatisfied group → fire `prereq_violation` or `coreq_violation` alert

Cycle detection runs at catalog load time (topological sort). Cycles at runtime are blocked by the `visited_path` guard in the CTE — they do not cause infinite loops.

> **Duplicate validation (Phase 1b update):** Duplicate validation blocks the same course at any grade level (not just same grade+semester). Semester partners (same name, different code) are also blocked. Full-year courses are allowed at the same grade in both semesters (expected pattern for 2-row storage).

---

## 15. Alert Engine

Alerts are evaluated in BullMQ jobs, **never in the API request cycle**.

### Trigger sources

| Job trigger | Fires on |
|---|---|
| `alert-evaluation` job | Every plan save or grade entry (enqueued by API) |
| `graduation-detection` cron | Nightly |
| `payment-lapse-freeze` job | 5 days after `invoice.payment_failed` |
| `catalog-reload` event | After each annual catalog update |

### Deduplication

```sql
UNIQUE (student_id, deduplication_key) WHERE resolved_at IS NULL
```

`deduplication_key` format: `'{planId}:{courseId}:{alertType}'` (or `'{studentId}:{alertType}'` for non-course alerts).

Before inserting a new alert, the engine checks if a matching unresolved alert already exists (same `deduplication_key` per student). If yes, it skips insertion. When a violation is resolved (e.g., student adds the missing prerequisite), `resolved_at` is set — allowing the same key to fire again if the condition recurs.

### Underload warnings

Underload warnings trigger for any semester with fewer than 5 academic courses, including empty semesters (0 courses). This ensures all four grade levels have adequate course loads. The course load count excludes non-academic courses: Physical Welfare division, DNC-prefix (Dance), and D/E-prefix (Driver Ed) courses are not counted — they represent the "sixth supervised period", not part of the 5 academic credits.

### Dashboard layout

> **Phase 2 update:** The dashboard uses a 3-row, 2-column grid layout:
> - **Row 1:** Active Plan card, GPA card
> - **Row 2:** Attention Required card (renamed from "Validation Report", with warning icon), Achievements card
> - **Row 3:** Academic Progress card, Quick Actions card
>
> **"Attention Required" card:** Simplified — no category summary line or "Issues found" badge in header. Shows only category titles with counts (Graduation Gaps, Semester Gaps, Prerequisite Violations) + "View Report" button that routes to `/planner?validation=open`. Three validation categories:
> - **Graduation Requirement Gaps** (red) — missing credits for diploma
> - **Semester Requirement Gaps** (amber) — course load, PW/Dance, GPA waiver eligibility issues
> - **Prerequisite Violations** (amber) — course ordering conflicts
>
> Non-course requirements (ACT, FAFSA) are excluded from issue counts. Honors badge removed from this card (moved to Achievements).
>
> **"Academic Progress" card:** Shows all requirement groups (not just graduation) with per-group segmented progress bars showing earned/planned/remaining. Replaces old graduation-only credit progress and individual requirement list. Data from requirements API.
>
> **"Achievements" card:** All badges (earned + unearned) in a single 2-column grid: Honor Graduate tier (computed from GPA), Graduation Ready, Credit milestones (15/30/45), GPA milestones (3.0+/3.5+/4.0+), Credits Earned. Data from requirements API (`honorsStatus`) and plan validation API for the primary/active plan.

### Plan header bar validation indicator

> **Phase 2 update:** The plan bar "Issues found" count includes graduation gaps, semester issues, and prerequisite violations only — non-course requirements (ACT, FAFSA) are excluded. Progress data is auto-fetched on plan load and auto-refreshed when the plan is updated while the validation side panel is open.

### Planner validation report side panel

> **Phase 2 update:** A side panel (380px, right side, sticky, scrollable) with frozen title "Validation Report". Collapsible summary: collapsed shows "Credits 48/45 | Reqs 11/12 | 1 gap | 15 warnings". Expanded summary has 3 groups: Credits (Total/Earned/Planned), Graduation Requirements (Met/In Progress/Gaps), Warnings (Semester/Prerequisite).
>
> 3 collapsible detail sections:
> - **Graduation Gaps** (with credit progress bar inside)
> - **Semester Requirement Gaps** (course load, PW/Dance/DriverEd, GPA waiver eligibility)
> - **Prerequisite Violations** (course ordering conflicts)
>
> Warning messages use consistent "Gr X Sem Y:" prefix format as clickable links that navigate to the grade/semester in the planner grid. Clicking a link expands only that grade and highlights the target semester cell (blue ring, fades after 3s). The panel works with any selected plan (not just primary) using the `?planId=` parameter on the requirements API. When the side panel is open and the plan is updated (course added/removed, grade or status changed), the requirements API is automatically called to refresh the validation data. The planner auto-opens the validation panel when navigated with `?validation=open` URL parameter (used by the Dashboard "View Report" button).

### Plan selection persistence

> **Phase 2 update:** The selected plan in the planner is persisted via `sessionStorage` so navigating away and back retains the selection. Key: plan ID stored on plan switch, restored on planner mount.

### Tier gating

Tier-gated alert types (`ap_capacity_underuse`, `declining_gpa_trend`) are evaluated and stored for all tiers. Only the UI display is suppressed for Starter/Plus users. This ensures no data loss on downgrade.

---

## 16. Notification System

### Dispatch flow

```
Alert triggered
  → alert-evaluation job inserts alert row
  → notification-dispatch job enqueued
  → reads user.notification_preferences for this notification_type
  → for each enabled channel:
      → INSERT notifications row (status = 'pending')
      → if 'email': Resend API call → update status = 'sent'/'failed'
      → if 'in_app': Supabase Realtime broadcasts to subscribed client
```

### Email provider: Resend

Templates are React Email components, rendered server-side. Each `notification_type` has a corresponding template file in `components/emails/`.

### Preference enforcement

`users.notification_preferences` JSONB keys must match the `notification_type` CHECK constraint on `notifications`. Always check preferences before dispatching — never send a channel the user has disabled.

---

## 17. Real-Time Updates

Supabase Realtime provides Postgres change subscriptions. Used for:
- In-app notification center (new rows in `notifications` WHERE `user_id = auth.uid()`)
- Alert badge count (new rows in `alerts` WHERE `student_id = auth.uid()`)

No polling needed. Client subscribes on mount; unsubscribes on unmount.

```typescript
// components/notification-center.tsx
const channel = supabase
  .channel('user-notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    addNotification(payload.new);
  })
  .subscribe();
```

---

## 18. PDF Export & Share Links

### PDF export

Rendered server-side via React-pdf from `/api/v1/export/plan/:id`. Output includes:
- Course grid (grade × semester)
- GPA projections (cumulative + projected)
- Graduation requirement status
- Dual credit summary

Generated on-demand; not stored in DB or object storage (regenerated on each request).

### Share links

Token generation: `crypto.randomBytes(24).toString('base64url')` — 32 URL-safe characters.

```typescript
// Access check in /api/v1/share/:token
const link = await db.query.planShareLinks.findFirst({
  where: eq(planShareLinks.token, token)
});

if (!link) return notFound();
if (link.revokedAt) return notFound();
if (link.expiresAt && link.expiresAt < new Date()) return notFound();

// Update last_accessed
await db.update(planShareLinks)
  .set({ lastAccessed: new Date() })
  .where(eq(planShareLinks.id, link.id));

// Return read-only plan data
```

Visitors accessing a share link are never authenticated. They cannot call any write endpoint. Share links survive plan archival and subscription downgrade.

---

## 19. Security Model

### OWASP Top 10 concerns

| Risk | Mitigation |
|---|---|
| **Broken Access Control** | RLS policies enforced at DB layer; API routes double-check ownership on all mutations |
| **Injection** | Drizzle ORM with parameterized queries; no raw SQL concatenation |
| **Sensitive Data Exposure** | Never log raw grade data; all data encrypted at rest (Supabase managed) + TLS in transit |
| **IDOR on plan/grade endpoints** | All endpoints verify `student_id = auth.uid()` before returning data (RLS is the primary guard; API adds a defense-in-depth check) |
| **Broken Auth** | Supabase Auth handles JWT issuance; JWTs validated on every request |
| **Stripe webhook spoofing** | `stripe.webhooks.constructEvent()` validates signature on every webhook |
| **XSS** | React escapes by default; no `dangerouslySetInnerHTML` in user-facing content; Content Security Policy headers (see below) |
| **Dependency vulnerabilities** | `npm audit` + Snyk on every PR via GitHub Actions |

### CSRF Protection

API routes using `Authorization: Bearer` headers are immune to CSRF. For Supabase client SDK cookie-based auth, Next.js API routes validate the `Origin` header against allowed origins. Stripe webhooks are protected by signature verification, not cookies. No additional CSRF tokens are required at this time.

### Content Security Policy (CSP)

Configure CSP headers in `next.config.ts` to prevent XSS and data exfiltration:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://js.stripe.com https://us-assets.i.posthog.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.i.posthog.com https://*.upstash.io;
  frame-src https://js.stripe.com;
  object-src 'none';
  base-uri 'self';
```

`unsafe-inline` for scripts is required by Next.js SSR hydration. Stripe.js and PostHog require their respective script-src entries. Review and tighten CSP at each phase.

**Future hardening:** Replace `'unsafe-inline'` in `script-src` with nonce-based CSP (supported in Next.js via `next.config.ts` `headers()` config). This eliminates inline script injection vectors.

### RLS verification test (mandatory before launch)

```typescript
// tests/security/rls.test.ts
it('student A cannot read student B plan_courses', async () => {
  const studentAClient = createSupabaseClient(studentAToken);
  const rows = await studentAClient
    .from('plan_courses')
    .select('*')
    .eq('plan_id', studentBPlanId);
  expect(rows.data).toHaveLength(0);
});

it('counselor cannot read non-linked student data', async () => {
  const counselorClient = createSupabaseClient(counselorToken);
  const rows = await counselorClient
    .from('four_year_plans')
    .select('*')
    .eq('student_id', unlinkedStudentId);
  expect(rows.data).toHaveLength(0);
});
```

---

## 20. Accessibility & Mobile Responsive Design

### Accessibility (WCAG 2.1 AA — Phase 1 requirement)

Accessibility is a Phase 1 build-in requirement, not a Phase 5 retrofit. shadcn/ui provides accessible primitives, but the planner grid, course browser, and alert system require custom ARIA implementation.

**Planner grid accessibility:**

```typescript
// components/planner/planner-grid.tsx
// The grid uses role="grid" with role="row" and role="gridcell"
// Each cell is labeled: "Grade 10, Semester 1 — 4 courses planned"
// Arrow keys navigate between cells; Enter opens course picker
// Validation errors announced via aria-live="assertive" region

<div role="grid" aria-label="Four-year course planner">
  <div role="row" aria-label="Grade 9">
    <div role="gridcell" aria-label="Grade 9, Semester 1 — 3 courses planned" tabIndex={0}>
      {/* course cards */}
    </div>
  </div>
</div>
```

**Key implementation rules:**

| Requirement | Implementation |
|---|---|
| Keyboard navigation | Arrow keys between grid cells; Tab to move between grid and other page regions; Enter/Space to activate; Escape to close overlays |
| Screen reader support | `role="grid"`, `role="row"`, `role="gridcell"` on planner; `aria-live="assertive"` for validation errors; `aria-describedby` on course cards linking to prerequisite status |
| Color independence | All states (violation, warning, completed, planned) use icons + text labels in addition to color. Never rely on color alone |
| Contrast ratios | WCAG AA: 4.5:1 for normal text, 3:1 for large text and UI components. Enforced via Tailwind config and tested in CI |
| Focus management | Visible focus rings on all interactive elements. Modal focus trapping. Focus restored to trigger element on modal close |
| Form accessibility | All inputs have associated `<label>` elements. Error messages linked via `aria-describedby`. Required fields marked with `aria-required` |

**Automated accessibility testing (CI):**

```bash
# Run axe-core accessibility checks on all pages
npx playwright test --project=accessibility

# Tests use @axe-core/playwright to scan each page for WCAG 2.1 AA violations
# Any violation fails the CI build
```

Add `@axe-core/playwright` to the E2E test suite. Every new page/component must pass axe checks before merge. The Phase 5 WCAG audit focuses on AAA improvements and manual testing with assistive technologies — not baseline AA compliance.

### UI Orchestration — Design System Sweep (Phase 3)

A complete visual consistency sweep was performed across all 22 pages:

| Area | Changes |
|---|---|
| **Page headers** | Standardized across all pages using consistent heading hierarchy and spacing |
| **Component usage** | Card, Button, Badge, and Input components from shadcn/ui used consistently everywhere |
| **Loading states** | Proper loading skeletons added to all data-dependent pages |
| **Empty states** | Meaningful empty state messages with CTAs on all pages (e.g., "No plans shared yet" for counselors) |
| **Error states** | Error handling with user-friendly messages on all pages |
| **Responsive grids** | 1-column on mobile, 2/3-column on desktop grids applied consistently |
| **Focus rings** | Visible focus indicators on all interactive elements |
| **Touch targets** | 44px minimum touch targets per WCAG 2.5.5 enforced throughout |
| **ARIA attributes** | Labels, roles, and live regions added across all interactive components |
| **Print styles** | `globals.css` includes `@media print` rules for the planner print page |
| **Design tokens** | Hardcoded colors replaced with Tailwind CSS v4 `@theme` CSS variables |

The sweep is documented in `ui_orchestration_plan.md` as a reusable playbook for future design system audits.

### Navigation & UX Updates (Phase 3)

- **Sign out:** Redirects to home page (`/`) instead of `/login` for better UX flow
- **Auth layout:** SAPS logo links to home page; "Home" link added to footer
- **Terms/Privacy pages:** Back button closes tab if opened via `target="_blank"`, falls back to browser history; back button moved to bottom of pages
- **Share modal:** Close (X) button added to header
- **Dashboard banners:** Show contextually based on plans + profile completeness + role
- **Invite form:** Toast notifications for success/error messages
- **Subscription tier fix:** `maxLinkedAccounts` derived from plan name when DB `features` JSONB is missing the field

### Mobile responsive design

**Breakpoints (Tailwind defaults):**

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | <640px (`sm`) | Single-column; accordion planner; slide-over panels |
| Tablet | 640–1024px (`md`/`lg`) | 2-column planner (Sem 1 \| Sem 2); stacked grade years |
| Desktop | >1024px (`lg`/`xl`) | Full 4×2 grid; side panels; multi-pane dashboard |

**Planner grid responsive behavior:**

```
Desktop (>1024px):
┌──────────────────────────────────────┐
│        Semester 1    │  Semester 2    │
│ Grade 9:  [courses]  │  [courses]     │
│ Grade 10: [courses]  │  [courses]     │
│ Grade 11: [courses]  │  [courses]     │
│ Grade 12: [courses]  │  [courses]     │
└──────────────────────────────────────┘

Mobile (<640px):
┌──────────────────┐
│ ▼ Grade 9        │  ← collapsible accordion
│   Semester 1     │
│   [course card]  │
│   [course card]  │
│   Semester 2     │
│   [course card]  │
│ ▶ Grade 10       │  ← collapsed by default (expand current grade)
│ ▶ Grade 11       │
│ ▶ Grade 12       │
└──────────────────┘
```

**Mobile-specific behaviors:**

- Course browser opens as full-screen slide-over (not modal overlay) with sticky search bar
- Dashboard uses single-column card stack of all 6 cards (desktop uses 3-row, 2-column grid: Active Plan/GPA, Attention Required/Achievements, Academic Progress/Quick Actions)
- Validation tooltips render as bottom sheets on mobile (not hover tooltips, which don't work on touch)
- Touch targets: minimum 44×44px for all interactive elements (WCAG 2.5.5)
- Drag-and-drop (Phase 3) supported on tablet via touch events; on mobile, use explicit "Move to..." action menu instead
- Share link and PDF export actions accessible via a floating action button (FAB) on mobile

**Testing:** Playwright E2E tests run against three viewport sizes (375px, 768px, 1280px). Mobile layout breakage fails the CI build.

---

## 21. Testing Strategy

### Python extractor (pytest)

- Unit tests per field parser function
- Integration test against full PDF — assert course count, field accuracy
- Regression snapshot: diff extracted JSON against previous run

### API layer (Vitest + supertest)

- Unit tests for GPA calculation logic (critical: wrong formula = loss of trust)
- Unit tests for alert threshold evaluation
- Integration test per endpoint
- Prerequisite DAG traversal tests using known chains from the Stevenson catalog

### Frontend (Vitest + Testing Library + Playwright)

- Component tests: GPA calculator, planner grid, requirement checklist
- E2E tests for critical flows:
  - Onboarding (enter prior grades, select template, create plan)
  - Add course to plan → prerequisite violation detected
  - Enter grade → GPA updates
  - Year-end transition workflow (grade locked after completion, lockedGradeLevels updated)
  - Grade-level locking: 409 on POST/DELETE/PATCH (non-waiver) for locked grades; GPA waiver toggle succeeds; lock/unlock via `POST /api/v1/plans/:id/lock-grade`
  - Upgrade flow (402 → checkout → plan unlocked)
  - Consent flow (signup checkbox, `/consent` interstitial, consent gate redirect)
  - Settings page (flat sections with 3x3 profile grid including state/school, linked accounts list, compact sections)
  - Linked accounts: counselor invite/join (canEdit: false), linked accounts tier limits (402 UPGRADE_REQUIRED), linked accounts UI with usage counter
  - Signup page (2-column grids, role selector cards, frozen state/school fields, school request form)
  - Legal pages (`/terms`, `/privacy` rendering)
  - Public homepage (`/`): hero rendering, stats bar, feature cards, FAQ accordion, CTA links, responsive layout
  - About page (`/about`): story, mission, Plan/Track/Connect cards, disclaimer rendering
  - Contact page (`/contact`): form submission, validation, feature flag gating
  - Public layout: navbar links, footer columns, social media icons, mobile hamburger menu
  - Feedback widget: floating button rendering, 5-star rating submission, comment field, page path capture, success animation
  - Testimonials: three placeholder testimonials visible on home page, star ratings displayed
  - Footer: feedback link points to /contact page
  - SEO: meta description, Open Graph tags on root layout
  - Guided tours: tour auto-start on first visit, tour button triggers, adaptive step counts, tour state persistence
  - UI components: Button, Badge, Card, Input, Checkbox, Toast component tests
  - Plan permissions: plan access gating for GPA/requirements APIs, invite shared_plans parameter
  - Signup roles: 4-role selector (Student/Parent/Guardian/Counselor), guardian-to-parent mapping; invite-driven signups override form role with `invite.targetRole`; stale invites return `INVITE_INVALID`; signup page pre-selects + locks role from `?role=` URL param
  - Member invite email lookup: case-insensitive (`lower(users.email)`) for already-linked and existing-user checks so mixed-case stored emails route to the correct invite-email template
  - Pending invites: `target_email` is stored lowercased on invite-create; `GET members` returns `{ members, pending_invites }` shape; per-invite `can_revoke` matches the member-removal rule (students any; others own only); revoke endpoint returns 404/409/403 for missing/already-claimed/forbidden invites and only deletes unclaimed rows
  - Counselor restrictions: cannot create/delete/share plans, billing hidden, "View" instead of "Edit"
  - Share modal: close (X) button, permission selection
  - Auth layout: logo links to home, footer "Home" link, sign out redirects to `/`

**Current test count: 63 test files** — 30 unit/API test files with 427 test cases (404 passing, 5 failing, 18 skipped), 33 E2E spec files. UI component test files: Button, Badge, Card, Input, Checkbox, Toast, plan-permissions. Additional test files: signup-roles, counselor-restrictions, share-modal, auth-layout. Tests for plan access gating (GPA/requirements APIs) and invite shared_plans parameter. E2E tests for homepage/about/contact, feedback widget, testimonials, consent/settings/legal pages, counselor invite/join, linked accounts UI, planner/progress/dashboard/transcript/billing/signup/auth/course-browser/grade-lock/plan-management/print-gating/accessibility. API tests for contact, feedback, consent, auth-me, accounts, counselor-join, GPA, grade-lock, health, plan-courses, plan-shares, plans, requirements, school-request. Unit tests for GPA calc, requirement matching, subscription middleware, undo stack, rate limiting.

### Test data

Seed script generates 5 student personas:

| Persona | Purpose |
|---|---|
| Freshman | Clean-slate onboarding; no prior grades |
| Sophomore mid-plan | Mixed completed/planned; GPA trending up |
| Senior at risk | Graduation credit gap; alerts active |
| High achiever | AP-heavy load; percentile stats applicable |
| Athlete w/ NCAA concerns | Specific course eligibility requirements |

Never use real student data in non-production environments.

### Deferred to Phase 3

| Feature | Notes |
|---|---|
| Template intensity levels | 5 levels (Easy/Moderate/Challenging/Intensive/Rigorous) auto-select CP/Accelerated/AP course variants and load per template. ~600 course placements across 6 templates × 5 levels. Requires substitution rules engine + prerequisite chain validation per level. |
| NCAA eligibility tracking | Complex sliding-scale rules. Schema supports via `requirementGroup: "ncaa"` and `isOptIn: true`. |
| Seal of Biliteracy | Requires exam score tracking (AAPPL, STAMP, AP language exams). |
| P.E. waiver rules | Per-semester logic with multiple waiver types (athletic Jr/Sr, Marching Band, academic Sr). Requires tracking athletic status and band membership. |

---

## 22. Deployment & Infrastructure

| Component | Platform | Notes |
|---|---|---|
| Source control | GitHub | PR-based workflow; branch protection on `main` |
| Next.js frontend + API routes | AWS Amplify | Managed Next.js SSR; preview deployments per PR; env vars pulled from AWS Secrets Manager |
| PostgreSQL + Auth | Supabase Pro | Enable PgBouncer (connection pooling); Supabase project in the closest AWS region |
| Redis | **Upstash** (early phase) | Serverless Redis; no VPC or NAT Gateway required; ~$0 at <50 users; 10,000 commands/day free tier |
| Redis (scale phase, ~500+ users) | AWS ElastiCache (`cache.t4g.micro`) | Migrate when fixed VPC costs (~$32/mo NAT Gateway or ~$14/mo VPC endpoints) are justified by traffic |
| BullMQ worker | AWS ECS Fargate | Persistent containerised Node.js process; Docker image in Amazon ECR; separate ECS service from Next.js. Single task at launch; scale to 2 tasks when average job queue latency exceeds 30s. ECS Service Auto Scaling based on `QueueLatency` CloudWatch custom metric is recommended at >200 users |
| Container registry | Amazon ECR | Stores worker Docker images; tagged by git SHA |
| Secrets management | AWS Secrets Manager | All production secrets (DB, Stripe, Anthropic, Resend keys); referenced by Amplify + ECS task definitions |
| PDF extractor | Local CLI / GitHub Actions | Runs once per year; no always-on infra |
| Email | Resend | SaaS |
| Error tracking | Sentry | Configured in both Next.js app and ECS Fargate worker |
| CI/CD | GitHub Actions → AWS | Test on PR; build + push ECR image + deploy to Amplify + ECS on merge to `main` |

### Environment strategy

| Environment | DB | Redis | Notes |
|---|---|---|---|
| `development` | Local Supabase (`supabase start`) | Local Redis (Docker) | No SQLite fallback — PostgreSQL UUIDs and constraints are incompatible |
| `staging` | Supabase (separate project) | Upstash (separate instance) | Seeded with anonymized test data; deploys via GitHub Actions on push to `staging` branch |
| `production` | Supabase Pro | Upstash → ElastiCache when scale justifies | PITR enabled; daily backups; secrets in AWS Secrets Manager |

### WAF

**WAF:** Deploy AWS WAF in front of the Amplify CloudFront distribution from Phase 2 onward. Configure rate-limiting rules (matching the API rate limits), geo-blocking if needed, and AWS Managed Rules for common web exploits. Estimated cost: ~$5/month at launch scale.

### Database Migration Strategy

- Migrations are generated by Drizzle Kit (`drizzle-kit generate`) and stored in `lib/db/migrations/`.
- CI/CD pipeline runs `drizzle-kit migrate` as a pre-deployment step before the app deployment.
- **Rollback:** Each migration has a corresponding down migration. Rollbacks are manual (`drizzle-kit rollback`) and require engineer approval.
- **Breaking changes:** Schema changes that break backward compatibility (column removal, type changes) must be deployed in two steps: (1) deploy code that handles both old and new schema, (2) run migration, (3) deploy code that assumes new schema only.
- **Connection:** Migrations run using the direct (non-pooled) connection string to avoid PgBouncer limitations with DDL statements.

### Backup strategy

- Supabase Pro: daily automated backups, 7-day retention; enable point-in-time recovery (PITR)
- `courses.json` artifacts exported to GitHub releases as secondary archive
- **Backup restore test (mandatory):** Verify a full restore from PITR backup at least once before public launch. Schedule quarterly restore tests thereafter. Document the restore procedure in a runbook.

---

## 23. Environment Configuration

```bash
# .env.local (never committed)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only; never exposed to client

# Database (Drizzle direct connection for migrations + worker)
DATABASE_URL=

# Redis (Upstash — early phase; swap for ElastiCache endpoint at scale)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...           # PostHog project API key (client-side)
POSTHOG_PERSONAL_API_KEY=phk_...          # PostHog personal API key (server-side, optional)

# App
NEXT_PUBLIC_APP_URL=              # used for share link generation
```

All production secrets managed in **AWS Secrets Manager**. AWS Amplify environment variables reference Secrets Manager ARNs at build/runtime. ECS Fargate task definitions reference the same secrets via the `secrets` field in the task definition. Never committed to git. GitHub Actions uses an IAM role with least-privilege permissions (OIDC federation — no long-lived AWS keys stored in GitHub Secrets).

---

## 24. Performance Considerations

| Concern | Mitigation |
|---|---|
| GPA recomputed on every page load | Redis cache (5-min TTL); invalidated on grade entry |
| Requirement progress expensive join | Redis cache (10-min TTL); recomputed in BullMQ job on plan save |
| Prerequisite recursive CTE on every plan load | Redis cache for course prereq chains (24-hr TTL, invalidated on catalog reload) |
| Alert evaluation in API request cycle | Never — always enqueued to BullMQ, evaluated async |
| Percentile stats live cross-student query | Never — pre-aggregated nightly into `grade_cohort_stats`; RLS cannot allow live cross-student queries |
| Planner grid loading many courses | `idx_plan_courses_plan_id` index; load once per plan, cache in Zustand state |

> **Planner grid sort order (implemented):** Courses in the planner grid are sorted by division: Early Bird (period 0) → Communication Arts → Mathematics → Science → Multilingual Learning → Electives (Applied Arts, CS/Engineering, Fine Arts, Social Studies) → Physical Welfare.
| Supabase serverless connection limits | PgBouncer connection pooling enabled on Supabase Pro |

---

## 25. Observability & Monitoring

### Structured logging

All application logs use JSON format with consistent fields:

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  // NEVER log: raw grade data, passwords, tokens, PII
  redact: ['req.headers.authorization', 'grade', 'password', 'token'],
});
```

**Log levels:**
- `error` — unhandled exceptions, failed jobs, external service errors
- `warn` — AI hallucination mismatches, rate limit hits, cache misses on hot paths
- `info` — API requests (method, path, status, duration), job completions, webhook receipts
- `debug` — detailed query timing, cache operations (disabled in production)

### Log aggregation

- **Next.js app (AWS Amplify):** Logs stream to CloudWatch Logs automatically
- **BullMQ worker (ECS Fargate):** Logs stream to CloudWatch Logs via `awslogs` driver in ECS task definition
- **Log retention:** 30 days in CloudWatch; archive to S3 for longer retention if needed

### Operational monitoring

| Metric | Source | Alert threshold |
|---|---|---|
| API error rate (5xx) | Sentry + CloudWatch | >1% of requests in 5-min window |
| API P95 latency | Sentry Performance | >500ms for non-AI endpoints |
| BullMQ failed job queue depth | Custom CloudWatch metric from worker | >0 for >10 minutes |
| BullMQ job lag (oldest waiting job age) | Custom CloudWatch metric | >5 minutes |
| Redis connection failures | Application logs | Any occurrence |
| Stripe webhook processing failures | `stripe_events WHERE processed = FALSE AND received_at < NOW() - INTERVAL '1 hour'` | Any row |
| Supabase connection pool utilization | Supabase dashboard | >80% |
| ECS Fargate task health | ECS service health checks | Task restart count >2 in 10 min |

### Uptime monitoring

Use an external uptime service (e.g., Better Uptime free tier or AWS Route 53 health checks) to ping `/api/v1/health` every 60 seconds. The health endpoint checks:
- Database connectivity (lightweight `SELECT 1`)
- Redis connectivity (`PING`)
- Returns `200 OK` with `{ "status": "healthy", "version": "<git-sha>" }`

---

## 26. Resilience & Graceful Degradation

External dependencies will fail. The system must degrade gracefully, not crash.

### Redis unavailable

| Component | Behavior when Redis is down |
|---|---|
| Subscription middleware | Fall back to direct DB query (slower but functional); log cache miss |
| GPA cache | Recompute from DB on every request; log cache miss |
| Rate limiting | Bypass rate limits (fail-open); log the bypass |
| BullMQ job queue | **Critical failure** — jobs cannot be enqueued. Return `503 Service Unavailable` for async operations (alert evaluation, GPA recompute). Synchronous operations (plan reads, grade reads) continue normally. |

> **Performance fix (implemented):** Rate limiter (`lib/api/rate-limit.ts`) and subscription middleware (`lib/subscription/middleware.ts`) now short-circuit when Redis is not configured (no `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` in env). Redis availability is cached with a 60s retry interval after failure, preventing repeated timeout delays on requests. This reduced the courses API response time from ~4.8s to ~50ms in environments without Redis.

**Detection:** The health endpoint includes a Redis `PING` check. If Redis is unreachable for >5 minutes, trigger a PagerDuty/email alert.

### Claude API unavailable

| Feature | Behavior |
|---|---|
| Career recommendations (`/api/v1/suggestions`) | Return only rule-based suggestions (graduation gap filler); omit AI suggestions with a notice: "AI suggestions are temporarily unavailable" |
| Plan review (`/api/v1/ai/plan-review`) | Return `503` with `{ "error": { "code": "AI_UNAVAILABLE", "message": "AI plan review is temporarily unavailable. Please try again later." } }` |
| Chat (`/api/v1/ai/chat`) | Same `503` pattern |

**Timeout:** All Claude API calls have a **30-second timeout**. On timeout, treat as unavailable (same fallback behavior).

### Supabase Realtime disconnects

The Supabase client SDK automatically reconnects on disconnect. Add:
- A visual indicator in the notification center when the real-time connection is lost: "Live updates paused — reconnecting..."
- A manual refresh button as fallback
- Client-side polling fallback (every 30s) if Realtime has been disconnected for >60 seconds

### Stripe webhooks delayed

The nightly reconciliation job already handles this. Additionally:
- Add a "Sync subscription" button in Settings that triggers an on-demand Stripe status check
- If `subscriptions.status` diverges from Stripe's state, self-heal and log the discrepancy

---

## 27. Data Seeding Strategy

### Seed data format

All seed data is stored as TypeScript files in `config/seeds/` and loaded via a Drizzle seed script (`npm run db:seed`).

```
config/seeds/
├── subscription-plans.ts     # 4 tier definitions
├── plan-templates.ts         # 6 starter plan templates (College Prep, STEM, Pre-Med, CS, Humanities, Business)
├── career-paths.ts           # Career tracks + course mappings
├── graduation-requirements.ts # 37 requirements across 4 groups (graduation, course_load, il_public_university, non_course)
└── divisions-departments.ts  # Subject area hierarchy
```

### Seed script behavior

```typescript
// scripts/seed.ts
// Idempotent: uses INSERT ... ON CONFLICT DO UPDATE for all seed data
// Safe to re-run on existing data without duplicating rows
// Environment-aware: test personas only seeded in development/staging
```

> **Plan templates (Phase 1b):** All 6 templates use the standard math progression: Algebra 1 (Gr 9) then Geometry (Gr 10) then Algebra 2 (Gr 11) then Precalculus or AP Calculus (Gr 12). U.S. History is placed in Grade 11 and Government in Grade 12, matching grade eligibility. Templates are seeded with split full-year rows (two `plan_courses` per full-year course) to support independent per-semester status and grade tracking. All 6 templates pass validation with zero violations. Fixes applied: Driver Education added to Grade 10, correct grade-level placements (U.S. History Gr 11, Government Gr 12, Health Gr 10 only), Applied Health moved after Health prerequisite (Pre-Med), Economics added to STEM/CS, electives added for Grade 10 underloads, PW coverage via Choice PE for Gr 11/12. Reset to Template uses `pc.semester` and `pc.gradeLevel` from actual course data (not group key), adds `skip_validation: true` for template reset, and logs failures.

### Environment-specific seeding

| Environment | Seeds loaded |
|---|---|
| `development` | All seeds + 5 test personas (with synthetic grade histories) |
| `staging` | All seeds + 5 test personas (anonymized) |
| `production` | Core seeds only (subscription plans, templates, career paths, requirements). No test personas. |

### Test personas (dev/staging only)

| Persona | Data |
|---|---|
| Freshman (clean slate) | No prior grades; 1 plan from template |
| Sophomore mid-plan | 1 year of grades; active plan with mixed completed/planned |
| Senior at risk | 3 years of grades; graduation credit gap; active alerts |
| High achiever | AP-heavy; high GPA; percentile stats applicable |
| Athlete (NCAA) | Specific eligibility-relevant courses |

Seed data is version-controlled and reviewed in PRs alongside schema changes.

---

## 28. Analytics & Event Tracking

### Provider: PostHog

PostHog (cloud or self-hosted) tracks product usage events needed for the success metrics defined in the PRD. Generous free tier (1M events/month). GDPR-friendly with EU hosting option.

### Key events tracked

| Event | Properties | Used for |
|---|---|---|
| `signup_completed` | `role`, `grade_level`, `template_selected` | Acquisition metrics |
| `onboarding_step_completed` | `step_number`, `step_name`, `skipped` | Activation metrics |
| `plan_created` | `from_template`, `template_id` | Activation |
| `course_added_to_plan` | `course_id`, `grade_level`, `plan_id` | Engagement |
| `grade_entered` | `semester`, `academic_year` | Engagement |
| `alert_viewed` | `alert_type`, `severity` | Engagement — alert open rate |
| `alert_dismissed` | `alert_type`, `time_since_triggered` | Product quality — alert accuracy |
| `feature_gate_hit` | `feature`, `current_tier`, `minimum_tier` | Conversion — which features drive upgrades |
| `upgrade_modal_opened` | `trigger_feature`, `current_tier` | Conversion |
| `checkout_started` | `target_tier`, `billing_cycle` | Conversion |
| `subscription_activated` | `tier`, `billing_cycle`, `days_since_trial_start` | Conversion |
| `year_end_wizard_completed` | `grade_level` | Engagement — year-end completion |
| `ai_suggestion_requested` | `feature` (chat/review/career) | AI usage |
| `plan_exported` | `format` (pdf/share_link) | Retention proxy |

### Privacy

- PostHog is configured to **not** record: grade values, GPA numbers, course names, or any academic data
- Only track behavioral events (what action, when, which feature) — never content
- Respect user's Do Not Track (DNT) header
- PostHog cookie banner shown on first visit (required for GDPR if EU users)

---

## 29. Data Privacy & Compliance

### Current scope (personal/family tool)

- Not subject to FERPA (no school system integration)
- All data encrypted at rest (Supabase managed) and in transit (TLS 1.3)
- No sale of user data
- Grades and academic data are personal data — never logged in application logs

### COPPA

`users.date_of_birth` captured at signup. If `date_of_birth > NOW() - INTERVAL '13 years'`, block registration until a parent-verified consent flow is in place. Implement before public launch.

### GDPR

If EU users register:
- Consent on signup
- Right to erasure: `DELETE FROM users WHERE id = :userId` (cascades via FK to all user data)
- Data portability: `/api/v1/export/my-data` → full JSON export of all user rows
- EU-region Supabase instance may be required

### Data retention

| State | Retention |
|---|---|
| Active account | Indefinitely |
| Deleted account | All personal data purged within 30 days |
| Graduated student | Read-only archive indefinitely (unless user requests deletion) |
| `account_events` | Never deleted (compliance audit trail) |
| `stripe_events` | 90-day active retention; archive/purge after reconciliation confirmed |
| Anonymized aggregates (`grade_cohort_stats`) | Retained for product analytics (no PII) |

### If school officially adopts the tool

FERPA applies immediately. Before storing any school-transmitted data:
- Legal review required
- Formal data-sharing agreement with District 125
- Parent/guardian consent flows required for students under 18

---

*References: FEATURE_ANALYSIS.md (rev 13, 2026-04-07)*
