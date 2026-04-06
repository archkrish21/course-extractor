# Student Academic Planning System (SAPS) — Feature Analysis

## Overview

A full-featured student academic planning platform built on top of the Stevenson High School course catalog extractor. The system helps students and parents plan four-year academic paths, track grades, validate graduation requirements, and receive AI-driven career/GPA guidance.

---

## What We're Building

Three distinct pillars, all powered by a foundational data engine:

```
                    ┌──────────────────────┐
                    │    Data Engine        │
                    │  Course catalog       │
                    │  Requirements DB      │
                    │  Career paths         │
                    │  Annual PDF sync      │
                    └──────────┬───────────┘
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Planning Engine │  │  Tracking Engine │  │ Advisory Engine │
│                 │  │                  │  │                 │
│ 4-year planner  │  │ Transcript       │  │ AI suggestions  │
│ Req. validator  │  │ GPA calculator   │  │ Career mapping  │
│ Prereq. graph   │  │ Credit tracker   │  │ Alert system    │
│ Plan comparison │  │ Dual credit log  │  │ Notifications   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Feature Breakdown

### User Login & Profiles

Three user roles — design the auth/roles model to accommodate all from day one:

| Role | Needs |
|---|---|
| Student | Own account, plans, grades, goals, notifications. Only student can set Primary plan and enter grades. |
| Parent | Member of one or more student accounts. Can create plans, browse courses, view grades/GPA (read-only). Cannot set Primary or enter grades. Account switcher for multi-child parents. |
| Counselor | Read-only access to linked student accounts. Bulk alerts (future phase). |

The platform uses a student-centric account model. Each `account` represents one student's academic data. Users (students, parents, counselors) are `account_members` with role-based permissions. Either a student or parent can create an account. When a parent creates an account, the student claims it later via an invite code.

- Use an established auth library (Auth.js or Supabase Auth) — do not build auth from scratch.
- Support email login + Google OAuth. The OAuth callback auto-provisions first-time Google users (creates `users`, `accounts`, `student_profiles`, `subscriptions` with 14-day Plus trial, trialing status) and redirects to `/onboarding`. Student name is extracted from Google profile metadata. Email is marked as pre-verified.
- `GET /api/v1/auth/me` endpoint returns the logged-in user's email, role, first_name, and last_name. `PATCH /api/v1/auth/me` accepts first_name/last_name updates.
- **User names:** `firstName` and `lastName` columns on users table. Signup sets firstName from email prefix. Layout displays full name instead of email prefix. Settings has inline name editing. Family members show full names.
- **Account editing:** `PATCH /api/v1/accounts/:id` endpoint for updating student_name. Settings Account card has 2-column stacked layout (Name/Email/Password | Role/Grade Level/Graduation Year).
- **Family member removal:** Any member can remove other members (not just non-students). API updated to allow student removal by non-student members. Remove button shows for all members except self.
- **Settings UI improvements:** Collapsible cards (Account open by default), merged Family Members + Invite into one card, 2-column Account layout with stacked label/value fields, password show/hide toggle on all password inputs.
- **Consent system:** `legal_documents` + `consent_records` tables, `/terms` and `/privacy` pages, `/consent` interstitial, consent gate in app layout, signup checkbox, OAuth redirect to consent, account deletion with full cleanup (Stripe, Supabase, Redis, PostHog).
- **Parent user menu:** Parent sees their own name/email in the avatar (not the student's name). A "Managing: StudentName · Gr X" subtitle is shown below the parent's name. "Add Another Child" removed from the dropdown.
- **Child invite flow:** Parents can invite a child (student) via email from Settings. When the student joins via the invite: (1) if the student already has an account, the parent is added to the student's existing account; (2) if no account exists, a new account is created with both student and parent as members. The active account auto-switches to the joined account.

**Onboarding flow for existing students** (non-freshman) is critical: students must be able to enter grades already completed before using the planner. Without prior grade history, the GPA calculator and requirement progress tracker are meaningless. Make bulk entry fast — a table-style entry form, not one course at a time.

### Grade Tracking & GPA Calculator

Three GPA views required:

- **Cumulative GPA** — all completed courses
- **Projected GPA** — completed + in-progress + planned future courses with estimated grades
- **What-if GPA** — read-only simulation: "If I drop AP Chemistry and replace it with Honors Chemistry, how does my projected GPA change?" Does not save plan changes.

Stevenson uses a weighted GPA scale:
- `College Prep` → standard weight
- `Accelerated` → +0.5 (confirm with school)
- `Honors` → +0.5 (placeholder — confirm with school)
- `AP` → +1.0 (confirm with school)

> **Important:** Get the exact weight table from the school website before writing any GPA calculation code. Implement as a config constant, not hardcoded logic.

**Grade scale mapping** must be defined before any GPA code is written:

| Letter Grade | GPA Points (unweighted) |
|---|---|
| A | 4.0 |
| B | 3.0 |
| C | 2.0 |
| D | 1.0 |
| F | 0.0 |
| P (Pass) | excluded from GPA calculation |
| I (Incomplete) | excluded from GPA calculation |

> Stevenson uses a 5-letter grade scale without +/- variants. P (Pass) and I (Incomplete) are excluded from GPA calculation.

> Confirmed: Stevenson uses A/B/C/D/F (no +/- variants). P (Pass) and I (Incomplete) are excluded from GPA calculation.

> **Phase 2 update:** Stevenson uses a single final grade per semester (proficiency-based grading model). Midterm grades have been removed from the schema (`midterm_grade` and `grade_type` columns dropped from `grade_entries`). Grades live exclusively in `plan_courses.planned_grade`, set via the planner page. The Grades page has been renamed to **Transcript** (`/transcript`) — a read-only view showing completed courses from the primary plan with their grades, semester GPA, grade-level GPA, cumulative GPA, and credits earned. No editing on the transcript; all grade entry happens in the planner page.

**GPA snapshots** are taken automatically at two points: (1) end of each semester when a student marks all grades as final, and (2) on-demand when the student requests a snapshot. These form the historical GPA trend chart on the Progress page right sidebar.

> **GPA snapshot auto-trigger (Phase 2 — US-24):** When the year-end wizard completes, a GPA snapshot with trigger `semester_end` is automatically created from completed `plan_courses`. Snapshot creation is non-fatal — if it fails, the year-end completion still succeeds.
>
> **GPA trend chart (Phase 2 — US-23):** Recharts `LineChart` on the Progress page right sidebar showing unweighted GPA (primary color line) and weighted GPA (success color line) over time. Only renders when 2+ snapshots exist. Data fetched from `GET /api/v1/gpa/snapshots`.

Also track **standardized test scores** (SAT, ACT, AP exam scores) — these are critical for college planning and AI recommendations. Store as optional profile data, never required. Test score entry UI ships in Phase 4 (alongside AI advisory features that consume this data). Test scores are included in AI context from Phase 4.

> **Implementation status (Phase 1b):** GPA calculation is implemented in `lib/gpa/calc.ts` using configurable weights from `config/gpa-weights.ts` and grade scale from `config/grade-scale.ts`. Three GPA views supported: cumulative (completed only), projected (all non-dropped with grades), what-if (Phase 2). Weighted GPA includes bonuses: CP +0.0, Accelerated +0.5, Honors +0.5, AP +1.0. GPA waiver courses excluded from calculation. Pass/Fail and Incomplete grades excluded. Full-year courses are stored as two semester rows; GPA uses half credit value per row to avoid double-counting. GPA displayed in planner grid grade headers and plan header.
>
> **P/F-only course handling (Phase 2 update):** Regular PE courses (PED121, PED122, PED451, PED452, PED111/112) and Driver Education (D/E231, D/E232) are identified as Pass/Fail-only via `isPassFailCourse()` in `config/grade-scale.ts`. These courses: (1) show only P and F in the grade dropdown (via `PASS_FAIL_OPTIONS`), (2) are excluded from GPA calculation (the `CourseForGPA` interface includes optional `code` field), (3) have the GPA waiver toggle hidden (already excluded from GPA), and (4) display a grey "P/F" badge with tooltip "Pass/Fail course — excluded from GPA and academic course count". Health (PED201/202), Applied Health (PED231/232), Adventure Ed (PED331/332), Lifeguard (PED501), and Leadership courses still get letter grades.

> **GPA waiver toggle:** GPA waiver is a per-plan-course toggle (`gpa_waiver_applied` on plan_courses). The catalog-level `gpa_waiver` flag indicates eligibility; the student must explicitly apply it via a checkbox on the course card. Applied waivers show in yellow. The GPA calculator excludes courses where `gpa_waiver_applied = true`. The GPA waiver checkbox is hidden for P/F-only courses (identified by `isPassFailCourse()`) since they are already excluded from GPA calculation.

> **Grade-level locking (Phase 2 update):** After completing a grade via the year-end wizard, the entire grade level is locked in the planner. Completed grades are locked at the grade level (not per-course) — once locked, no courses can be added/removed, no status/grade changes are allowed, and bulk operations (clear grade, bulk status/grade) are disabled. The GPA waiver toggle is the only exception and remains functional on locked grades. The "current grade" in the planner is defined as the first unlocked grade level, which may differ from the account's `current_grade_level` if grades are manually unlocked. Lock state is stored as a `lockedGradeLevels` JSONB integer array on `four_year_plans`.

### Dual Credit Tracking

Several Stevenson courses earn transferable college credit through partner institutions (e.g., Harper College). This is a significant college planning consideration and must be tracked explicitly:

- Flag dual credit courses in the planner (distinct visual treatment)
- Track partner college and course credit hours per course
- Show a running tally of college credits earned/planned alongside high school credits
- Include dual credit summary in the graduation/college readiness checklist
- Surface dual credit courses prominently in AI career-path recommendations (cost savings, advanced standing)

### Course Suggestions — Three Engines

1. **Graduation requirement filler** — rule-based, deterministic. "You need 2 more Science credits. Available courses for grade 10: Biology, Chemistry, Earth Science." Fully automatable from the DB.

2. **GPA targeting** — heuristic. "To reach 3.8 GPA, your remaining courses need an average grade of X." Requires careful scoping — avoid overpromising without historical difficulty data.

3. **Career path alignment** — AI-assisted via Claude API. "For Pre-Med, prioritize AP Biology, AP Chemistry, and AP Statistics." Backed by curated career-to-course mappings as guardrails.

**Suggestion ranking order** (when multiple courses satisfy the same suggestion engine):
1. Courses the student is grade-eligible for this year (closest to current grade level first)
2. Courses that also fulfill other graduation requirements (higher multi-requirement overlap ranked higher)
3. Dual credit courses (surfaced prominently — financial value)
4. Courses matching the student's stated career path
5. Alphabetical as final tiebreaker

**Career path data structure** — career-to-course mappings are stored as a curated JSON file (`career_paths.json`) loaded into the DB at deploy time. These tables power Engine 3 suggestions and provide the context injected into Claude API calls. Manually curated, updated annually alongside the course catalog, and version-controlled in the repo.

```sql
-- career_paths: top-level career tracks (e.g., "Pre-Med", "Computer Science")
CREATE TABLE career_paths (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,     -- e.g., "Pre-Med"
  description      TEXT,
  related_careers  JSONB DEFAULT '[]',       -- e.g., ["Physician", "Pharmacist", "Nurse Practitioner"]
  display_order    SMALLINT DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- career_path_courses: courses that belong to a career track
CREATE TABLE career_path_courses (
  career_path_id  UUID NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  priority        SMALLINT NOT NULL CHECK (priority IN (1, 2, 3)),
                  -- 1 = essential   (strongly recommend; show prominently in AI suggestions)
                  -- 2 = recommended (beneficial; show in secondary suggestions)
                  -- 3 = optional    (nice-to-have; show only if student has room)
  catalog_version_id UUID NOT NULL REFERENCES catalog_versions(id),
  notes           TEXT,                      -- e.g., "Required for most pre-med college programs"
  PRIMARY KEY (career_path_id, course_id)
);
```

> **Note:** Career path mappings (`career_path_courses`) must be rebuilt during annual catalog reload, since `course_id` references are version-specific.

> **AI Guardrail:** Every AI-generated course suggestion must be cross-validated against the actual course DB before display. Never show hallucinated course names as recommendations. If Claude suggests a course not in the DB, suppress it and log the mismatch.

> **Phase 1a Extraction Results (2026-27 Catalog):** The PDF extractor successfully parsed 315 courses from the Stevenson 2026-27 course catalog, resolving 331 prerequisite links and identifying 159 GPA waiver courses across 9 divisions and 20+ departments. Semester offering breakdown: 89 Sem 1 only, 90 Sem 2 only, 136 full year, 6 Sem 1 exclusive, 6 Sem 2 exclusive, 168 available in both semesters. The extractor also produces structured `prerequisite_groups` with AND/OR semantics (semester-pair siblings grouped as single OR group) and a `semesters_offered` integer array per course parsed from PDF code line patterns. The 3-phase extraction pipeline (appendix name lookup → two-column body extraction → prerequisite name-to-code resolution) achieved 0 validation errors on the full catalog.

### Plan Management

- **Multiple draft plans** — students create Plan A, Plan B, etc. (e.g., "Pre-Med Track" vs "Computer Science Track") and compare them side by side before committing. Each additional plan starts as a draft; the student can promote any plan to **Primary** at any time.
- **Primary plan** — one plan per student is designated primary (`is_primary = TRUE`). It is the plan shown by default in the dashboard, planner grid, requirement checklist, GPA projections, alert engine, and PDF exports. All other plans are secondary and accessible via a "Switch plan" dropdown. Primary and active status are merged: setting a plan as primary automatically sets its status to 'active'. The old primary is demoted to 'draft'. Archived plans cannot be set as primary. First plan created is automatically primary + active.
- **Plan templates** — pre-built starter templates for common tracks (e.g., "4-Year College Prep", "STEM / Engineering Track", "Arts Track", "Dual Credit Maximizer") that students can select during onboarding and customize. Significantly reduces the blank-canvas problem for new users.
- **Plan history / audit trail** — every change to a plan (add course, remove course, change semester) is logged with a timestamp. Students can undo/revert to a prior state.
- **What-if analysis** — a read-only simulation mode where students try changes and see the impact on GPA, requirements, and alerts without saving.
- **Plan export / share** — students can export their active plan as a PDF (to share with a counselor or parent) or generate a read-only shareable link. The PDF includes the course grid, GPA projections, and requirement status.
- **Plan sharing with permissions (Phase 3 — implemented)** — per-plan, per-user permissions via the `plan_shares` table. Each share row stores a `permission` level (owner/view/edit/delete) and an `isHidden` toggle. Permission hierarchy: owner > delete > edit > view. The plan owner can share with any family member via a share modal on the `/plans` page, setting permission level per member (No access / View only / Can edit / Full access). Owner share is auto-created on plan creation. All plan mutation endpoints (PATCH/DELETE/POST courses, lock-grade) enforce permissions via `getPlanAccess()` instead of `accountCtx.canEdit`. Plans without `plan_shares` rows fall back to `account_members.canEdit` for backward compatibility.
- **Plan management page (Phase 3 — implemented)** — `/plans` page with "My Plans" and "Shared with Me" tabs. Plan cards show status badge, permission level badge, hide/show toggle, share button, open-in-planner link, and delete action. "Plans" removed from nav bar; accessible via "Manage" button in planner header. New Plan button links to `/planner?newPlan=true`. Delete button also shown on planner page; disabled for primary plans with tooltip.
- **Plan delete permissions (Phase 3 update)** — `DELETE /api/v1/plans/:id` updated to use `getPlanAccess()` permissions. Strictly permission-based: requires owner or delete permission only; no student role override.
- **Create Plan modal fix** — extracted into a reusable `renderNewPlanModal()` function so it renders in both empty state and normal planner views. Single "Create Your First Plan" button replaces duplicate buttons in the empty state.
- **Plan visibility (Phase 3 — implemented)** — students can hide plans from the planner plan dropdown without deleting them, via the `isHidden` flag on `plan_shares`. Hidden plans remain accessible on the `/plans` page.
- **Plan print/export** — browser-native print dialog via `/planner/print?id=planId`. Landscape layout with grade tables, semester columns, status, grades, credits, GPA. Print button (printer icon) in planner header bar. **Subscription gated:** all print buttons (planner, progress, transcript, dashboard "Print Plan" quick action) require `canExportPdf` (Plus+ only). Trial and Starter users see disabled buttons with "Upgrade to Plus to print" tooltip.
- **Year-end transition workflow** — at the end of each school year, the app prompts the student to: (1) confirm final grades for completed courses, (2) lock the entire completed grade level, (3) advance their current grade level, and (4) review the active plan for the upcoming year. Completed grades are locked at the grade level (not per-course) via `lockedGradeLevels` on the plan. Locked grades block all course modifications (add/remove/status/grade changes) except GPA waiver toggles. Lock/unlock icons appear on grade bars for current and previous grades; unlocking requires a confirmation dialog. The "current grade" in the planner is defined as the first unlocked grade level, not just the account's grade level. The year-end API accepts a `grade` query param to complete a specific grade (not just current). This is a critical operational workflow — without it, the plan becomes stale.
- **Enrollment rule enforcement** — the planner enforces scheduling rules automatically:
  - `One Semester` courses can only occupy one semester slot
  - `Full Year` courses must span both semesters of a grade year
  - A course cannot be planned before its prerequisite grade level
  - A co-requisite course must be planned in the same semester

> **Implementation status (Phase 1b):** Full-year courses are now stored as two `plan_courses` rows (semester 1 + semester 2) instead of one row with `semester=null`. This enables independent status and grade tracking per semester. Plan templates are seeded with split rows via the seed script. The prerequisite validator's enrollment rule check verifies both semesters are present for full-year courses instead of checking for `semester=null`. Semester-paired courses are excluded from the course picker when one variant is already in the plan (e.g., CSC162 hidden if CSC161 is planned). Matching is by course name across all 80 semester-paired courses. Bulk status and grade updates available per semester (dropdown in semester cell header). Trash icon for clearing a semester. Credits calculated correctly for full-year courses (per-row = creditValue/2 to avoid double-counting).

### Credit System

Stevenson uses 1 credit per semester course, 2 credits per full-year course. Graduation requires 45 credits total. The school day has 8 periods (including lunch), allowing a maximum of 7 courses per semester (8 with an early bird period). Minimum 5 courses per semester.
>
> **Course load count (Phase 2 update):** The semester course load check (min 5, max 7/8) now counts only academic courses. Physical Welfare division, DNC-prefix (Dance), and D/E-prefix (Driver Ed) courses are excluded from the count — these are the "sixth supervised period", not part of the 5 academic credits.

> **1.5 period AP Science courses:** Eight AP Science lab courses use 1.5 class periods and earn 3.0 credits per year (1.5 per semester): AP Physics 1 (SCI611/612), AP Biology (SCI631/632), AP Chemistry (SCI651/652), AP Physics C (SCI661/662), and their Early Bird variants (SCI61E1/E2, SCI63E1/E2, SCI65E1/E2, SCI66E1/E2). All other courses earn 1.0 credit per semester (2.0 per full year) or 1.0 per semester course.

### Course Ordering in Planner

Courses within each semester cell are displayed in fixed order: Early Bird → Language Arts (Communication Arts) → Math → Science → World Language (Multilingual Learning) → Electives → PE (Physical Welfare).

### Prerequisite Visualization

Prerequisite chains form a **directed acyclic graph (DAG)**. This must be surfaced to students, not just enforced silently:

- When a student views a course, show a visual tree of what it requires (upstream) and what it unlocks (downstream)
- In the 4-year planner grid, prerequisite violations are highlighted inline with a tooltip explaining the gap — including **transitive violations** (e.g., removing Algebra 2 from grade 9 breaks AP Calculus BC in grade 11, even though Algebra 2 is not a direct prerequisite of AP Calc BC)
- A "prereq path" view shows the **full multi-level chain** from current grade to a target course (e.g., "To take AP Calculus BC in grade 11: Algebra 1 (gr 9) → Algebra 2 (gr 9) → Precalculus (gr 10) → AP Calculus AB (gr 11) → AP Calculus BC (gr 12)")
- Chain depth can reach 4–5 levels in math and science sequences; the DAG traversal uses a **recursive CTE** (see Course Catalog Data Model section) with a depth guard — not application-layer recursion
- **Co-requisites** (courses that must be taken concurrently) are modeled separately from prerequisites and shown distinctly in the DAG — a same-semester link rather than a before/after link
- **OR-group prerequisites** (e.g., "Algebra 2 OR Precalculus") are shown as branched paths converging on the target; satisfying any one branch clears the requirement
- Cycle detection runs at catalog load time (topological sort); a cycle in the data is a load error, not a runtime case

### Alert System (Overload / Underload)

Each alert must be **actionable** — link to a specific fix suggestion, not just a warning. Alerts are evaluated in a background job, not in the request cycle.

**Overload signals:**
- More than 7 courses per semester
- More than 2 AP courses simultaneously (grade-dependent)
- Consecutive heavy semesters with declining GPA trend

**Underload signals:**
- Fewer credits than needed to graduate on time (pace check)
- No AP/Accelerated courses when GPA and grade level suggest capacity

**Other alerts:**
- Prerequisite violation: planned course is missing a required prerequisite — evaluated **transitively** (removing a lower-level course in the chain raises an alert on all downstream courses that depend on it, not just the immediate next course)
- Co-requisite violation: co-requisite course not planned in the same semester
- Enrollment rule violation: course duration mismatch in planned slot
- Grade-level ineligibility: course planned outside its eligible grade range
- Repeat course: student already completed a course they've planned again
- Graduation risk: projected credit gap with fewer than 2 years remaining
- Catalog change: a planned course was removed or renamed in the new year's catalog
- Grade threshold: actual grade in a course is lower than planned grade, causing projected GPA to drop below goal
- GPA goal at risk: projected cumulative GPA has fallen below the student's stated GPA goal (distinct from a single-course grade drop — this is a cumulative trend alert)
- Dual credit eligibility: student qualifies for a dual credit course but hasn't planned it

### Notifications

Channels for MVP: **in-app + email only**. Defer push notifications to a later phase.

| Trigger | Channel | Audience |
|---|---|---|
| Alert threshold crossed | In-app + email | Student + Parent |
| New course catalog available | Email | All users |
| Grade entry reminder (per semester) | Email | Student |
| Prerequisite gap detected | In-app | Student |
| GPA projection update | Weekly digest email | Student + Parent |
| Plan milestone (on track for graduation) | In-app | Student |
| Planned course removed from catalog | In-app + email | Student + Parent |
| Actual grade below planned grade | In-app | Student + Parent |
| Dual credit opportunity identified | In-app | Student |

> **Multi-member alert visibility:** Alerts remain account-scoped. All account members can view alerts. Only the student can dismiss alerts (`dismissed_by UUID` is planned to replace the boolean `is_dismissed` in a future phase when multi-member alert dismissal is implemented. Currently, alerts use `is_dismissed BOOLEAN`). For notification dispatch, iterate over all `account_members` and check each member's `notification_preferences`.

Email provider: **Resend**.

---

## Monetization & Subscription Model

### Free Trial

Every new user gets **14 days of Plus-level access** (trialing status) from the moment they sign up (`trial_ends_at = created_at + INTERVAL '14 days'`). No credit card required. At trial end, the account automatically downgrades to Starter unless a paid plan has been selected. The Accounts API returns "trial" as the plan name when `status = 'trialing'`. The TierBadge component shows "Trial" (amber). The billing page shows "Free Trial" with a "X days left" badge. Pricing cards do not show "Current Plan" for trialing users. Billing card buttons are aligned at the same level using flex layout.

Show a countdown banner in the app from day 10 onward: "X days left in your free trial."

---

### Subscription Tiers

3 tiers (Pro tier eliminated). Plus absorbs non-AI features; Elite is the premium AI-powered tier. 14-day trial assigns the Plus plan with `status = 'trialing'` — restricted Plus-level features (no export/print/share/compare, max 2 plans, no AI).

| | Trial (14-day) | Starter | Plus | Elite |
|---|---|---|---|---|
| **Price** | Free | Free | $9.99/mo · $107.88/yr · $399/4yr | $19.99/mo · $215.88/yr · $799/4yr |
| **Max active plans** | 2 | 1 | 10 | Unlimited |
| Course browser & search | ✓ | ✓ | ✓ | ✓ |
| Prerequisite validation | ✓ | ✓ | ✓ | ✓ |
| Graduation requirement tracking | ✓ | ✓ | ✓ | ✓ |
| GPA tracking (cumulative) | ✓ | ✓ | ✓ | ✓ |
| What-if GPA simulator | ✓ | — | ✓ | ✓ |
| Goal tracking | ✓ | — | ✓ | ✓ |
| Full alert system | ✓ | — | ✓ | ✓ |
| Dual credit tracking | ✓ | — | ✓ | ✓ |
| Parent plan drafts | ✓ | — | ✓ | ✓ |
| Plan comparison | — | — | ✓ | ✓ |
| PDF export / print | — | — | ✓ | ✓ |
| Share links | — | — | ✓ | ✓ |
| AI course suggestions | — | — | — | ✓ |
| AI plan review | — | — | — | ✓ |
| AI chat | — | — | — | ✓ |
| **Percentile comparison** | — | — | — | ✓ |
| **Course rigor scoring** | — | — | — | ✓ |

Billing intervals: monthly, annual (save 10%), 4-year (save 17%). The 4-year plan matches the product's natural lifecycle.

> Annual pricing is approximately 2 months free vs. monthly. Confirm exact pricing with business requirements before launch.

---

### Percentile Comparison (Elite)

Students can see where their GPA, AP count, credit load, and course rigor fall relative to other students at the **same grade level** on the platform.

**Design rules — privacy is non-negotiable:**
- All comparison data is **aggregated and anonymized** — no individual student's data is ever exposed to another user
- A cohort must have **at least 50 contributing students** before percentile data is surfaced in the UI; below that threshold, the feature shows "Not enough data yet"
- Students must **opt in** to contributing their anonymized data (`contributes_to_stats BOOLEAN` on `student_profiles`). Non-contributing students can still view percentiles if the cohort threshold is met, but their data does not influence the stats
- Percentiles are computed **nightly** from a pre-aggregated stats table — never via live queries across student rows (this is a hard RLS requirement)
- Frame results positively: "Your GPA ranks in the top 28% of grade 11 students on SAPS" — not "72% of students have a higher GPA than you"

**Metrics compared:**

| Metric | Description |
|---|---|
| Unweighted GPA | Cumulative unweighted GPA |
| Weighted GPA | Cumulative weighted GPA |
| AP course count | Number of AP courses completed or in-progress |
| Credit count | Total credits earned toward graduation |
| Rigor score | Composite score: weighted sum of credit types (AP=2.5, Honors=2.0, Accelerated=1.5, CP=1.0) × credits |

---

### Subscription Enforcement

**Pattern:** Middleware reads the user's effective subscription tier (from Redis cache, 5-min TTL; fallback to DB) and injects it into the request context. API routes and server components check the tier before returning gated resources.

- **API response for gated features:** `HTTP 402` with `{ "upgrade_required": true, "feature": "ai_suggestions", "minimum_tier": "elite" }`. Feature gating uses flag-based checks (`canWhatIf`, `canExportPdf`, `canComparePlans`, `canSharePlans`, `canUseAi`, `canViewPercentile`, `canParentDraft`, `canCreateGoals`), not tier name lists. Pro tier backward compatibility: middleware maps `pro` to `plus`.
- **Frontend:** Gated UI elements render as disabled with an upgrade CTA tooltip; clicking opens the upgrade modal. **Print button gating (implemented):** All print buttons (planner, progress, transcript, dashboard "Print Plan" quick action) are gated by `canExportPdf`. Disabled buttons are wrapped in a `<span>` with `title="Upgrade to Plus to print"` for accessibility. Client-side check: `subscriptionTier === "plus" || subscriptionTier === "elite"`.
- **Plan count enforcement:** Excess plans are not deleted on downgrade — they become `archived` (read-only), in order from oldest `activated_at` first. Student retains all data; they cannot edit beyond their plan limit until upgrading again. Existing `plan_share_links` for archived plans remain active (shares are independent of subscription tier).
- **Feature data on downgrade:** Alert history, AI chat history, and prerequisite graph data are preserved in the DB. The UI hides tier-gated display until the user upgrades again — no data loss. Alert evaluation continues running for all tiers; only tier-gated alert types (e.g., `ap_capacity_underuse`, `declining_gpa_trend`) are suppressed from dispatch for Starter users — the alerts are still evaluated and stored, just not shown.
- **Billing:** Stripe handles payment, webhook events update `subscriptions.status`. A `past_due` grace period of 5 days before downgrading to Starter.
- **`stripe_events` archival:** The `stripe_events` table retains all rows for 90 days for reconciliation and debugging. A scheduled job archives rows older than 90 days (move to cold storage or delete after ensuring reconciliation is complete). The `processed = TRUE` rows are lower priority to retain than `processed = FALSE`.

> **Family note:** The student account holds the subscription. A parent linked to a student views the student's data at the same access level — the parent does not need a separate subscription to view their child's plan.

> **Account model note:** Subscriptions are per `account`, not per `user`. Parent users have no subscription of their own. The subscription middleware resolves the effective tier from the `account_id` context, not the user's ID. When a parent switches between children's accounts, the available features change based on each account's subscription tier. Any account member can be designated as the billing contact.

---

### Account Lifecycle & Freeze Policy

Three distinct triggers can move an account out of `active` status. Each has a different reactivation path.

#### Trigger 1 — Payment failure

```
Stripe: invoice.payment_failed
  → subscriptions.status = 'past_due'
  → 5-day grace period (reminder emails on day 1 and day 4)
  → if still unpaid after 5 days:
      users.account_status   = 'frozen'
      users.freeze_reason    = 'payment_lapsed'
      users.frozen_at        = NOW()
      account_events row inserted (triggered_by = 'stripe_webhook')

Reactivation: user updates payment method in Stripe billing portal
  → Stripe: invoice.paid webhook
      subscriptions.status   = 'active'
      users.account_status   = 'active'
      users.freeze_reason    = NULL
      users.frozen_at        = NULL
      account_events row inserted (triggered_by = 'stripe_webhook')
```

#### Trigger 2 — Subscription canceled

```
User cancels in billing portal → cancel_at_period_end = TRUE
  → No immediate change; account stays active until period_end
  → At period_end: Stripe: customer.subscription.deleted webhook
      subscriptions.status   = 'canceled'
      users.account_status   = 'frozen'
      users.freeze_reason    = 'subscription_canceled'
      users.frozen_at        = NOW()
      account_events row inserted (triggered_by = 'stripe_webhook')

Reactivation: user selects a new plan → Stripe checkout
  → New subscription created; webhook fires
      users.account_status   = 'active'
      users.freeze_reason    = NULL
      account_events row inserted
```

#### Trigger 3 — Graduation completed

```
BullMQ nightly cron (runs every morning):
  SELECT user_id FROM student_profiles
  WHERE graduation_year < current_academic_year_start
    AND users.account_status = 'active'

  For each matched student:
    users.account_status = 'frozen'
    users.freeze_reason  = 'graduation_complete'
    users.frozen_at      = NOW()
    account_events row inserted (triggered_by = 'system', event_type = 'graduation_detected')
    Send "Congratulations on graduating!" email with 3 options:
      1. Export data and deactivate account
      2. Stay as Alumni (free read-only archive, no subscription required)
      3. Dismiss (account stays frozen with read-only access)
```

#### Trigger 4 — Unclaimed account expiry

```
BullMQ nightly cron:
  SELECT id FROM accounts
  WHERE student_user_id IS NULL
    AND created_at < NOW() - INTERVAL '90 days'

  For each matched account:
    Freeze account (read-only for parent)
    Send "Your child hasn't claimed this account" email to created_by
    Options: Resend invitation / Archive account
```

**Alumni mode** is just the `frozen` + `freeze_reason = 'graduation_complete'` state — no active subscription required for read-only archive access. The student keeps all historical data visible forever. The subscription is set to `subscription_plan_id = starter`, `status = 'active'` so no billing occurs, but all features are read-only because the `graduation_complete` freeze is still set.

If no action is taken within 6 months of graduation, show a dashboard banner: *"Your account will be deactivated in 30 days. Export your data before then."* Deactivation (with 30-day data purge window) only proceeds if the user explicitly requests it or after 6 months of inactivity.

---

#### What "frozen" means in practice

| Operation | Frozen behavior |
|---|---|
| Log in | ✓ Allowed |
| View plans, grades, GPA | ✓ Allowed (read-only) |
| View alerts and notifications | ✓ Allowed |
| Add/edit/delete a plan or course | ✗ Blocked → `403 { account_frozen: true, reason: "...", reactivate_url: "..." }` |
| Enter or edit grades | ✗ Blocked |
| Create goals | ✗ Blocked |
| Export data | ✓ Always allowed (right to erasure) |
| Delete account | ✓ Always allowed |
| Change notification preferences | ✓ Allowed |

> Frozen accounts are **never silently degraded** — the user always sees a clear, actionable banner explaining why their account is frozen and exactly what to do to restore it. The message differs by `freeze_reason`.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                          │
│                                                                      │
│  Auth / Onboarding  │  Dashboard   │  4-yr Planner  │  Progress     │
│  Transcript         │  Req Checker │  AI Advisor    │  Notif Center │
│  GPA Calc / What-If │  Course Search│  Prereq Graph  │  Plan Export  │
│  Plan Comparison    │              │                │               │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ REST API (versioned: /api/v1/...)
┌──────────────────────────────────▼──────────────────────────────────┐
│                  API Layer (Next.js API routes)                       │
│                                                                      │
│  /auth          /courses        /plans          /transcript          │
│  /requirements  /gpa            /suggestions    /alerts              │
│  /notifications /ai             /users          /catalog-versions    │
│  /export        /dual-credit    /subscriptions  /stripe              │
└──────┬────────────────┬────────────────────┬───────────────┬────────┘
       │                │                    │               │
┌──────▼──────┐  ┌──────▼──────┐  ┌─────────▼────┐  ┌──────▼────────┐
│  Supabase   │  │  Redis      │  │  Claude API  │  │ Notification  │
│  (Auth +    │  │  (Upstash)  │  │              │  │ Service       │
│  PostgreSQL)│  │             │  │ - Suggestions│  │ (Resend email │
│             │  │ - GPA cache │  │ - Career map │  │  + in-app)    │
│  RLS policies│  │ - req cache │  │ - Plan review│  └───────────────┘
└─────────────┘  └─────────────┘  └──────────────┘
                                          ▲
                                   rate-limited
                                   (10 req/user/hr)
       ▲
┌──────┴──────────────────────┐
│         Job Queue           │  ← triggered by API events AND schedule
│         (BullMQ)            │
│                             │
│  - Alert evaluation         │  ← on every plan save / grade entry
│  - GPA recalculation        │  ← on every grade entry
│  - Notification dispatch    │  ← on alert trigger
│  - req_progress refresh     │  ← on every plan save
│  - Weekly digest emails     │  ← cron: every Sunday
│  - Trial expiry check       │  ← cron: nightly; downgrade expired trials
│  - Graduation detection     │  ← cron: nightly; freeze graduated accounts
│  - Payment lapse freeze     │  ← triggered by Stripe webhook (5-day delay)
│  - Percentile stats rebuild │  ← cron: nightly (Elite feature)
│  - Year-end state reset     │  ← cron: Aug 1; reset year_end_transition_state = 'pending' for all active students
│  - req-progress-refresh     │  ← on plan save (course added/removed/status changed);
│                             │     recalculates graduation requirement fulfillment;
│                             │     runs inline if < 500ms, otherwise queued
│  - stripe-reconciliation    │  ← cron: nightly; fetches active Stripe subscriptions,
│                             │     compares against local subscriptions table,
│                             │     fixes drift from missed webhooks
└─────────────────────────────┘

       ┌────────────────┐
       │  PDF Extractor  │  (independent yearly CLI batch job, Python)
       │  courses.json   │  loads directly into DB; does NOT use BullMQ
       └────────────────┘
```

**Key architectural notes:**

- Supabase provides both Auth and PostgreSQL in one managed service. Use Row Level Security (RLS) policies for multi-tenant data isolation — students cannot read other students' data at the DB layer.
- The Job Queue (BullMQ) connects to the API layer, not just the PDF extractor. Alert evaluation and GPA recalculation are triggered by API events (plan saves, grade entries) and also by scheduled jobs.
- Redis caches GPA computations and `requirement_progress` — these are expensive to recompute on every page load. (Upstash early phase → AWS ElastiCache at ~500 users)
- Rate-limit the `/api/v1/ai` endpoint (10 requests/user/hour) to control Claude API costs. Also rate-limit `/api/v1/gpa` and `/api/v1/suggestions` (100 requests/user/hour) to prevent abuse. When a rate limit is exceeded, return `HTTP 429 Too Many Requests` with a `retry_after` value in seconds and `X-RateLimit-Remaining` headers. See TECH_DESIGN_DOC.md §8 for full rate limit implementation details.
- Version the API from day one (`/api/v1/`). This avoids breaking the frontend when the API evolves.

---

## Database Schema

### `users`
```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
email                    TEXT UNIQUE NOT NULL,
first_name               TEXT,              -- set from email prefix at signup; editable via PATCH /api/v1/auth/me
last_name                TEXT,              -- editable via PATCH /api/v1/auth/me
role                     TEXT NOT NULL CHECK (role IN ('student','parent','counselor','admin')),
is_email_verified        BOOLEAN DEFAULT FALSE,         -- required for email auth flow
date_of_birth            DATE,                          -- required for COPPA under-13 check at signup
account_status           TEXT NOT NULL DEFAULT 'active'
                           CHECK (account_status IN ('active','frozen','deactivated','suspended')),
                           -- 'active'      → normal access
                           -- 'frozen'      → read-only; login allowed; all write ops blocked; reactivatable
                           -- 'deactivated' → user-initiated permanent close; 30-day data purge window starts
                           -- 'suspended'   → admin-initiated (abuse/policy); requires admin to lift
freeze_reason            TEXT CHECK (freeze_reason IN (
                           'payment_lapsed',        -- Stripe invoice.payment_failed + 5-day grace exhausted
                           'subscription_canceled', -- Stripe subscription.deleted at period_end
                           'graduation_complete',   -- graduation_year has passed; student finished 4 years
                           'admin_action'           -- manual freeze by admin
                         ) OR freeze_reason IS NULL),
frozen_at                TIMESTAMPTZ,               -- timestamp when account_status last became 'frozen'
CHECK (                                            -- freeze_reason must be set iff account is frozen
  (account_status = 'frozen' AND freeze_reason IS NOT NULL AND frozen_at IS NOT NULL)
  OR (account_status <> 'frozen' AND freeze_reason IS NULL AND frozen_at IS NULL)
),
created_at               TIMESTAMPTZ DEFAULT NOW(),
last_login               TIMESTAMPTZ,
notification_preferences JSONB DEFAULT '{
  "alert_triggered":       {"email": true,  "in_app": true},
  "catalog_update":        {"email": true,  "in_app": true},
  "grade_reminder":        {"email": true,  "in_app": false},
  "prereq_gap":            {"email": false, "in_app": true},
  "gpa_digest":            {"email": true,  "in_app": false},
  "plan_milestone":        {"email": false, "in_app": true},
  "course_removed":        {"email": true,  "in_app": true},
  "grade_below_target":    {"email": true,  "in_app": true},
  "dual_credit_opportunity":{"email": false,"in_app": true},
  "year_end_reminder":     {"email": true,  "in_app": true},
  "trial_expiry_warning":  {"email": true,  "in_app": true},
  "account_frozen":        {"email": true,  "in_app": true},
  "graduation_detected":   {"email": true,  "in_app": true}
}'
```
> `notification_preferences` keys must match the `notification_type` enum on the `notifications` table. The default shown above is the recommended baseline; users can toggle each channel per type in the Settings screen.

### `accounts`
```sql
-- accounts: one per student, regardless of who created it
CREATE TABLE accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name          TEXT NOT NULL,
  student_date_of_birth DATE,
  grade_level           SMALLINT CHECK (grade_level BETWEEN 9 AND 12),
  graduation_year       SMALLINT,
  school_id             UUID,
  student_user_id       UUID UNIQUE REFERENCES users(id),
  created_by            UUID NOT NULL REFERENCES users(id),
  billing_contact_id    UUID REFERENCES users(id),
  claim_code            VARCHAR(8) UNIQUE,
  claim_expires_at      TIMESTAMPTZ,
  claimed_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### `account_members`
```sql
-- account_members: who has access to each account
CREATE TABLE account_members (
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('student', 'parent', 'guardian', 'counselor')),
  can_edit    BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by  UUID REFERENCES users(id),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, user_id)
);
```

> **Phased rollout:** Student-side accounts are created automatically during student signup (Phase 1a). Parent-side account creation and the claim flow are Phase 2 features.

> The `accounts` table replaces the implicit student identity that was previously embedded in `student_id` foreign keys across all data tables. All data tables (`four_year_plans`, `grade_entries`, `gpa_snapshots`, `goals`, `alerts`, `notifications`, `subscriptions`, `requirement_progress`) gain an `account_id` column. The `student_parent_links` and `parent_invite_codes` tables are replaced by `account_members` and the `claim_code` on `accounts`. The `four_year_plans` table also gains `created_by` (UUID, who authored the plan) and `visibility` (shared/private) columns.

### `student_profiles`
```sql
user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
graduation_year      SMALLINT NOT NULL,      -- e.g., 2027
current_grade_level  SMALLINT NOT NULL,      -- 9, 10, 11, or 12
gpa_goal             DECIMAL(3,2),           -- e.g., 3.80
college_targets      JSONB,                  -- [{"name": "UIUC", "type": "reach|match|safety", "notes": "strong CS program"}]
career_goals         JSONB,                  -- [{"field": "Medicine", "role": "Physician"}]
sat_score               SMALLINT,               -- optional
act_score               SMALLINT,               -- optional
ap_exam_scores          JSONB,                  -- {"AP Calculus BC": 5, "AP Biology": 4}
contributes_to_stats    BOOLEAN NOT NULL DEFAULT FALSE,
                        -- opt-in: TRUE = anonymized GPA/credit/rigor data feeds grade_cohort_stats nightly
                        -- opt-out students can still VIEW percentile charts; they just don't influence the stats
