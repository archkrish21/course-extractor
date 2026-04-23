# Student Academic Planning System (SAPS)
## Executive Summary

**Prepared for:** Executive Leadership
**Date:** April 2026
**Status:** Phase 3 In Progress — Active Development

---

## The Opportunity

High school students and their families face a complex, high-stakes planning problem with inadequate tools. A four-year course sequence at a large school like Stevenson High School involves hundreds of course options, multi-level prerequisite chains, graduation credit requirements, GPA targets, college admission goals, and annual catalog changes. Today, students manage this with spreadsheets, counselor meetings, and guesswork.

**SAPS replaces guesswork with a structured, intelligent planning platform** — giving students, parents, and counselors a shared, always-current view of where a student stands and what they should do next.

---

## What We Are Building

SAPS is a web-based SaaS platform with three integrated value pillars:

| Pillar | What It Does | Who Benefits |
|---|---|---|
| **Planning Engine** | 4-year course planner, prerequisite validation, graduation requirement checker, plan comparison | Students, Parents |
| **Tracking Engine** | Grade entry, GPA calculation (weighted + projected + what-if), credit tracking, dual college credit log | Students, Parents |
| **Advisory Engine** | AI-powered course recommendations, career path alignment, smart alerts, counselor access dashboard | Students, Counselors |

All three pillars are powered by a structured course catalog database, updated annually from the school's published PDF, and backed by curated career-path and graduation-requirement data.

---

## Target Users

| User | Role on Platform |
|---|---|
| **Students** | Primary users — create plans, track grades, receive AI guidance. Only students can set a plan as Primary/Active. |
| **Parents** | Can create accounts for their children OR join an existing student account. Can create and compare plans. Read-only for grades, GPA, and alerts. Cannot set Primary plan. |
| **Guardians** | Identical to parents in behavior (maps to "parent" in DB). Separate signup role for clarity. |
| **School Counselors** | View-only access to linked student accounts. Cannot create plans, delete plans, share plans, invite others, or access billing. See "View" instead of "Edit" on plans. Account switcher shows "Managing: Student Name · Gr X". Future: bulk alerts, counselor dashboard. |

The platform is designed as a **personal/family planning tool** — no school system integration is required at launch. This means no institutional procurement, no district IT approval, and no FERPA complexity in Phase 1.

---

## Subscription Model & Revenue

Every new user receives a **14-day free trial** (no credit card required) with Plus-level features except plan comparison, PDF export/print, and share links. Max 2 plans during trial. AI features are NOT included (Elite-only). New signups are assigned the Plus plan with `status = 'trialing'` for 14 days. At trial end, the account automatically moves to the free Starter tier unless the user upgrades. This prevents the "build-export-leave" pattern while demonstrating the product's value. The Accounts API returns "trial" as the plan name when `status = 'trialing'`, and the UI shows a "Trial" badge (amber) and "Free Trial" label on the billing page with a "X days left" countdown.

| Tier | Monthly | Annual (save 10%) | 4-Year (save 17%) | Key Capabilities |
|---|---|---|---|---|
| **Starter** | Free | — | — | 1 plan, course browser, requirement validation, GPA tracking |
| **Plus** | $9.99/mo | $107.88/yr ($8.99/mo) | $399 ($8.31/mo) | 10 plans, what-if GPA, plan comparison, PDF export/print, share links, goal tracking, full alerts, dual credit, parent plan drafts |
| **Elite** | $19.99/mo | $215.88/yr ($17.99/mo) | $799 ($16.65/mo) | Everything in Plus + AI course suggestions, AI plan review, AI chat, percentile comparison, course rigor scoring, unlimited plans |

**Key monetization principles:**
- 3 tiers (Starter/Plus/Elite) — Pro tier eliminated. Plus absorbs non-AI features at an accessible price; Elite is the premium AI-powered tier.
- 3 billing intervals: monthly, annual (10% discount), and **4-year** (17% discount). The 4-year plan matches the product's natural lifecycle — students plan all 4 years of high school.
- Starter is genuinely useful — core planning is free, not crippled. This drives adoption.
- Upgrades are prompted in-context when a student hits a plan limit or tries a gated feature.
- A student's subscription covers their linked accounts (parents, guardians, counselors) — no separate subscription required. The subscription is per student account (not per person). Linked accounts are always free. Any account member can be the billing contact. Parents with multiple children see an account switcher — each child's account has its own subscription tier. Linked account limits per tier: Starter/Trial 3, Plus 5, Elite 8. Counselors join with view-only access (canEdit: false) and cannot invite others. Counselors cannot create plans, delete plans, share plans, or access billing. Settings page hides subscription/billing for counselors and shows a separate "Student Information" section for non-student roles.
- Downgrading never deletes data. Excess plans become read-only archives; all history and grades are preserved.
- Parent plan draft creation requires Plus or Elite — parents on Starter accounts cannot create draft plans in their child's account.

**Payment infrastructure:** Stripe handles billing, subscription lifecycle, and failure recovery. A 5-day grace period applies before a lapsed payment results in account restrictions.

---

## Product Differentiation

### Why students will choose SAPS over alternatives:

1. **Prerequisite intelligence.** The platform understands multi-level course chains (e.g., removing Algebra 2 in grade 9 automatically flags AP Calculus BC in grade 11 as at-risk). No other consumer tool does this.

2. **Dual credit tracking.** Several Stevenson courses earn transferable college credits through Harper College. SAPS surfaces these prominently in planning and AI recommendations — a concrete financial value for families.

3. **AI-powered career alignment.** Unlike generic planners, course suggestions are grounded in a curated career-to-course database and validated against the live course catalog before display. AI hallucinations are filtered out — students only see real courses.

4. **Whole-family visibility.** Parents receive the same plan and GPA visibility as students, with configurable notifications. This reduces the "I don't know what my kid is taking" problem.

5. **Year-end workflow.** A structured year-end wizard locks the entire completed grade level in the planner, advances the student's grade level, and prompts a plan review. Locked grades prevent all course modifications (add/remove/status/grade changes) except GPA waiver toggles. Without this, planning tools become stale and abandoned.

---

## Phased Delivery Plan

The build is structured across five phases over approximately 18+ weeks. Phase 1 is split into two sub-phases (1a + 1b) to create an earlier internal validation milestone.

