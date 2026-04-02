# Student Academic Planning System (SAPS)
## Executive Summary

**Prepared for:** Executive Leadership
**Date:** March 2026
**Status:** Phase 1b Complete — Active Development

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
| **School Counselors** | Read-only dashboard across their assigned students; receive bulk alerts (future phase) |

The platform is designed as a **personal/family planning tool** — no school system integration is required at launch. This means no institutional procurement, no district IT approval, and no FERPA complexity in Phase 1.

---

## Subscription Model & Revenue

Every new user receives a **14-day free trial of the Elite tier** (no credit card required). At trial end, the account automatically moves to the free Starter tier unless the user upgrades.

| Tier | Monthly | Annual | Key Capabilities |
|---|---|---|---|
| **Starter** | Free | Free | 1 plan, course browser, requirement validation, GPA tracking |
| **Plus** | ~$6/mo | ~$50/yr | Up to 5 plans, what-if GPA, plan comparison, PDF export, goal tracking |
| **Pro** | ~$12/mo | ~$95/yr | Unlimited plans, AI course suggestions, full alert system, dual credit tracking |
| **Elite** | ~$18/mo | ~$130/yr | Everything in Pro + percentile comparison and course rigor scoring vs. peers |

**Key monetization principles:**
- Starter is genuinely useful — core planning is free, not crippled. This drives adoption.
- Upgrades are prompted in-context when a student hits a plan limit or tries a gated feature.
- Annual billing offers approximately 2 months free vs. monthly — designed to capture families before school year starts.
- A student's subscription covers their linked parent accounts — no separate parent subscription required. The subscription is per student account (not per person). Parent accounts are always free. Any family member can be the billing contact. Parents with multiple children see an account switcher — each child's account has its own subscription tier.
- Downgrading never deletes data. Excess plans become read-only archives; all history and grades are preserved.

**Payment infrastructure:** Stripe handles billing, subscription lifecycle, and failure recovery. A 5-day grace period applies before a lapsed payment results in account restrictions.

---

## Product Differentiation

### Why students will choose SAPS over alternatives:

1. **Prerequisite intelligence.** The platform understands multi-level course chains (e.g., removing Algebra 2 in grade 9 automatically flags AP Calculus BC in grade 11 as at-risk). No other consumer tool does this.

2. **Dual credit tracking.** Several Stevenson courses earn transferable college credits through Harper College. SAPS surfaces these prominently in planning and AI recommendations — a concrete financial value for families.

3. **AI-powered career alignment.** Unlike generic planners, course suggestions are grounded in a curated career-to-course database and validated against the live course catalog before display. AI hallucinations are filtered out — students only see real courses.

4. **Whole-family visibility.** Parents receive the same plan and GPA visibility as students, with configurable notifications. This reduces the "I don't know what my kid is taking" problem.

5. **Year-end workflow.** A structured year-end wizard locks completed grades, advances the student's grade level, and prompts a plan review. Without this, planning tools become stale and abandoned.

---

## Phased Delivery Plan

The build is structured across five phases over approximately 18+ weeks. Phase 1 is split into two sub-phases (1a + 1b) to create an earlier internal validation milestone.

| Phase | Focus | Duration | Key Deliverables |
|---|---|---|---|
| **1a** | Data Foundation + Auth | Weeks 1–3 | ✅ Complete — PDF extractor, course catalog database, user auth, course browser, analytics integration |
| **1b** | Core Planning + Onboarding | Weeks 4–6 | ✅ Complete — 4-year planner grid (keyboard-accessible, mobile-responsive), course picker, prerequisite validation, enrollment rules, 6 plan templates, plan creation/deletion, per-semester status/grade editing, GPA calculation, semester course limits, credit display, core course removal warnings |
| **2** | Grade Tracking + GPA + Billing | Weeks 7–10 | Transcript page (read-only, print button), GPA API (from plan_courses), graduation requirements with matching rules expanded to 4 requirement groups (graduation, il_public_university, non_course, course_load — 37 total requirements), Academic Progress page (`/progress`, two-column layout with filter bar + grouped sections + sticky sidebar with honors badge + summary card), dashboard (3-row 2-column grid: Active Plan/GPA, Attention Required/Achievements, Academic Progress/Quick Actions), planner validation side panel (380px, sticky, scrollable, with clickable warning links), plan selection persistence, Stripe integration, subscription enforcement |
| **3** | Plan Tools + Alert Engine | Weeks 11–14 | Plan history/undo, prerequisite graph visualization, dual credit tracking, overload/underload alerts, plan comparison, PDF export, share links |
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
| Frontend | Next.js + shadcn/ui | Modern React framework; accessible components; works for the complex planner grid |
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

