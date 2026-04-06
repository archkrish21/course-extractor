# Student Academic Planning System (SAPS)
## Product Requirements Document

**Version:** 1.0
**Date:** March 2026
**Status:** Approved for development

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope & Assumptions](#2-scope--assumptions)
3. [User Personas](#3-user-personas)
4. [User Stories](#4-user-stories)
5. [Feature Requirements](#5-feature-requirements)
6. [User Flows](#6-user-flows)
7. [Success Metrics](#7-success-metrics)
8. [Acquisition & Landing Page](#8-acquisition--landing-page)
9. [Out of Scope](#9-out-of-scope)

---

## 1. Purpose

### 1.1 The Problem

High school students and their families face a consequential, multi-year planning challenge with no adequate dedicated tools.

**The planning problem is hard:**
- Stevenson High School offers hundreds of courses across 20+ subject divisions.
- Courses have prerequisites that chain across years — choosing the wrong course in Grade 9 can close doors in Grade 11 without any visible warning.
- Graduation requires satisfying specific credit totals across subject areas, a requirement set most students and parents don't fully understand until it's too late to correct.
- Some courses earn transferable college credit through partner institutions — a significant financial benefit that goes unnoticed by most families.
- The course catalog changes annually. Courses get renamed, removed, or have their prerequisites updated — breaking existing plans silently.

**The tracking problem is hard:**
- Students manage their grade history in spreadsheets, notes apps, or from memory.
- There is no tool that connects a student's past grades to their future plan to project where their GPA will land at graduation.
- The "what if I swap AP Chemistry for Honors Chemistry?" question gets answered with a calculator and a guess.

**The guidance problem is hard:**
- School counselors are stretched thin — a 30-minute annual meeting is the primary planning touchpoint for most students.
- Parents who want to be involved have no shared, structured view of their child's plan.
- Career path alignment ("if I want to study Pre-Med, which courses should I prioritize?") requires deep knowledge that most families don't have.

### 1.2 The Consequence of Doing Nothing

Students who don't plan carefully:
- Discover graduation credit gaps with less than one year remaining — too late to fix.
- Miss AP and dual credit opportunities that would have strengthened their college applications and saved tuition money.
- Choose courses without understanding multi-year prerequisite chains, then find advanced courses blocked in later years.
- Rely on advice from peers rather than structured guidance, with inconsistent outcomes.

### 1.3 The Solution

SAPS is a structured academic planning platform that gives students, parents, and counselors a shared, always-current view of where a student stands and what they should do next.

It replaces guesswork with:
- A four-year course planner with live prerequisite validation
- An automatic graduation requirement tracker
- A GPA calculator with projected and what-if views
- An AI-powered advisory engine grounded in the real course catalog
- Proactive alerts before problems become irreversible

### 1.4 Business Goals

| Goal | Metric |
|---|---|
| Establish SAPS as the go-to planning tool for Stevenson students | 200 registered users within 6 months of launch |
| Convert trial users to paid plans | 20% free-to-paid conversion within 30 days of trial expiry |
| Retain paid subscribers through the school year | >80% annual renewal rate on Plus/Elite |
| Demonstrate enough value to unlock school partnership conversations | Active use by at least one school counselor by Month 9 |

---

## 2. Scope & Assumptions

### In Scope (MVP through Phase 5)

- Students, parents, and counselors at Stevenson High School (District 125)
- Four-year academic planning (Grades 9–12)
- Grade tracking and GPA calculation based on Stevenson's weighted scale
- Graduation requirement validation against Stevenson's requirements
- Dual credit tracking for Harper College and other partner institutions
- AI-powered course and career recommendations
- Subscription-based monetization (Starter/Plus/Elite — Pro tier removed)
- Web application (responsive for mobile; no native app). Mobile-first responsive design from Phase 1 — see §5.2 for breakpoints and layout specs
- WCAG 2.1 AA accessibility compliance from Phase 1 for all core UI components — see §5.2 for detailed requirements

### Assumptions

- The school's course catalog is published annually as a PDF and is the authoritative source.
- GPA weights (AP/Honors/Accelerated bonuses) and the letter grade scale must be confirmed with the school before any GPA code is written.
- The platform is a personal/family planning tool — it does not connect to the school's information systems, does not read official transcripts, and is not subject to FERPA at launch.
- All grades entered are self-reported by students; they are not verified against official school records.
- The platform launches for Stevenson specifically and may expand to other schools in a future phase. Accounts store `state` (frozen to IL) and `schoolName` (frozen to Stevenson) for future multi-school expansion. Signup captures these as frozen fields with a "Request yours" link for unsupported schools; requests are stored in `school_requests` table.
- The platform uses a student-centric account model. Each account represents one student. Parents, guardians, and counselors are account members with defined permissions. Either a student or parent can create an account.

---

## 3. User Personas

### Persona 1 — Maya, the Motivated Sophomore

**Age:** 15
**Grade:** 10
**Situation:** Maya has a 3.7 GPA and wants to study Computer Science at UIUC. She's heard AP classes help with college admissions but doesn't know which ones to take or in what order. Her parents are supportive but don't know the Stevenson curriculum.

**Goals:**
- Understand which AP courses are most relevant for a CS major
- Make sure she's on track to graduate with strong credentials
- Not accidentally block herself from an advanced course by skipping a prerequisite

**Frustrations:**
- The school counselor meeting felt rushed; she left with general advice, not a specific plan
- The course catalog PDF is 80 pages and hard to navigate
- She doesn't know what her projected GPA will be when she graduates

**How she'll use SAPS:**
- Build a 4-year plan with her CS track in mind
- Use AI recommendations to identify the right AP sequence
- Check her projected GPA after each grade entry

---

### Persona 2 — David, the Worried Parent

**Age:** 47
**Situation:** David's son Ethan is a junior who hasn't been tracking his credits carefully. David doesn't know if Ethan is on track to graduate. He tries to stay involved but Ethan doesn't always share details about his courses or grades.

**Goals:**
- Get a clear, current view of Ethan's graduation status without creating friction
- Be notified immediately if something looks wrong — not find out at the end of the year
- Understand what "on track" actually means in terms of credits and GPA

**Frustrations:**
- He has to ask Ethan for every piece of information
- He doesn't know if the courses Ethan chose are building toward anything
- He has no way to verify if Ethan's plan makes sense

**How he'll use SAPS:**
- Linked read-only access to Ethan's plan and grades
- Email notifications when alerts fire (graduation risk, grade below target)
- Dashboard view showing graduation progress ring and GPA trend

---

### Persona 3 — Priya, the Overachieving Freshman

**Age:** 14
**Grade:** 9
**Situation:** Priya is starting high school and wants to maximize her four years. She's interested in Pre-Med and has heard about dual credit courses at Harper College. She's a planner — she wants to map out all four years before she even starts.

**Goals:**
- Build a complete four-year plan from day one
- Identify all dual credit opportunities and understand the credit savings
- Make sure every year builds logically toward her Pre-Med goal

**Frustrations:**
- She doesn't know which courses lead to which advanced options
- The dual credit information is scattered across the catalog PDF and Harper College's website
- She wants to compare a Pre-Med track with a Biomedical Engineering track to decide which direction to go

**How she'll use SAPS:**
- Select a Pre-Med plan template during onboarding and customize it
- Use plan comparison to diff Pre-Med vs. Biomedical Engineering tracks side-by-side
- Track dual credit courses and see the running college credit tally

---

### Persona 4 — Marcus, the Recovering Junior

**Age:** 17
**Grade:** 11
**Situation:** Marcus had a rough sophomore year (GPA dropped to 2.9) and wants to turn things around for college applications. He's not sure which courses in his remaining two years will have the highest impact on his GPA and college prospects.

**Goals:**
- Understand exactly what GPA he can realistically reach by graduation
- Identify lower-risk ways to demonstrate improvement without overloading himself
- Know if he's still on track to graduate on time given his past credit choices

**Frustrations:**
- He has no tool to see "if I get B+ in all remaining courses, what is my final GPA?"
- He's not sure how many credits he has toward each graduation requirement
- Every decision feels high-stakes because he has less runway than freshmen

**How he'll use SAPS:**
- What-if GPA simulator to model different scenarios
- Graduation requirement checklist to identify any credit gaps with urgency
- Overload/underload alerts to find the right course load for recovery without burnout

---

### Persona 5 — Ms. Chen, the School Counselor

**Age:** 38
**Situation:** Ms. Chen is a counselor at Stevenson assigned to 300 students. She doesn't have time for regular planning check-ins but wants to be able to quickly review a student's plan before a meeting and flag students who need intervention.

**Goals:**
- View student plans without the student having to send her a document
- Quickly identify students with graduation risk or overload alerts
- Share annotated plan feedback without editing the student's data

**Frustrations:**
- Students come to meetings with incomplete or outdated plans
- She has no way to monitor student progress between annual meetings
- She manually tracks concerns in a spreadsheet that's always out of date

**How she'll use SAPS:**
- Counselor dashboard: view all linked students, filter by alert severity
- Read-only access to any linked student's full plan, grades, and alerts
- No write access — she never modifies student data

---

## 4. User Stories

### Authentication & Onboarding

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-01 | As a new student, I want to sign up with my email or Google account so I can get started quickly without creating a separate password. | Must | 1 |
| US-01a | As a logged-in user, I want to sign out from the user avatar dropdown in the top navigation (or from the mobile hamburger menu) so I can securely end my session. Sign out calls Supabase `signOut()` and redirects to `/login`. | Must | 1 |
| US-02 | As a new student, I want to enter my current grade level and completed course history in bulk (table view, not one at a time) so that my GPA and progress tracker are accurate from day one. | Must | 1 |
| US-03 | As a new student, I want to select a starting plan template (e.g., "STEM Track", "Pre-Med", "Dual Credit Maximizer") so I don't start from a blank canvas. | Must | 1 |
| US-04 | As a new user, I want to see a 14-day free trial of the Plus tier (with trialing status) automatically activated so I can explore features before deciding whether to pay. | Must | 1 |
| US-05 | As a student, I want to set my GPA goal, target colleges, and career interests during onboarding so the system can personalize its recommendations. | Should | 1 |
| US-06 | As a parent, I want to create an account for my child by entering their name, date of birth, grade level, and graduation year, so I can start building course plans before my child signs up. | Must | 1b |
| US-06a | As a parent who created an account, I want to generate an invite code so my child can claim their account and set their own email/password. | Must | 1b |
| US-06b | As a student, I want to claim an account created by my parent using an invite code, so I take ownership of my academic data. | Must | 1b |
| US-07 | As a student, I want to invite my parent to join my account so they can view my plans and create plan suggestions for me. | Must | 1b |
| US-07c | As a parent, I want to invite my child (student) via email from Settings so they can join the account. If the student already has an account, the parent is added to the student's existing account; if not, a new account is created with both members. The active account auto-switches to the joined account. | Must | 3 |
| US-07a | As a parent with multiple children, I want to switch between my children's accounts using an account switcher, with each child's subscription tier governing available features. | Must | 1b |
| US-07b | As a student, I want to mark any of my plans as "private" so my parents cannot see them. | Should | 1b |

> **Implementation note:** Account management APIs, claim flow, and account switcher were built ahead of schedule in Phase 1b. The Settings page UI for managing family members remains for Phase 2.

### Account Creation & Membership Flow

```
Account Creation — Student Initiates:
1. Student signs up → account created automatically
   └── student is the account subject and first member
2. Student goes to Settings → "Invite Family"
   └── Generates invite code (target_role: parent)
3. Parent signs up or logs in → enters invite code
   └── account_members row created (role: parent, can_edit: true)
   └── Student notified: "Your parent [name] has joined your account"

Account Creation — Parent Initiates:
1. Parent signs up (role: parent)
2. Parent selects "Create Account for Your Child"
   └── Enters: child name, date of birth (COPPA check), grade level, graduation year
   └── accounts row created (student_user_id = NULL, claim_code generated)
   └── account_members row created (role: parent, can_edit: true)
3. Parent shares claim code with student (outside the app)
4. Student signs up → enters claim code
   └── accounts.student_user_id set, claimed_at set
   └── account_members row created (role: student, can_edit: true)
   └── 14-day Plus trial (trialing status) starts at claim time
   └── Parent notified: "Your child [name] has claimed their account"

Unclaimed Account Behavior:
- Parent can: browse courses, create plans, select templates
- Parent cannot: enter grades, set Primary plan, use AI features
- Trial does NOT start until student claims
- Account auto-freezes after 90 days if unclaimed (resend invite or archive)

Unlinking:
- Any member can leave an account from Settings
- Removing a member revokes their access; plans they created remain
- Any member can remove other members (except themselves); students can be removed by non-student members
- Remove button shows for all members except self

Account Switcher (parent with multiple children):
- Parent sees a dropdown in the top nav showing each child's name, grade, and tier
- Switching changes the entire app context (plans, courses, grades, subscription features)
- Each child's account is independent with its own subscription
```

**Parent Visibility by Phase:**
| Phase | What Parents Can See/Do |
|---|---|
| **2** | Create account for child. Create plans in child's account. View plans, courses, grades (read-only). Account switcher for multi-child parents. |
| **3** | Receive email notifications for alerts. View dual credit summary. Compare plans (Plus+). |
| **4** | No additional parent features (AI advisory is student-only) |
| **5** | Dedicated parent dashboard. Co-edit toggle for plan editing rights. |

> **Note on parent experience gap (Phases 2–4):** In Phases 2–4, linked parents access their child's data through the same pages students use (planner grid, transcript, etc.) — there is no dedicated parent dashboard until Phase 5. This is intentional: building a separate parent UI before the core student experience is mature would add scope risk. The Phase 2 parent experience is functional but not optimized for parents.

### Plan Management

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-10 | As a student, I want to add courses to a 4-year planner grid (organized by grade year and semester) so I can see my full academic path in one view. | Must | 1 |
| US-11 | As a student, I want the system to automatically warn me when I add a course I'm not eligible for (missing prerequisite, wrong grade level, wrong semester) so I don't make planning errors silently. | Must | 1 |
| US-12 | As a student, I want to create multiple plan drafts (e.g., "Pre-Med Track" and "CS Track") so I can compare options before committing. | Must | 1 |
| US-12a | As a parent, I want to create plan drafts in my child's account so I can suggest course sequences for them to consider. | Must | 2 |
| US-12b | As a student, I want to see who created each plan in my account (me, Mom, Dad) so I know whose suggestion it is. | Must | 2 |
| US-13 | As a student, I want to designate one plan as my Primary plan so the dashboard, GPA projections, and requirement checklist always reflect my main direction. | Must | 1 |
| US-14 | As a student, I want to compare two plans side by side (course load, GPA projection, requirement status) so I can make an informed decision between tracks. | Should | 3 |
| US-15 | As a student, I want to undo the last 20 changes to my plan so I can experiment without fear of losing my work. | Should | 3 |
| US-16 | As a student, I want to export my primary plan as a PDF so I can share it with my counselor or parents. | Should | 3 |
| US-17 | As a student, I want to generate a read-only shareable link to my plan so others can view it without needing an account. | Should | 3 |
| US-17a | As a student, I want to share a plan with a family member and set their permission level (view only / can edit / full access) so I control who can modify my plans. **Implemented:** Share modal on `/plans` page sets per-family-member permissions. `plan_shares` table stores per-plan, per-user permissions (owner/view/edit/delete) with permission hierarchy: owner > delete > edit > view. | Must | 3 |
| US-17b | As a student, I want to see all my plans and plans shared with me in one place so I can manage them easily. **Implemented:** `/plans` page with "My Plans" and "Shared with Me" tabs. Plan cards show status badges and permission level. | Must | 3 |
| US-17c | As a student, I want to hide a plan from my planner without deleting it so I can reduce clutter while preserving the plan. **Implemented:** `isHidden` toggle on `plan_shares`; hidden plans excluded from planner dropdown. | Should | 3 |
| US-17d | As a parent, I want per-plan permission enforcement so I can only edit plans I have been granted edit access to. **Implemented:** All mutation endpoints use `getPlanAccess()` instead of `accountCtx.canEdit`. Backward-compatible: plans without `plan_shares` rows fall back to `account_members.canEdit`. | Must | 3 |
| US-18 | As a student, I want to complete a year-end transition wizard each summer that locks my final grades, advances my grade level, and prompts me to review my upcoming year plan so my plan never becomes stale. | Must | 2 |

### Grade Tracking & GPA

> **Phase 2 update:** Grades are entered via the planner page (status dropdown + grade dropdown on each course card) and stored in `plan_courses.planned_grade`. The Transcript page (`/transcript`) is a read-only view showing completed courses from the primary plan with their grades, semester GPA, grade-level GPA, and cumulative GPA. Print button (printer icon) in header next to "Edit in Planner" button triggers `window.print()`. **Subscription gated:** print button requires `canExportPdf` (Plus+ only); Trial and Starter users see a disabled button with "Upgrade to Plus to print" tooltip. No editing on the transcript — all grade changes happen via the planner. The GPA API reads from `plan_courses` on the primary plan, not from `grade_entries`.

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-20 | As a student, I want to enter grades for each course via the planner page (status dropdown + grade dropdown) so my GPA is always up to date. Midterm grades are not tracked — Stevenson uses a single final grade per semester. | Must | 2 |
| US-21 | As a student, I want to see my cumulative GPA (completed courses only), projected GPA (including planned future courses with estimated grades), and weighted GPA side by side so I understand where I stand now and where I'm headed. | Must | 2 |
| US-22 | As a student, I want to use a what-if GPA simulator to try course swaps (e.g., "replace AP Chemistry with Honors Chemistry") and see the GPA impact without saving any changes so I can explore safely. | Should | 2 |
| US-23 | As a student, I want to see a GPA trend chart over time (from semester snapshots) so I can show improvement to colleges. **Implemented:** Recharts `LineChart` on the Progress page right sidebar showing unweighted (primary color) and weighted (success color) GPA over time. Only renders when 2+ snapshots exist. Fetches from `GET /api/v1/gpa/snapshots`. | Should | 2 |
| US-24 | As a student, I want my GPA to automatically take a snapshot at the end of each semester (when I mark grades final) so I don't have to remember to do it manually. **Implemented:** Year-end wizard auto-creates a GPA snapshot with trigger `semester_end` from completed `plan_courses`. Non-fatal if snapshot creation fails. | Should | 2 |
| US-25 | As a student, I want to store my SAT, ACT, and AP exam scores in my profile so the AI advisor can factor them into its recommendations. | Could | 4 |

### Graduation Requirements

> **Phase 2 update:** Each graduation requirement has a `matching_rule` (JSONB) that specifies how courses are matched to that requirement. Five rule types: `code_prefix` (e.g., all ENG courses), `codes` (specific course codes), `division` (all courses in a division), `multi_division` (courses across multiple divisions), and `remainder` (catch-all for courses not claimed by other requirements — used for "Additional Credits and P.E."). The requirements API uses matching rules instead of simple division_id matching.
>
> **Phase 2 update (expanded):** The requirements system has been expanded from 12 graduation-only requirements to **37 total requirements** across 4 requirement groups:
> - `graduation` — 12 course-match requirements (existing Stevenson graduation credit requirements, unchanged)
> - `course_load` — 16 per-semester requirements: 8 course count checks (Grades 9-12 x Sem 1-2, min 5 / max 7-8) + 8 PW/Dance/DriverEd checks (each semester must have at least one Physical Welfare, Dance [DNC prefix], or Driver Education [D/E prefix] course)
> - `il_public_university` — 5 opt-in course-match requirements for Illinois public university admission (Science 6cr, Social Studies 6cr, Electives 4cr, English 8cr, Math 6cr)
> - `non_course` — 4 requirements: ACT (manual checkbox), FAFSA (manual checkbox), 46th Credit (auto-from-course), Civics & Patriotism (auto-from-course)
> - Note: `honors_status` was REMOVED from requirements — it is now an achievement badge computed from GPA
>
> Four evaluation types: `course_match`, `manual_checkbox`, `auto_from_course`, `course_load_check`. Schema changes: `graduation_requirements` table has `requirement_group`, `evaluation_type`, `display_order`, `is_opt_in` columns; `divisionId` now nullable. New `student_requirement_status` table for manual checkbox tracking. New `student_requirement_opt_ins` table for opt-in group enablement. New API endpoints: `PUT /api/v1/requirements/status` (toggle manual checkboxes), `PUT /api/v1/requirements/opt-in` (enable/disable opt-in groups). `GET /api/v1/requirements` now returns `groups[]` array alongside existing flat `requirements[]` (backwards compatible), plus `gpaWaiverWarnings[]` and `honorsStatus` (achievement, not requirement). Group order: graduation, course_load, il_public_university, non_course. GPA waiver eligibility check validates 4+ GPA-counted courses per semester when waiver is applied.

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-30 | As a student, I want to see a visual checklist of graduation requirements (credits required per subject area) with my current progress filled in so I always know what's left. | Must | 2 |
| US-30a | As a student, I want to see my requirements organized by group (Graduation, Semester Requirements, IL Public University, Additional Requirements) so I can understand all dimensions of my academic standing. | Must | 2 |
| US-30b | As a student, I want to opt in to tracking Illinois public university admission requirements so I can see whether my plan meets those additional standards. | Must | 2 |
| US-30c | As a student, I want to check off non-course requirements (ACT, FAFSA) via clickable checkbox cards so I can track items that aren't tied to specific courses. | Must | 2 |
| US-30d | As a student, I want to see my honors status as an achievement badge (computed from GPA) in the Progress page sidebar and Dashboard Achievements card so I know where I stand. | Should | 2 |
| US-30e | As a student, I want to see per-semester course load status (underload/overload badges) so I can identify semesters that need adjustment. | Must | 2 |
| US-31 | As a student, I want the system to immediately alert me when my plan creates a graduation credit gap (e.g., I've only planned 2 of the 4 required English credits) so I can fix it before it's too late. | Must | 2 |
| US-32 | As a parent, I want to see my child's graduation requirement progress so I can have an informed conversation with them about their plan. | Must | 5 |

### Dual Credit Tracking

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-40 | As a student, I want dual credit courses flagged visually in the planner so I can easily identify which courses earn college credits. | Must | 3 |
| US-41 | As a student, I want to see a running tally of college credits I've earned or planned through dual credit courses so I understand the financial and academic value. | Should | 3 |
| US-42 | As a student, I want the AI advisor to surface dual credit opportunities I haven't planned yet so I don't miss a valuable option. | Could | 4 |

### Prerequisite Intelligence

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-50 | As a student, I want to see the full prerequisite chain for any course (what I need to take first, and what it unlocks) so I can plan the right sequence. | Must | 1 |
| US-51 | As a student, I want the planner to flag prerequisite violations transitively — not just the direct prerequisite — so that removing a course in Grade 9 shows me all the downstream courses in Grades 11–12 that are now at risk. | Must | 1 |
| US-52 | As a student, I want a visual DAG (directed graph) view of prerequisite chains so I can understand complex multi-year sequences at a glance. | Should | 3 |
| US-53 | As a student, I want OR-group prerequisites shown clearly (e.g., "Algebra 2 OR Precalculus") so I know which paths are available to me. | Should | 1 |

### Alert System

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-60 | As a student, I want to be alerted when my course load exceeds 7 courses in a single semester or when I'm taking more than 2 AP courses simultaneously so I can proactively manage stress and performance. | Must | 3 |
| US-61 | As a student, I want an alert when my actual grade in a course falls below my planned grade so I know my projected GPA has changed. | Must | 3 |
| US-62 | As a student, I want an alert if a course I've planned is removed or renamed in the new catalog so I can update my plan before it's too late. | Must | 5 |
| US-63 | As a student, I want every alert to include an actionable suggestion (not just a warning) so I know exactly what to do to resolve it. | Must | 3 |
| US-64 | As a student on Elite, I want an alert when my GPA trend is declining across consecutive heavy-load semesters so I can adjust my load before it becomes a pattern. | Should | 3 |
| US-65 | As a parent, I want to receive email notifications when a critical alert fires on my child's account so I can help them address it. | Must | 3 |

### AI Advisory Engine

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-70 | As a student on Elite, I want AI-powered course recommendations aligned to my stated career path so I can build a plan that strengthens my college application for my target field. | Must | 4 |
| US-71 | As a student on Elite, I want an AI review of my full plan that highlights strengths and raises concerns so I get a second perspective before committing. | Should | 4 |
| US-72 | As a student on Elite, I want a chat interface to ask planning questions in natural language (e.g., "What AP courses should I take if I want to study Engineering?") so I can get advice at any time, not just during counselor hours. | Should | 4 |
| US-73 | As a student on Elite, I want every AI recommendation to only include real courses from the actual catalog so I never receive advice about a course that doesn't exist. | Must | 4 |

### Subscription & Account Management

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-80 | As a student, I want to see a countdown banner starting at Day 10 of my trial showing how many days remain so I'm not surprised when my trial ends. | Must | 1 |
| US-81 | As a student, I want to upgrade my subscription from within the app (upgrade modal + pricing comparison) so the path to paid is frictionless. | Must | 2 |
| US-82 | As a student, I want my data to be fully preserved if I downgrade my subscription — including excess plans (archived, not deleted) — so I never lose work due to billing changes. | Must | 2 |
| US-83 | As a student, I want a clear explanation when a feature I try to use is behind a paywall, with a direct link to upgrade, so I understand what I'm missing and how to unlock it. | Must | 2 |
| US-84 | As a student whose account is frozen due to payment lapse, I want to see a clear explanation of what happened and a direct link to resolve it — not just a generic error — so I can reactivate quickly. | Must | 2 |
| US-85 | As a student who has graduated, I want to keep read-only access to all my historical data indefinitely so I can reference my plan for college applications and credit transfers. | Should | 3 |

### Counselor Features

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-90 | As a counselor, I want a dashboard that shows all of my linked students with their active alert count and graduation status so I can triage who needs attention before meetings. | Must | 5 |
| US-91 | As a counselor, I want to view any linked student's full plan, grades, GPA, and alerts in read-only mode so I can prepare for meetings without asking students to send documents. | Must | 5 |
| US-92 | As a counselor, I want confirmation that I cannot edit any student data so I trust that my access is always read-only and non-intrusive. | Must | 5 |

### Elite Features

| ID | Story | Priority | Phase |
|---|---|---|---|
| US-95 | As an Elite subscriber, I want to see how my GPA, AP course count, credit load, and rigor score compare to other students at my grade level on the platform so I can benchmark my progress. | Should | 5 |
| US-96 | As an Elite subscriber, I want percentile results framed positively ("top 28% of grade 11 students") and only shown when the cohort has at least 50 contributing students so comparisons are meaningful and not discouraging. | Must | 5 |

**Rigor Score Calculation:**
Rigor score = (Σ course_weight × credit_hours) / total_credit_hours, where:
- CP courses = 1.0
- Accelerated courses = 1.5
- Honors courses = 2.0
- AP courses = 2.5
- Pass/Fail courses are excluded

The rigor score is recomputed nightly by the percentile stats job (Elite tier). It is displayed as both a raw score and a percentile rank among same-grade-level students on the platform.

---

## 5. Feature Requirements

### 5.1 Onboarding

| Req | Description | Priority |
|---|---|---|
| F-ON-01 | Email/password signup + Google OAuth. Email verification required before plan creation. Signup page: wider layout (max-w-lg), 2-column grids for credentials and personal info. Role selector with description cards (Student/Parent/Counselor). State (frozen to IL) and school (frozen to Stevenson) fields with "Request yours" link for unsupported schools. School request form stores to `school_requests` table via `POST /api/v1/school-request` (no auth). "Claim your account" link removed from signup. | Must |
| F-ON-02 | Date of birth captured at signup. Block registration for users under 13 (COPPA). | Must |
| F-ON-03 | **Bulk grade entry table** during onboarding: student selects courses from a dropdown and enters letter grades in a spreadsheet-style table. Not one course at a time. | Must |
| F-ON-04 | Plan template selection during onboarding (Pre-Med, STEM/Engineering, Arts, Dual Credit Maximizer, 4-Year College Prep, General). Templates are pre-seeded — no admin UI required. | Must |
| F-ON-05 | Goal setting: GPA target, college targets (reach/match/safety), career interest field. | Should |
| F-ON-06 | Skip-and-complete-later option for grade history and goals. Dashboard shows a "Complete your profile" banner for incomplete onboarding. | Must |
| F-ON-07 | 14-day Plus trial (trialing status) activated automatically at signup. No credit card required. Accounts API returns "trial" as the plan name when status is trialing. TierBadge shows "Trial" (amber). Billing page shows "Free Trial" with "X days left" badge. Pricing cards do not show "Current Plan" for trialing users. | Must |
| F-ON-08 | **Consent system (Phase 3 — implemented):** Terms of Service and Privacy Policy acceptance required at signup (checkbox) and enforced via `/consent` interstitial for existing users. `legal_documents` table stores versioned legal documents; `consent_records` table tracks user acceptance with timestamps. `/terms` and `/privacy` pages display legal content. Consent gate in app layout redirects users who haven't accepted current terms. OAuth users redirected to `/consent` after first login. | Must |

**Plan Templates at Launch:**
Six pre-seeded templates, each containing a recommended 4-year course sequence:
1. **College Prep (General)** — Balanced CP/Accelerated mix meeting all graduation requirements
2. **STEM Focus** — Emphasizes math/science with AP Calculus, AP Physics, AP Chemistry
3. **Humanities Focus** — Emphasizes English/Social Studies with AP Literature, AP History
4. **Pre-Med Track** — Biology/Chemistry/Physics sequence with AP Bio and AP Chem
5. **Computer Science Track** — CS course progression with AP Computer Science A
6. **Business/Economics Track** — Economics, accounting, and business courses

Templates are tied to a specific `catalog_version_id`. During annual catalog update, templates are cloned for the new version and admin reviews/updates any courses that changed. Students who previously copied a template are not affected — their plans are independent copies.

### 5.2 Four-Year Planner

| Req | Description | Priority |
|---|---|---|
| F-PL-01 | Grid layout: rows = Grade 9/10/11/12, columns = Semester 1 / Semester 2. Each cell shows courses for that grade-semester slot. | Must |
| F-PL-02 | Click-to-add course cards from a search/filter panel. | Must |
| F-PL-03 | Drag-and-drop course reordering within and between semesters. *(Deferred to Phase 3)* | Should |
| F-PL-04 | Inline validation on add: prerequisite violations, co-requisite violations, enrollment rule violations (duration mismatch), grade-level ineligibility. Each shows a tooltip with the specific reason. | Must |
| F-PL-05 | Transitive prerequisite violation detection: removing a course highlights all downstream courses at risk across all grade years. | Must |
| F-PL-06 | Full-year course enforcement: course occupies both semester slots and cannot be placed in only one. | Must |
| F-PL-07 | Multiple plan drafts per student. First plan auto-set to Primary. Additional plans default to Draft. | Must |
| F-PL-08 | Primary plan designation (one per student at a time). Switching primary requires a confirmation step. Logged in plan_history. | Must |
| F-PL-09 | Plan status lifecycle: Draft → Active → Archived. Archived plans are read-only but data is fully preserved. | Must |
| F-PL-10 | **Grade-level locking:** after completing a grade via the year-end wizard, the entire grade level is locked in the planner (`lockedGradeLevels` JSONB integer array on `four_year_plans`). When a grade is locked: no add/remove courses, no bulk status/grade/clear, no individual course status/grade changes, no clear grade. GPA waiver toggle remains functional on locked grades (only exception). Lock/unlock icons appear on current and previous grade bars. Unlocking requires a confirmation dialog ("Unlock Grade X?"). Locking redirects to `/year-end?grade=X` for the grade completion wizard. API enforcement: PATCH returns 409 for non-waiver changes on locked grades, DELETE returns 409, POST (add course) returns 409. New endpoint: `POST /api/v1/plans/:id/lock-grade` with `{ grade_level, locked }` body. "Current grade" = first unlocked grade level, not just account grade level. | Must |
| F-PL-11 | Plan history / undo: last 20 changes per plan stored with timestamp, actor, before/after state. Undo restores the last change. | Should |
| F-PL-12 | Plan template copy: selecting a template during onboarding or plan creation copies template courses into a new student-owned plan. | Must |
| F-PL-13 | `created_from_template_id` tracked on each plan for analytics. | Should |
| F-PL-14 | Per-semester status editing (Planned/Enrolled/Completed/Dropped) via dropdown on each course card. | Must |
| F-PL-15 | Per-semester grade assignment. Projected grade (Est.) for planned/enrolled courses, actual grade for completed courses. Grade dropdown with A through F options for standard courses; P/F-only courses (regular PE and Driver Ed, identified by `isPassFailCourse()`) show only P and F options via `PASS_FAIL_OPTIONS` from `config/grade-scale.ts`. | Must |
| F-PL-16 | Full-year courses stored as two semester rows with independent status and grade per semester. Removing from either semester removes both. Adding a full-year course creates both semester rows automatically. | Must |
| F-PL-17 | Course sort order within semester cells: Early Bird, Language Arts, Math, Science, World Language, Social Studies, Electives, PE. | Should |
| F-PL-18 | Semester course limits: minimum 5, maximum 7 (or 8 with early bird) for academic courses only. Physical Welfare division, DNC-prefix (Dance), and D/E-prefix (Driver Ed) courses are excluded from the count — they represent the "sixth supervised period", not part of the 5 academic credits. Add Course button disabled at max. Count shown as X/7 in cell header. | Must |
| F-PL-19 | GPA display in grade header (projected weighted + actual weighted) and plan header (total projected + actual + /45 required). GPA is displayed as both unweighted and weighted simultaneously: 'Proj: 3.75 / 4.25' (blue, projected from all graded courses) and 'Actual: 4.00 / 5.00' (green, completed courses only). Format is always unweighted / weighted. | Must |
| F-PL-20 | Plan creation modal with name input and template selection (Blank Plan or any of 6 templates). Extracted into reusable `renderNewPlanModal()` function so it renders in both empty state and normal planner views. Single "Create Your First Plan" button replaces duplicate buttons in the empty state. | Must |
| F-PL-21 | Plan deletion with confirmation dialog (non-primary plans only). `DELETE /api/v1/plans/:id` uses `getPlanAccess()` permissions — requires owner or delete permission; no student role override. Delete button shown on both planner and manage plans pages, disabled for primary plans with tooltip explaining why. | Must |
| F-PL-22 | Clear semester and clear grade with confirmation dialogs. | Should |
| F-PL-23 | Core course removal warning for template-based plans with Reset to Template option. Reset uses `pc.semester` and `pc.gradeLevel` from actual course data (not group key), adds `skip_validation: true` for template reset, and logs failures. | Should |
| F-PL-24 | Credits display: planned and earned credits per grade and total. Stevenson uses 1 credit per semester course, 2 credits per full-year course, 45 credits required for graduation. Credits displayed as: 'X credits planned, Y earned' (earned in green). Per-row credit = creditValue/2 for full-year courses to avoid double-counting. 1.5 period courses show 1.5 credits per semester row. | Must |
| F-PL-25 | **Plan sharing with permissions (Phase 3):** Per-plan, per-user permissions via `plan_shares` table. Permission levels: owner, view, edit, delete. Hierarchy: owner > delete > edit > view. Share modal on `/plans` page lets plan owner set permission per family member (No access / View only / Can edit / Full access). Owner share auto-created on plan creation. | Must |
| F-PL-26 | **Per-plan permission enforcement (Phase 3):** All plan mutation endpoints (PATCH/DELETE/POST courses, lock-grade) use `getPlanAccess()` helper instead of `accountCtx.canEdit`. Backward compatibility: plans without `plan_shares` rows fall back to `account_members.canEdit`. | Must |
| F-PL-27 | **Plan management page (Phase 3):** `/plans` page with "My Plans" and "Shared with Me" tabs. Plan cards display status badge, permission level badge, hide/show toggle, share button, open-in-planner link, delete action. "Plans" removed from nav bar; accessible via "Manage" button in planner header. New Plan button links to `/planner?newPlan=true`. | Must |
| F-PL-28 | **Plan visibility (Phase 3):** `isHidden` toggle on `plan_shares`. Hidden plans are excluded from the planner plan dropdown but remain accessible on the `/plans` page. Hiding a plan does not delete it. | Should |

**Accessibility Requirements (Phase 1 — build in, not bolt on):**

| Req | Description | Priority |
|---|---|---|
| F-PL-A01 | Planner grid must be fully keyboard-navigable: arrow keys to move between cells, Enter/Space to open course picker, Escape to close modals. Tab order follows left-to-right, top-to-bottom grid flow. | Must |
| F-PL-A02 | All course cards, validation tooltips, and alert badges must have ARIA labels and roles. Validation errors announced via `aria-live="assertive"` region. | Must |
| F-PL-A03 | Color is never the sole indicator of state. Prerequisite violations, alert severity, and course status must use icons and/or text labels in addition to color. | Must |
| F-PL-A04 | All interactive elements meet WCAG 2.1 AA contrast ratios (4.5:1 for text, 3:1 for UI components). | Must |
| F-PL-A05 | Focus indicators are visible on all interactive elements. Never suppress browser default focus rings without providing a custom visible alternative. | Must |
| F-PL-A06 | Screen reader users must be able to understand the planner grid structure via `role="grid"`, `role="row"`, `role="gridcell"` with appropriate `aria-label` attributes describing grade level and semester. | Must |

> **Principle:** WCAG AA compliance is a Phase 1 requirement for all core UI components (planner grid, course browser, onboarding wizard, dashboard). The Phase 5 accessibility audit is for edge cases and WCAG AAA improvements — not for retrofitting basic accessibility.

**Mobile Responsive Requirements (Phase 1):**

| Req | Description | Priority |
|---|---|---|
| F-PL-M01 | **Breakpoints:** Mobile (<640px), Tablet (640–1024px), Desktop (>1024px). Tailwind's default breakpoints (`sm`, `md`, `lg`). | Must |
| F-PL-M02 | **Mobile planner layout:** The 4×2 grid (grade × semester) collapses to a single-column accordion on mobile. Each grade year is a collapsible section showing Semester 1 and Semester 2 stacked vertically. | Must |
| F-PL-M03 | **Touch targets:** All interactive elements (buttons, course cards, dropdowns) have a minimum 44×44px touch target per WCAG 2.5.5. | Must |
| F-PL-M04 | **Course browser on mobile:** Full-screen slide-over panel (not a modal overlay) with sticky search bar and scrollable results. | Must |
| F-PL-M05 | **Dashboard on mobile:** Single-column stack of all 6 cards. Desktop uses 3-row, 2-column grid: Row 1 (Active Plan, GPA), Row 2 (Attention Required, Achievements), Row 3 (Academic Progress, Quick Actions). No side-by-side panels on mobile. | Must |
| F-PL-M06 | **Tablet planner layout:** 2-column layout (Semester 1 | Semester 2) with grade years stacked vertically. Drag-and-drop (Phase 3) works on tablet but is not required on mobile. | Should |

> **Design principle:** Mobile is the student's primary device during registration season. The planner must be usable (not just viewable) on a phone. Desktop is the power-user experience; mobile is the "check my plan, add a course, review an alert" experience.

> **Phase 1a implementation note:** The top navigation bar uses a horizontal layout with logo, nav items (Dashboard, Courses, Planner, Progress, Transcript), and user avatar dropdown. The user avatar dropdown contains Settings, Billing, and Sign out. Settings was moved out of the main nav bar into this dropdown. Mobile uses a hamburger dropdown menu (which also includes Sign out). The sidebar layout described earlier was replaced during implementation for better screen real estate. "Progress" was added in Phase 2 between Planner and Transcript.

> **Phase 1b implementation note:** Planner grid, course picker, prerequisite validation (AND/OR groups), 6 plan templates, per-semester status/grade editing, GPA display (projected + actual weighted), plan creation/deletion/reset-to-template, credit display per semester and grade, and semester course limits (5 min, 7 max, 8 with early bird) are all functional. Full-year courses are stored as two `plan_courses` rows (one per semester) with independent status and grade per semester. Course status transitions (planned → enrolled → completed/dropped) are supported per semester via dropdown on each course card. Course detail modal accessible from planner grid and course picker (clicking any course card). Template-based plans support core course deletion warnings and Reset to Template. Redis performance optimized (short-circuits when not configured). Course loader uses UPSERT to preserve IDs. Set Primary UI (student-only, star icon button). Primary = active status merge (setting primary auto-activates, old primary demotes to draft). Multi-select credit type/grade level filters with comma-separated API support. Semester partner exclusion in course picker (same-name courses hidden). Multiple grade expansion (no forced single-accordion). E2E global teardown for test data cleanup. Add to Plan from course detail modal on /courses page (plan/grade/semester selection). Auth guard on all app pages. Improved duplicate validation (cross-grade, semester partners). Bulk status and grade update per semester. Credit calculation corrected for full-year courses. Plan print view at /planner/print — opens in new tab with clean print-optimized landscape layout. Shows student info, plan name, grade tables with semester columns, course status/grades, credits, GPA summary, and legend footer. Auto-triggers browser print dialog. Screen controls (Back to Planner, Print/Save as PDF) hidden when printing.

> **Phase 2 implementation note (Dashboard + Progress + Planner):** Dashboard restructured to 3-row, 2-column grid: Row 1 (Active Plan, GPA), Row 2 (Attention Required, Achievements), Row 3 (Academic Progress, Quick Actions). "Validation Report" renamed to **"Attention Required"** — simplified: no category summary line or "Issues found" badge in header; shows only category titles with counts (Graduation Gaps, Semester Gaps, Prerequisite Violations) + "View Report" button routing to `/planner?validation=open`. Three validation categories: Graduation Requirement Gaps (red), Semester Requirement Gaps (amber), Prerequisite Violations (amber). Honors badge removed from this card. **Academic Progress** card now shows all requirement groups (not just graduation) with per-group segmented progress bars showing earned/planned/remaining, replacing old graduation-only credit progress and individual requirement list. New **"Achievements"** card with all badges (earned + unearned) in a single 2-column grid: Honor Graduate tier, Graduation Ready, Credit milestones, GPA milestones, Credits Earned. Progress page renamed to **"Academic Progress"** (page title; nav label unchanged). Two-column layout: left (2/3) has status filter bar (All/Gap-Missing/In Progress/OK-Complete/Not Started) + Expand All/Collapse All + grouped sections (Graduation, Semester Requirements, IL Public University, Additional Requirements); right (1/3) sticky sidebar with honors badge + summary card showing three-state segmented progress bars per category (earned green, planned blue, remaining grey) with earned/planned/gap counts and status labels: "Complete" (all earned), "On track" (earned+planned covers all), or "N gaps" (uncovered). Course Load group has 2 sub-categories: "Course Count Per Semester" and "Physical Welfare / Dance / Driver Ed". Course-match cards show earned/planned/needed breakdown below progress bar. Planner validation report is now a **side panel** (380px, right side, sticky, scrollable) with frozen title, collapsible summary ("Credits 48/45 | Reqs 11/12 | 1 gap | 15 warnings"), 3 detail sections (Graduation Gaps, Semester Requirement Gaps, Prerequisite Violations). Warning messages use "Gr X Sem Y:" prefix as clickable links that navigate to the grade/semester cell (blue ring highlight, fades after 3s). Plan bar "Issues found" count includes graduation gaps, semester issues, and prerequisite violations only — non-course requirements (ACT, FAFSA) excluded. Planner auto-opens validation panel when navigated with `?validation=open` URL parameter. Plan selection persisted via `sessionStorage`. Reset to Template now uses `pc.semester` and `pc.gradeLevel` from actual course data (not group key), adds `skip_validation: true`, and logs failures. All 6 plan templates pass validation with zero violations (Driver Ed added to Grade 10, correct grade-level placements, Applied Health after Health prerequisite in Pre-Med, Economics added to STEM/CS, electives for Grade 10 underloads, PW coverage via Choice PE for Gr 11/12). P/F-only course handling: regular PE courses (PED121/122/451/452/111/112) and Driver Ed (D/E231/232) identified via `isPassFailCourse()` in `config/grade-scale.ts` — grade dropdown restricted to P/F options, GPA calculation excludes them, GPA waiver toggle hidden, grey "P/F" badge shown on course cards. Course load count excludes PW division, DNC-prefix, and D/E-prefix courses (non-academic "sixth supervised period"). GPA waiver eligibility check now excludes P/F-only courses from GPA-counted course count. Validation report auto-refreshes when the side panel is open and the plan is updated.

**Course Status Transitions:**
- `planned` → `enrolled`: Manual action by student (or automatically when the year-end wizard advances to a new year and next year's planned courses become current-year).
- `enrolled` → `completed`: Set during year-end transition when final grade is entered.
- `enrolled` → `dropped`: Manual action by student at any time.
- `planned` → `dropped`: Manual action by student at any time.
- `dropped` courses are excluded from GPA but retained in plan history.
- `completed` is a terminal state — cannot be changed (edit the grade, not the status).

### 5.2a Progress Page (Academic Progress)

| Req | Description | Priority |
|---|---|---|
| F-PR-01 | Dedicated requirements progress page at `/progress` with page title "Academic Progress" (nav menu item label remains "Progress"). Two-column layout: left (2/3) content area, right (1/3) sticky sidebar. **Empty state:** When no primary plan exists, shows "No active plan yet" message with a link to create a plan. | Must |
| F-PR-02 | Sticky sidebar with honors badge (achievement computed from GPA) and overall summary card showing three-state segmented progress bars per category (earned green, planned blue, remaining grey) with earned/planned/gap counts. Status labels: "Complete" (all earned), "On track" (earned+planned covers all), or "N gaps" (uncovered requirements). | Must |
| F-PR-03 | Status filter bar: All, Gap/Missing, In Progress, OK/Complete, Not Started. Plus Expand All / Collapse All buttons. | Must |
| F-PR-04 | Per-requirement cards with: status badge (Met/In Progress/Gap), segmented progress bar, notes, and course chips color-coded by earned vs planned. Course-match cards show earned/planned/needed breakdown below progress bar. | Must |
| F-PR-05 | Gap message per requirement showing credits still needed. | Must |
| F-PR-06 | "View Progress" button on the Dashboard Academic Progress card links to `/progress`. | Must |
| F-PR-07 | Print button (printer icon) in the Progress page header. Triggers `window.print()` for browser-native print dialog. **Subscription gated:** requires `canExportPdf` (Plus+ only). Trial and Starter users see a disabled button with "Upgrade to Plus to print" tooltip. | Must |
| F-PR-08 | Grouped sections: Graduation, Semester Requirements (unified name for course_load group), IL Public University (opt-in), Additional Requirements. Each is a collapsible section with its own header. | Must |
| F-PR-09 | Manual checkbox requirements (`non_course` group): clickable checkbox cards that toggle via `PUT /api/v1/requirements/status`. | Must |
| F-PR-10 | Auto-from-course requirements: status cards showing auto-satisfaction notes (e.g., "Satisfied by 46th credit" or "Satisfied by Civics course"). | Must |
| F-PR-11 | Honors status displayed as an achievement badge in the sidebar (computed from GPA, no longer a requirement group). | Should |
| F-PR-12 | Course load (Semester Requirements) group has 2 collapsible sub-categories: "Course Count Per Semester" and "Physical Welfare / Dance / Driver Ed". Per-semester cards with course count vs min/max, Underload/Overload badges. PW/Dance/DriverEd checks: each semester must have at least one Physical Welfare, Dance (DNC prefix), or Driver Education (D/E prefix) course. | Must |
| F-PR-13 | Opt-in groups (`il_public_university`): toggle to enable/disable tracking, calls `PUT /api/v1/requirements/opt-in`. | Must |

### 5.2a2 Dashboard Layout

The dashboard uses a 3-row, 2-column grid layout:
- **Row 1:** Active Plan card, GPA card
- **Row 2:** Attention Required card (with warning icon), Achievements card
- **Row 3:** Academic Progress card, Quick Actions card

| Req | Description | Priority |
|---|---|---|
| F-DVR-01 | **"Attention Required"** card (renamed from "Validation Report") with warning icon. Simplified: no category summary line or "Issues found" badge in header. Shows only category titles with counts (Graduation Gaps, Semester Gaps, Prerequisite Violations) + "View Report" button that routes to `/planner?validation=open`. Honors badge removed from this card. **Empty state:** When no primary plan exists, shows a "Create a plan" message instead of false gap counts. | Must |
| F-DVR-02 | **"Academic Progress"** card shows all requirement groups (not just graduation) with per-group segmented progress bars showing earned/planned/remaining. Replaces old graduation-only credit progress and individual requirement list. **Empty state:** When no primary plan exists, shows a "Create a plan" message instead of misleading progress data. | Must |
| F-DVR-03 | Three validation categories in Attention Required: **Graduation Requirement Gaps** (red, missing credits for diploma), **Semester Requirement Gaps** (amber, course load/PW-Dance/GPA waiver eligibility), **Prerequisite Violations** (amber, course ordering conflicts). Non-course requirements (ACT, FAFSA) are excluded from issue counts. | Must |
| F-DVR-04 | New **"Achievements"** card with all badges (earned + unearned) in a single 2-column grid: Honor Graduate tier (computed from GPA), Graduation Ready, Credit milestones (15/30/45), GPA milestones (3.0+/3.5+/4.0+), Credits Earned. | Must |
| F-DVR-05 | Uses data from the requirements API (which returns grouped data, `gpaWaiverWarnings[]`, `honorsStatus`) and plan validation API for the primary/active plan. | Must |

### 5.2b Planner Validation Report (Side Panel)

| Req | Description | Priority |
|---|---|---|
| F-VR-01 | Side panel (380px, right side, sticky, scrollable) with frozen title "Validation Report". | Must |
| F-VR-02 | Collapsible summary: collapsed shows "Credits 48/45 | Reqs 11/12 | 1 gap | 15 warnings". Expanded summary has 3 groups: Credits (Total/Earned/Planned), Graduation Requirements (Met/In Progress/Gaps), Warnings (Semester/Prerequisite). | Must |
| F-VR-03 | 3 collapsible detail sections: Graduation Gaps (with credit progress bar inside), Semester Requirement Gaps, Prerequisite Violations. | Must |
| F-VR-04 | Warning messages use consistent "Gr X Sem Y:" prefix format as clickable links that navigate to the grade/semester in the planner grid. Clicking a link expands only that grade and highlights the target semester cell (blue ring, fades after 3s). | Must |
| F-VR-05 | Validation categories: Graduation Requirement Gaps (red), Semester Requirement Gaps (amber, course load/PW-Dance/GPA waiver eligibility), Prerequisite Violations (amber). | Must |
| F-VR-06 | Validation report works with any selected plan, not just the primary plan. | Must |
| F-VR-07 | Plan bar "Issues found" count includes graduation gaps, semester issues, and prerequisite violations only — non-course requirements (ACT, FAFSA) are excluded. | Must |
| F-VR-08 | Progress data auto-fetched when a plan is loaded. | Must |
| F-VR-10 | When the validation report side panel is open and the plan is updated (course added/removed, grade changed, status changed), the requirements API is automatically called to refresh the validation data. | Must |
| F-VR-09 | Selected plan in planner persisted via `sessionStorage` so navigating away and back retains the selection. | Must |
| F-VR-11 | Planner auto-opens validation panel when navigated with `?validation=open` URL parameter (used by Dashboard "View Report" button). | Must |

### 5.3 Grade Tracking

> **Phase 2 update:** Grade entry happens exclusively in the planner page via status dropdown + grade dropdown on each course card. Grades are stored in `plan_courses.planned_grade`. Midterm grades have been removed — Stevenson uses a single final grade per semester (proficiency-based grading model). The Transcript page (`/transcript`) is a read-only view showing completed courses from the primary plan with their grades, semester GPA, grade-level GPA, cumulative GPA, and credits earned. Print button (printer icon) in header next to "Edit in Planner" button triggers `window.print()` for browser-native printing.

| Req | Description | Priority |
|---|---|---|
| F-GR-01 | Enter a single final grade per course per semester via the planner page. Midterm grades are not tracked (Stevenson proficiency-based model). | Must |
| F-GR-02 | Support letter grades (A/B/C/D/F for standard GPA), Pass/Fail (excluded from GPA), and Incomplete (excluded from GPA). | Must |
| F-GR-03 | Grade corrections allowed at any time. If a correction would change a past GPA snapshot by more than 0.05 points, display a notice: "Your historical GPA chart has been updated." | Must |
| F-GR-04 | Automatic GPA snapshot at semester-end when all grades are marked final. Manual snapshot available on demand. **Phase 2 update:** Year-end wizard auto-triggers snapshot creation with `semester_end` trigger; non-fatal on failure. | Must |
| F-GR-05 | "Data entered by you" badge on all self-reported grades — never implied to be official school records. | Must |

### 5.4 GPA Calculator

| Req | Description | Priority |
|---|---|---|
| F-GPA-01 | Cumulative GPA: all completed courses. | Must |
| F-GPA-02 | Projected GPA: completed + enrolled + planned courses using `planned_grade`. | Must |
| F-GPA-03 | Weighted GPA: applies credit type bonus. Values configurable — not hardcoded. Must be confirmed with school before implementation. **Placeholder weights:** CP = +0.0; Accelerated = +0.5; Honors = +0.5 (placeholder — confirm with school); AP = +1.0; Pass/Fail = N/A (excluded from GPA). | Must |
| F-GPA-04 | GPA trend chart: line chart from `gpa_snapshots` over time. **Implemented:** Recharts `LineChart` on Progress page right sidebar; shows unweighted + weighted GPA lines; renders only with 2+ snapshots; data from `GET /api/v1/gpa/snapshots`. | Should |
| F-GPA-05 | **What-if GPA simulator**: read-only mode. Student swaps courses; GPA recalculates in memory. No changes persisted. | Should |
| F-GPA-06 | GPA waiver is a student-initiated per-course toggle, not automatic. Waiver-eligible courses (CP-level Applied Arts, Fine Arts, CSET, specific Communication Arts/PE courses) show a 'GPA Waiver' checkbox on the course card. When checked, the course is excluded from GPA calculation. The waiver can be toggled on/off at any time. The GPA waiver checkbox is hidden for P/F-only courses (regular PE and Driver Ed) since they are already excluded from GPA. | Must |

**What-If Simulator UX:**
- Accessed via a "What If?" button on the planner grid (Plus tier and above).
- Opens an overlay mode on the existing planner — the grid border changes color to indicate simulation mode.
- Student can: swap courses (remove one, add another), change planned grades, add/remove semesters.
- GPA recalculates in real-time in a side panel showing: current GPA vs. simulated GPA, delta, and projected cumulative.
- Changes are never persisted. Clicking "Exit What-If" discards all modifications.
- "Save as New Plan" creates a copy of the simulated state as a new plan (counts toward plan limit).
| F-GPA-07 | Pass/fail and Incomplete grades excluded from GPA calculation. P/F-only courses (regular PE: PED121/122/451/452/111/112; Driver Ed: D/E231/232) are identified by `isPassFailCourse()` in `config/grade-scale.ts` and are always excluded from GPA regardless of grade value. The `CourseForGPA` interface includes an optional `code` field to support this check. Health (PED201/202), Applied Health (PED231/232), Adventure Ed (PED331/332), Lifeguard (PED501), and Leadership courses still receive letter grades and are included in GPA. | Must |
| F-GPA-09 | P/F-only course cards display a small grey "P/F" badge with tooltip "Pass/Fail course — excluded from GPA and academic course count". | Must |

**F-GPA-08: Incomplete Grade Handling**
- Grades marked as `I` (Incomplete) are excluded from GPA calculation until resolved.
- An active alert (`incomplete_grade`) fires when an Incomplete is older than 30 days.
- Incomplete grades block year-end transition for the affected course — the student must resolve or drop the course before advancing.
- In the graduation progress tracker, Incomplete courses count as 0 credits until resolved.

### 5.5 Graduation Requirement Tracker

| Req | Description | Priority |
|---|---|---|
| F-REQ-01 | Visual checklist per subject area: required credits vs. completed + planned credits. Applies to course-match requirements in `graduation` and `il_public_university` groups. | Must |
| F-REQ-02 | Status indicator per requirement: Met / In Progress / Gap. Applies to all evaluation types. | Must |
| F-REQ-03 | Credit tally displayed in the planner grid (running total per subject area). | Must |
| F-REQ-04 | Requirements versioned by catalog year. A student's tracker uses the requirements from the catalog version their plan was created on. | Must |
| F-REQ-05 | `requirement_progress` is recomputed in a BullMQ job on every plan save. Cached in Redis (10-min TTL). | Must |
| F-REQ-06 | 37 total requirements seeded across 4 groups (was 12 graduation-only). `honors_status` removed as a requirement group — now an achievement badge. | Must |
| F-REQ-07 | Opt-in requirement groups (e.g., `il_public_university`) are not tracked unless the student explicitly enables them. | Must |
| F-REQ-08 | Manual checkbox requirements persist their checked/unchecked state via `student_requirement_status` table. | Must |
| F-REQ-09 | Auto-from-course requirements are automatically satisfied when the relevant course or credit threshold is reached. | Must |
| F-REQ-10 | Honors status computed from GPA and displayed as an achievement badge (not a requirement). | Should |
| F-REQ-11 | Course load requirements: 8 course count checks (min 5 / max 7-8 per semester) + 8 PW/Dance/DriverEd checks (at least one Physical Welfare, Dance [DNC prefix], or Driver Education [D/E prefix] course per semester). "Semester Requirements" is the unified display name. | Must |
| F-REQ-12 | GPA waiver eligibility check: API validates 4+ GPA-counted courses per semester when waiver is applied. P/F-only courses are excluded when counting GPA-counted courses (previously PE courses were counted as GPA-eligible, which understated the issue). | Must |

### 5.6 Course Browser

| Req | Description | Priority |
|---|---|---|
| F-CB-01 | Search by course name or code. | Must |
| F-CB-02 | Filter by division, credit type (CP/Accelerated/Honors/AP), grade level eligibility, dual credit flag, AP flag. | Must |
| F-CB-03 | Course detail view: description, credit value, duration (semester/full-year), prerequisites, co-requisites, dual credit partner info, notes. | Must |
| F-CB-04 | Visual distinction for dual credit courses (badge/icon). | Must |
| F-CB-05 | "Add to plan" button on course detail — opens plan selector if student has multiple plans. | Must |
| F-CB-06 | Filter by department within a selected division. Department dropdown appears only when a division with multiple departments is selected. | Must |
| F-CB-07 | Filter by GPA waiver status (checkbox: "GPA waiver available"). | Should |
| F-CB-08 | GPA waiver badge displayed on course cards and course detail view for courses where GPA waiver is available (159 of 315 courses). | Must |
| F-CB-09 | Course cards displayed in a 2-column responsive grid (single column on mobile, 2 columns on md+ screens). Fixed card height (140px) with truncated names and 1-line description for consistent layout. | Must |
| F-CB-10 | Cursor-based pagination with Previous/Next controls, page counter, and "Showing X–Y of Z courses" info. Total count returned from API. | Must |
| F-CB-11 | Semester Offered radio filter: All, Sem 1, Sem 2, Sem 1 & 2, Full Year. "Sem 1"/"Sem 2" filters to courses exclusively offered in that semester (excludes courses with a same-name partner in the other semester). "Sem 1 & 2" filters to semester courses where a same-name partner exists in the other semester. | Must |
| F-CB-12 | Duration filter: semester or full year. | Should |
| F-CB-13 | Course cards display semester info label: "Sem 1 only", "Sem 2 only", "Sem 1 & 2", or "Full Year". | Must |
| F-CB-14 | Course list sorted alphabetically by name ascending, then code ascending (not by id). | Must |
| F-CB-15 | Course detail modal: centered layout (max-w-5xl), 3-column info grid, badges moved to modal header. Duplicate AP badge suppressed when creditType is already "AP". | Must |
| F-CB-16 | Course detail: "Also available as" section showing clickable linked semester-partner courses. | Must |
| F-CB-17 | Course detail: Prerequisites grouped by requirement_group with OR badges. Semester pairs merged in display (e.g., "INTRODUCTION TO BUSINESS (BUS171 / BUS172)"). | Must |
| F-CB-18 | Course detail: "What This Unlocks" section also merges semester pairs. | Must |
| F-CB-19 | Course detail: Division and Department names are clickable (sets the corresponding filter and closes the modal). | Should |
| F-CB-20 | Course detail: Prerequisite and unlock course codes are clickable (navigates to that course's detail). | Should |
| F-CB-21 | Navigation uses a horizontal top bar instead of a sidebar. Nav order: Dashboard, Courses, Planner, Progress, Transcript. User avatar dropdown contains Settings, Billing, and Sign out. For parent users: avatar shows the parent's own name/email (not the student's), with a "Managing: StudentName · Gr X" subtitle below the parent's name. "Add Another Child" removed from the dropdown. Settings page uses flat sections with uppercase headers (no collapsible cards): 3x3 profile grid (Name/Email/Password/Role/Grade/Graduation/State/School — state and school are read-only), clean family member list, compact subscription/legal/danger zone sections. | Must |

### 5.7 Prerequisite Visualization

| Req | Description | Priority |
|---|---|---|
| F-PRE-01 | Prerequisite chain shown on course detail: upstream (what must be taken first) and downstream (what this course unlocks). | Must |
| F-PRE-02 | Visual DAG (React Flow) showing full multi-level chains and OR-group branches. *(Phase 3)* | Should |
| F-PRE-03 | "Prereq path" view: full chain from current grade to a target course (e.g., "Algebra 1 → Algebra 2 → Precalculus → AP Calc AB → AP Calc BC"). | Should |
| F-PRE-04 | OR-group prerequisites shown as branched paths converging on the target course — any one branch clears the requirement. | Must |
| F-PRE-05 | Co-requisites shown as same-semester links (visually distinct from before/after prerequisite links). | Must |
| F-PRE-06 | Cycle detection runs at catalog load time (topological sort). Cycles abort the load; they are never surfaced as a runtime case. | Must |

### 5.8 Alert System

| Req | Description | Priority |
|---|---|---|
| F-AL-01 | All alerts evaluated in BullMQ background jobs — never in the API request cycle. | Must |
| F-AL-02 | Alert types: overload, underload, prereq_violation, coreq_violation, enrollment_rule, grade_level_ineligible, repeat_course, graduation_risk, catalog_change, grade_below_target, gpa_goal_at_risk, declining_gpa_trend (Elite), ap_capacity_underuse (Elite), dual_credit_opportunity. | Must |
| F-AL-03 | Every alert includes an `action_suggestion` — a specific, actionable next step. No warning-only alerts. | Must |
| F-AL-04 | Alert deduplication: only one active alert per unique `(student_id, deduplication_key)`. Re-fires only after the previous instance is resolved. | Must |
| F-AL-05 | Severity levels: `info`, `warning`, `critical`. Dashboard badge count shows unresolved warning + critical alerts. | Must |
| F-AL-06 | Student can mark an alert as dismissed. Dismissed alerts do not re-fire for the same condition unless the condition changes. | Must |
| F-AL-07 | Tier-gated alert types (declining_gpa_trend, ap_capacity_underuse) still evaluated for all tiers but only displayed for Elite subscribers. | Must |

**Catalog Change Detection Process:**
1. Admin uploads the new year's course PDF. The extractor produces a new set of course records tied to the new `catalog_version_id`.
2. The system performs an automated diff: match courses across catalog versions by `code` (primary) and `name` (fuzzy, using pg_trgm similarity > 0.6 as a secondary signal).
3. Detected changes are categorized:
   - **Renamed:** Same code, different name → auto-linked via `previous_code`/`previous_name` fields.
   - **Removed:** Code exists in old catalog but not new → flagged for admin review.
   - **New prerequisite:** Course exists in both but prerequisites changed → flagged.
4. Admin reviews flagged changes and confirms or overrides the automated mapping.
5. After admin confirmation, the system generates `catalog_change` alerts for all students whose plans reference affected courses, with specific replacement suggestions where applicable.

### 5.9 Notification System

| Req | Description | Priority |
|---|---|---|
| F-NO-01 | Channels: in-app (Supabase Realtime, no polling) + email (Resend). Push notifications deferred to Phase 5+. | Must |
| F-NO-02 | Per-notification-type user preference toggle (email on/off, in-app on/off). Defaults shown in the spec. | Must |
| F-NO-03 | Notification types match alert types plus: `prereq_gap`, `overload`, `underload`, `gpa_drop`, `catalog_change`, `requirement_at_risk`, `gpa_digest`, `plan_milestone`, `incomplete_grade`, `catalog_update`, `grade_reminder`, `course_removed`, `year_end_reminder`, `trial_expiry_warning`, `account_frozen`, `graduation_detected`. | Must |
| F-NO-04 | Weekly GPA digest email (Sunday) to student and linked parents. | Should |
| F-NO-05 | Trial expiry countdown banner in-app from Day 10 onward. | Must |

### 5.10 AI Advisory Engine

| Req | Description | Priority |
|---|---|---|
| F-AI-01 | Career path course recommendations via Claude API. Input: student profile, career path selection, current plan. Output: validated list of recommended courses from the real catalog. | Must |
| F-AI-02 | **Guardrail (non-negotiable):** every AI-suggested course code validated against `courses` table before display. Hallucinated courses suppressed and logged as mismatches. | Must |
| F-AI-03 | AI plan review: structured response with `strengths[]`, `concerns[]`, `suggestions[]` for the student's primary plan. | Should |
| F-AI-04 | AI chat interface: free-form Q&A about courses, planning, and career alignment. Rate-limited to 10 requests/user/hour. | Should |
| F-AI-05 | Every AI response includes a prominent disclaimer: "These are suggestions only. Confirm all course decisions with your school counselor." | Must |
| F-AI-06 | Career-to-course mappings stored in `career_path_courses` table (curated, not AI-generated). Seeded at deploy time. Updated annually. | Must |
| F-AI-07 | Suggestion ranking order: grade-eligible first → multi-requirement overlap → dual credit → career path match → alphabetical. | Should |

### 5.11 Security

**F-SEC-01: API Rate Limiting**
| Endpoint Category | Limit | Scope |
|---|---|---|
| General authenticated API | 120 requests/minute | Per user |
| AI endpoints (Elite) | 10 requests/hour | Per user |
| Course search | 30 requests/minute | Per user |
| Auth endpoints (login/signup) | 5 requests/minute | Per IP |
| Invite code generation | 3 requests/hour | Per user |
| Share link access | 20 requests/minute | Per IP |
| Unauthenticated endpoints | 60 requests/minute | Per IP |

### 5.12 Subscription & Billing

| Req | Description | Priority |
|---|---|---|
| F-SB-01 | 3 tiers: Starter (free), Plus ($9.99/mo), Elite ($19.99/mo). 3 billing intervals: monthly, annual (save 10%), 4-year (save 17%). Annual: Plus $107.88/yr ($8.99/mo), Elite $215.88/yr ($17.99/mo). 4-Year: Plus $399, Elite $799. Pro tier removed — Plus absorbs non-AI features, AI stays Elite-only. | Must |
| F-SB-02 | 14-day trial at signup with Plus plan (trialing status). No credit card required. Trial gives Plus-level features EXCEPT plan comparison, PDF export, and share links (to prevent extract-and-leave). Max 2 plans during trial. Auto-downgrade to Starter at expiry. AI features NOT included in trial (Elite-only). Billing page shows "Free Trial" with days-left badge. Pricing cards suppress "Current Plan" for trialing users. Billing card buttons aligned at same level using flex layout. | Must |
| F-SB-03 | Stripe Checkout for payment; Stripe Billing Portal for subscription management. | Must |
| F-SB-04 | Subscription enforcement middleware: Redis-cached tier (5-min TTL); HTTP 402 on gated feature access; HTTP 403 on frozen account write. | Must |
| F-SB-05 | Downgrade guard: excess plans archived (never deleted). Alert history, AI history, prerequisite data preserved. | Must |
| F-SB-06 | Past-due grace period: 5 days before account freeze. Reminder emails on Day 1 and Day 4. | Must |
| F-SB-07 | All Stripe events logged to `stripe_events` before processing (idempotency via UNIQUE on `stripe_event_id`). | Must |
| F-SB-08 | Nightly Stripe reconciliation job: self-heals any missed webhooks by comparing `subscriptions.status` against Stripe API. | Must |
| F-SB-09 | Stripe webhook signature verification on every incoming event. | Must |
| F-SB-10 | Subscription is per account (one student), not per person. Parent accounts are free. Any account member can be the billing contact. | Must |
| F-SB-11 | Billing contact can be transferred between account members (e.g., student turns 18 and takes over billing). | Should |

### 5.13 Tier Feature Matrix

| Feature | Trial (14-day) | Starter (free) | Plus ($9.99/mo) | Elite ($19.99/mo) |
|---|---|---|---|---|
| Course browser & search | ✓ | ✓ | ✓ | ✓ |
| Prerequisite validation | ✓ | ✓ | ✓ | ✓ |
| Graduation requirement tracking | ✓ | ✓ | ✓ | ✓ |
| GPA tracking (cumulative) | ✓ | ✓ | ✓ | ✓ |
| Max active plans | 2 | 1 | 10 | Unlimited |
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
| Percentile comparison | — | — | — | ✓ |
| Course rigor scoring | — | — | — | ✓ |

### 5.13a Pricing

| Billing | Plus | Elite |
|---|---|---|
| Monthly | $9.99/mo | $19.99/mo |
| Annual (save 10%) | $107.88/yr ($8.99/mo) | $215.88/yr ($17.99/mo) |
| 4-Year (save 17%) | $399 one-time ($8.31/mo) | $799 one-time ($16.65/mo) |

**Trial design:** 14-day free trial with Plus plan (trialing status). Plus-level features except plan comparison, PDF export/print, and share links. Max 2 plans. No credit card required. AI features NOT included (Elite-only). Auto-downgrades to Starter at expiry. This prevents the "build-export-leave" pattern while giving enough value to demonstrate the product. Accounts API returns "trial" as the plan name when `status = 'trialing'`. TierBadge component shows "Trial" (amber). Billing page shows "Free Trial" with "X days left" badge. Pricing cards do not show "Current Plan" indicator for trialing users.

### 5.14 Account Lifecycle

| Req | Description | Priority |
|---|---|---|
| F-AC-01 | Account states: `active`, `frozen`, `deactivated`, `suspended`. **Definitions:** `active` = normal account in good standing; `frozen` = payment lapse (5-day grace expired), read-only access, can export/upgrade/delete; `suspended` = admin-initiated hold (ToS violation investigation), same read-only access as frozen, requires admin action to lift; `deactivated` = user-initiated deletion, 30-day data purge window. | Must |
| F-AC-02 | Frozen accounts: login allowed; all reads allowed; all writes blocked (403 with clear reason + reactivation link). | Must |
| F-AC-03 | Freeze reasons: `payment_lapsed`, `subscription_canceled`, `graduation_complete`, `admin_action`. | Must |
| F-AC-04 | Graduation detection: nightly cron freezes accounts where `graduation_year < current_academic_year_start`. Send graduation email with three options: export + deactivate / stay as alumni / dismiss. | Must |
| F-AC-05 | Alumni mode: frozen (`graduation_complete`) + Starter plan active. Full read-only history. No subscription billing. | Should |
| F-AC-06 | Data deletion: user-initiated account deletion triggers 30-day purge window. All personal data deleted within 30 days. | Must |
| F-AC-07 | All account status transitions logged to `account_events` for compliance audit trail. | Must |
| F-AC-08 | Unclaimed accounts auto-freeze after 90 days. Creating parent receives a notification: "Your child hasn't claimed this account. Resend invitation or archive." Frozen unclaimed accounts can be reactivated by resending the claim code. | Must |

### 5.15 Account Permissions Matrix

| Operation | Student | Parent (can_edit) | Parent (read-only) | Counselor |
|---|---|---|---|---|
| Create plans | ✓ | ✓ | — | — |
| Edit own plans | ✓ | ✓ | — | — |
| Edit others' plans | — | — | — | — |
| Archive/Delete plans | ✓ own only | ✓ own only | — | — |
| Set plan as Primary | ✓ | — | — | — |
| View shared plans | ✓ | ✓ | ✓ | ✓ |
| View private plans | ✓ own only | — | — | — |
| Enter/edit grades | ✓ | — | — | — |
| View grades & GPA | ✓ | ✓ | ✓ | ✓ |
| Dismiss alerts | ✓ | — | — | — |
| View alerts | ✓ | ✓ | ✓ | ✓ |
| Manage subscription | ✓ | ✓ (billing contact) | — | — |
| Invite members | ✓ | ✓ | — | — |

---

## 6. User Flows

### Flow 1 — New Student Signup & Onboarding

```
1. Student arrives at landing page
   └── Clicks "Get Started Free"

2. Signup screen (max-w-lg, 2-column grids)
   ├── Option A: Email + password (2-column credential grid)
   │   └── Verify email before proceeding
   └── Option B: Google OAuth
       └── First-time: auto-provisions app records (user, account, profile, 14-day Plus trial with trialing status) using Google profile name. Email marked as verified. Redirects to /onboarding.
       └── Returning: resumes session, redirects to intended page.
   ├── Personal info: first name, last name, date of birth (2-column grid)
   └── Role selector: Student / Parent / Counselor cards with descriptions
   └── State (frozen to IL) + School (frozen to Stevenson) with "Request yours" link
       └── School request form → POST /api/v1/school-request (no auth) → school_requests table

3. Date of birth check
   └── If under 13 → blocked; show COPPA notice

4. Onboarding wizard — Step 1: Who are you?
   └── Select role: Student / Parent / Counselor

5. Onboarding wizard — Step 2: About you (student)
   ├── Enter current grade level (9/10/11/12)
   ├── Enter expected graduation year (auto-calculated, editable)
   └── Optional: GPA goal, college targets, career interest

6. Onboarding wizard — Step 3: Enter past courses
   ├── Bulk entry table: select course → select grade → repeat
   ├── "I'm a freshman / no prior courses" skip option
   └── Skip-and-complete-later available

7. Onboarding wizard — Step 4: Choose a starting plan
   ├── Browse templates (Pre-Med, STEM, Arts, Dual Credit Maximizer, etc.)
   ├── Preview each template's course list
   └── Select → creates first plan from template (Primary, Active)

8. Trial activation banner
   └── "Your 14-day free trial has started. X days left."

9. Dashboard (first view)
   ├── GPA: shows entered grades if any, else "Enter grades to see GPA"
   ├── Graduation progress: shows requirement checklist
   ├── Alerts: none initially
   └── "Complete your profile" banner if steps skipped
```

---

### Flow 2 — Adding a Course to the Plan

```
1. Student opens the 4-Year Planner grid

2. Clicks "+ Add Course" in a grade-semester cell
   └── OR searches in the Course Browser → clicks "Add to Plan"

3. Course search panel opens
   ├── Filter: division, credit type, grade level, AP, dual credit
   └── Select a course from results

4. System validates immediately (inline, before confirming):
   ├── PASS: No violations → course added to the cell
   │   └── plan_history row inserted; alert-evaluation job enqueued
   │
   └── FAIL: One or more violations detected
       ├── Prereq violation → tooltip: "Requires [course name] first (Grade X)"
       ├── Coreq violation → tooltip: "Must be taken in the same semester as [course]"
       ├── Grade level ineligibility → tooltip: "This course is only available in Grades X–Y"
       └── Enrollment rule → tooltip: "This is a full-year course and must span both semesters"
           └── Student can override with confirmation ("Add anyway") or cancel

5. If course added: downstream alert check runs in background
   └── If adding this course resolves an existing alert → alert auto-resolved
   └── If adding this course creates a new alert (e.g., overload) → alert fires within seconds
```

---

### Flow 3 — Year-End Transition Workflow

```
Trigger: School year is ending (student receives email reminder + dashboard banner)

1. Dashboard banner: "It's time to complete your year-end review"
   └── Student clicks "Start Year-End Review"

2. Year-End Wizard — Step 1: Confirm final grades
   ├── Shows all enrolled/in-progress courses for the current year
   ├── Student confirms or corrects final grades for each course
   └── Grades locked → plan_courses.status → 'completed'
   └── Entire grade level locked → grade added to four_year_plans.lockedGradeLevels

3. Year-End Wizard — Step 2: Advance grade level
   ├── Shows: "You're completing Grade X. Continue as Grade X+1?"
   └── Student confirms → student_profiles.current_grade_level += 1
   └── "Current grade" in planner = first unlocked grade level (not just profile grade)

4. Year-End Wizard — Step 3: Review next year's plan
   ├── Shows the upcoming year's planned courses
   ├── Runs fresh validation: any prereq/enrollment violations?
   ├── Alerts shown inline for anything needing attention
   └── Student can edit before completing

5. Complete
   ├── year_end_transition_state → 'completed'
   ├── GPA snapshot taken ('semester_end')
   └── Dashboard shows updated graduation progress
```

**Grade 12 (Graduating Seniors):**
- Instead of advancing grade level, the year-end wizard triggers the graduation workflow.
- Student is asked: "Congratulations! Would you like to: (a) Archive your account as a permanent read-only record, (b) Export all data as PDF/JSON and delete your account, (c) Dismiss and decide later."
- Account status is tagged as `graduated` (a flag on `student_profiles`, not an account state).
- Graduated accounts remain on their current subscription tier until they choose to cancel or are auto-detected by the nightly graduation job.

---

### Flow 4 — Receiving and Resolving an Alert

```
Trigger: Student enters a grade below their planned grade for a course

1. Background job fires (grade-entry → alert-evaluation):
   ├── Detects: actual_grade < planned_grade
   └── Fires: 'grade_below_target' alert + 'gpa_goal_at_risk' if GPA projection drops below goal

2. Alert delivery:
   ├── In-app: red badge on notification icon; alert appears in Alert Center
   └── Email: sent to student (and parent if linked + preferences enabled)

3. Student opens Alert Center
   └── Sees: "Your B- in AP Biology is below your planned A. Your projected GPA has dropped to 3.62."
       └── Action suggestion: "Review your remaining course grades — raising AP Statistics to an A would restore your projected GPA to 3.75."

4. Student acts:
   ├── Option A: Accepts the lower grade, adjusts remaining planned grades
   ├── Option B: Opens What-If Simulator to model the impact of different remaining grades
   └── Option C: Dismisses the alert (records dismissal; won't re-fire unless further drop)

5. Alert resolved:
   └── Once the projected GPA rises back above goal → alert auto-resolves (resolved_at set)
```

---

### Flow 5 — Subscription Upgrade (Triggered by Feature Gate)

```
1. Student on Starter tier clicks "AI Course Suggestions" in the planner

2. API returns HTTP 402:
   { "upgrade_required": true, "feature": "ai_suggestions", "minimum_tier": "elite" }

3. Frontend shows upgrade modal:
   ├── Highlights Plus and Elite tiers with 3-interval toggle (monthly/annual/4-year)
   ├── Shows what the student gains at each tier
   └── "Upgrade to Elite — $19.99/mo" CTA button (AI is Elite-only)

4. Student clicks upgrade:
   └── Redirected to Stripe Checkout (subscription mode for monthly/annual, payment mode for 4-year)

5. Stripe Checkout:
   ├── Student enters payment details
   └── Stripe processes payment

6. Stripe fires webhook: customer.subscription.created
   ├── SAPS updates subscriptions row: subscription_plan_id → Elite, status → active
   └── Redis cache invalidated (new tier takes effect immediately)

7. Student returned to app:
   └── AI Suggestions panel now loads without the gate
   └── Toast: "Welcome to Elite! All Elite features are now unlocked."
```

---

### Flow 6 — Counselor Accesses a Student's Plan

```
1. Counselor logs into SAPS (counselor role)

2. Counselor Dashboard:
   ├── Sees list of all linked students
   ├── Each row shows: student name, grade, graduation year, active alert count, GPA (if shared)
   └── Filters: grade level, alert severity, graduation status

3. Counselor clicks a student's name

4. Student profile view (read-only):
   ├── Four-year plan grid (read-only)
   ├── Graduation requirement checklist
   ├── GPA trend chart
   ├── Active alerts list
   └── Dual credit summary

5. All edit/delete controls hidden for counselors — no UI affordance to modify data

6. Counselor prepares for meeting using this view
   └── No in-app annotation; counselor uses own notes tool
```

---

### Flow 7 — Account Frozen Due to Payment Lapse

```
Trigger: Stripe fires invoice.payment_failed

1. Day 0 — Invoice.payment_failed webhook received:
   ├── subscriptions.status → 'past_due'
   └── BullMQ job scheduled: "freeze in 5 days if still unpaid"

2. Day 1 — Reminder email:
   └── "Your payment failed. Please update your billing details to keep your plan active."
   └── Link to Stripe billing portal

3. Day 4 — Second reminder email:
   └── "1 day left. Your account will be restricted tomorrow if payment is not resolved."

4. Day 5 — Freeze job fires (invoice still unpaid):
   ├── users.account_status → 'frozen', freeze_reason → 'payment_lapsed'
   └── account_events row inserted (triggered_by = 'stripe_webhook')

5. Student tries to add a course:
   └── API returns HTTP 403:
       { "account_frozen": true, "reason": "payment_lapsed", "reactivate_url": "..." }
   └── Frontend shows banner: "Your account is restricted due to an unpaid invoice. [Update payment method]"

6. Student resolves payment via Stripe billing portal

7. Stripe fires invoice.paid webhook:
   ├── subscriptions.status → 'active'
   ├── users.account_status → 'active', freeze_reason → NULL, frozen_at → NULL
   ├── Redis cache invalidated
   └── account_events row inserted (triggered_by = 'stripe_webhook')

8. Student's next page load:
   └── Freeze banner gone; all write operations restored
```

---

### Flow 8: Counselor Account Setup (Phase 5)

1. Counselor signs up and selects "School Counselor" role during onboarding.
2. Counselor enters their school name and professional email for verification.
3. Admin verifies the counselor's identity (manual review in Phase 5; automated verification is out of scope).
4. Once verified, the counselor receives a unique counselor code.
5. Students enter the counselor code in Settings → Counselor Access to create a link.
6. The counselor's dashboard shows all linked students (read-only).

**Counselor pricing:** Counselor accounts are free. Counselors see only the data that linked students have shared — no access to AI features, GPA details, or grades unless the student explicitly grants visibility (future: granular permission toggles).

---

### Flow 9: Account Deletion

1. Student navigates to Settings → Account → Delete Account.
2. System displays warning: "This will permanently delete your account, all plans, grades, and linked parent access after 30 days. This cannot be undone."
3. Student confirms by typing their email address.
4. Account status changes to `deactivated`. All linked parent accounts lose access immediately.
5. Active Stripe subscription is canceled immediately (no further charges).
6. Full cleanup performed: Stripe customer deleted, Supabase auth user deleted, Redis cache cleared, PostHog user data removed.
7. A confirmation email is sent with a "Cancel Deletion" link valid for 30 days.
8. After 30 days, all personal data is purged. Anonymized aggregate analytics data is retained.
9. If the student clicks "Cancel Deletion" within 30 days, the account is restored to its previous state (including subscription, if still within the billing period).

---

### Flow 10: Trial Expiry & Downgrade

1. **Day 10 of 14:** A persistent banner appears: "Your free trial ends in 4 days. Upgrade to keep [specific features they've used]."
2. **Day 13:** Email reminder: "Your trial ends tomorrow."
3. **Day 14 (expiry):**
   - Account tier changes to Starter immediately.
   - A full-screen interstitial appears on next login: "Your trial has ended. Here's what you'll keep (Starter features) and what's now locked." with upgrade CTAs for each tier.
   - Excess plans (beyond 1) become read-only archives. The most recently modified plan remains active.
   - AI chat history is preserved but the chat interface is locked.
   - All data is preserved — nothing is deleted.
4. The interstitial shows once. Subsequent logins show a dismissible upgrade banner.

---

## 7. Success Metrics

### 7.1 Acquisition

| Metric | Target (Month 6) | Measurement |
|---|---|---|
| Registered users | 200 | Supabase `users` table count |
| Trial activations | 200 (all signups) | `subscriptions.status = 'trialing'` |
| Source of signups | >50% word-of-mouth from existing users | Signup referral attribution |

### 7.2 Activation (Did the user get value in their first session?)

| Metric | Target | Measurement |
|---|---|---|
| Onboarding completion rate | >70% complete all 4 steps | `year_end_transition_state != 'pending'` at Day 7 |
| Plan created within first session | >80% of signups | `four_year_plans` count per user at Day 1 |
| At least 1 course added to plan | >75% at Day 3 | `plan_courses` row count at Day 3 |
| Bulk grade entry completed (non-freshmen) | >60% | `grade_entries` count > 0 for Grade 10–12 users at Day 7 |

### 7.3 Engagement (Are users coming back?)

| Metric | Target | Measurement |
|---|---|---|
| Weekly active users (WAU) / Monthly active users (MAU) | >40% WAU/MAU ratio | Session events |
| Median sessions per user per month | ≥4 | Session events |
| Alert center open rate | >60% of users with active alerts open Alert Center within 48 hrs | `alerts.is_read` + session events |
| Grade entry rate | >80% of enrolled students update at least one grade per semester | `grade_entries.updated_at` |
| Year-end workflow completion | >75% complete the wizard before the new school year starts | `year_end_transition_state = 'completed'` |

### 7.4 Conversion (Free → Paid)

| Metric | Target | Measurement |
|---|---|---|
| Trial → any paid plan conversion rate | ≥20% within 30 days of trial expiry | `subscriptions.status` transitions |
| Upgrade modal click-through rate | ≥15% of 402 responses result in Checkout open | Frontend event tracking |
| Feature gate triggered per trial user | Track which features drive upgrade intent | 402 response logging |
| Time from trial start to first upgrade | Median <10 days | `subscriptions.created_at` vs. `updated_at` |

### 7.5 Retention (Are paid users staying?)

| Metric | Target | Measurement |
|---|---|---|
| Month 3 retention (paid) | >70% | `subscriptions.status = 'active'` at Month 3 |
| Annual renewal rate | >80% | Annual billing cycle renewal count |
| Voluntary churn rate | <5%/month | `subscriptions.status → 'canceled'` per month |
| Plan export / share link generation | Track as a proxy for counselor/parent sharing | `plan_share_links` row count |

### 7.6 Product Quality

| Metric | Target | Measurement |
|---|---|---|
| Alert accuracy rate | <5% of alerts dismissed as irrelevant within 1 hour | Ratio of fast dismissals to total alerts |
| GPA calculator agreement | 100% match on 10 hand-verified test cases | QA test results |
| Prerequisite violation detection speed | Alert fires within 2 seconds of adding a violating course | API response timing |
| AI hallucination rate | 0 hallucinated course names reach the UI | `ai_suggestion_mismatches` log count |
| Uptime | >99.5% monthly | Sentry + AWS Amplify health metrics |
| P95 API response time | <500ms for non-AI endpoints | Sentry performance monitoring |

### 7.7 Business Health

| Metric | Target (Month 12) | Measurement |
|---|---|---|
| Monthly Recurring Revenue (MRR) | Target defined by business | Stripe Dashboard |
| Average Revenue Per User (ARPU) | Track vs. tier mix | MRR / paying users |
| Tier distribution | >40% of paid on Elite | `subscription_plans.name` distribution |
| Counselor adoption | ≥1 active counselor using the platform | `users` WHERE `role = 'counselor'` AND active |
| Net Promoter Score (NPS) | ≥40 | In-app survey (triggered at Day 30 for active users) |

---

## 8. Acquisition & Landing Page

A landing page is required before user acquisition begins. This is not a separate project — it should be a Next.js page within the main app, deployed alongside the product.

**Landing page requirements (Phase 1b, before user testing):**
- Clear value proposition: "Plan your 4-year course path. Track your GPA. Graduate on track."
- Feature highlights for the three pillars (Planning, Tracking, Advisory)
- Tier comparison table (Starter → Elite) with pricing
- "Get Started Free — 14-day free trial" CTA → signup flow
- Mobile-responsive
- SEO-optimized for: "Stevenson High School course planner", "high school academic planner", "4-year plan tool"

**Acquisition strategy (pre-launch):**
- Seed 3-5 real students during Phase 1b user testing; leverage word-of-mouth
- Consider a referral mechanism: "Invite a friend, both get 1 week of Plus free" (defer to post-launch)
- The success metric targets >50% word-of-mouth signups — landing page SEO provides the other half

> The landing page is the first thing a parent or student sees. It must clearly communicate that SAPS is not a school tool (no sign-in with school credentials) — it's a personal planning tool that works alongside the school's process.

---

## 9. Out of Scope

The following are explicitly not in scope for the current product, and should not be designed for:

| Out of Scope Item | Reason |
|---|---|
| Official school system integration / transcript sync | FERPA complexity; requires formal district agreement |
| NCAA eligibility tracking | Specialized; requires ongoing rule maintenance. Phase 3 |
| Template intensity levels (Easy/Moderate/Challenging/Intensive/Rigorous) | Auto-selects CP/Accelerated/AP course variants and load per template. ~600 course placements to validate across 6 templates × 5 levels. Phase 3 |
| Seal of Biliteracy | Requires exam score tracking. Phase 3 |
| P.E. waiver rules | Complex per-semester logic with multiple waiver types. Phase 3 |
| College admission requirement validation | Too complex to maintain accurately; liability risk |
| Mobile native app (iOS/Android) | Web responsive is sufficient for MVP; defer to Phase 6+ |
| Multi-school support | Stevenson-specific for launch; architecture supports expansion later |
| Parent co-editing of student plans by default | Parents can create their own plan drafts in Phase 2; co-edit toggle for student plans is Phase 5 |
| Push notifications | Deferred to post-Phase 5 |
| Course difficulty/historical grade distribution data | Not publicly available without school partnership |
| Peer-to-peer plan sharing or social features | Not a planning tool need at this stage |
| AI fine-tuning or custom model training | Guardrails on Claude API are sufficient; no model training on user data |
| Bulk student import for counselors | Deferred; counselors link students individually at launch |

---

*This document is the authoritative product specification. For technical schema, API design, and infrastructure details, see TECH_DESIGN_DOC.md. For executive-level summary and business context, see EXECUTIVE_SUMMARY.md.*