rigor_score             DECIMAL(6,3),
                        -- computed nightly by Elite stats job: SUM(credit_value × weight) where
                        --   weight: AP=2.5, Honors=2.0, Accelerated=1.5, CP=1.0; NULL until first nightly run
                        -- displayed on Elite dashboard as "Course Rigor Score"; used to seed grade_cohort_stats
updated_at               TIMESTAMPTZ DEFAULT NOW(),
year_end_transition_state TEXT NOT NULL DEFAULT 'pending'
                        CHECK (year_end_transition_state IN ('pending','in_progress','completed')),
                        -- 'pending'     → year-end workflow not yet started for this school year
                        -- 'in_progress' → user opened the wizard but hasn't confirmed all steps; show "Resume" button
                        -- 'completed'   → all steps done: grades confirmed, grade_level incremented, plan reviewed
                        -- Reset to 'pending' at start of each new school year (nightly cron)
```
> Note: `graduation_year` and `current_grade_level` must stay in sync. At signup, derive `graduation_year = current_school_year + (12 - current_grade_level)` and keep it fixed. Only `current_grade_level` advances (by 1 each year-end). Any mismatch surfaces as a data integrity alert for admin review.

> **Grade corrections and GPA snapshots:** `grade_entries` is mutable — students can correct a grade after a snapshot is taken. GPA snapshots are historical markers only; the live cumulative GPA is always recomputed from `grade_entries` at read time. Snapshots are used only for the trend chart and are labelled with their `snapshot_date`. If a grade correction would materially change a past snapshot (>0.05 GPA points), the app shows a notice: "Your historical GPA chart has been updated to reflect this correction."

### `student_parent_links`

> **Deprecated:** Replaced by `account_members` table. Retained for backward compatibility.

```sql
student_id  UUID REFERENCES users(id) ON DELETE CASCADE,
parent_id   UUID REFERENCES users(id) ON DELETE CASCADE,
can_edit    BOOLEAN DEFAULT FALSE,
linked_at   TIMESTAMPTZ DEFAULT NOW(),
PRIMARY KEY (student_id, parent_id)
```

### `parent_invite_codes`
> **Deprecated:** Superseded by `accounts.claim_code` (for student claims) and `account_invite_codes` (for member invitations). Retained for backward compatibility.

```sql
CREATE TABLE parent_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_by UUID REFERENCES users(id),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (code) -- active codes must be globally unique
);