> **Claude API cost estimate:** Assumes ~30% of users are on Pro/Elite (AI-eligible). Average 3 AI requests/user/day at ~5K input tokens + ~1K output tokens per request. At claude-sonnet-4-6 pricing ($3/M input, $15/M output): ~$0.03/request × 3 requests × 60–300 active AI users × 30 days = $5–$270/month depending on scale. **Monitor input token counts per request from Phase 4 onward.** Cost can be reduced by caching common AI responses (e.g., career recommendations for the same career path + grade level combo).

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
| Official GPA weight table from Stevenson | Product / School contact | **Critical** — blocks GPA calculator |
| Exact subscription pricing (confirm ~$6/$12/$18) | Business | High — needed for Stripe setup |
| Career path initial data (Pre-Med, CS, Engineering, etc.) | Product | High — needed for Phase 4 AI features |
| COPPA consent flow legal review | Legal | High — needed before any public launch |
| Dual credit partner college course codes (Harper College, etc.) | Product | Medium — needed for Phase 3 |
| Illinois state graduation requirements | Product | Medium — needed for requirement validator |
| Plan template content (track definitions) | Product / Counselor input | Medium — needed for Phase 1 seeding |

---

## Recommended Next Steps

1. **Confirm GPA weight table and grade scale** with Stevenson — this single piece of data is the foundation of the GPA calculator and must be correct before any code is written.
2. **Finalize subscription pricing** and confirm with business/finance before Stripe configuration begins.
3. **Engage legal counsel** on COPPA date-of-birth gating and data retention policy before public launch.
4. **Identify 3–5 students** for Phase 1 user testing (ideally a freshman, a sophomore, a junior, and a senior).
5. **Begin Phase 1 development** once GPA weights and pricing are confirmed.

---

## Current Development Status

**Phase 1a is complete.** The following deliverables have been built and are functional:

- **PDF Extractor** (Python/pdfplumber): Extracts 315 courses from the Stevenson 2026-27 catalog PDF using a 3-phase pipeline (appendix name resolution, body extraction, name cleanup + prerequisite resolution). 331 prerequisite links resolved. 159 GPA waiver courses detected. Semester offering parsed per course: 89 Sem 1 only, 90 Sem 2 only, 136 full year, 6 Sem 1 exclusive, 6 Sem 2 exclusive, 168 available in both semesters. Structured prerequisite groups extracted with AND/OR semantics. Grade level parsing from above-lines for Early Bird courses. Manual grade overrides (AP Music Theory). Credit values corrected to 1 credit per semester / 2 per full year.
- **Database**: 32 tables in PostgreSQL via Drizzle ORM on Supabase (local dev). All tables from the tech design doc are implemented. `semesters_offered` integer array column added to courses table.
- **Auth**: Supabase Auth with email/password + Google OAuth, COPPA age check, 14-day Elite trial auto-activation. Google OAuth callback auto-provisions first-time users (creates users, accounts, profiles, subscriptions) and redirects to onboarding.
- **Course Browser**: Search, filter by division/department/credit type/grade level/AP/dual credit/GPA waiver/semester offered/duration, cursor-based pagination with total counts. Results sorted alphabetically by name then code. Semester info displayed on cards ("Sem 1 only", "Sem 2 only", "Sem 1 & 2", "Full Year"). GPA Waiver badge (yellow) on course cards.
- **Course Detail**: Centered modal (max-w-5xl) with 3-column info grid, badges in modal header. Prerequisites grouped by requirement_group with OR badges; semester pairs merged (e.g., "INTRODUCTION TO BUSINESS (BUS171 / BUS172)"). "What This Unlocks" also merges semester pairs. "Also available as" section showing clickable linked semester-partner courses. Division/Department names are clickable (sets filter and closes modal). Prerequisite and unlock course codes are clickable (navigates to that course). GPA waiver info, dual credit info.
- **Subscription Middleware**: Redis-cached tier lookup with fail-open.
- **API**: 8 endpoints (health, signup, login, OAuth callback, course list, course detail, course prereqs, user profile). Course list supports `semester_offered`, `semester_both`, and `duration` filter params; returns `semestersOffered` field; sorted by name then code with composite cursor encoding. Course detail returns `linkedCourses` array (semester partners).
- **Frontend**: Responsive horizontal top-nav layout, login/signup pages, course browser with 2-column grid, course detail modal, trial banner. Semester Offered radio filter (All/Sem 1/Sem 2/Sem 1 & 2/Full Year). Division filter values corrected to match actual Stevenson divisions.
- **Infrastructure**: Supabase local dev, Drizzle migrations, pino structured logging, PostHog analytics helpers, CSP headers, rate limiting.
- **Seed Data**: 4 subscription tiers, 15 divisions, 49 departments, 315 courses with prerequisites and semester offerings, 37 requirement definitions across 4 requirement groups.