| Phase | Focus | Duration | Key Deliverables |
|---|---|---|---|
| **1a** | Data Foundation + Auth | Weeks 1–3 | ✅ Complete — PDF extractor, course catalog database, user auth, course browser, analytics integration |
| **1b** | Core Planning + Onboarding | Weeks 4–6 | ✅ Complete — 4-year planner grid (keyboard-accessible, mobile-responsive), course picker, prerequisite validation, enrollment rules, 6 plan templates, plan creation/deletion, per-semester status/grade editing, GPA calculation, semester course limits, credit display, core course removal warnings |
| **2** | Grade Tracking + GPA + Billing | Weeks 7–10 | ✅ Complete — Transcript page (read-only, print button), GPA API (from plan_courses), graduation requirements with matching rules expanded to 4 requirement groups (graduation, il_public_university, non_course, course_load — 37 total requirements), Academic Progress page (`/progress`, two-column layout with filter bar + grouped sections + sticky sidebar with honors badge + summary card), dashboard (3-row 2-column grid: Active Plan/GPA, Attention Required/Achievements, Academic Progress/Quick Actions), planner validation side panel (380px, sticky, scrollable, with clickable warning links), plan selection persistence, Stripe integration (Checkout, Webhook, Billing Portal), subscription enforcement with 8 feature flags, billing page at `/settings/billing` |
| **3** | Plan Tools + Alert Engine | Weeks 11–14 | **In progress.** ✅ Plan management page (`/plans` — "My Plans" / "Shared with Me" tabs, plan cards with status/permission badges, hide/show toggle, share with linked account members via per-plan permissions using `plan_shares` table (owner/view/edit/delete + isHidden), `getPlanAccess()` enforced on all mutation endpoints, auto-create owner share on plan creation, backward-compatible fallback to `account_members.canEdit`, migration script for existing plans, 14 API + 15 E2E tests). ✅ Trial tier display (Accounts API returns "trial" when trialing; TierBadge shows amber "Trial"; billing page shows "Free Trial" with days-left badge; pricing cards suppress "Current Plan" for trialing users; billing card buttons aligned with flex layout). ✅ Signup trial changed from Elite to Plus plan with trialing status. ✅ Parent user menu shows parent's own name/email in avatar with "Managing: StudentName · Gr X" subtitle; "Add Another Child" removed from dropdown. ✅ Child invite flow from Settings: parent invites child via email; if student has existing account, parent joins it; if not, new account created with both members; active account auto-switches to joined account. ✅ Dashboard/Progress empty states: Attention Required and Academic Progress cards show "Create a plan" messages when no primary plan exists; Progress page shows "No active plan yet" empty state. ✅ Plan delete updated to use `getPlanAccess()` permissions (owner/delete only, no student role override); delete button on planner and manage plans pages, disabled for primary plans with tooltip. ✅ Create Plan modal extracted into reusable `renderNewPlanModal()` function for both empty state and normal planner views; single "Create Your First Plan" button replaces duplicates. ✅ `GET /api/v1/auth/me` endpoint returning user email, role, first_name, last_name, and tourState; `PATCH /api/v1/auth/me` accepts first_name/last_name/tourState updates. ✅ First name / last name on users: `firstName` and `lastName` columns added to users table; signup sets firstName from email prefix; layout displays full name instead of email prefix; linked account members show full names. ✅ Account editing: `PATCH /api/v1/accounts/:id` endpoint for updating student_name; Settings Account card has 2-column stacked layout (Name/Email/Password | Role/Grade Level/Graduation Year). ✅ Linked account member removal: any member can remove other members (not just non-students); API updated to allow student removal by non-student members; remove button shows for all members except self. ✅ Settings UI improvements: collapsible cards (Account open by default), merged Linked Accounts + Invite into one card, 2-column Account layout with stacked label/value fields, password show/hide toggle on all password inputs, inline name editing. ✅ State and school on accounts: `state` and `schoolName` columns added to accounts table. Signup captures state (frozen to IL) and school (frozen to Stevenson). Displayed read-only in Settings profile grid. Stored for future multi-school expansion. ✅ Signup page redesign: wider layout (max-w-lg), 2-column grids for credentials and personal info. Role selector with description cards (Student/Parent/Guardian/Counselor — 4 roles). Guardian maps to "parent" in DB for identical behavior. Frozen state/school fields with "Request yours" link. Removed "Claim your account" link. ✅ School request system: `POST /api/v1/school-request` endpoint (no auth required), `school_requests` table for future outreach. ✅ Settings redesign: flat sections with uppercase headers (no collapsible cards), 3x3 profile grid (Name/Email/Password/Role/Grade/Graduation/State/School), clean linked accounts list (renamed from "Family Members"), compact subscription/legal/danger zone sections. ✅ Linked Accounts (renamed from Family Members): students can invite Parent/Guardian/Counselor; parents can invite Child/Parent/Guardian/Counselor; counselors cannot invite anyone (view-only, canEdit: false, invite form hidden). Linked accounts tier limits: Starter/Trial 3, Plus 5, Elite 8 — enforced in invite API (402 UPGRADE_REQUIRED), usage counter shown in Settings ("2/5 linked accounts used"), `maxLinkedAccounts` added to SubscriptionContext and tier config. Counselor role: joins with canEdit: false (view-only), can view plans/progress/grades but cannot modify, cannot invite others; future: will be able to add comments/suggestions on shared plans. Billing pricing cards updated to show linked accounts per tier and PDF/print for Plus. 4-year subscription display shows "Expires" instead of "Renews" since it is a one-time payment. ✅ Consent system: `legal_documents` + `consent_records` tables, `/terms` and `/privacy` pages, `/consent` interstitial, consent gate in app layout, signup checkbox, OAuth redirect to consent, account deletion with full cleanup (Stripe, Supabase, Redis, PostHog). ✅ Public homepage (`/`): hero section with gradient text, animated stats bar, animated trial badge, "Why SAPS?" problem section, 5 feature cards with unique color accents, 3-step timeline how-it-works, FAQ accordion, final CTA. Feature-flagged pricing section (dormant for v1 via `config/homepage.ts`: `showPricing: false`). Testimonials section dormant (`showTestimonials: false` — no real testimonials yet). ✅ Public layout: sticky navbar with glass blur effect, logo, nav links (About, FAQ), Sign in and Get Started Free CTA buttons, mobile hamburger menu. Footer with Product/Legal/Connect columns, social media icons (Instagram, Facebook, Twitter, LinkedIn), feedback link (points to /contact page instead of mailto), school request link, copyright with disclaimer. ✅ About page (`/about`): story, mission, what-we-do section (Plan/Track/Connect cards), looking-ahead section, disclaimer. ✅ Contact page (`/contact`): form with name/email/subject/message fields, stored in `contact_messages` table via `POST /api/v1/contact` (no auth required). Route sends notification email to `planwithgenie@gmail.com` via Resend with reply-to sender. Enabled in nav + footer. ✅ SEO: meta description, keywords, Open Graph tags on root layout. ✅ Plan sharing on invite: students can select which plans to share (with view/edit permission) when inviting linked accounts. DB migration added `shared_plans` JSONB column to `account_invite_codes`. Join endpoint creates `plan_shares` rows when invite is claimed. GPA and Requirements APIs gated behind plan access (return empty data if user has no `plan_shares`). ✅ Guardian role added to signup (maps to "parent" in DB for identical behavior). 4 signup roles: Student, Parent, Guardian, Counselor. ✅ Non-student roles skip onboarding and go directly to dashboard. Onboarding shows welcome banner ("Account created successfully!") with auto-dismiss. "Skip setup" link on onboarding page. Smart routing after onboarding: dashboard if plans exist, planner otherwise. ✅ Counselor restrictions: cannot create plans, delete plans, share plans, invite others, or access billing. Counselors see "View" instead of "Edit" on plans, "No Plans Shared Yet" empty states. Counselor account switcher shows "Managing: Student Name · Gr X". Settings page hides subscription/billing for counselors, shows separate "Student Information" section for non-student roles. ✅ Sign out redirects to home page (/) instead of login. Auth layout: SAPS logo links to home, "Home" link added to footer. Terms/Privacy back button: closes tab if opened via target="_blank", falls back to browser history; back button moved to bottom of Terms/Privacy pages. Share modal: close (X) button added to header. Dashboard banner logic: shows contextually based on plans + profile completeness + role. Invite form shows toast for success/error messages. Subscription tier fix: maxLinkedAccounts derived from plan name when DB features JSONB missing the field. ✅ UI orchestration (design system sweep): complete visual consistency across all 22 pages. Standardized page headers, Card/Button/Badge/Input component usage. Loading skeletons, empty states, and error states on all pages. Responsive grids (1-col mobile, 2/3-col desktop). Focus rings, 44px touch targets, ARIA attributes throughout. Print styles in globals.css. Hardcoded colors replaced with design tokens. UI orchestration plan (`ui_orchestration_plan.md`) created as reusable playbook. ✅ 433 total tests (up from 272 at start of session, 659 previous peak — test count reflects consolidation and new focused test files). 7 new UI component test files (Button, Badge, Card, Input, Checkbox, Toast, plan-permissions). New test files: signup-roles, counselor-restrictions, share-modal, auth-layout. Tests for plan access gating (GPA/requirements APIs) and invite shared_plans parameter. Remaining: plan history/undo, prerequisite graph visualization, dual credit tracking, plan comparison, PDF export, share links, template intensity levels (Easy/Moderate/Challenging/Intensive/Rigorous — auto-selects CP/Accelerated/AP course variants and load per template), goal setting (GPA targets, credit milestones, course goals — Plus+ gated), user profile (move settings into profile dropdown from top-right user icon), NCAA eligibility tracking, Seal of Biliteracy, P.E. waiver rules |
| **4** | AI Advisory | Weeks 15–17 | Claude AI integration, career-path course recommendations, AI plan review, AI chat interface |
| **5** | Annual Workflow + Counselor + Polish | Week 18+ | Admin catalog update UI, counselor dashboard, parent dashboard, percentile comparison (Elite), WCAG AAA audit + edge-case accessibility fixes |