CREATE INDEX idx_invite_codes_lookup ON parent_invite_codes (code) WHERE claimed_by IS NULL;
```

### `counselor_student_links`
```sql
counselor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
linked_at     TIMESTAMPTZ DEFAULT NOW(),
linked_by     UUID REFERENCES users(id) ON DELETE SET NULL,  -- admin or counselor who created the link
PRIMARY KEY (counselor_id, student_id)
```
> Allows counselors (role = 'counselor') to view a student's plans, grades, and alerts in the Counselor Dashboard. Write access is always read-only for counselors — no `can_edit` flag. Counselors cannot modify student data.

### `plan_share_links`
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
plan_id        UUID NOT NULL REFERENCES four_year_plans(id) ON DELETE CASCADE,
created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
               -- SET NULL (not CASCADE): share links survive if the creating counselor/teacher account is deleted
               -- The plan owner (student) can still revoke or renew the link independently
token          TEXT NOT NULL UNIQUE,       -- random URL-safe token, e.g., from crypto.randomBytes(24)
label          TEXT,                       -- optional: "Share with counselor", "College application"
expires_at     TIMESTAMPTZ,               -- NULL = no expiry; set for time-limited shares
revoked_at     TIMESTAMPTZ,               -- NULL = active; SET to revoke without deleting the row
last_accessed  TIMESTAMPTZ,
created_at     TIMESTAMPTZ DEFAULT NOW()
```
> Powers the read-only shareable plan link feature on the Plan Export screen. Anyone with the token URL can view the plan as a static snapshot — they cannot log in or modify data. Access is always read-only.