- **Account model redesigned:** introducing an `accounts` table that separates person identity (users) from academic data context (accounts). Parents can create accounts for children, create plans, and manage billing. Students claim accounts via invite codes. Subscription, authorization, and RLS all operate on account_id for a consistent access pattern.

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

**Phase 2 Grade Tracking (in progress):** Transcript page (read-only view of completed courses from the primary plan with grades, semester GPA, grade-level GPA, and cumulative GPA — replaces the previously planned Grade Tracker; Print button with printer icon in header next to "Edit in Planner" button triggers `window.print()` for browser-native printing). GPA API calculates cumulative and projected GPA from `plan_courses` on the primary plan (not `grade_entries`). Graduation requirements rewritten with matching rules — each requirement has a `matching_rule` JSONB column supporting 5 rule types: `code_prefix` (e.g., ENG courses), `codes` (specific course codes), `division` (all courses in a division), `multi_division` (multiple divisions), and `remainder` (catch-all for unclaimed courses). Requirements API enhanced with optional `?planId=` query parameter to validate any plan, not just the primary plan. All grade entry happens in the planner page via status dropdown + grade dropdown on each course card.

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
- **Navigation**: "Progress" nav item between Planner and Transcript (unchanged). Menu order: Dashboard, Courses, Planner, Progress, Transcript, Settings.
- **Planner validation report** is now a **side panel** (380px, right side, sticky, scrollable): Frozen title "Validation Report". Collapsible summary: collapsed shows "Credits 48/45 | Reqs 11/12 | 1 gap | 15 warnings". Expanded summary has 3 groups: Credits (Total/Earned/Planned), Graduation Requirements (Met/In Progress/Gaps), Warnings (Semester/Prerequisite). 3 collapsible detail sections: Graduation Gaps (with credit progress bar inside), Semester Requirement Gaps, Prerequisite Violations. Warning messages use consistent "Gr X Sem Y:" prefix format as clickable links that navigate to the grade/semester in the planner grid. Clicking a link expands only that grade and highlights the target semester cell (blue ring, fades after 3s). Plan bar shows "Issues found" count covering graduation gaps, semester issues, and prerequisite violations only — non-course requirements (ACT, FAFSA) are excluded. Works with any selected plan (not just primary). Progress data auto-fetched on plan load and auto-refreshed when the plan is updated while the panel is open.
- **Plan selection persistence**: Selected plan in planner persisted via `sessionStorage` so navigating away and back retains the selection.
- **Planner auto-opens validation panel** when navigated with `?validation=open` URL parameter (used by Dashboard "View Report" button).

**Next up (remaining Phase 2):** Stripe integration, subscription enforcement, year-end transition workflow.

---

*This document summarizes the full feature specification in FEATURE_ANALYSIS.md (rev 9, April 2026). For technical schema, API design, acceptance criteria, and testing strategy, refer to the full specification.*