**Internal milestone after Phase 1a (Week 3):** ✅ Complete. Course catalog in DB, auth functional, course browser usable.

**Internal milestone after Phase 1b (Week 6):** ✅ Complete. 4-year planner grid, course picker, prerequisite validation, 6 plan templates, GPA calculation, per-semester status/grade editing, credit display, plan management (create/delete/clear). Add to Plan from course detail modal. Auth guard on all app pages. Bulk status/grade update per semester. Credit calculation fixed for full-year courses. Plan print/export view (browser print dialog with clean landscape layout).

**User testing checkpoint (before Phase 2):** 3–5 real students will validate the core planning UX before Phase 2 begins. Phase 2 scope will be adjusted based on findings.

---

## Technology Choices

The stack is selected for speed of development, managed infrastructure (minimal DevOps overhead), and long-term maintainability.

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 16 + shadcn/ui + Tailwind CSS v4 | Modern React framework; accessible components; Tailwind v4 with @theme CSS variables for design tokens |
| Database | PostgreSQL via Supabase | Managed service; row-level security enforces data isolation; no additional auth service needed |
| AI | Claude API (Anthropic) | Best reasoning quality; structured tool use to validate AI suggestions against real course data |
| Background jobs | BullMQ | Handles alert evaluation, GPA recalculation, nightly cron jobs — offloaded from the API request cycle |
| Email | Resend | Developer-friendly; React Email templates; no mail server to manage |
| Hosting | AWS Amplify + AWS ECS Fargate | Next.js app on Amplify; background worker as a persistent Fargate task |
| Source control | GitHub | All code versioned in GitHub; PR-based workflow |
| CI/CD | GitHub Actions → AWS | Tests on every PR; deploy to Amplify + ECS on merge to `main` |

**Monthly infrastructure cost estimate — early launch (10–50 users):**

| Service | Cost | Notes |
|---|---|---|
| Supabase | **$0** (Free) or $25 (Pro) | Free tier is sufficient at this scale; upgrade to Pro to remove the 7-day inactivity pause |
| AWS Amplify | **~$0–2/mo** | 1,000 free build minutes/mo; bandwidth ~$0.15/GB (negligible at <50 users) |
| AWS ECS Fargate (BullMQ worker) | **~$9/mo** | 0.25 vCPU + 0.5 GB, 24/7 = ~$8.89/mo — non-negotiable for persistent job queue |
| Redis — **Upstash** (replaces ElastiCache) | **~$0/mo** | 10,000 commands/day free; serverless; no VPC or NAT Gateway needed |
| AWS Secrets Manager | **~$2/mo** | ~$0.40/secret/month for ~5 secrets |
| Amazon ECR | **~$0/mo** | $0.10/GB/month; negligible for a single Docker image |
| Resend | **$0** | 3,000 emails/mo free |
| Sentry | **$0** | Free tier |
| GitHub | **$0** | Free tier covers private repos + 2,000 CI/CD minutes/mo |

**Total: ~$11–38/month** depending on whether Supabase Free or Pro is chosen.

> **Why not ElastiCache yet?** AWS ElastiCache runs inside a VPC. Reaching it from AWS Amplify Lambda functions requires a NAT Gateway (~$32/mo) or VPC endpoints (~$7–14/mo) — costs that exceed the rest of the stack at <50 users. **Use Upstash** (serverless Redis, no VPC needed) for the early phase. Migrate to ElastiCache once the user base exceeds ~500 active users and the fixed VPC cost is justified.

**Cost projections at scale:**