### `four_year_plans`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id          UUID REFERENCES users(id) ON DELETE CASCADE NULL, -- NULL for admin-owned templates
account_id          UUID REFERENCES accounts(id),
created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
visibility          TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared', 'private')),
name                TEXT NOT NULL,           -- e.g., "Plan A - Pre-Med Track"
school_year         TEXT NOT NULL,           -- e.g., "2025-26" (the year plan was created)
catalog_version_id      UUID REFERENCES course_catalog_versions(id) ON DELETE RESTRICT,
created_from_template_id UUID REFERENCES four_year_plans(id) ON DELETE SET NULL,
                         -- NULL for plans not based on a template; SET NULL if the source template is deleted
is_template         BOOLEAN DEFAULT FALSE,   -- TRUE for built-in starter templates; student_id IS NULL when is_template = TRUE
status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','active','archived')),
                      -- 'draft'    → being created or explored; not the student's primary working plan
                      -- 'active'   → currently in use; plan_courses may include enrolled/completed entries
                      -- 'archived' → no longer in use; hidden from default views; data preserved
is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
                      -- TRUE  → this is the student's current default plan:
                      --           shown in dashboard, planner, requirement tracker, GPA projections, and exports
                      -- FALSE → secondary plan (alternative track, what-if draft, or archived)
                      -- INVARIANT: at most one non-template row per student can have is_primary = TRUE
                      -- Enforced by partial unique index (see below); NOT by a CHECK constraint
activated_at        TIMESTAMPTZ,             -- timestamp when is_primary was last set to TRUE for this plan
created_at          TIMESTAMPTZ DEFAULT NOW(),
updated_at          TIMESTAMPTZ DEFAULT NOW(),
CHECK (is_template = TRUE OR student_id IS NOT NULL),     -- student plans must have an owner
CHECK (is_primary = FALSE OR is_template = FALSE),        -- templates cannot be primary
CHECK (is_primary = FALSE OR activated_at IS NOT NULL)    -- primary plans must record when they were promoted
-- Partial unique index (defined outside the table, in migration):
--   CREATE UNIQUE INDEX idx_one_primary_plan_per_student
--   ON four_year_plans (student_id)
--   WHERE is_primary = TRUE AND is_template = FALSE AND student_id IS NOT NULL;
```
> **`status` vs `is_primary` — distinct concepts:**
> - `status` is the lifecycle state of a plan (`draft → active → archived`). A student can have multiple `active` plans simultaneously (e.g., "Pre-Med Track" and "CS Track" both in use across different school years).
> - `is_primary` identifies the **single default plan** used for the dashboard, requirement tracker, GPA projections, exports, and alerts. Only one student plan can be primary at a time.
> - A plan can be `active` but not primary (secondary working plan) or `draft` and primary (student just started a new plan from scratch).
>
> **Switching the primary plan (must be a transaction):**
> ```sql
> BEGIN;
>   UPDATE four_year_plans
>   SET    is_primary = FALSE
>   WHERE  student_id = :student_id AND is_primary = TRUE;
>
>   UPDATE four_year_plans
>   SET    is_primary    = TRUE,
>          status        = 'active',
>          activated_at  = NOW()
>   WHERE  id = :new_primary_plan_id;
> COMMIT;
> ```
> The partial unique index ensures the two-step update is race-safe: if two requests try to set different plans as primary simultaneously, one will fail the unique constraint and be retried.
>
> **Defaults on plan creation:**
> - First plan created during onboarding → `is_primary = TRUE, status = 'active'` automatically.
> - Each additional plan created → `is_primary = FALSE, status = 'draft'` by default; student can promote it to primary at any time.
>
> Plan templates are stored in the same table with `is_template = TRUE` and `student_id = NULL`. When a student selects a template during onboarding, the app copies the template rows into a new student-owned plan. Templates are seeded at initial deployment (not via the admin UI).

### `plan_courses` ← central planning table
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
plan_id       UUID NOT NULL REFERENCES four_year_plans(id) ON DELETE CASCADE,
course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
grade_level   SMALLINT NOT NULL CHECK (grade_level BETWEEN 9 AND 12),
semester      SMALLINT CHECK (semester IN (1, 2)),  -- NULL means full year
status        TEXT DEFAULT 'planned' CHECK (status IN ('planned','enrolled','completed','dropped')),
planned_grade TEXT CHECK (planned_grade IN ('A', 'B', 'C', 'D', 'F', 'P', 'I') OR planned_grade IS NULL),
display_order SMALLINT DEFAULT 0,            -- ordering of courses within a grade_level + semester; persists user reordering
notes         TEXT,
UNIQUE (plan_id, course_id, grade_level, semester)
-- Allows retakes in different years but prevents duplicate entries within the same grade/semester.
```
> **Phase 2 update:** `planned_grade` in `plan_courses` is now the authoritative grade source for both planned and completed courses. Grades are set via the planner page (status dropdown + grade dropdown). The `grade_entries` table is retained for future use but is not the primary source. The GPA API and Transcript page both read from `plan_courses` on the primary plan. The Transcript page includes a Print button (printer icon) in the header next to "Edit in Planner" that triggers `window.print()`.

> **Completed-course locking:** Once a `plan_courses` row transitions to `status = 'completed'` (during year-end transition), the API must reject any attempt to delete the row, change `course_id`, `grade_level`, or `semester`. Only `planned_grade` (for reference) and `notes` remain editable. This is enforced at the API layer — not by a DB constraint — because PostgreSQL does not support conditional mutability triggers without plpgsql triggers. Add an integration test asserting that a DELETE on a `completed` row returns `HTTP 409 Conflict`. To link them: JOIN `plan_courses → four_year_plans` (to get `student_id`), then match on `(student_id, course_id, academic_year, semester)`. This two-step join is intentional — it allows a student to retake a course in a different year without creating conflicting plan rows.

### `plan_history` ← audit trail / undo
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
plan_id       UUID NOT NULL REFERENCES four_year_plans(id) ON DELETE CASCADE,
changed_at    TIMESTAMPTZ DEFAULT NOW(),
changed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
              -- SET NULL: plan history survives if a parent/counselor account is deleted
action        TEXT CHECK (action IN ('add_course','remove_course','change_planned_grade','change_semester','change_status','rename_plan','reorder_courses','set_primary')),
                    -- 'set_primary' logged when is_primary transitions TRUE → FALSE or FALSE → TRUE
before_state  JSONB,
after_state   JSONB
```

### `grade_entries`

> **Phase 2 update:** The `midterm_grade` and `grade_type` columns have been removed. Stevenson uses a single final grade per semester (proficiency-based grading model). The primary grade source is now `plan_courses.planned_grade`, set via the planner page. The `grade_entries` table is retained for future use (e.g., onboarding bulk import, historical records) but is **not** the authoritative source for GPA calculation or transcript display.

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
account_id      UUID REFERENCES accounts(id),
course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
                  -- RESTRICT: deleting a catalog course that has grade records must be an explicit migration, not a cascade
academic_year   TEXT NOT NULL,               -- e.g., "2024-25"
semester        SMALLINT NOT NULL CHECK (semester IN (1, 2)),
final_grade     TEXT CHECK (final_grade IN ('A', 'B', 'C', 'D', 'F', 'P', 'I')),
credit_earned   DECIMAL(3,1),
-- Weight is derived from courses.credit_type at GPA calculation time — not stored on grade_entries
-- to avoid denormalization drift if a course's credit_type is corrected.
created_at      TIMESTAMPTZ DEFAULT NOW(),
updated_at      TIMESTAMPTZ DEFAULT NOW(),
UNIQUE (student_id, course_id, academic_year, semester)
```

> **Incomplete grade handling:** Grades marked as `I` (Incomplete) are excluded from GPA calculation. An `incomplete_grade` alert fires when an Incomplete is older than 30 days. Incompletes block year-end transition for the affected course.

### `gpa_snapshots`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
account_id          UUID REFERENCES accounts(id),
snapshot_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- TIMESTAMPTZ not DATE: multiple snapshots can occur on the same calendar day
trigger             TEXT NOT NULL CHECK (trigger IN ('semester_end','manual','plan_save')),
cumulative_gpa      DECIMAL(4,3),
weighted_gpa        DECIMAL(4,3),
semester_gpa        DECIMAL(4,3),
credits_earned      DECIMAL(5,1),
credits_attempted   DECIMAL(5,1)
```

### `dual_credit_log`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
account_id          UUID REFERENCES accounts(id),
plan_id             UUID REFERENCES four_year_plans(id) ON DELETE SET NULL,
course_id           UUID REFERENCES courses(id) ON DELETE RESTRICT,
partner_college     TEXT NOT NULL,           -- e.g., "Harper College"
college_course_code TEXT,                    -- partner college's course identifier
college_credits     DECIMAL(3,1) NOT NULL,   -- credit hours earned
academic_year       TEXT NOT NULL,
status              TEXT CHECK (status IN ('planned','enrolled','completed','transferred','dropped')),
created_at          TIMESTAMPTZ DEFAULT NOW(),
updated_at          TIMESTAMPTZ DEFAULT NOW()  -- track when status last changed
```
> `plan_id` links dual credit to a specific student plan (ON DELETE SET NULL so the record survives plan deletion). `'dropped'` status added to handle mid-semester withdrawal from the college portion.

### `goals`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
account_id    UUID REFERENCES accounts(id),
goal_type     TEXT NOT NULL CHECK (goal_type IN ('gpa','college','career','graduation','dual_credit')),
target_gpa    DECIMAL(3,2),                  -- used when goal_type = 'gpa'
target_text   TEXT,                          -- used for college, career, graduation goals
target_date   DATE,
status        TEXT DEFAULT 'active' CHECK (status IN ('active','achieved','abandoned')),
achieved_at   TIMESTAMPTZ,                   -- set when status transitions to 'achieved'
notes         TEXT,                          -- optional context from the student
created_at    TIMESTAMPTZ DEFAULT NOW(),
updated_at    TIMESTAMPTZ DEFAULT NOW()
```
> The `set_updated_at()` trigger (used on `four_year_plans`, `grade_entries`, etc.) should also be applied to `student_profiles` and `goals` to keep `updated_at` current on every UPDATE.

> Split `target_value` into `target_gpa` (numeric, for GPA goals) and `target_text` (string, for all other goal types) to avoid ambiguous typing.

### `alerts`
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
account_id        UUID REFERENCES accounts(id),
alert_type        TEXT NOT NULL CHECK (alert_type IN (
                    'overload',              -- >7 courses/semester or >2 AP simultaneously
                    'underload',             -- insufficient credits to graduate on pace; also fires for AP underuse
                    'prereq_violation',      -- hard prerequisite missing (transitive)
                    'coreq_violation',       -- co-requisite not in same semester
                    'enrollment_rule',       -- semester slot / duration mismatch
                    'grade_level_ineligible',-- course planned outside its eligible grade range
                    'repeat_course',         -- course already completed
                    'graduation_risk',       -- projected credit gap with <2 years remaining
                    'catalog_change',        -- planned course removed or renamed in new catalog
                    'grade_below_target',    -- actual grade < planned_grade; impacts projected GPA
                    'gpa_goal_at_risk',      -- projected cumulative GPA has dropped below student's stated GPA goal
                    'declining_gpa_trend',   -- GPA has dropped for 2+ consecutive heavy-load semesters
                    'ap_capacity_underuse',  -- student GPA and grade level suggest AP capacity but none planned
                    'dual_credit_opportunity'
                  )),
severity          TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
message           TEXT NOT NULL,
action_suggestion TEXT,
related_plan_id   UUID REFERENCES four_year_plans(id) ON DELETE SET NULL,
related_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
deduplication_key TEXT,                      -- prevents re-firing same alert; e.g. '{plan_id}:{course_id}:{alert_type}'
is_read           BOOLEAN DEFAULT FALSE,
is_dismissed      BOOLEAN DEFAULT FALSE,
triggered_at      TIMESTAMPTZ DEFAULT NOW(),
resolved_at       TIMESTAMPTZ
```

```sql
-- Deduplication: only one unresolved alert per student per key
CREATE UNIQUE INDEX idx_alerts_dedup
  ON alerts (student_id, deduplication_key)
  WHERE resolved_at IS NULL;
```

### `notifications`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
account_id            UUID REFERENCES accounts(id),
channel               TEXT CHECK (channel IN ('in_app','email')),
notification_type     TEXT NOT NULL CHECK (notification_type IN (
                        'alert_triggered','catalog_update','grade_reminder',
                        'prereq_gap','gpa_digest','plan_milestone',
                        'course_removed','grade_below_target','dual_credit_opportunity',
                        'year_end_reminder',      -- prompts student to complete year-end transition workflow
                        'trial_expiry_warning',   -- countdown banner email (day 10 of trial)
                        'account_frozen',         -- account_status transitioned to 'frozen'; reason + reactivation link
                        'graduation_detected'     -- graduation cron fired; offers alumni/export/dismiss options
                      )),                    -- must match keys in users.notification_preferences
title                 TEXT NOT NULL,
body                  TEXT NOT NULL,
related_entity_type   TEXT,                  -- e.g., 'alert', 'plan', 'course'
related_entity_id     UUID,
metadata              JSONB DEFAULT '{}',    -- flexible per notification type
status                TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
created_at            TIMESTAMPTZ DEFAULT NOW(),
sent_at               TIMESTAMPTZ,
read_at               TIMESTAMPTZ
```
> `notification_type` is required to enforce user preferences stored in `users.notification_preferences`. Without it, "only email me for critical alerts" cannot be evaluated at dispatch time.

### `requirement_progress` ← computed/cached
```sql
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
```
> Keyed on `plan_id` (not just `student_id`) because a student's two plans can have different requirement fulfillment states. Also includes `catalog_version_id` because graduation requirements can change between annual catalog editions.

### `course_catalog_versions` ← tracks annual catalog snapshots
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_year         TEXT NOT NULL UNIQUE,    -- e.g., "2026-27"
source_pdf_url      TEXT,
json_artifact_path  TEXT,
loaded_at           TIMESTAMPTZ DEFAULT NOW(),
loaded_by           UUID REFERENCES users(id) ON DELETE SET NULL,
courses_added       SMALLINT DEFAULT 0,
courses_removed     SMALLINT DEFAULT 0,
courses_modified    SMALLINT DEFAULT 0,
change_summary      JSONB DEFAULT '[]'       -- [{code, name, change_type, details}]
```