| Scale | Supabase | AWS Amplify | ECS Fargate | Redis | Claude API | Resend | Total/mo |
|---|---|---|---|---|---|---|---|
| **10–50 users** | $0–25 | ~$2 | ~$9 | ~$0 (Upstash free) | ~$5–15 | $0 | **~$16–51** |
| **200 users** (Month 6 target) | $25 | ~$5 | ~$9 | ~$0 (Upstash free) | ~$30–60 | $0 | **~$69–99** |
| **500 users** (ElastiCache trigger) | $25 | ~$10 | ~$18 (0.5 vCPU) | ~$46 (ElastiCache + NAT) | ~$75–150 | ~$20 | **~$194–269** |
| **1,000 users** | $25 | ~$20 | ~$36 (1 vCPU) | ~$46 | ~$150–300 | ~$40 | **~$317–467** |

> **Claude API cost estimate:** Assumes ~30% of users are on Elite (AI-eligible). Average 3 AI requests/user/day at ~5K input tokens + ~1K output tokens per request. At claude-sonnet-4-6 pricing ($3/M input, $15/M output): ~$0.03/request × 3 requests × 60–300 active AI users × 30 days = $5–$270/month depending on scale. **Monitor input token counts per request from Phase 4 onward.** Cost can be reduced by caching common AI responses (e.g., career recommendations for the same career path + grade level combo).

---

## Key Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GPA weight table is incorrect | Medium | High — users distrust the tool | Obtain official weights from school before any GPA code is written; display source; make configurable |
| AI recommends courses that don't exist | Medium | High — destroys trust in AI features | Every AI suggestion validated against the live course database before display; mismatches logged and suppressed |
| Onboarding friction for existing students | High | High — non-freshman students need to enter 1–3 years of prior grades | Bulk grade entry table at onboarding (not one-by-one); skip-and-complete-later option |
| Alert engine performance at scale | Medium | Medium | Alerts run in background jobs, never in API request cycle; no performance impact on page load |
| Scope creep in Phase 1 | High | Schedule risk | Phase 1 is strictly MVP: planner grid + prerequisite validation only; drag-and-drop and DAG view deferred to Phase 3 |
| Pricing perceived as unfair for students | Medium | Adoption risk | Starter tier is genuinely functional; consider annual student discount once school partnerships form |
| AI recommendations bypass counselor judgment | Medium | Liability risk | Every AI response includes a prominent disclaimer: "Suggestions only — confirm all course decisions with your school counselor" |
| Account frozen during critical registration period | Low | High UX risk | 3-day warning banner before grace period expires; two email reminders before freeze; never freeze without prior notice |

---

## Compliance Considerations

**Current scope (personal/family tool — no school system integration):**
- Not subject to FERPA. No connection to school systems or official records.
- Standard data privacy: all data encrypted at rest and in transit; no sale of user data.
- **Consent system implemented:** `legal_documents` + `consent_records` tables track versioned ToS/Privacy Policy acceptance with IP address and user agent. `/terms` (12 sections, Illinois governing law) and `/privacy` (11 sections, COPPA/FERPA/CCPA, essential cookies only) pages — both Version 1.0, effective April 6, 2026. `/consent` interstitial with consent gate in `(app)/layout.tsx` that blocks app access until current terms are accepted; shows "We've Updated Our Terms" header with change summary on version updates. Signup checkbox, OAuth redirect to consent. Account deletion with full cleanup (Stripe, Supabase, Redis, PostHog).
- Row-level security at the database layer ensures one student's data is never accessible to another student.

**COPPA:** Date-of-birth check at signup. Users under 13 are blocked pending a parent-verified consent flow. High school students are typically 14+, but 8th-grade early planners may be younger. When a parent creates an account on behalf of a student, the student's date of birth is required at account creation and the COPPA age check is enforced.

**If the school officially adopts the tool:**
- FERPA applies immediately. Requires formal data-sharing agreement with District 125.
- Parent/guardian consent flows required for students under 18.
- Legal review required before any school-transmitted data is stored.

**GDPR:** If European families use the platform, GDPR applies. Minimum requirements: consent on signup, right to erasure, and data export. EU-region database instance may be required.

**Data retention:**
- Active accounts: data retained indefinitely.
- Deleted accounts: all personal data purged within 30 days of deletion request.
- Graduated students: offered a permanent read-only archive mode; no auto-deletion without explicit user action.
- Anonymized aggregate data (no PII) may be retained for product analytics.

---

## Operational Policies

**Account lifecycle states:** `active → frozen → suspended → deactivated`.
- **Frozen:** read-only due to payment lapse (5-day grace expired); can export data, upgrade, or delete account.
- **Suspended:** admin-initiated hold (e.g., ToS violation investigation); same read-only access as frozen.
- **Deactivated:** user-initiated account deletion; 30-day purge window.

Frozen and suspended accounts are never silently degraded — users always see a clear, actionable explanation.

**Nightly automated jobs:**
- Detect graduated students → offer alumni/export/dismiss options
- Check trial expiry → downgrade to Starter
- Rebuild percentile statistics (Elite)
- Reconcile Stripe subscription status (self-heal missed webhooks)
- Reset year-end transition state (August 1 each year)

**Annual catalog update workflow:** Each year, an admin uploads the new course PDF. The system extracts the catalog, diffs against the prior year, and flags any planned courses that were renamed or removed. Affected students receive alerts with replacement suggestions before their plans break.

---

## What Is Needed Before Development Begins

| Item | Owner | Priority |
|---|---|---|
| ~~Official GPA weight table from Stevenson~~ | ~~Product / School contact~~ | ✅ Done — GPA weights implemented in `config/gpa-weights.ts` (CP +0.0, Accelerated +0.5, Honors +0.5, AP +1.0). Grade scale (A/B/C/D/F, no +/-) in `config/grade-scale.ts`. Values are configurable — confirm exact values with school before public launch. |
| ~~Exact subscription pricing~~ | ~~Business~~ | ✅ Done — 3 tiers finalized: Starter (free), Plus ($9.99/mo), Elite ($19.99/mo) with annual and 4-year billing |
| Career path initial data (Pre-Med, CS, Engineering, etc.) | Product | High — needed for Phase 4 AI features |
| ~~COPPA consent flow legal review~~ | ~~Legal~~ | ✅ Consent system implemented — `legal_documents` + `consent_records` tables, `/terms` + `/privacy` pages, `/consent` interstitial, consent gate in app layout, signup checkbox, OAuth redirect. Legal content review still needed before public launch. |
| Dual credit partner college course codes (Harper College, etc.) | Product | Medium — needed for Phase 3 |
| ~~Illinois state graduation requirements~~ | ~~Product~~ | ✅ Done — 37 requirements across 4 groups seeded (graduation, course_load, il_public_university, non_course). IL public university requirements are opt-in. |
| ~~Plan template content (track definitions)~~ | ~~Product / Counselor input~~ | ✅ Done — 6 templates seeded (College Prep, STEM, Pre-Med, CS, Humanities, Business/Economics). All pass validation with zero violations. |

---

## Recommended Next Steps

1. ~~**Confirm GPA weight table and grade scale**~~ — ✅ Done. Implemented in `config/gpa-weights.ts` and `config/grade-scale.ts`. Confirm exact values with school before public launch.
2. ~~**Finalize subscription pricing**~~ — ✅ Done. Stripe integration complete with 3 tiers, 3 billing intervals, and billing page at `/settings/billing`.
3. **Engage legal counsel** on COPPA date-of-birth gating and data retention policy before public launch.
4. **Identify 3–5 students** for user testing before Phase 4 begins.
5. **Complete remaining Phase 3 features**: plan history/undo, prerequisite graph visualization, dual credit tracking, plan comparison, PDF export, share links.
6. **Obtain dual credit partner college course codes** (Harper College, etc.) for dual credit tracking implementation.
7. **Curate career path initial data** (Pre-Med, CS, Engineering, etc.) for Phase 4 AI features.

---

## Current Development Status

**Phase 1a is complete.** The following deliverables have been built and are functional:

- **PDF Extractor** (Python/pdfplumber): Extracts 315 regular courses and 35+ summer courses from the Stevenson 2026-27 catalog PDF using a 3-phase pipeline (appendix name resolution, body extraction, name cleanup + prerequisite resolution). 331 prerequisite links resolved. 159 GPA waiver courses detected. Semester offering parsed per course: 89 Sem 1 only, 90 Sem 2 only, 136 full year, 6 Sem 1 exclusive, 6 Sem 2 exclusive, 168 available in both semesters. Structured prerequisite groups extracted with AND/OR semantics. Grade level parsing from above-lines for Early Bird courses. Manual grade overrides (AP Music Theory). Credit values corrected to 1 credit per semester / 2 per full year.
- **Database**: 37+ tables in PostgreSQL via Drizzle ORM on Supabase (local dev). All tables from the tech design doc are implemented including `plan_shares`, `plan_share_links`, `account_invite_codes`, `school_requests`, `contact_messages`, `feedback`, `legal_documents`, `consent_records`, and `account_events`. 9 migration files (0000–0008). `semesters_offered` integer array column added to courses table. `state` and `schoolName` columns on accounts table.
- **Auth**: Supabase Auth with email/password + Google OAuth, COPPA age check, 14-day Plus trial auto-activation (trialing status). New `GET /api/v1/auth/me` endpoint returns the logged-in user's email and role. Google OAuth callback auto-provisions first-time users (creates users, accounts, profiles, subscriptions) and redirects to onboarding. Signup page redesigned: wider layout (max-w-lg), 2-column grids, role selector with description cards, frozen state/school fields.
- **Course Browser**: Search, filter by division/department/credit type/grade level/AP/dual credit/GPA waiver/semester offered/duration, cursor-based pagination with total counts. Results sorted alphabetically by name then code. Semester info displayed on cards ("Sem 1 only", "Sem 2 only", "Sem 1 & 2", "Full Year"). GPA Waiver badge (yellow) on course cards.
- **Course Detail**: Centered modal (max-w-5xl) with 3-column info grid, badges in modal header. Prerequisites grouped by requirement_group with OR badges; semester pairs merged (e.g., "INTRODUCTION TO BUSINESS (BUS171 / BUS172)"). "What This Unlocks" also merges semester pairs. "Also available as" section showing clickable linked semester-partner courses. Division/Department names are clickable (sets filter and closes modal). Prerequisite and unlock course codes are clickable (navigates to that course). GPA waiver info, dual credit info.
- **Subscription Middleware**: Redis-cached tier lookup with fail-open.
- **API**: 22 resource groups under `/api/v1/` (accounts, ai, alerts, auth, catalog-versions, contact, courses, dual-credit, export, feedback, gpa, health, notifications, plans, requirements, school-request, stripe, subscriptions, suggestions, transcript, users, year-end) with 40+ endpoints total. Course list supports `semester_offered`, `semester_both`, and `duration` filter params; returns `semestersOffered` field; sorted by name then code with composite cursor encoding. Course detail returns `linkedCourses` array (semester partners).
- **Frontend**: Responsive horizontal top-nav layout, login/signup pages, course browser with 2-column grid, course detail modal, trial banner. Semester Offered radio filter (All/Sem 1/Sem 2/Sem 1 & 2/Full Year). Division filter values corrected to match actual Stevenson divisions.
- **Infrastructure**: Supabase local dev, Drizzle migrations, pino structured logging, PostHog analytics helpers, CSP headers, rate limiting.
- **Seed Data**: 3 subscription tiers (Starter/Plus/Elite), 15 divisions, 49 departments, 315 courses with prerequisites and semester offerings, 37 requirement definitions across 4 requirement groups, 6 plan templates, legal documents (ToS + Privacy Policy).

- **Account model redesigned:** introducing an `accounts` table that separates person identity (users) from academic data context (accounts). Parents can create accounts for children, create plans, and manage billing. Students claim accounts via invite codes. Subscription, authorization, and RLS all operate on account_id for a consistent access pattern.

**Summer semester support (Phase 3).** Summer courses are fully supported in the planner and grade tracking system. Two pre-summer sessions (Summer Session 1 = semester -2, Summer Session 2 = semester -1) are available before each grade level's regular semesters. A curated set of 52 summer course equivalency mappings (e.g., SOC13S ↔ SOC101) prevents duplicate enrollment and enables graduation requirement matching. Summer courses extracted via `extract_summer.py` and curated in `summer_courses_2026.py`. DB migration `0008_summer_semesters.sql` extends `plan_courses` and `grade_entries` semester constraints to allow -2 and -1 values. Print view displays summer courses with amber indicators.

**Phase 1b is complete.** The following deliverables have been built and are functional. Course detail modal accessible from planner and course picker. Redis performance fix (50ms response, down from 4.8s). Course loader uses UPSERT to preserve course IDs. All 6 templates pass validation with zero violations (Driver Education added to Grade 10, correct grade-level placements, Applied Health after Health prerequisite in Pre-Med, Economics added to STEM/CS, electives for Grade 10 underloads, PW coverage via Choice PE for Gr 11/12). Set Primary plan with merged active status (primary = active, non-primary = draft). Multi-select credit type and grade level filters. Semester partner exclusion in course picker. E2E test global teardown for automatic cleanup.