### `subscription_plans` ← static tier definitions, seeded at deploy
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name            TEXT NOT NULL UNIQUE,     -- 'starter', 'plus', 'elite' (Pro removed)
display_name    TEXT NOT NULL,            -- 'Starter', 'Plus', 'Elite'
price_monthly   DECIMAL(6,2),             -- NULL = free tier. Plus: 9.99, Elite: 19.99
price_annual    DECIMAL(7,2),             -- NULL = free tier. Plus: 107.88, Elite: 215.88 (save 10%)
price_four_year DECIMAL(7,2),             -- Plus: 399.00, Elite: 799.00 (save 17%)
max_plans       SMALLINT,                  -- 1 for Starter, 10 for Plus, NULL = unlimited (Elite)
features        JSONB NOT NULL            -- 8 feature flags: canWhatIf, canExportPdf, canComparePlans,
                                          -- canSharePlans, canUseAi, canViewPercentile, canParentDraft, canCreateGoals
```
> This table is seeded once at deploy time and updated only on pricing/tier changes. Never mutated by user actions.

### `subscriptions` ← one row per account (tied to a student account, not an individual user)
```sql
id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id                UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
account_id             UUID REFERENCES accounts(id),
subscription_plan_id   UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
status                 TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','paused')),
trial_ends_at          TIMESTAMPTZ NOT NULL,    -- always set at signup = created_at + INTERVAL '14 days'
billing_cycle          TEXT CHECK (billing_cycle IN ('monthly','annual','four_year') OR billing_cycle IS NULL),
                                                -- NULL = free tier (no billing cycle); four_year uses Stripe payment mode (not subscription)
current_period_start   TIMESTAMPTZ,
current_period_end     TIMESTAMPTZ,
cancel_at_period_end   BOOLEAN DEFAULT FALSE,   -- TRUE = cancels at end of current billing period
canceled_at            TIMESTAMPTZ,
stripe_customer_id     TEXT UNIQUE,             -- NULL for free-tier users with no payment method on file
stripe_subscription_id TEXT UNIQUE,             -- NULL for free-tier users
created_at             TIMESTAMPTZ DEFAULT NOW(),
updated_at             TIMESTAMPTZ DEFAULT NOW()
```
> A new `subscriptions` row is created for every new user at signup with `status = 'trialing'`, `subscription_plan_id = plus`, `trial_ends_at = NOW() + INTERVAL '14 days'`. A BullMQ job runs nightly to downgrade expired trials to `subscription_plan_id = starter`, `status = 'active'`.

> **Effective tier logic:** `IF status = 'trialing' AND NOW() < trial_ends_at → apply plus features (trial). ELSE IF status IN ('active','past_due') → apply subscription_plan_id features. ELSE → apply starter features.` This is evaluated in middleware, not per-request DB queries, using the Redis-cached value. The Accounts API returns "trial" as the plan name when `status = 'trialing'`, so the UI shows "Trial" (amber badge) instead of the underlying plan name.

### `stripe_events` ← raw Stripe webhook log
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
stripe_event_id  TEXT NOT NULL UNIQUE,      -- Stripe's evt_... ID; UNIQUE prevents duplicate processing
event_type       TEXT NOT NULL,             -- e.g., 'invoice.payment_failed', 'customer.subscription.deleted'
api_version      TEXT,                      -- Stripe API version from the event envelope
payload          JSONB NOT NULL,            -- full raw event body for replay and audit
processed        BOOLEAN NOT NULL DEFAULT FALSE,
processed_at     TIMESTAMPTZ,
error_message    TEXT,                      -- NULL if processed successfully; error string if processing failed
received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
> Every incoming Stripe webhook is written to this table **before** any business logic runs. If the webhook handler crashes after writing but before updating `subscriptions`, the nightly reconciliation job replays unprocessed events in `received_at` order. `stripe_event_id` uniqueness prevents double-processing on Stripe retries.

### `grade_cohort_stats` ← nightly aggregate for Elite percentile feature
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
grade_level  SMALLINT NOT NULL,          -- 9, 10, 11, or 12
school_year  TEXT NOT NULL,              -- e.g., '2025-26'
metric       TEXT NOT NULL CHECK (metric IN (
               'unweighted_gpa',
               'weighted_gpa',
               'ap_count',              -- AP courses completed or enrolled
               'credit_count',          -- total credits earned toward graduation
               'rigor_score'            -- weighted composite: AP×2.5 + Honors×2.0 + Accelerated×1.5 + CP×1.0 per credit
             )),
sample_size  INTEGER NOT NULL,           -- must be >= 50 to surface in UI; below threshold → hide
p10          DECIMAL(6,3),
p25          DECIMAL(6,3),
p50          DECIMAL(6,3),              -- median
p75          DECIMAL(6,3),
p90          DECIMAL(6,3),
computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE (grade_level, school_year, metric)
```
> Built nightly by a BullMQ job that queries **only** `student_profiles` and `grade_entries` rows where `contributes_to_stats = TRUE`. No individual student IDs are stored in this table. A student's percentile rank is computed at read time by comparing their metric value against the pre-aggregated breakpoints — no cross-student row access occurs at query time.

> **Privacy note:** Add `contributes_to_stats BOOLEAN NOT NULL DEFAULT FALSE` to `student_profiles`. Show an explicit opt-in prompt during onboarding and in Settings. Even students who opt out can view percentile charts if the cohort threshold is met — they just do not influence the stats.

### `account_events` ← lifecycle audit trail
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
event_type   TEXT NOT NULL CHECK (event_type IN (
               'account_frozen',        -- account_status → 'frozen'
               'account_reactivated',   -- account_status → 'active' (payment resolved / new subscription)
               'account_deactivated',   -- account_status → 'deactivated' (user-requested closure)
               'account_suspended',     -- account_status → 'suspended' (admin action)
               'suspension_lifted',     -- account_status → 'active' (admin lifted suspension)
               'graduation_detected',   -- nightly cron detected graduation_year has passed
               'trial_expired',         -- 14-day trial ended without subscribing
               'data_exported'          -- user exported their full data archive
             )),
triggered_by TEXT NOT NULL CHECK (triggered_by IN ('system','stripe_webhook','admin','user')),
reason       TEXT,                      -- human-readable context for the event (e.g., Stripe event ID)
metadata     JSONB DEFAULT '{}',        -- e.g., {"stripe_event_id": "evt_...", "previous_status": "active"}
occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
> Used for compliance audit trails and support investigations. Never delete rows from this table — retention mirrors the user's data retention period.

### Recommended Indexes

Beyond primary keys and unique constraints, these indexes are required for query performance at scale:

```sql
-- grade_entries: heavy student-level query pattern
CREATE INDEX idx_grade_entries_student_id ON grade_entries (student_id);

-- plan_courses: the planner fetches all courses for a given plan on every page load
CREATE INDEX idx_plan_courses_plan_id ON plan_courses (plan_id);

-- alerts: dashboard loads all active alerts per student
CREATE INDEX idx_alerts_student_unresolved ON alerts (student_id) WHERE resolved_at IS NULL;

-- notifications: notification center loads all unread per user
CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE read_at IS NULL;

-- plan_history: undo list fetches recent changes per plan
CREATE INDEX idx_plan_history_plan_id_at ON plan_history (plan_id, changed_at DESC);

-- subscriptions: middleware looks up tier per user on every request
-- (covered by the UNIQUE constraint on user_id — no extra index needed)

-- stripe_events: reconciliation job queries by processed + received_at
CREATE INDEX idx_stripe_events_unprocessed ON stripe_events (received_at) WHERE processed = FALSE;

-- grade_cohort_stats: percentile lookup by grade level + school year + metric
-- (covered by UNIQUE(grade_level, school_year, metric))

-- gpa_snapshots: trend chart loads snapshots per student ordered by date
CREATE INDEX idx_gpa_snapshots_student_date ON gpa_snapshots (student_id, snapshot_date DESC);

-- goals: active goals per student (goal tracking dashboard)
CREATE INDEX idx_goals_student_active ON goals (student_id) WHERE status = 'active';

-- dual_credit_log: dual credit summary per student
CREATE INDEX idx_dual_credit_student ON dual_credit_log (student_id);

-- account_events: lifecycle audit trail per user
CREATE INDEX idx_account_events_user ON account_events (user_id, occurred_at DESC);

-- notifications: notification center loads recent per user
CREATE INDEX idx_notifications_user_date ON notifications (user_id, created_at DESC);

-- requirement_progress: graduation checklist per student
CREATE INDEX idx_requirement_progress_student ON requirement_progress (student_id);
```

---

**Table Creation by Phase:**
- **Phase 1a:** users, student_profiles, departments, catalog_versions, courses, course_prerequisites, divisions
- **Phase 1b:** four_year_plans, plan_courses, plan_history, subscription_plans (seed only)
- **Phase 2:** accounts, account_members, account_invite_codes, grade_entries, gpa_snapshots, subscriptions, account_events, requirement_progress, graduation_requirements, student_requirement_status, student_requirement_opt_ins, stripe_events. Schema changes: `priceFourYear` column on `subscription_plans`; `four_year` added to `billing_cycle` check constraint on `subscriptions`. Drizzle migrations in `lib/db/migrations/`.
- **Phase 2 (deprecated):** ~~student_parent_links~~, ~~parent_invite_codes~~ — superseded by accounts model
- **Phase 3:** alerts, notifications, dual_credit_log, plan_share_links
- **Phase 4:** career_paths, career_path_courses, ai_recommendations (if persisted)
- **Phase 5:** counselor_student_links, goals

---

## Course Catalog Data Model

The course catalog tables are the foundation of all planning and validation logic. They are populated by the PDF extractor and versioned via `course_catalog_versions`.

### `divisions`
Top-level subject areas (e.g., Mathematics, English, Science).

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name          TEXT NOT NULL UNIQUE,    -- e.g., "Mathematics"
code          TEXT NOT NULL UNIQUE,    -- e.g., "MTH"
display_order SMALLINT DEFAULT 0
```

### `departments`
Subdivisions within a division (e.g., Mathematics → AP Mathematics).

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
division_id   UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
name          TEXT NOT NULL,
display_order SMALLINT DEFAULT 0,
UNIQUE (division_id, name)
```

### `courses`
One row per catalog course entry. Versioned via `catalog_version_id`.

```sql
id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
code               TEXT NOT NULL,           -- e.g., "MTH401"
name               TEXT NOT NULL,
division_id        UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
department_id      UUID REFERENCES departments(id) ON DELETE RESTRICT,
description        TEXT,
credit_value       DECIMAL(3,1) NOT NULL DEFAULT 1.0,
duration           TEXT NOT NULL CHECK (duration IN ('semester','full_year')),
grade_levels       SMALLINT[] NOT NULL,     -- eligible grade levels, e.g., {10,11,12}
credit_type        TEXT NOT NULL CHECK (credit_type IN ('CP','Accelerated','Honors','AP','Pass/Fail')),
is_ap              BOOLEAN DEFAULT FALSE,
is_dual_credit     BOOLEAN DEFAULT FALSE,
is_honors          BOOLEAN DEFAULT FALSE,
gpa_waiver         BOOLEAN DEFAULT FALSE,   -- excluded from weighted GPA (PE, some electives)
max_enrollment     SMALLINT,
is_active          BOOLEAN DEFAULT TRUE,
catalog_version_id UUID NOT NULL REFERENCES course_catalog_versions(id) ON DELETE RESTRICT,
previous_code      TEXT,                    -- prior course code if renamed in a newer catalog (e.g., "MTH400" → "MTH401")
previous_name      TEXT,                    -- prior course name if renamed; used to alert students with stale plan entries
notes              TEXT,                    -- free-text notes from catalog (e.g., "audition required")
created_at         TIMESTAMPTZ DEFAULT NOW(),
updated_at         TIMESTAMPTZ DEFAULT NOW(),
UNIQUE (code, catalog_version_id)  -- course codes are unique within a catalog version, not globally
```