- **4-Year Planner Grid**: Collapsible grade rows with semester columns. Desktop grid layout with keyboard navigation (arrow keys, Enter/Space/Escape). Mobile accordion layout. Course cards sorted by division order within each semester cell (Early Bird, Language Arts, Math, Science, World Language, Social Studies, Electives, PE).
- **Course Picker**: Slide-over modal with search, filter chips for credit type (CP/Accelerated/Honors/AP/Dual Credit), division and department dropdowns, duration filter (Full Year/Semester), Early Bird toggle, GPA Waiver toggle. Already-added courses excluded from results.
- **Prerequisite Validation**: AND/OR group semantics enforced on course addition. Prerequisite must be in an earlier semester. Co-requisites must be in the same semester. Transitive downstream detection via recursive CTE for removal warnings.
- **Plan Templates**: 6 pre-seeded templates (College Prep, STEM Focus, Pre-Med Track, Computer Science Track, Humanities Focus, Business/Economics Track). Standard math progression: Algebra 1 (Gr 9) then Geometry (Gr 10) then Algebra 2 (Gr 11) then Precalculus or AP Calculus (Gr 12). U.S. History in Grade 11, Government in Grade 12. All 6 templates pass validation with zero violations. Fixes applied: Driver Education added to Grade 10, correct grade-level placements (U.S. History Gr 11, Government Gr 12, Health Gr 10 only), Applied Health moved after Health prerequisite (Pre-Med), Economics added to STEM/CS, electives added for Grade 10 underloads, PW coverage via Choice PE for Gr 11/12. Templates seeded with split full-year rows.
- **Plan Creation**: Modal with name input and template selection (Blank Plan or any of the 6 templates). `created_from_template_id` tracked. First plan auto-set as Primary.
- **Per-Semester Status and Grade Editing**: Status dropdown on each course card (Planned/Enrolled/Completed/Dropped). Grade selector with A+ through F options. Projected grade label ("Est.") for planned/enrolled courses; actual grade label for completed courses.
- **Full-Year Course Storage**: Full-year courses stored as two separate semester rows (semester 1 + semester 2) in `plan_courses` for independent status and grade tracking per semester. Removing from either semester removes both. Adding a full-year course creates both rows automatically.
- **GPA Calculation**: Implemented in `lib/gpa/calc.ts`. Projected weighted and actual weighted GPA displayed in grade headers and plan header. GPA waiver courses excluded. Pass/Fail and Incomplete grades excluded. P/F-only courses (regular PE courses PED121/122/451/452/111/112 and Driver Ed D/E231/232) are identified via `isPassFailCourse()` in `config/grade-scale.ts` and automatically excluded from GPA — their grade dropdown shows only P/F options (via `PASS_FAIL_OPTIONS`), and the GPA waiver toggle is hidden since they are already excluded. Health, Applied Health, Adventure Ed, Lifeguard, and Leadership PE courses still receive letter grades. The `CourseForGPA` interface includes an optional `code` field to support P/F-only exclusion. Full-year courses use half credit per row to avoid double-counting. Configurable weights from `config/gpa-weights.ts` (CP +0.0, Accelerated +0.5, Honors +0.5, AP +1.0). P/F-only courses display a grey "P/F" badge with tooltip "Pass/Fail course — excluded from GPA and academic course count" on their course cards.
- **Semester Course Limits**: Minimum 5, maximum 7 (or 8 with early bird). Count shown as X/7 in cell header. Add Course button disabled at max. The course load count excludes non-academic courses: Physical Welfare division, DNC-prefix (Dance), and D/E-prefix (Driver Ed) courses are not counted toward the 5-7 academic course limit, as they represent the "sixth supervised period".
- **Credit Display**: Planned and earned credits per grade and total in plan header. Stevenson uses 1 credit per semester course, 2 credits per full-year course, 45 credits required for graduation.
- **Plan Deletion**: Confirmation dialog for non-primary plans.
- **Clear Semester / Clear Grade**: Confirmation dialogs for clearing all courses in a semester or entire grade.
- **Core Course Removal Warning**: For template-based plans, removing a core course shows a warning with Reset to Template option. Reset uses `pc.semester` and `pc.gradeLevel` from actual course data (not group key), adds `skip_validation: true` for template reset, and logs failures.

**Phase 2 Grade Tracking + Billing (complete):** Transcript page (read-only view of completed courses from the primary plan with grades, semester GPA, grade-level GPA, and cumulative GPA — replaces the previously planned Grade Tracker; Print button with printer icon in header next to "Edit in Planner" button triggers `window.print()` for browser-native printing). GPA API calculates cumulative and projected GPA from `plan_courses` on the primary plan (not `grade_entries`). **Grade-level locking (F-PL-10):** completing a grade via the year-end wizard locks the entire grade level (`lockedGradeLevels` JSONB array on `four_year_plans`). Locked grades block all course modifications except GPA waiver toggles. Lock/unlock icons on grade bars; unlock requires confirmation dialog. "Current grade" is defined as the first unlocked grade level. New API endpoint `POST /api/v1/plans/:id/lock-grade`. Graduation requirements rewritten with matching rules — each requirement has a `matching_rule` JSONB column supporting 5 rule types: `code_prefix` (e.g., ENG courses), `codes` (specific course codes), `division` (all courses in a division), `multi_division` (multiple divisions), and `remainder` (catch-all for unclaimed courses). Requirements API enhanced with optional `?planId=` query parameter to validate any plan, not just the primary plan. All grade entry happens in the planner page via status dropdown + grade dropdown on each course card. **Auto GPA snapshot on year-end (US-24):** when the year-end wizard completes, a GPA snapshot with trigger `semester_end` is automatically created from completed `plan_courses`; non-fatal if snapshot creation fails. **GPA trend chart (US-23):** Recharts `LineChart` on the Progress page right sidebar showing unweighted (primary color) and weighted (success color) GPA over time; only renders when 2+ snapshots exist; fetches from `GET /api/v1/gpa/snapshots`.

- **Requirements system expanded** from 12 graduation-only requirements to **37 total requirements** across 4 requirement groups:
  - `graduation` — 12 course-match requirements (existing Stevenson graduation credit requirements, unchanged)
  - `course_load` — 16 per-semester requirements: 8 course count checks (Grades 9-12 x Sem 1-2, min 5 / max 7-8, counting academic courses only — PW division, DNC-prefix, D/E-prefix excluded) + 8 PW/Dance/DriverEd checks (each semester must have at least one Physical Welfare, Dance [DNC prefix], or Driver Education [D/E prefix] course)
  - `il_public_university` — 5 opt-in course-match requirements for Illinois public university admission (Science 6cr, Social Studies 6cr, Electives 4cr, English 8cr, Math 6cr)
  - `non_course` — 4 requirements: ACT (manual checkbox), FAFSA (manual checkbox), 46th Credit (auto-from-course), Civics & Patriotism (auto-from-course)
  - Note: `honors_status` was REMOVED from requirements — it is now an achievement badge computed from GPA, displayed in the Progress page sidebar and Dashboard Achievements card