> **Course code uniqueness:** Codes are unique per catalog version, not globally. This allows the same code to exist across catalog editions (most courses don't change) while supporting cases where a code is reused with different properties in a new year. The active catalog version is used for all planning operations; historical courses are preserved for completed plan references.

### `course_prerequisites`

**Storage model: adjacency list.** Each row is one direct edge in the prerequisite DAG. Multi-level chains are stored as individual edges and traversed at query time via recursive CTE — not flattened or pre-computed.

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                  -- the course that HAS a prerequisite
prerequisite_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                  -- the course that must be satisfied first
relationship_type TEXT NOT NULL DEFAULT 'prerequisite'
                    CHECK (relationship_type IN ('prerequisite', 'corequisite')),
                  -- 'prerequisite' = must be completed BEFORE
                  -- 'corequisite'  = must be taken IN THE SAME SEMESTER

requirement_group SMALLINT NOT NULL DEFAULT 1,
                  -- OR / AND semantics:
                  --   rows with same course_id + same requirement_group = OR
                  --     (any one course in the group satisfies this requirement)
                  --   rows with same course_id + different requirement_group = AND
                  --     (all groups must be independently satisfied)
                  --
                  -- Example — "Algebra 2 OR Precalculus" (single OR group):
                  --   (AP_Calc_AB, Algebra_2,    prereq, group=1)
                  --   (AP_Calc_AB, Precalculus,  prereq, group=1)
                  --
                  -- Example — "Algebra 2 AND a lab science credit" (two AND groups):
                  --   (Chemistry_H, Algebra_2,   prereq, group=1)
                  --   (Chemistry_H, Biology,     prereq, group=2)

minimum_grade     TEXT CHECK (minimum_grade IN ('A','B','C','D') OR minimum_grade IS NULL),
                  -- NULL = any passing grade satisfies
                  -- 'B'  = must have earned B or better in the prerequisite course

is_recommended    BOOLEAN NOT NULL DEFAULT FALSE,
                  -- FALSE = hard requirement (enforced; raises prereq_violation alert)
                  -- TRUE  = advisory only (shown in UI, not enforced by validator)

notes             TEXT,
catalog_version_id UUID NOT NULL REFERENCES course_catalog_versions(id) ON DELETE CASCADE,
                  -- NOT NULL: every prerequisite edge belongs to the catalog version it was extracted from
                  -- ON DELETE CASCADE: removing an old catalog version removes its prerequisite edges

UNIQUE (course_id, prerequisite_id, catalog_version_id),
CHECK (course_id <> prerequisite_id)  -- self-loops are a data error
```

#### Multi-level chain traversal (recursive CTE)

All prerequisite validation and DAG visualization uses a recursive CTE, **not** application-layer recursion:

```sql
-- Full upstream chain: all transitive prerequisites of a target course
WITH RECURSIVE prereq_chain AS (
  -- Base: direct prerequisites
  SELECT cp.prerequisite_id,
         cp.course_id        AS required_by,
         cp.requirement_group,
         cp.minimum_grade,
         cp.is_recommended,
         1                   AS depth,
         ARRAY[cp.course_id] AS visited_path   -- cycle guard
  FROM   course_prerequisites cp
  WHERE  cp.course_id           = :target_course_id
    AND  cp.catalog_version_id  = :catalog_version_id
    AND  cp.relationship_type   = 'prerequisite'

  UNION ALL

  -- Recursive: prerequisites of prerequisites
  SELECT cp.prerequisite_id,
         cp.course_id,
         cp.requirement_group,
         cp.minimum_grade,
         cp.is_recommended,
         pc.depth + 1,
         pc.visited_path || cp.course_id
  FROM   course_prerequisites cp
  JOIN   prereq_chain pc ON pc.prerequisite_id = cp.course_id
  WHERE  cp.catalog_version_id  = :catalog_version_id
    AND  pc.depth               < 10               -- safety cap (no HS chain exceeds ~6)
    AND  NOT cp.course_id = ANY(pc.visited_path)   -- short-circuit on any cycle (data error)
    AND  cp.relationship_type   = 'prerequisite'
)
SELECT prereq_chain.prerequisite_id,
       prereq_chain.required_by,
       prereq_chain.depth,
       prereq_chain.requirement_group,
       prereq_chain.minimum_grade,
       prereq_chain.is_recommended,
       prereq_chain.visited_path
FROM   prereq_chain
ORDER  BY prereq_chain.depth;
```

The symmetric query (full downstream: all courses that eventually require a given course) uses `course_id`/`prerequisite_id` swapped and is used to compute the blast radius when a course is removed from a plan or from the catalog.

#### Plan prerequisite validator

When validating a student's plan, the engine:

1. For each planned course C, fetch the **full transitive prerequisite set** using the recursive CTE above (hard requirements only, `is_recommended = FALSE`)
2. Group the results by `requirement_group` to resolve OR/AND logic:
   - For each distinct `requirement_group`, at least one prerequisite in the group must appear in the plan with:
     - `status IN ('planned', 'enrolled', 'completed')`
     - `grade_level` or `semester` **earlier** than course C's slot (for `relationship_type = 'prerequisite'`)
     - `grade_level` and `semester` **equal** to course C's slot (for `relationship_type = 'corequisite'`)
     - If `minimum_grade` is set, the grade recorded in `grade_entries` must meet or exceed it for `status = 'completed'` courses
3. Any unsatisfied group fires a `prereq_violation` or `coreq_violation` alert on course C

> **Cycle detection at load time:** The extractor loader runs a topological sort (`Kahn's algorithm`) on the full `course_prerequisites` graph before committing any catalog version to the DB. A detected cycle aborts the load and reports the offending edge — cycles are a data extraction error, not a scenario the runtime validator needs to handle.

### `graduation_requirements`

Defines the credit targets per subject area that a student must meet to graduate, plus additional requirement types (non-course, GPA-computed, course load).

> **Phase 2 update:** A `matching_rule` JSONB column has been added. The requirements API uses matching rules instead of simple `division_id` matching.
>
> **Phase 2 update (expanded):** The requirements system has been expanded from 12 graduation-only requirements to **37 total requirements** across 4 requirement groups. The `honors_status` group was REMOVED — honors is now an achievement badge computed from GPA. New columns added: `requirement_group`, `evaluation_type`, `display_order`, `is_opt_in`. `division_id` is now nullable (non-course requirements have no division). New supporting tables: `student_requirement_status` (manual checkbox tracking), `student_requirement_opt_ins` (opt-in group enablement).

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
division_id       UUID REFERENCES divisions(id) ON DELETE RESTRICT,  -- nullable for non-course and course_load requirements
requirement_name  TEXT NOT NULL,          -- e.g., "English", "Mathematics", "ACT", "Grade 9 Sem 1", "Grade 9 Sem 1 PW/Dance/DriverEd"
required_credits  DECIMAL(3,1) NOT NULL,
eligible_credit_types TEXT[],            -- which credit_type values count, e.g., {'CP','Honors','AP'}
matching_rule     JSONB,                 -- see matching rule types below
requirement_group TEXT NOT NULL DEFAULT 'graduation',  -- 'graduation', 'il_public_university', 'non_course', 'course_load'
evaluation_type   TEXT NOT NULL DEFAULT 'course_match', -- 'course_match', 'manual_checkbox', 'auto_from_course', 'course_load_check'
display_order     SMALLINT DEFAULT 0,
is_opt_in         BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE for il_public_university group
notes             TEXT,
catalog_version_id UUID NOT NULL REFERENCES course_catalog_versions(id) ON DELETE RESTRICT,
UNIQUE (catalog_version_id, requirement_name)
```

**Requirement groups (4 groups, 37 total requirements):**

| Group | Count | Evaluation Type | Opt-In | Description |
|---|---|---|---|---|
| `graduation` | 12 | `course_match` | No | Stevenson graduation credit requirements (English 8, Math 6, Science 6, etc.) — unchanged |
| `course_load` | 16 | `course_load_check` | No | 8 course count checks (Grades 9-12 x Sem 1-2, min 5 / max 7-8) + 8 PW/Dance/DriverEd checks (each semester must have at least one Physical Welfare, Dance [DNC prefix], or Driver Education [D/E prefix] course). Display name: "Semester Requirements" |
| `il_public_university` | 5 | `course_match` | Yes | Illinois public university admission (Science 6cr, Social Studies 6cr, Electives 4cr, English 8cr, Math 6cr) |
| `non_course` | 4 | `manual_checkbox` / `auto_from_course` | No | ACT (manual), FAFSA (manual), 46th Credit (auto), Civics & Patriotism (auto) |

> Note: `honors_status` was REMOVED from requirements — it is now an achievement badge computed from GPA, displayed in the Progress page sidebar and Dashboard Achievements card.

**Evaluation types (4 types):**
- `course_match` — matches courses against `matching_rule` (used by graduation and il_public_university groups)
- `manual_checkbox` — student manually checks/unchecks via UI; state stored in `student_requirement_status`
- `auto_from_course` — automatically satisfied when a specific course is completed or credit threshold is reached
- `course_load_check` — checks per-semester course count against min/max bounds; also checks PW/Dance/DriverEd presence

**Supporting tables:**

```sql
-- student_requirement_status: tracks manual checkbox state
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

-- student_requirement_opt_ins: tracks which opt-in groups are enabled
CREATE TABLE student_requirement_opt_ins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id        UUID REFERENCES accounts(id),
  requirement_group TEXT NOT NULL,    -- e.g., 'il_public_university'
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, requirement_group)
);
```

**Matching rule types (5 types, for course_match evaluation):**
- `{ "type": "code_prefix", "prefix": "ENG" }` — matches courses whose code starts with the prefix (e.g., all ENG courses for English requirement)
- `{ "type": "codes", "codes": ["ART101", "ART102"] }` — matches specific course codes
- `{ "type": "division", "division_id": "uuid" }` — matches all courses in a division
- `{ "type": "multi_division", "division_ids": ["uuid1", "uuid2"] }` — matches courses in any of the listed divisions
- `{ "type": "remainder" }` — catch-all: matches any course not claimed by another requirement (used for "Additional Credits and P.E.")

### JSON vs Database Strategy

Use JSON as the **canonical source artifact** and the database as the **runtime store**:

```
PDF (yearly) → extractor → courses.json (git-tracked) → load script → DB (app runtime)
```

Benefits:
- `git diff 2025-courses.json 2026-courses.json` shows exact changes between catalog years
- Easy to feed course data to Claude API as context
- Portable and inspectable without a running DB
- Human review of diff before DB reload prevents silent plan breakage

### Annual Update Workflow
```
new PDF → extractor → new courses.json → diff against previous →
human review of diff → approve → DB reload → insert course_catalog_versions row
→ evaluate all active plans against new catalog → alert affected students
```

> **Never auto-reload without human review.** A removed or renamed course can silently break active student plans.

---

## Key Screens (UI)

| Screen | Primary User | Purpose |
|---|---|---|
| Onboarding wizard | Student | Enter grade level, past course history (bulk), grades, and goals |
| Dashboard | Student / Parent | 3-row, 2-column grid: Row 1 (Active Plan, GPA), Row 2 (Attention Required — simplified: no category summary line or "Issues found" badge, shows only category titles with counts for Graduation Gaps/Semester Gaps/Prerequisite Violations + "View Report" button routing to `/planner?validation=open`; Achievements card with all badges earned + unearned in a single 2-column grid for Honor Graduate tier, Graduation Ready, Credit milestones, GPA milestones, Credits Earned), Row 3 (Academic Progress — shows all requirement groups with per-group segmented progress bars showing earned/planned/remaining, Quick Actions). Three validation categories: Graduation Requirement Gaps (red), Semester Requirement Gaps (amber), Prerequisite Violations (amber). Non-course requirements (ACT, FAFSA) excluded from issue counts. |
| Academic Progress | Student / Parent | Page title "Academic Progress" (nav label remains "Progress"). Two-column layout: left (2/3) has status filter bar (All/Gap-Missing/In Progress/OK-Complete/Not Started) + Expand All/Collapse All buttons + grouped sections (Graduation, Semester Requirements, IL Public University opt-in, Additional Requirements); right (1/3) sticky sidebar with honors badge (achievement from GPA) + summary card with three-state segmented progress bars per category (earned green, planned blue, remaining grey), earned/planned/gap counts, and status labels: "Complete" (all earned), "On track" (earned+planned covers all), or "N gaps" (uncovered). Course Load group has 2 sub-categories: "Course Count Per Semester" and "Physical Welfare / Dance / Driver Ed". Course-match cards show earned/planned/needed breakdown below progress bar. Print button in header triggers `window.print()`. Print gated by `canExportPdf` (Plus+ only). |
| 4-Year Planner grid | Student | Click-to-add courses in a grade × semester grid with inline validation |
| Prerequisite graph | Student | Visual DAG showing prereq chains and what each course unlocks |
| Plan Comparison | Student | Side-by-side diff of Plan A vs Plan B (GPA, requirements, course load) |
| What-If Simulator | Student | Try course swaps; see GPA/requirement impact without saving |
| Course Browser | Student / Parent | Search, filter by division/credit type/grade; view prereqs and dual credit info |
| Transcript | Student / Parent | Read-only view of completed courses from primary plan with grades, semester GPA, grade-level GPA, cumulative GPA, credits earned. All grade entry happens in the planner page. Print button (printer icon) in header next to "Edit in Planner" button triggers `window.print()` for browser-native printing. Print gated by `canExportPdf` (Plus+ only). |
| GPA Calculator | Student | Live unweighted + weighted GPA with projected future GPA chart |
| Requirement Checklist | Student / Parent | Visual progress against graduation requirements per subject area |
| Dual Credit Summary | Student / Parent | Planned and earned college credits, partner colleges, transferability notes |
| AI Advisor | Student | Chat interface for course/career/planning Q&A |
| Notification Center | Student / Parent | All alerts and notifications with action links |
| Plan Export | Student | Generate PDF or shareable read-only link of the active plan |
| Pricing & Upgrade | Student | Tier comparison table, upgrade CTA, billing portal link, trial countdown; shown during trial and on 402 feature-gate |
| Billing (`/settings/billing`) | Student / billing contact | Pricing cards with 3-interval toggle (monthly/annual/4-year), current plan indicator, upgrade button (Stripe Checkout), manage subscription button (Stripe Billing Portal) |
| Settings (via avatar dropdown) | All users | Notification preferences, password change, linked accounts, subscription management, delete account. Accessed from user avatar dropdown in top nav (not main nav bar). For parents: avatar shows parent's own name/email with "Managing: StudentName · Gr X" subtitle. "Add Another Child" removed from dropdown. Child invite flow available from Settings. |
| Year-End Transition | Student | Confirm final grades, advance grade level, review plan for next year |
| Parent View | Parent | Read-only dashboard of student's plan, grades, GPA, and alerts |
| Counselor Dashboard | Counselor | View multiple students, filter by alert severity, bulk export plans |
| Admin / Catalog Manager | Admin | Upload new PDF, review diff, approve catalog reload |

**Accessibility (Phase 1 — design-in, not bolt-on):** All screens must meet WCAG 2.1 AA. This is a school-context tool — accessibility is not optional. Key requirements from day one:
- All interactive elements keyboard-navigable (planner grid cells, course cards, dropdowns)
- ARIA attributes on custom components (course card = `role="listitem"`, planner grid = `role="grid"`)
- Color contrast ratio ≥ 4.5:1 for all text; never rely on color alone for status (use icons + labels)
- Screen reader announcements for dynamic content (alerts, validation messages, GPA updates)
- Focus management on modal open/close and route transitions
- shadcn/ui provides accessible primitives — do not override accessibility attributes

Phase 5 includes a formal WCAG audit and remediation of any gaps, but the core patterns must be implemented from Phase 1.

**Mobile:** Responsive design required. Dashboard, alerts, grade entry, and notification center are the primary mobile screens. The 4-year planner grid and prerequisite graph need simplified mobile layouts (collapse to list view on small screens).

---

## Phased Delivery Plan

### Phase 1a — Data Foundation + Auth (Weeks 1-3)
- PDF extractor → `courses.json` → DB loader
- Create first `course_catalog_versions` entry on initial DB load
- Database schema + Drizzle migrations for all Phase 1 tables
- Seed script: subscription plans, divisions/departments, plan templates, graduation requirements (37 requirements across 4 groups)
- User auth (student + parent roles) with Google OAuth + email verification
- **Subscription setup at signup:** create `subscriptions` row (`status = trialing`, `subscription_plan_id = plus`, `trial_ends_at = NOW() + 14 days`); seed `subscription_plans` at deploy
- Basic student profile creation (grade level, graduation year)
- Course browser with search and filter (division, credit type, grade level) using `pg_trgm`
- **Accessibility baseline:** keyboard navigation, ARIA attributes, color contrast for all Phase 1a components
- Health endpoint (`/api/v1/health`) with DB + Redis connectivity checks
- PostHog analytics integration (signup, onboarding events)

> **Internal milestone:** At the end of Week 3, the course catalog is in the DB, auth works, and the course browser is functional. This can be demoed internally before the planner grid exists.

### Phase 1b — Core Planning + Onboarding (Weeks 4-6)
- Onboarding flow: bulk entry of current grade level + completed course history + plan template selection
- Goal setting (GPA target, college targets, career interests)
- 4-year course planner grid (click-to-add; drag-and-drop deferred to Phase 3)
- Prerequisite and co-requisite validation — inline pass/fail with tooltip explanation
- Enrollment rule enforcement (duration + semester slot matching)
- **Trial countdown banner** (from day 10 onward); upgrade CTA in nav
- Settings page (notification preferences, account management, subscription status)
- **Accessibility:** keyboard-navigable planner grid, screen reader support for validation messages

> **Scope note:** Phase 1 is 6 weeks total (split into 1a + 1b), not the original 5 — the PDF extractor alone takes 1-2 weeks. Defer drag-and-drop, plan comparison, and prerequisite graph to **Phase 3**. Validate the core planning UX with real users before building Phase 2.
>
> **Templates in Phase 1b:** Plan templates are seeded into the DB as part of the initial deployment script — they do not require the admin UI (which is Phase 5). A TypeScript seed file of starter templates is maintained in the repo and loaded alongside the course catalog. All 6 templates pass validation with zero violations (Driver Ed in Grade 10, correct grade-level placements, Applied Health after Health prerequisite in Pre-Med, Economics in STEM/CS, electives for Grade 10 underloads, PW coverage via Choice PE for Gr 11/12).

> **User testing checkpoint:** Before starting Phase 2, run the Phase 1b build with 3-5 real students and collect feedback. Plan the Phase 2 scope based on what they actually use.

### Phase 2 — Grade Tracking + GPA + Subscription Gating (Weeks 7-10)
- **Transcript page** (`/transcript`): read-only view of completed courses from primary plan with grades, semester GPA, grade-level GPA, cumulative GPA, credits earned. Replaces previously planned "Grade Tracker" — all grade entry happens in the planner page. Print button (printer icon) in header next to "Edit in Planner" button triggers `window.print()` for browser-native printing. Print gated by `canExportPdf` (Plus+ only); disabled with tooltip for Trial/Starter users.
- **GPA API** (`GET /api/v1/gpa`): calculates cumulative and projected GPA from `plan_courses` on primary plan (not `grade_entries`). Returns plan totals (`totalCredits`, `earnedCredits`, `totalCourses`) and `hasGrades` flag.
- **Graduation requirements with matching rules**: `matching_rule` JSONB column on `graduation_requirements` table. 5 rule types: `code_prefix`, `codes`, `division`, `multi_division`, `remainder`. Requirements API rewritten to use matching rules instead of simple `division_id` matching.
- **Requirements system expanded** to 4 groups / 37 total requirements: `graduation` (12 course-match, unchanged), `course_load` (16: 8 course count checks + 8 PW/Dance/DriverEd checks per semester), `il_public_university` (5 opt-in course-match: Science 6cr, Social Studies 6cr, Electives 4cr, English 8cr, Math 6cr), `non_course` (4: ACT manual, FAFSA manual, 46th Credit auto, Civics auto). `honors_status` REMOVED from requirements — now an achievement badge computed from GPA. New columns on `graduation_requirements`: `requirement_group`, `evaluation_type`, `display_order`, `is_opt_in`. `divisionId` now nullable. New tables: `student_requirement_status`, `student_requirement_opt_ins`. New API endpoints: `PUT /api/v1/requirements/status`, `PUT /api/v1/requirements/opt-in`. `GET /api/v1/requirements` returns `groups[]` alongside flat `requirements[]`, plus `gpaWaiverWarnings[]` and `honorsStatus` (achievement, not requirement). Group order: graduation, course_load, il_public_university, non_course.
- **GPA waiver eligibility check**: API validates 4+ GPA-counted courses per semester when waiver is applied. P/F-only courses are now correctly excluded from the GPA-counted course count (previously PE courses were counted as GPA-eligible, which understated the issue).
- **PW/Dance/DriverEd requirement**: Each semester must have at least one Physical Welfare, Dance (DNC prefix), or Driver Education (D/E prefix) course.
- **P/F-only course handling**: Regular PE courses (PED121/122/451/452/111/112) and Driver Ed (D/E231/232) identified via `isPassFailCourse()` in `config/grade-scale.ts`. Grade dropdown restricted to P/F options (`PASS_FAIL_OPTIONS`). GPA calculation excludes them (`CourseForGPA` interface includes optional `code` field). GPA waiver toggle hidden. Grey "P/F" badge on course cards with tooltip "Pass/Fail course — excluded from GPA and academic course count". Health, Applied Health, Adventure Ed, Lifeguard, and Leadership PE courses still get letter grades.
- **Course load count excludes non-academic courses**: PW division, DNC-prefix (Dance), and D/E-prefix (Driver Ed) courses are not counted toward the semester course load check (min 5, max 7/8) — they represent the "sixth supervised period".
- **Progress page** (`/progress`) renamed to **"Academic Progress"** (page title; nav label unchanged): Two-column layout — left (2/3) has status filter bar (All/Gap-Missing/In Progress/OK-Complete/Not Started) + Expand All/Collapse All buttons + grouped sections (Graduation, Semester Requirements, IL Public University, Additional Requirements); right (1/3) sticky sidebar with honors badge + summary card showing three-state segmented progress bars per category (earned green, planned blue, remaining grey) with earned/planned/gap counts and status labels: "Complete" (all earned), "On track" (earned+planned covers all), or "N gaps" (uncovered). Course Load group has 2 sub-categories: "Course Count Per Semester" and "Physical Welfare / Dance / Driver Ed". Course-match cards show earned/planned/needed breakdown below progress bar. Print button in header. **Empty state:** when no primary plan exists, shows "No active plan yet" message with a link to create a plan.
- **Dashboard restructured**: 3-row, 2-column grid — Row 1 (Active Plan, GPA), Row 2 (Attention Required, Achievements), Row 3 (Academic Progress, Quick Actions). "Validation Report" card renamed to **"Attention Required"** — simplified: no category summary line or "Issues found" badge in header; shows only category titles with counts (Graduation Gaps, Semester Gaps, Prerequisite Violations) + "View Report" button routing to `/planner?validation=open`. Honors badge removed from this card. **Empty state:** when no primary plan exists, Attention Required and Academic Progress cards show "Create a plan" messages instead of false gap counts. **Academic Progress** card now shows all requirement groups (not just graduation) with per-group segmented progress bars showing earned/planned/remaining, replacing old graduation-only credit progress and individual requirement list. New **"Achievements"** card with all badges (earned + unearned) in a single 2-column grid: Honor Graduate tier, Graduation Ready, Credit milestones (15/30/45), GPA milestones (3.0+/3.5+/4.0+), Credits Earned.
- **Validation categories** across planner and dashboard: Graduation Requirement Gaps (red, missing credits for diploma), Semester Requirement Gaps (amber, course load/PW-Dance/GPA waiver eligibility), Prerequisite Violations (amber, course ordering conflicts). Non-course requirements (ACT, FAFSA) are excluded from plan bar "Issues found" count.
- **Navigation**: "Progress" nav item between Planner and Transcript. Menu order: Dashboard, Courses, Planner, Progress, Transcript. Settings was moved from the main nav bar into the user avatar dropdown, which contains Settings, Billing, and Sign out. Sign out calls Supabase `signOut()` and redirects to `/login`. Mobile hamburger menu also includes Sign out.
- **Planner validation report** is now a **side panel** (380px, right side, sticky, scrollable): Frozen title "Validation Report". Collapsible summary: collapsed shows "Credits 48/45 | Reqs 11/12 | 1 gap | 15 warnings". Expanded summary has 3 groups: Credits (Total/Earned/Planned), Graduation Requirements (Met/In Progress/Gaps), Warnings (Semester/Prerequisite). 3 collapsible detail sections: Graduation Gaps (with credit progress bar inside), Semester Requirement Gaps, Prerequisite Violations. Warning messages use consistent "Gr X Sem Y:" prefix format as clickable links that navigate to the grade/semester in the planner grid. Clicking a link expands only that grade and highlights the target semester cell (blue ring, fades after 3s). Plan bar "Issues found" count includes graduation gaps, semester issues, and prerequisite violations only — non-course requirements (ACT, FAFSA) excluded. Planner auto-opens validation panel when navigated with `?validation=open` URL parameter (used by Dashboard "View Report" button). Works with any selected plan. Progress data auto-fetched on plan load. Auto-refreshes when the side panel is open and the plan is updated (course added/removed, grade/status changed) by automatically calling the requirements API.
- **Plan selection persistence**: selected plan in planner persisted via `sessionStorage`.
- **Plan templates fixed**: All 6 templates now pass validation with zero violations. Fixes: Driver Education added to Grade 10, correct grade-level placements (U.S. History Gr 11, Government Gr 12, Health Gr 10 only), Applied Health moved after Health prerequisite (Pre-Med), Economics added to STEM/CS, electives for Grade 10 underloads, PW coverage via Choice PE for Gr 11/12.
- **Reset to Template fix**: Now uses `pc.semester` and `pc.gradeLevel` from actual course data (not group key), adds `skip_validation: true` for template reset, and logs failures.
- **Requirements API enhancement**: `/api/v1/requirements` accepts optional `?planId=` query parameter to validate any plan, not just the primary plan.
- GPA calculator (unweighted + weighted)
- Projected GPA based on planned courses + estimated grades
- What-if GPA simulator (read-only mode)
- GPA trend chart from snapshots
- Credit accumulation display in the planner grid (running tally per subject area)
- Year-end transition workflow + screen
- **Stripe integration (complete):** Stripe Checkout for payment (subscription mode for monthly/annual, payment mode for 4-year plans). Stripe Webhook handler processing 5 event types (`customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`), idempotent via `stripe_events` table with UNIQUE on `stripe_event_id`. Stripe Billing Portal for subscription management. New files: `lib/stripe/client.ts` (Stripe SDK singleton), `lib/stripe/prices.ts` (price ID mapping), `app/api/v1/stripe/checkout/route.ts`, `app/api/v1/stripe/webhook/route.ts`, `app/api/v1/stripe/portal/route.ts`, `app/api/v1/subscriptions/route.ts`.
- **`stripe_events` log table:** stores every incoming Stripe event raw for replay and reconciliation
- **Nightly Stripe reconciliation job:** compare `subscriptions.status` vs Stripe API; self-heal any missed webhooks
- **Subscription enforcement middleware (complete):** Redis-cached tier + `account_status` check on all API routes; `402` for gated features, `403` for frozen accounts. Expanded with 8 feature flags (`canWhatIf`, `canExportPdf`, `canComparePlans`, `canSharePlans`, `canUseAi`, `canViewPercentile`, `canParentDraft`, `canCreateGoals`). Feature gating uses flag-based checks, not tier name lists. Pro tier backward compatibility: maps `pro` to `plus` in middleware.
- **Billing page (complete):** `app/(app)/settings/billing/page.tsx` — pricing cards with 3-interval toggle (monthly/annual/4-year), current plan indicator, upgrade/manage subscription CTAs. Billing card buttons aligned at same level using flex layout. For trialing users: shows "Free Trial" with "X days left" badge; pricing cards suppress "Current Plan" indicator.
- **Trial expiry job (BullMQ cron):** nightly — downgrade expired trials (`status = 'trialing'` + `trial_ends_at < NOW()`) to Starter
- **Payment lapse freeze job:** triggered by `invoice.payment_failed` webhook; 5-day delay then freeze if still unpaid
- **Freeze/reactivation email flows:** payment reminder (day 1, day 4), freeze notice, reactivation confirmation
- **Downgrade guard:** excess plans archived (read-only) on plan-limit downgrade, never deleted

### Phase 3 — Plan Tools + Alerts (Weeks 11-14)
- ✅ Plan management page (`/plans` — "My Plans" / "Shared with Me" tabs, plan cards with status/permission badges, hide/show toggle, share with family members via `plan_shares` table with per-plan per-user permissions (owner/view/edit/delete + isHidden), `getPlanAccess()` enforced on all mutation endpoints, auto-create owner share, backward-compatible fallback, migration script, 14 API + 15 E2E tests)
- ✅ First name / last name on users (`firstName` and `lastName` columns; signup sets firstName from email prefix; auth/me returns and accepts PATCH for names; layout displays full name; family members show full names)
- ✅ Account editing (`PATCH /api/v1/accounts/:id` for student_name; Settings Account card with 2-column stacked layout)
- ✅ Family member removal (any member can remove other members except self; student removal allowed by non-student members)
- ✅ Settings UI improvements (collapsible cards, merged Family Members + Invite card, 2-column Account layout, password show/hide toggle, inline name editing)
- ✅ Consent system (`legal_documents` + `consent_records` tables, `/terms` and `/privacy` pages, `/consent` interstitial, consent gate in app layout, signup checkbox, OAuth redirect to consent, account deletion with full cleanup)
- ✅ 250 total tests (13 API tests for consent/auth-me/accounts + 20+ E2E tests for consent/settings/legal pages)
- Drag-and-drop planner grid upgrade
- Plan history / undo (last 20 changes)
- Prerequisite graph visualization (DAG view)
- Dual credit tracking and summary screen
- Rule-based course suggestions (graduation requirement gap filler)
- Overload/underload alert engine (background job via BullMQ)
- Alert center with actionable fix links
- In-app notification center (Supabase Realtime subscriptions — no polling)
- Email notifications via Resend
- Course suggestion for GPA targeting (heuristic-based)
- Multiple plan drafts + side-by-side plan comparison
- Plan export to PDF + read-only share link
- Template intensity levels (Easy/Moderate/Challenging/Intensive/Rigorous) — auto-selects CP/Accelerated/AP course variants and load per template
- Goal setting (GPA targets, credit milestones, course goals — Plus+ gated)
- User profile dropdown (Settings moved from main nav into top-right user avatar dropdown)
- NCAA eligibility tracking
- Seal of Biliteracy
- P.E. waiver rules (complex per-semester logic with multiple waiver types)

### Phase 4 — AI Advisory (Weeks 15-17)
- Claude API integration with course catalog as context
- Career path → course recommendations (validated against DB)
- AI plan review ("Here's what's strong, here's a concern")
- AI chat interface for course/planning Q&A
- SAT/ACT/AP score integration into AI context
- Rate limiting on AI endpoints (10 req/user/hr)
- Dual credit opportunity suggestions via AI

### Phase 5 — Annual Update Workflow + Polish (Week 18+)
- Admin UI: upload new PDF, review catalog diff, approve reload
- Plan migration when courses are renamed/removed (suggest replacements)
- Parent dashboard (read-only view)
- Counselor role (view multiple students, bulk alerts)
- Push notifications (mobile)
- WCAG 2.1 AA formal accessibility **audit** + remediation of any gaps (core patterns already implemented in Phase 1)
- Performance audit (Lighthouse, DB query analysis)
- **Elite — Percentile comparison:** nightly BullMQ job builds `grade_cohort_stats`; percentile display on dashboard for Elite subscribers; opt-in prompt in onboarding and Settings
- **Elite — Rigor score + college readiness score:** computed nightly alongside percentile stats; displayed as a score card on the student dashboard

---

## Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Frontend | Next.js (App Router) | SSR, API routes, strong ecosystem for grids/charts |
| UI component library | shadcn/ui | Accessible, unstyled-first, integrates with Tailwind; critical for the complex grid and DAG UI |
| State management | Zustand | Lightweight; well-suited for planner/simulator state without Redux boilerplate |
| Auth | Supabase Auth | Same instance as App DB; RLS handles multi-tenant isolation; Google OAuth built-in |
| Database | PostgreSQL via Supabase | Managed infra; RLS for row-level security; generous free tier |
| ORM | Drizzle ORM | Type-safe SQL queries from Next.js; lightweight, schema-first, Supabase-compatible; avoids raw Supabase client for complex joins |
| Real-time | Supabase Realtime | Postgres change subscriptions for live in-app notifications — eliminates polling |
| Cache | Redis via Upstash (early) → AWS ElastiCache (scale) | Upstash at <~500 users (serverless, no VPC, ~$0); migrate to ElastiCache when VPC cost is justified |
| Background jobs | BullMQ (Node.js) | Async alert evaluation, GPA recalculation, notification dispatch; runs on AWS ECS Fargate |
| AI | Claude API (claude-sonnet-4-6) | Best reasoning + natural language; structured tool use for DB-validated suggestions |
| Email | Resend | Best-in-class DX; React Email for templates; generous free tier |
| DAG visualization | React Flow | Purpose-built for node/edge graphs; handles the prerequisite DAG and course unlock trees |
| Charts / GPA trends | Recharts | Composable, Tailwind-friendly; used for GPA trend charts and credit progress rings |
| PDF generation | React-pdf | Renders plan export PDFs server-side from React components; matches the on-screen layout |
| API documentation | OpenAPI / Swagger via Zod | Zod schemas for request/response validation; `zod-to-openapi` generates the spec |
| Error tracking | Sentry | Captures frontend, API, and BullMQ worker errors |
| Analytics | PostHog | Product analytics, event tracking, feature flags; generous free tier; GDPR-friendly |
| Course data | JSON (source) + PostgreSQL (runtime) | Diffable artifact + queryable store |
| PDF extractor | Python (pdfplumber) | Standalone CLI batch job; independent of the web stack |

---

## Testing Strategy

### PDF Extractor (Python)
- Unit tests per field parser function (pytest)
- Integration test against full PDF — assert course count, field accuracy
- Regression snapshot: diff extracted JSON against previous run

### API Layer (Next.js / Node.js)
- Unit tests for GPA calculation logic (critical: wrong formula = distrust)
- Unit tests for alert threshold evaluation logic
- Integration tests per API endpoint (Vitest + supertest)
- Prerequisite DAG traversal tests (known chains from course catalog)

> Note: `pytest` applies only to the Python PDF extractor above. All Next.js API tests use JavaScript tooling (Vitest, supertest).

### Frontend
- Component tests for GPA calculator, planner grid, requirement checklist (Vitest + Testing Library)
- E2E tests for critical user flows: onboarding, add course to plan, enter grade, view alert (Playwright)

### Security Testing
- Automated dependency vulnerability scan on every PR (GitHub Actions + `npm audit` / Snyk)
- OWASP Top 10 manual review before public launch: focus on broken access control (RLS bypass), injection, and insecure direct object references (IDOR on plan/grade endpoints)
- Verify RLS policies: a student's API token must never be able to read or write another student's rows

### Test Data Strategy
- Seed script generates synthetic multi-year grade histories for 5 student personas (freshman, sophomore mid-plan, senior at risk, high achiever, athlete with NCAA concerns)
- Personas are used for E2E tests and manual QA; never use real student data in non-production environments
- Store seed data as version-controlled SQL fixtures alongside migrations

### Key Acceptance Criteria

**Core planning and grade tracking:**
- GPA calculator output matches manual calculation for 10 hand-verified test cases including weighted and pass/fail courses
- All AP courses flagged `is_ap = TRUE` in the DB
- All dual credit courses show partner college in the UI
- Prerequisite violation alert fires within 2 seconds of adding a violating course to a plan
- Plan export PDF renders correctly and matches screen state
- Year-end transition workflow completes without data loss (grade entries preserved, plan_courses status updated, grade level added to lockedGradeLevels)
- Grade-level locking enforced: API returns 409 on POST/DELETE/PATCH (non-waiver) for courses in locked grades; GPA waiver toggle succeeds on locked grades; lock/unlock endpoint tested
- RLS policy test: authenticated student cannot read another student's `plan_courses` row (assert 0 rows returned)
- RLS: student API token attempting INSERT on another student's `plan_courses` is rejected
- Counselor API token can read linked student's plans/grades/alerts; cannot read non-linked student data (0 rows)

**Subscription enforcement:**
- Student on Starter tier calling an Elite-gated API endpoint receives `HTTP 402` with `{ "upgrade_required": true, "feature": "ai_suggestions", "minimum_tier": "elite" }`
- Frozen account calling any write endpoint receives `HTTP 403` with `{ "account_frozen": true, "reason": "payment_lapsed", "reactivate_url": "..." }`
- Redis-cached tier is invalidated and refreshed within 1 second of a Stripe webhook updating `subscriptions.status`
- Stripe sends same webhook twice (retry); second request hits `UNIQUE` constraint on `stripe_events.stripe_event_id` and produces no duplicate state changes

**Account freeze and reactivation:**
- Account frozen for `payment_lapsed`: reminder emails sent on day 1 and day 4; `account_status` transitions to `'frozen'` with `freeze_reason` set on day 5 if invoice remains unpaid
- Reactivation: user pays outstanding invoice; `invoice.paid` webhook fires; `subscriptions.status = 'active'` and `account_status = 'active'` updated atomically; `account_events` row inserted
- Graduation detection cron runs nightly; `graduation_year < current_academic_year_start` triggers freeze with `freeze_reason = 'graduation_complete'`; graduation email sent; account remains read-only

**Primary plan switching:**
- Student promotes Plan B to primary; `plan_history` records `set_primary` action for both Plan A (demoted) and Plan B (promoted)
- Concurrent requests to set two different plans as primary: partial unique index ensures exactly one succeeds; second request fails with unique constraint violation and must be retried
- After primary switch, dashboard, planner grid, requirement checklist, and GPA projections all reflect the new primary plan

**Plan share links:**
- Student generates a share link; unauthenticated visitor can view the plan as a read-only snapshot (all course grid, GPA projection, requirement status visible)
- Share link with `expires_at` in the past returns `404`
- Revoked link (`revoked_at IS NOT NULL`) returns `404`
- Accessing a valid link sets `last_accessed = NOW()`
- Visitor cannot modify plan data; all write endpoints with the share token are rejected

---

## Deployment & Infrastructure

| Component | Platform | Notes |
|---|---|---|
| Next.js frontend + API routes | AWS Amplify | Managed Next.js SSR; preview deployments per PR; env vars pulled from AWS Secrets Manager |
| PostgreSQL + Auth | Supabase Pro | Managed; enable PgBouncer connection pooling; Supabase project in the closest AWS region |
| Redis (early phase) | Upstash | Serverless Redis; no VPC or NAT Gateway required; ~$0 at <50 users |
| Redis (scale phase, ~500+ users) | AWS ElastiCache (`cache.t4g.micro`) | Migrate when fixed VPC costs (~$32/mo NAT Gateway or ~$14/mo VPC endpoints) are justified by traffic |
| BullMQ worker | AWS ECS Fargate | Persistent containerised Node.js process; Docker image in Amazon ECR; separate ECS service from Next.js |
| Container registry | Amazon ECR | Stores worker Docker images; tagged by git SHA |
| Secrets management | AWS Secrets Manager | All production secrets (DB, Stripe, Anthropic, Resend keys); referenced by Amplify + ECS task definitions |
| PDF extractor | Local CLI / GitHub Actions | Runs once per year; no always-on infra needed |
| Email | Resend | SaaS; no infra to manage |
| Error tracking | Sentry | Configured in both Next.js app and ECS Fargate worker |
| CI/CD | GitHub Actions → AWS | Test on PR; build + push ECR image + deploy to Amplify + ECS on merge to `main` |

**Environment strategy:**
- `development` — local Supabase instance (via `supabase start`), local Redis via Docker; no SQLite fallback (PostgreSQL-specific constraints and UUIDs are incompatible with SQLite)
- `staging` — Supabase (separate project) + Upstash (separate instance); seeded with anonymized test data; deploys via GitHub Actions on push to `staging` branch
- `production` — Supabase Pro + Upstash → ElastiCache when scale justifies; PITR enabled; daily backups; secrets in AWS Secrets Manager; never committed to git

**Backup strategy:**
- Supabase Pro: daily automated backups, 7-day retention; enable point-in-time recovery (PITR) for production
- **Backup restore test:** verify a full restore from PITR backup at least once before public launch and quarterly thereafter
- Export `courses.json` artifacts to GitHub releases as a secondary archive

> **Note:** BullMQ requires a persistent Node.js process — it cannot run on AWS Amplify's serverless functions. The job worker runs as a dedicated AWS ECS Fargate task, deployed separately from the Next.js app.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| GPA weight table incorrect | High — users distrust entire tool | Get official weights from school, display source, make configurable |
| AI hallucinates course names | High — bad recommendations shown | Validate all AI output against DB before display; log mismatches |
| Plan breaks when course removed from catalog | Medium | Detect on annual reload, alert affected students, offer replacement suggestions |
| Onboarding friction for existing students | High — low adoption | Bulk grade entry table in onboarding wizard; skip-and-complete-later option |
| Alert engine performance at scale | Medium | Run in background job queue; never in API request cycle |
| Scope creep in Phase 1 | Schedule risk | Strict MVP: simple grid + prereq validation only; no drag-drop or DAG yet |
| College requirement data accuracy | Medium | Source from Common Data Set files; display as guidance, not guarantee |
| BullMQ worker downtime (ECS Fargate) | Medium | Alerts delayed but not lost; queued jobs persist in Redis and retry on worker restart; ECS auto-restarts failed tasks |
| Dual credit transferability varies by college | Medium | Display information only; include disclaimer that transferability is not guaranteed |
| Over-reliance on AI recommendations | High — counselor bypass | Add prominent disclaimer on every AI response: "These are suggestions only. Confirm all course decisions with your school counselor." |
| Incorrect grade entry by user | High — cascades to wrong GPA and wrong suggestions | Show clear edit/correction UI; display a "data entered by you" badge on all user-supplied grades |
| Year-end transition not completed | Medium — plan becomes stale | Send reminder email before school year end; show dashboard banner until year-end workflow is completed |
| Alert deduplication failure | Low UX / trust risk | `deduplication_key` constraint ensures only one active alert per unique condition per student |
| Redis cache stale data | Medium — wrong GPA shown | Set TTL on all cached values (GPA: 5 min, requirement_progress: 10 min); on cache miss, fall back to live DB query; invalidate on every grade entry or plan save |
| Supabase vendor lock-in | Low-Medium long-term | Schema and queries use standard PostgreSQL SQL via Drizzle ORM; migrating to another hosted PostgreSQL (e.g., Neon, Amazon RDS) requires only connection string change |
| Subscription gating blocks a student mid-year | High UX / trust risk | Never delete data on downgrade; archived plans remain readable; show clear upgrade path; consider a grace period before hard-gating features |
| Stripe webhook delivery failure | Medium — subscription status stale | Use Stripe's webhook retry + store all events in a `stripe_events` log table; reconcile on next webhook or nightly job |
| Percentile cohort too small to surface | Medium | Suppress the feature entirely below 50-student threshold; show "Invite friends" CTA until threshold is met |
| Opt-out students skew percentile stats | Low | Document the opt-in bias; label data as "among SAPS users" not "all Stevenson students" |
| Pricing perceived as unfair for students | High adoption risk | Keep Starter tier genuinely useful; do not paywall core planning. Consider a "student proof" annual discount once school partnerships form |
| Account frozen during critical planning period | High UX / trust risk | Show banner 3 days before grace period expires; send day-1 and day-4 payment reminder emails; never freeze without prior warning |
| Graduation detection fires for wrong year | Medium — premature freeze | Nightly cron compares `graduation_year` to current school year (not calendar year); use the start of the academic year as the boundary, not Jan 1 |
| Graduated student loses access before data export | Medium — right to erasure risk | Freeze (not deactivate) on graduation; send export prompt immediately; never auto-deactivate without explicit user action |
| Stripe webhook missed or delayed | Medium — account stuck in wrong state | Log all Stripe events to `stripe_events` table; nightly reconciliation job compares `subscriptions.status` against Stripe API; self-heals within 24 hours |

---

## Data Privacy & Compliance

This section must be revisited before any public launch or school partnership.

**As a personal/family planning tool (current scope):**
- Not subject to FERPA (no connection to school systems)
- Standard data privacy practices: encrypted at rest, TLS in transit, no sale of user data
- Grades and goals entered by users are personal data — handle accordingly
- **Consent system (Phase 3 — implemented):** `legal_documents` and `consent_records` tables track versioned legal document acceptance. `/terms` and `/privacy` pages render legal content. `/consent` interstitial enforced via consent gate in app layout for users who haven't accepted current terms. Signup includes a consent checkbox. OAuth users redirected to `/consent` after first login. Account deletion performs full cleanup (Stripe customer deleted, Supabase auth user deleted, Redis cache cleared, PostHog user data removed).

**If the school officially adopts this tool:**
- FERPA applies immediately — consult legal counsel before storing data transmitted from school systems
- Requires a formal data-sharing agreement with District 125
- Parent/guardian consent flows required for students under 18

**COPPA (Children's Online Privacy Protection Act):**
- If any user is under 13, COPPA applies. High school students are typically 14+, but early planners (8th graders) may be younger. Add a date-of-birth check at signup and block registration for users under 13 until a parent-verified consent flow is in place.

**Data retention policy:**
- Active accounts: data retained indefinitely while account is active
- Deleted accounts: all personal data purged within 30 days of deletion request
- Graduated students: offer a "read-only archive" mode rather than auto-deletion; prompt at graduation year + 6 months
- Anonymized aggregate data (no PII) may be retained for product analytics

**GDPR:**
- If European families use this tool, GDPR applies. At minimum: consent on signup, right to erasure, data portability (export all my data as JSON). Supabase stores data in the US by default — EU users may require a EU-region Supabase instance.

**General best practices regardless of scope:**
- Never log raw grade data in application logs
- Allow users to delete their account and all associated data (right to erasure)
- Do not use student grade/goal data to train AI models
- Supabase RLS ensures a student's rows are never accessible to other students at the DB layer — enforce this from day one
- Conduct an OWASP Top 10 security review before any public launch

---

## Missing Data Sources

The PDF covers school-level data only. Additional sources needed:

| Missing Data | Suggested Source |
|---|---|
| Illinois state graduation requirements | ISBE website (scrape once, update manually) |
| College-specific admission requirements | Common Data Set files, manual curation per target school |
| Career-to-course mappings | O*NET API + manual curation |
| GPA weight table | Stevenson school website / student handbook |
| Historical course difficulty data | Not public — requires school partnership |
| AP exam score scales | College Board website (public, stable) |
| Dual credit partner college course codes | Harper College and other partner college websites |
| Course enrollment open/close dates | School website / district calendar |
| NCAA core course eligibility requirements | NCAA Eligibility Center website (ncaa.org) — critical for student athletes |
| Plan templates content (track definitions) | Manual curation based on college counselor input |

---

*Last updated: 2026-04-01 (rev 8)*