- **Schema changes for requirements**: `graduation_requirements` table has `requirement_group`, `evaluation_type`, `display_order`, `is_opt_in` columns. `divisionId` is now nullable (non-course requirements have no division). New `student_requirement_status` table tracks manual checkbox state. New `student_requirement_opt_ins` table tracks opt-in group enablement. Four evaluation types: `course_match`, `manual_checkbox`, `auto_from_course`, `course_load_check`.
- **Requirements API changes**: `GET /api/v1/requirements` now returns a `groups[]` array alongside the existing flat `requirements[]` (backwards compatible). Each group has: group key, label, isOptIn, enabled, requirements[], and totals. Also returns `gpaWaiverWarnings[]` and `honorsStatus` (achievement, not requirement). New `PUT /api/v1/requirements/status` toggles manual checkbox requirements. New `PUT /api/v1/requirements/opt-in` enables/disables opt-in groups. Group order: graduation, course_load, il_public_university, non_course.
- **GPA waiver eligibility check**: API validates 4+ GPA-counted courses per semester when waiver is applied. P/F-only courses are now correctly excluded from the GPA-counted course count (previously PE courses were counted as GPA-eligible, which understated the issue).
- **Auto-refresh validation**: When the validation report side panel is open and the plan is updated, the requirements API is automatically called to refresh the validation data.
- **Progress page** (`/progress`) renamed to **"Academic Progress"** (page title; nav menu item label unchanged): Two-column layout — left (2/3) has status filter bar (All, Gap/Missing, In Progress, OK/Complete, Not Started) + Expand All/Collapse All buttons + requirement group sections; right (1/3) has sticky sidebar with honors badge and overall summary card showing three-state segmented progress bars per category (earned green, planned blue, remaining grey) with earned/planned/gap counts per category and three-state status labels: "Complete" (all earned), "On track" (earned+planned covers all), or "N gaps" (uncovered requirements). Course Load group has 2 collapsible sub-categories: "Course Count Per Semester" and "Physical Welfare / Dance / Driver Ed". Course-match cards show earned/planned/needed breakdown below progress bar. Grouped sections: Graduation, Semester Requirements (unified name for course_load), IL Public University (opt-in), Additional Requirements. Print button (printer icon) in header triggers `window.print()`.
- **Dashboard restructured**: 3-row, 2-column grid — Row 1 (Active Plan, GPA), Row 2 (Attention Required, Achievements), Row 3 (Academic Progress, Quick Actions). "Validation Report" card renamed to **"Attention Required"** with warning icon. Simplified layout: no category summary line or "Issues found" badge in header — shows only category titles with counts (Graduation Gaps, Semester Gaps, Prerequisite Violations) plus a "View Report" button that routes to `/planner?validation=open`. Honors badge removed from this card. New **"Academic Progress"** card shows all requirement groups (not just graduation) with per-group segmented progress bars showing earned/planned/remaining, replacing the old graduation-only credit progress and individual requirement list. New **"Achievements"** card with all badges (earned + unearned) in a single 2-column grid: Honor Graduate tier, Graduation Ready, Credit milestones (15/30/45), GPA milestones (3.0+/3.5+/4.0+), Credits Earned.
- **Validation categories** across planner and dashboard: Graduation Requirement Gaps (red, missing credits for diploma), Semester Requirement Gaps (amber, course load/PW-Dance/GPA waiver eligibility), Prerequisite Violations (amber, course ordering conflicts).
- **Navigation**: "Progress" nav item between Planner and Transcript (unchanged). Menu order: Dashboard, Courses, Planner, Progress, Transcript, Settings. Global "Tour" button in app header nav bar on every page.
- **Planner validation report** is now a **side panel** (380px, right side, sticky, scrollable): Frozen title "Validation Report". Collapsible summary: collapsed shows "Credits 48/45 | Reqs 11/12 | 1 gap | 15 warnings". Expanded summary has 3 groups: Credits (Total/Earned/Planned), Graduation Requirements (Met/In Progress/Gaps), Warnings (Semester/Prerequisite). 3 collapsible detail sections: Graduation Gaps (with credit progress bar inside), Semester Requirement Gaps, Prerequisite Violations. Warning messages use consistent "Gr X Sem Y:" prefix format as clickable links that navigate to the grade/semester in the planner grid. Clicking a link expands only that grade and highlights the target semester cell (blue ring, fades after 3s). Plan bar shows "Issues found" count covering graduation gaps, semester issues, and prerequisite violations only — non-course requirements (ACT, FAFSA) are excluded. Works with any selected plan (not just primary). Progress data auto-fetched on plan load and auto-refreshed when the plan is updated while the panel is open.
- **Plan selection persistence**: Selected plan in planner persisted via `sessionStorage` so navigating away and back retains the selection.
- **Planner auto-opens validation panel** when navigated with `?validation=open` URL parameter (used by Dashboard "View Report" button).

- **Stripe integration (Phase 2):** Stripe Checkout for payment (subscription mode for monthly/annual, payment mode for 4-year plans). Stripe Webhook handler processing 5 event types (`customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`), idempotent via `stripe_events` table with UNIQUE on `stripe_event_id`. Stripe Billing Portal for subscription management. Subscription middleware expanded with 8 feature flags (`canWhatIf`, `canExportPdf`, `canComparePlans`, `canSharePlans`, `canUseAi`, `canViewPercentile`, `canParentDraft`, `canCreateGoals`). Feature gating uses flag-based checks, not tier name lists. Pro tier backward compatibility: maps `pro` to `plus` in middleware. Billing page at `/settings/billing` with pricing cards and 3-interval toggle (monthly/annual/4-year). Schema: `priceFourYear` column on `subscription_plans`; `four_year` added to `billing_cycle` check constraint.
- **New files:** `lib/stripe/client.ts` (Stripe SDK singleton), `lib/stripe/prices.ts` (price ID mapping), `app/api/v1/stripe/checkout/route.ts`, `app/api/v1/stripe/webhook/route.ts`, `app/api/v1/stripe/portal/route.ts`, `app/api/v1/subscriptions/route.ts`, `app/(app)/settings/billing/page.tsx`, `lib/db/migrations/` (Drizzle migration for schema changes).

**Phase 3 (in progress).** Plan management with sharing and permissions is complete:

- **Plan Management page** (`/plans`): "My Plans" and "Shared with Me" tabs, plan cards with status/permission badges, hide/show toggle, share button, open in planner, delete. New Plan button links to `/planner?newPlan=true`. "Plans" removed from nav bar — accessible via "Manage" button in planner header.
- **Plan sharing**: Share modal sets per-member permission levels (No access / View only / Can edit / Full access). Counselors always receive view-only. New `plan_shares` table with per-plan, per-user permissions (owner/view/edit/delete) and `isHidden` toggle. Permission hierarchy: owner > delete > edit > view.
- **Per-plan permission enforcement**: All mutation endpoints (PATCH/DELETE/POST courses, lock-grade) use `getPlanAccess()` instead of `accountCtx.canEdit`. Auto-creates owner share on plan creation. Backward compatibility: plans without `plan_shares` rows fall back to `account_members.canEdit`.
- **Plan visibility**: Hide plans from planner without deleting them.
- **API endpoints**: `GET/POST /plans/:id/shares`, `PATCH/DELETE /plans/:id/shares/:userId`, `PATCH /plans/:id/visibility`.
- **Migration script** for existing plans (creates owner share rows).
- **Tests**: 14 API tests + 15 E2E tests.
- **First name / last name on users**: `firstName` and `lastName` columns added to users table. Signup sets firstName from email prefix. `GET /api/v1/auth/me` returns first_name, last_name, and tourState; `PATCH /api/v1/auth/me` accepts first_name/last_name/tourState updates. Layout displays full name instead of email prefix. Settings has inline name editing. Linked account members show full names.
- **Account editing**: New `PATCH /api/v1/accounts/:id` endpoint for updating student_name. Settings Account card has 2-column stacked layout (Name/Email/Password | Role/Grade Level/Graduation Year).
- **Linked account member removal**: Any member can remove other members (not just non-students). API updated to allow student removal by non-student members. Remove button shows for all members except self.
- **State and school on accounts**: `state` and `schoolName` columns added to accounts table. Signup captures state (frozen to IL) and school (frozen to Stevenson). Displayed read-only in Settings profile grid. Stored for future multi-school expansion.
- **Signup page redesign**: Wider layout (max-w-lg), 2-column grids for credentials and personal info. Role selector with description cards (Student/Parent/Guardian/Counselor — 4 roles). Guardian maps to "parent" in DB for identical behavior. Frozen state/school fields with "Request yours" link. Removed "Claim your account" link.
- **School request system**: `POST /api/v1/school-request` endpoint (no auth), `school_requests` table for future outreach.
- **Settings redesign**: Flat sections with uppercase headers (no collapsible cards), 3x3 profile grid (Name/Email/Password/Role/Grade/Graduation/State/School), clean linked accounts list (renamed from "Family Members"), compact subscription/legal/danger zone sections.
- **Linked Accounts** (renamed from Family Members): Students can invite Parent/Guardian/Counselor; parents can invite Child/Parent/Guardian/Counselor; counselors cannot invite anyone (view-only, canEdit: false, invite form hidden). Tier limits: Starter/Trial 3, Plus 5, Elite 8 — enforced in invite API (402 UPGRADE_REQUIRED), usage counter shown in Settings. `maxLinkedAccounts` added to SubscriptionContext and tier config.
- **Counselor role**: Joins with canEdit: false (view-only). Can view plans, progress, grades but cannot modify. Cannot invite others. Future: will be able to add comments/suggestions on shared plans.
- **Billing updates**: Pricing cards show linked accounts per tier and PDF/print for Plus. 4-year subscription display shows "Expires" instead of "Renews" (one-time payment).
- **Consent system**: `legal_documents` + `consent_records` tables, `/terms` and `/privacy` pages, `/consent` interstitial, consent gate in app layout, signup checkbox, OAuth redirect to consent, account deletion with full cleanup (Stripe, Supabase, Redis, PostHog).
- **Public homepage** (`/`): Hero with gradient text, "For high school students & parents" audience eyebrow, animated stats bar, animated trial badge. "Why SAPS?" problem section. 5 feature cards with unique color accents. 3-step timeline how-it-works. FAQ accordion. Final CTA. Feature-flagged pricing section (dormant for v1). Testimonials section dormant (`showTestimonials: false` — no real testimonials yet).
- **Public layout**: Sticky navbar with glass blur, logo, nav links (About, FAQ), Sign in, Get Started Free CTA. Mobile hamburger menu. Footer with Product/Legal/Connect columns, social media icons (Instagram, Facebook, Twitter, LinkedIn), feedback link (points to /contact page), school request link, copyright with disclaimer.
- **About page** (`/about`): Story, mission, what-we-do (Plan/Track/Connect cards), looking ahead, disclaimer.
- **Contact page** (`/contact`): Form with name/email/subject/message. Stored in `contact_messages` table via `POST /api/v1/contact` (no auth). Route sends notification email to `planwithgenie@gmail.com` via Resend with reply-to sender. Enabled in nav + footer.
- **Homepage feature config** (`config/homepage.ts`): `showTestimonials: false`, `showContactPage: true`, `showPricing: false`.
- **SEO**: Meta description, keywords, Open Graph tags on root layout.
- **New tables**: `contact_messages` (name, email, subject, message, created_at). `feedback` (id, user_id FK users SET NULL on delete, rating 1-5, comment, page, created_at).
- **In-app feedback widget**: Floating "Feedback" button on all app pages (bottom-right). Opens panel with 5-star rating + optional comment. Captures current page path. Stores in `feedback` table via `POST /api/v1/feedback` (auth required). Success animation, auto-closes.
- **Guided tour system**: driver.js integration (5KB) for step-by-step feature walkthroughs. Three tours: Welcome (dashboard, 6 steps), Planner (2-5 steps adaptive), Progress (1-3 steps adaptive). Auto-starts on first visit per page. Adaptive tours: Planner shows 2 steps (intro + create) when no plans exist, 5 steps when plans are present; Progress shows 1 step when no plan data, 3 steps when data exists. Global "Tour" button in app header nav bar on every page — detects current page and triggers appropriate tour with correct steps (checks DOM for plan elements). Tour state persisted in `tourState` JSONB column on users table via `PATCH /api/v1/auth/me`. Custom driver.js CSS overrides in `globals.css` matching SAPS brand (rounded popovers, primary color buttons, custom progress text). Infrastructure: `useTour` hook (`lib/hooks/use-tour.ts`), tour config file (`config/tours.ts`), `data-tour` attributes on key elements, `TourButton` component.
- **Tests**: **63 test files** (30 unit/API test files with 427 test cases, 33 E2E spec files). 9 migration files.

**Next up (Phase 3 remaining):** Plan history/undo, prerequisite graph visualization, dual credit tracking, plan comparison, PDF export, share links, template intensity levels, goal setting, NCAA eligibility tracking, Seal of Biliteracy, P.E. waiver rules.

---

*This document summarizes the full feature specification in FEATURE_ANALYSIS.md (rev 13, April 2026). For technical schema, API design, acceptance criteria, and testing strategy, refer to the full specification.*
