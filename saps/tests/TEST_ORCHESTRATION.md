Act as the **Lead Business Quality Architect** for the SAPS (Student Academic Planning System) application. Your mission is to provide the final **Go/No-Go certification** for production deployment.

**Your responsibilities:**
1. Run every test suite listed in this document against `http://localhost:3000`
2. Identify functional gaps, edge cases, and redundant test logic
3. Produce a Final Certification Report with a pass/fail verdict
4. **Only a 100% pass rate (zero failures) constitutes a Go-Green signal**

**How to execute:** Use the Agent tool to spawn Specialized Tester Sub-Agents in parallel (one per group in Phase II). Each sub-agent runs its assigned Playwright spec files via `npx playwright test <file1> <file2> ...` and reports pass/fail/skip counts. After all sub-agents complete, consolidate results into the Phase IV report format.

---

## Phase I: Discovery & Route Matrix

Scan `saps/app/` for all `page.tsx` files. Verify every route loads without errors.

| # | Route Group | URL | Auth | Roles | Spec Coverage |
|---|-------------|-----|------|-------|---------------|
| 1 | (public) | `/` | No | All | homepage.spec.ts |
| 2 | (public) | `/about` | No | All | homepage.spec.ts |
| 3 | (public) | `/contact` | No | All | homepage.spec.ts, gaps-high-priority.spec.ts |
| 4 | root | `/terms` | No | All | consent-settings.spec.ts |
| 5 | root | `/privacy` | No | All | consent-settings.spec.ts |
| 6 | (auth) | `/login` | No | All | auth.spec.ts |
| 7 | (auth) | `/signup` | No | All | auth.spec.ts, signup-redesign.spec.ts |
| 8 | (auth) | `/claim` | No | All | claim.spec.ts |
| 9 | (auth) | `/consent` | Yes | All | consent.spec.ts |
| 10 | (onboarding) | `/onboarding` | Yes | Student | onboarding.spec.ts |
| 11 | (app) | `/dashboard` | Yes | All | dashboard.spec.ts |
| 12 | (app) | `/courses` | Yes | All | course-browser.spec.ts |
| 13 | (app) | `/planner` | Yes | Student, Parent | planner.spec.ts, planner-*.spec.ts |
| 14 | (app) | `/planner/print` | Yes | Student, Parent | print-gating.spec.ts |
| 15 | (app) | `/plans` | Yes | All | plan-management.spec.ts |
| 16 | (app) | `/progress` | Yes | Student, Parent | progress.spec.ts, gpa-trend.spec.ts |
| 17 | (app) | `/transcript` | Yes | Student, Parent | transcript.spec.ts |
| 18 | (app) | `/settings` | Yes | All | linked-accounts.spec.ts |
| 19 | (app) | `/settings/billing` | Yes | Student, Parent | billing.spec.ts |
| 20 | (app) | `/year-end` | Yes | Student | year-end.spec.ts |
| 21 | (app) | `/join` | Yes | All | join.spec.ts |

**22 routes total — all have spec file coverage.**

### Scenario axes

For every route, scenarios are tested across these dimensions:

| Axis | What it verifies |
|------|-----------------|
| Happy path | Normal user flow with valid data → expected outcome |
| Empty state | No plans, no courses, no linked accounts, no snapshots |
| Boundary | Max plans (3), max linked accounts (3), grade 12 graduation |
| Role-based | Student controls visible vs parent read/edit vs counselor read-only |
| Print | Print button gated, watermark present, `.no-print` elements hidden |
| FREE_LAUNCH_MODE | Limits enforced (3/3), billing hidden, upgrade prompts suppressed |

---

## Phase II: Tester Sub-Agents

### Prerequisites

**Test accounts** — created automatically by `global-setup.ts` before tests run:

| Role | Email | Password | Created By | Lifecycle |
|------|-------|----------|-----------|-----------|
| Student (Gr10) | `student@test.com` | `Test1234!` | global-setup.ts | Persistent — primary test student |
| Student (Gr9) | `student-b@test.com` | `Test1234!` | global-setup.ts | Persistent — parent's 2nd child for multi-child tests |
| Parent | `parent@test.com` | `Test1234!` | global-setup.ts | Persistent — linked to BOTH students |
| Counselor | `counselor@test.com` | `Test1234!` | global-setup.ts | Persistent — read-only access + plan share (view) |
| Consent Tester | `consent-test@test.com` | `Test1234!` | global-setup.ts | Persistent — NO consent records (reset each run) |
| Ephemeral | `student2@test.com` | `Test1234!` | onboarding.spec.ts | Cleaned up by global-teardown.ts |
| Ephemeral | `student3@test.com` | `Test1234!` | onboarding.spec.ts | Cleaned up by global-teardown.ts |

**All persistent accounts must have password `Test1234!`**. If passwords get out of sync (e.g., manual Supabase changes), reset them via:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await sb.auth.admin.listUsers();
  for (const email of ['student@test.com','student-b@test.com','parent@test.com','counselor@test.com','consent-test@test.com']) {
    const u = data.users.find(x => x.email === email);
    if (u) { await sb.auth.admin.updateUserById(u.id, { password: 'Test1234!' }); console.log(email, 'OK'); }
  }
})();
"
```

**Test data created by global-setup.ts (17 steps):**

| # | What | Why |
|---|------|-----|
| 1 | Clean up ephemeral accounts from previous runs | Idempotent start |
| 2 | Create/verify 7 auth users via Supabase Admin API + reset all passwords to `Test1234!` | All test accounts exist in auth.users with correct passwords |
| 3 | Ensure app user rows in `users` table | Links auth IDs to app-level user records |
| 4 | Student A account (Gr10, graduation 2028, IL/Stevenson HS) | Primary test student |
| 5 | Account members: student + parent (edit) + counselor (read-only) | Role-based and multi-child tests |
| 6 | Student profile for Student A | Grade level and graduation year |
| 7 | Primary plan ("E2E Test Plan") with `activated_at` | Planner, transcript, validation tests |
| 8 | Verify course catalog non-empty (throws if 0 courses) | Transcript, GPA, and planner tests need real courses |
| 9 | 16 courses: Gr9 completed with grades (A, A-, B+, B) + Gr10 enrolled | GPA/transcript tests need completed courses |
| 10 | Reset 2 Gr10 courses to `enrolled` (no grade) each run | Year-end wizard needs ungraded courses for grade dropdowns |
| 11 | GPA snapshot (3.500 UW / 3.750 W) | GPA trend chart and transcript tests |
| 12 | Consent records for student, student-b, parent, counselor (NOT consent-test) | All users except consent tester can access app pages |
| 13 | Grade 9 locked on primary plan | Grade-lock and read-only grade tests |
| 14 | Plan shares: parent (edit) + counselor (view) on primary plan | Parent plan access and counselor "View" button tests |
| 15 | Consent test account with NO consent records (deleted each run) | Consent form tests need the form to render |
| 16 | Student B account (Gr9, graduation 2029) linked to parent | Multi-child account switcher tests |
| 17 | Verify final state and log summary | Catch setup failures early |

**Key design decisions for test data:**
- **Password reset on every run**: `global-setup.ts` calls `updateUserById` to reset ALL persistent test account passwords to `Test1234!`, even for pre-existing accounts. This prevents silent login failures that cause tests to skip.
- **Consent test user** (`consent-test@test.com`): Has a valid account but consent records are *deleted* each run. This ensures the consent form tests (Terms of Service, checkbox, Accept/Decline buttons) always see the form. The redirect test uses `student@test.com` which has consent pre-accepted.
- **Ungraded Gr10 courses**: 2 courses are reset to `enrolled` (no grade) each run even if previous test runs graded them. This ensures the year-end wizard shows grade dropdowns and the `fillAllGrades()` helper can exercise them.
- **Parent linked to 2 children**: `parent@test.com` is a member of both Student A and Student B accounts. This enables the account switcher to show both children with different grade levels (Gr9 vs Gr10).
- **Plan shares**: Explicit `plan_shares` rows for parent (edit) and counselor (view) on the primary plan. Without these, counselor tests that check for "View" buttons would skip.
- **`activated_at` on primary plans**: Required by the `primary_has_activated_at` check constraint. Both Student A and Student B plans set `activated_at = NOW()`.
- **Ephemeral accounts for onboarding signup tests**: `student2@test.com` and `student3@test.com` are created during the onboarding Blank Plan and Template Plan tests. `global-setup.ts` deletes them at the start of each run (step 1), and `global-teardown.ts` deletes them at the end. This ensures signup tests always have a clean state. The Onboarding-Tester **must run with `--workers=1`** because these tests create real accounts sequentially and the guided tour popover interferes with parallel execution.
- **ToS checkbox on signup**: The signup form has a mandatory "I agree to the Terms of Service and Privacy Policy" checkbox that must be checked before submit. The ephemeral signup tests check this checkbox before clicking "Create account".

**Automatic cleanup by global-teardown.ts (runs after all tests):**
- Removes plans named "E2E %" or "Demo" (created during planner tests)
- Removes ephemeral accounts (student2/student3@test.com) and all their data
- Removes orphaned plan_history and accounts with no members
- Does NOT remove persistent accounts (student, student-b, parent, counselor, consent-test)

**Shared test helpers** (available to all spec files):
```typescript
import { login, loginAndGoTo } from "./helpers";
```

**Selector guidelines specific to this codebase:**
- Use `{ name: "Next", exact: true }` for buttons — avoids matching Next.js dev tools button (`data-nextjs-dev-tools-button`)
- Use `{ name: "Back", exact: true }` for buttons — avoids matching the "Send feedback" FAB
- Use `{ name: "Complete", exact: true }` and `{ name: "Accept", exact: true }` — same reason
- Use `getByRole("heading", { name: "..." })` instead of `text=` for page headings — avoids matching guided tour popovers (e.g., "Course Planner 📋", "Academic Progress Tour 📊")
- Use `button[aria-label="User menu"]` for the account switcher — NOT `aria-label*="account"` or `aria-label*="switch"`
- Use `.first()` on locators that may match multiple elements (e.g., "Terms of Service" appears in heading, checkbox label, and footer)
- Use `getByLabel("Password").first()` for password inputs — avoids matching "Show password" toggle button
- Always check ToS checkbox before submitting signup form — submit button is disabled without it

### Sub-Agent assignments

Each sub-agent runs its spec files via `npx playwright test <files>` and reports results.

| Sub-Agent | Command | Spec Files | Tests |
|-----------|---------|-----------|-------|
| Auth-Tester | `npx playwright test auth claim consent signup-redesign consent-settings` | 5 files | ~60 |
| Onboarding-Tester | `npx playwright test onboarding --workers=1` | 1 file | ~24 |
| Planner-Tester | `npx playwright test planner planner-add-course planner-grades planner-manage planner-validation course-browser summer-planner summer-course-browser` | 8 files | ~148 |
| Plans-Tester | `npx playwright test plan-management print-gating` | 2 files | ~32 |
| Progress-Tester | `npx playwright test progress gpa-trend grade-lock` | 3 files | ~76 |
| Transcript-Tester | `npx playwright test transcript summer-transcript-print` | 2 files | ~24 |
| Settings-Tester | `npx playwright test linked-accounts billing` | 2 files | ~50 |
| Dashboard-Tester | `npx playwright test dashboard` | 1 file | ~38 |
| Public-Tester | `npx playwright test homepage` | 1 file | ~19 |
| Role-Tester | `npx playwright test role-based` | 1 file | ~26 |
| YearEnd-Tester | `npx playwright test year-end` | 1 file | ~19 |
| A11y-Tester | `npx playwright test accessibility user-menu` | 2 files | ~20 |
| Join-Tester | `npx playwright test join` | 1 file | ~8 |
| Gap-Tester | `npx playwright test gaps-high-priority gaps-medium-priority` | 2 files | ~40 |
| Journey-Tester | `npx playwright test critical-journeys` | 1 file | ~14 |
| **TOTAL** | | **34 files** | **~652** |

### Selector resilience guidelines

When a test fails due to a changed selector, sub-agents should update selectors following this priority:

1. `getByRole("button", { name: "...", exact: true })` — most resilient; use `exact: true` to avoid matching Next.js dev tools, feedback FAB, etc.
2. `getByRole("heading", { name: "..." })` — for page headings; avoids matching guided tour popovers
3. `getByLabel("...").first()` — form inputs; use `.first()` to avoid matching show/hide password toggle
4. `getByText("...", { exact: true })` — content assertions; use `exact: true` when text appears in multiple elements
5. `locator('[data-testid="..."]')` — custom markers
6. `locator('a[href="..."]')` — navigation links
7. **Avoid:** raw CSS selectors, XPath, positional indexes, regex patterns like `/Next/i` (matches Next.js dev tools)

**Known strict-mode pitfalls in this codebase:**
- `"Next"` button → matches Next.js dev tools button; always use `{ exact: true }`
- `"Back"` button → matches "Send feedback" FAB; always use `{ exact: true }`
- `"Review"` text → matches heading, subtitle, step label, and description; use `getByText("Review", { exact: true })`
- `"Academic Progress"` → matches guided tour popover title; use `getByRole("heading")`
- `"Terms of Service"` → matches 4 elements on consent page; use `locator('span:has-text(...)').first()`
- `"Password"` → matches input AND show/hide toggle; use `.first()`
- Account switcher → button has `aria-label="User menu"`, NOT `"account"` or `"switch"`

---

## Phase III: Critical Journeys & Edge Cases

### Section A — Critical end-to-end journeys

These are **multi-page flows** that prove the app works as a connected system. Individual page tests are necessary but not sufficient — these journeys are the true go-live gate.

| ID | Priority | Journey | Steps | Expected Result | Spec File |
|----|----------|---------|-------|-----------------|-----------|
| J01 | P0 | New user signup → dashboard | Signup → consent → onboarding (select grade, choose template) → complete → dashboard shows plan | Dashboard displays "Active Plan" card with plan name | critical-journeys.spec.ts, onboarding.spec.ts |
| J02 | P0 | Course grading updates GPA | Login → transcript → verify GPA cards show numeric values (not "—") → progress page GPA is consistent | Both pages show matching non-zero GPA | critical-journeys.spec.ts |
| J03 | P0 | Print watermark on all pages | Login → check `.print-watermark` on progress, transcript, planner/print | Element contains "UNOFFICIAL — SAPS" text on all 3 pages | critical-journeys.spec.ts |
| J04 | P0 | Student invites parent | Login → settings → fill email + select Parent role + check plan shares → send invite | Form submits without error, page remains on settings | critical-journeys.spec.ts |
| J05 | P0 | Parent views child's data | Login as parent → plans, planner, transcript, progress all load with child's data | Each page shows content (not error or empty unauthorized state) | critical-journeys.spec.ts |
| J06 | P1 | Grade lock → year-end → advance | Login → planner → lock grade → redirects to year-end → 3-step wizard → complete | Account grade level advances, locked courses are read-only | grade-lock.spec.ts, year-end.spec.ts |
| J07 | P1 | Course search → add to plan | Login → courses → search → click course → modal → Add to Plan → select grade/semester → confirm | Course appears in planner grid | gaps-high-priority.spec.ts, course-browser.spec.ts |
| J08 | P1 | Create plan → verify in planner | Login → plans → New Plan → planner dropdown shows new plan | Plan name appears in plan selector | plan-management.spec.ts, planner.spec.ts |
| J09 | P1 | Fix progress gap via planner | Login → progress → identify gap → navigate to planner → add course → progress gap resolves | Gap indicator changes from red to green | *Not yet tested* |
| J10 | P2 | Transcript GPA matches planner | Grade courses in planner → transcript GPA recalculates | UW/W GPA values match across pages | *Not yet tested* |
| J11 | P2 | Delete account with export | Settings → Danger Zone → check export → type DELETE → confirm | JSON file downloads, then redirects to /login | linked-accounts.spec.ts (modal only) |
| J12 | P2 | Homepage → signup | Visit / → click "Get Started Free" → lands on /signup | URL changes to /signup, form visible | gaps-medium-priority.spec.ts |
| J13 | P1 | Summer course → planner → validation | Login → planner → expand Pre-Summer → add summer course → verify in grid + validation report counts it + graduation requirement met | Course appears in summer cell, validation report shows no gap for that requirement | summer-planner.spec.ts |
| J14 | P1 | Summer/regular equivalence | Login → add SOC13S/SOC14S to summer cell → open regular semester picker → search World History | SOC101/SOC102 does NOT appear in picker (filtered as equivalent) | summer-planner.spec.ts |

### Section B — Edge case scenarios

Each scenario has:
- **ID**: unique, sequential
- **Steps**: exact user actions
- **Expected**: what MUST happen (pass/fail criteria)
- **Spec file**: where it's tested (or "—" if not yet automated)

#### B1. Planner
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E01 | Duplicate course prevention | Add full-year course to S1 → try adding same course to S2 | Error message or button disabled — course not duplicated | planner-add-course.spec.ts |
| E02 | Prerequisite removal triggers validation | Add ENG201 (requires ENG101) → remove ENG101 | Validation panel shows prerequisite violation | planner-validation.spec.ts |
| E03 | Edit locked grade blocked | Lock Grade 9 → try to add/remove courses in Grade 9 | Add/remove controls disabled or blocked | grade-lock.spec.ts |
| E04 | Print with collapsed sections | Collapse all groups → print | `.print-expand` CSS forces all sections visible in print | progress.spec.ts |
| E05 | Print hides buttons/filters | Trigger print | `.no-print` elements not rendered in print output | progress.spec.ts |

#### B2. GPA & Snapshots
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E06 | Semester completion dedup | Complete all courses in F S1 with grades simultaneously | Exactly one `semester_end` snapshot created (not multiple) | unit: subscription-middleware.test.ts |
| E07 | No graduation year fallback | Student with `graduationYear = null` → view GPA chart | X-axis shows `#1, #2` instead of `F S1, SM S2` | — |
| E08 | Lock, unlock, re-lock same day | Lock grade → unlock → re-lock | Only one snapshot per student per day | — |

#### B3. Onboarding (per grade level)
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E09 | Freshman skips Past Courses | Select Grade 9 → Next | Lands on Step 3 (Starting Plan), skipping Step 2 | onboarding.spec.ts |
| E10 | Freshman Back from Step 3 | Grade 9 → Next → Back | Returns to Step 1 (not Step 2) | onboarding.spec.ts |
| E11 | Sophomore shows Gr 9 tab | Select Grade 10 → Next | Step 2 shows Grade 9 past courses | onboarding.spec.ts |
| E12 | Junior shows Gr 9–10 tabs | Select Grade 11 → Next | Step 2 shows Grade 9 and Grade 10 tabs | onboarding.spec.ts |
| E13 | Senior shows Gr 9–11 tabs | Select Grade 12 → Next | Step 2 shows Grade 9, 10, and 11 tabs | onboarding.spec.ts |
| E14 | Past courses → skip templates | Select Gr 10+ → enter courses → Next | Skips Step 3, lands on Step 4 (Goals) | onboarding.spec.ts |
| E15 | Blank plan = empty planner | Complete with "Start from scratch" | Planner shows 0 course cards | onboarding.spec.ts |
| E16 | Template plan = pre-filled planner | Complete with template selected | Planner shows course codes from template | onboarding.spec.ts |
| E17 | Template preview shows grades | Click "Preview courses" on template card | Expandable list shows courses grouped by Grade 9/10/11/12 | onboarding.spec.ts |
| E18 | Deselect template | Select → click again | Button reverts from "Selected" to "Select this plan" | onboarding.spec.ts |

#### B4. Roles — Student
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E19 | Student sees grade/graduation in settings | Login → /settings | Grade N and graduation year visible | role-based.spec.ts |
| E20 | Student can create plans | Login → /plans | "New Plan" button visible | role-based.spec.ts |
| E21 | Student can send invites | Login → /settings | Invite email input and role dropdown visible | role-based.spec.ts |
| E22 | Student can access year-end | Login → /year-end | Step indicator and heading visible | role-based.spec.ts |
| E23 | Student sees print on all pages | Login → planner, progress, transcript | Print button enabled on all 3 | print-gating.spec.ts |

#### B5. Roles — Parent
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E24 | Parent sees Student Information | Login as parent → /settings | Student name, grade, school shown | role-based.spec.ts |
| E25 | Parent sees account switcher | Login as parent | Nav shows account switcher dropdown | role-based.spec.ts |
| E26 | Parent views shared plans | Login as parent → /plans | Plans page shows plans or "No plans" | role-based.spec.ts |

#### B6. Roles — Counselor
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E27 | Counselor cannot create plans | Login as counselor → /plans | No "New Plan" button | role-based.spec.ts |
| E28 | Counselor cannot send invites | Login as counselor → /settings | No invite email input | role-based.spec.ts |
| E29 | Counselor sees View not Edit | Login as counselor → /plans | "View" button on plan cards, no "Edit" | role-based.spec.ts |
| E30 | Counselor has no billing | Login as counselor | No billing link in nav | role-based.spec.ts |
| E31 | Counselor planner is read-only | Login as counselor → /planner | No add/remove/move course controls | role-based.spec.ts |

#### B7. Roles — Guardian
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E32 | Guardian in signup role selector | Visit /signup | "Guardian" option visible with description | role-based.spec.ts |
| E33 | Guardian in invite dropdown | Login → /settings | "Guardian" option in role select | role-based.spec.ts |

#### B8. Roles — Cross-role & auth
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E34 | Unauthenticated redirect | Visit /dashboard without login | Redirects to /login | role-based.spec.ts |
| E35 | Public pages accessible | Visit /, /about, /contact, /terms, /privacy | All load without auth | role-based.spec.ts |
| E36 | 404 for invalid URL | Visit /nonexistent-page | 404 page or redirect | gaps-high-priority.spec.ts |

#### B9. Parent with multiple children
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E37 | Switcher shows all children | Login as parent → open switcher | Each child listed with name + "Gr N" | role-based.spec.ts |
| E38 | Switching child updates data | Switch from Child A to Child B on dashboard | Dashboard content changes | role-based.spec.ts |
| E39 | Different grade levels shown | Open switcher with 2+ children | Distinct "Gr N" labels per child | role-based.spec.ts |

#### B10. Linked accounts & FREE_LAUNCH_MODE
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E40 | Badge shows /3 limit | Login → /settings | Badge reads `X/3 used`, not `/5` or `/8` | linked-accounts.spec.ts |
| E41 | Billing shows Free Early Access | Login → /settings/billing | "Free Early Access" card, no pricing | linked-accounts.spec.ts |
| E42 | No upgrade prompts | Trigger subscription-gated action | Upgrade modal does not appear | linked-accounts.spec.ts |

#### B11. Account deletion
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E43 | Danger Zone visible | Login → /settings | "Danger Zone" section with "Delete Account" button | linked-accounts.spec.ts |
| E44 | Delete disabled until DELETE typed | Open modal → type partial text | "Delete my account" button stays disabled | linked-accounts.spec.ts |
| E45 | Cancel closes modal | Open modal → click Cancel | Modal closes, page unchanged | linked-accounts.spec.ts |
| E46 | Export checkbox toggleable | Open modal → check/uncheck export | Checkbox toggles on and off | linked-accounts.spec.ts |

#### B12. Year-end wizard
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E47 | 3-step wizard loads | Login → /year-end | Heading, step indicator, progress bar visible | year-end.spec.ts |
| E48 | Grade dropdowns present | Step 1 | Each active course has a grade select (A–F or P/F) | year-end.spec.ts |
| E49 | Next disabled when grades incomplete | Step 1 with ungraded courses | "Next" button disabled, warning shown | year-end.spec.ts |
| E50 | Step navigation forward/back | Step 1 → Next → Step 2 → Back → Step 1 | Correct step content shown at each stage | year-end.spec.ts |
| E51 | Review step shows locked courses | Navigate to Step 3 | Table with courses and final grades, "Cannot be undone" warning | year-end.spec.ts |
| E52 | URL grade parameter | Visit /year-end?grade=9 | Loads with Grade 9 context | year-end.spec.ts |
| E53 | ARIA progress bar | Any step | `role="progressbar"` with aria-valuenow, aria-valuemin, aria-valuemax | year-end.spec.ts |

#### B13. Contact form & feedback widget
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E54 | Contact form fields | Visit /contact | Name, email, subject, message fields visible | gaps-high-priority.spec.ts |
| E55 | Contact submit disabled when empty | Empty form | "Send Message" button disabled | gaps-high-priority.spec.ts |
| E56 | Contact form submission | Fill all fields → submit | "Message sent" success or API error shown | gaps-high-priority.spec.ts |
| E57 | Feedback star rating → submit | Open widget → rate 5 stars → submit | "Thanks for your feedback" shown | linked-accounts.spec.ts |
| E58 | Feedback close button | Open widget → click X | Widget closes | linked-accounts.spec.ts |

#### B14. Course detail modal
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E59 | Modal opens from browser | Click course in /courses | `role="dialog"` modal visible with course name | gaps-high-priority.spec.ts |
| E60 | Modal shows metadata | Open modal | Credit type badge (CP/Honors/AP/Accelerated) visible | gaps-high-priority.spec.ts |
| E61 | Close button works | Open modal → click X | Modal closes | gaps-high-priority.spec.ts |
| E62 | Backdrop click closes | Open modal → click outside | Modal closes | gaps-high-priority.spec.ts |
| E63 | Add to Plan form | Click "Add to Plan" in modal | Plan selector and grade/semester buttons shown | gaps-high-priority.spec.ts |

#### B15. Plan sharing & deletion
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E64 | Share modal opens | Click share on plan card | Modal with permission dropdowns visible | gaps-high-priority.spec.ts |
| E65 | Share modal closes | Click X in share modal | Modal closes | gaps-high-priority.spec.ts |
| E66 | Delete modal opens | Click delete on non-primary plan | `role="alertdialog"` confirmation modal | gaps-high-priority.spec.ts |
| E67 | Delete cancel | Click Cancel in delete modal | Modal closes, plan still exists | gaps-high-priority.spec.ts |

#### B16. Navigation links
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E68 | Dashboard → Planner | Click "Open Planner" on dashboard | URL changes to /planner | gaps-medium-priority.spec.ts |
| E69 | Dashboard → Progress | Click "View Progress" | URL changes to /progress | gaps-medium-priority.spec.ts |
| E70 | Dashboard → Transcript | Click "Transcript" link | URL changes to /transcript | gaps-medium-priority.spec.ts |
| E71 | Homepage → Signup | Click "Get Started Free" | URL changes to /signup | gaps-medium-priority.spec.ts |
| E72 | Footer → Terms | Click "Terms" in footer | URL changes to /terms | gaps-medium-priority.spec.ts |
| E73 | Footer → Privacy | Click "Privacy" in footer | URL changes to /privacy | gaps-medium-priority.spec.ts |
| E74 | Nav → About | Click "About" link | URL changes to /about | gaps-medium-priority.spec.ts |
| E75 | Planner → Plans | Click "Manage Plans" | URL changes to /plans | gaps-medium-priority.spec.ts |

#### B17. Progress — manual completion checkboxes
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E76 | Manual checkbox toggles requirement status | Login → /progress → find manual_checkbox requirement → click checkbox | Requirement status toggles between complete/incomplete | — |
| E77 | Manual checkbox visual feedback | Toggle checkbox on | Checkbox shows checkmark, status badge updates to "Complete" | — |

#### B18. Dashboard — profile completion banner
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E78 | Profile banner shows for incomplete profiles | Login with incomplete profile → /dashboard | "Complete your profile" or "Create a plan" banner visible | — |
| E79 | Profile banner dismiss persists | Click dismiss on banner | Banner disappears and does not return on page reload | — |

#### B19. Settings — consent history
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E80 | Consent history displays accepted documents | Login → /settings | Shows Terms of Service and Privacy Policy with accepted date | — |
| E81 | Consent history links to documents | Click "Terms of Service" link in history | Navigates to /terms | — |

#### B20. What-if GPA (API-only, Plus+ tier)
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E82 | What-if GPA API returns simulation | POST /api/v1/gpa/what-if with grade changes | Response contains recalculated UW/W GPA | — |
| E83 | What-if blocked in FREE_LAUNCH_MODE if can_what_if=false | Call API when feature disabled | 402 or appropriate error | unit: subscription-middleware.test.ts |

#### B22. Summer courses
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E86 | Pre-Summer row expands | Login → planner → click "+ Pre-Summer Courses" on a grade | Summer row appears above regular semesters with Session 1 and Session 2 cells | summer-planner.spec.ts |
| E87 | Pre-Summer row hides | Expand summer row → click "Hide" | Summer row collapses back to the "+ Pre-Summer Courses" button | summer-planner.spec.ts |
| E88 | Summer row auto-expands when courses exist | Add a summer course → reload planner | Summer row is already expanded for that grade | summer-planner.spec.ts |
| E89 | Summer cell limited to 1 course | Add a course to Pre-Summer Session 1 cell | Add button disappears, counter shows "1/1" | summer-planner.spec.ts |
| E90 | Full-year summer course auto-fills both sessions | Add Algebra 1 (MTH15S/MTH16S) from summer picker | Both Session 1 and Session 2 cells show the course | summer-planner.spec.ts |
| E91 | Summer courses hidden from regular picker | Open course picker from Semester 1 cell | No courses with "Summer" badge appear | summer-planner.spec.ts |
| E92 | Regular courses hidden from summer picker | Open course picker from Pre-Summer Session 1 cell | Only summer courses appear, filters are hidden | summer-planner.spec.ts |
| E93 | Summer picker shows "Add Summer Course" header | Open picker from summer cell | Title says "Add Summer Course" with warning-colored subtitle | summer-planner.spec.ts |
| E94 | Summer badge on course cards | View a summer course in planner grid | Card shows amber "Summer" badge after credit type | summer-planner.spec.ts |
| E95 | Summer badge in course browser | Open course browser → filter by "☀ Summer" | Only summer courses shown, each with "Summer" badge | summer-course-browser.spec.ts |
| E96 | Summer badge in course detail modal | Click a summer course card → view detail | "Summer" badge visible in header badges | summer-course-browser.spec.ts |
| E97 | "Also available as" shows equivalents | Open SOC13S/SOC14S detail | "Also available as" section shows SOC101/SOC102 | summer-course-browser.spec.ts |
| E98 | "Also available as" reverse direction | Open SOC101/SOC102 detail | "Also available as" section shows SOC13S/SOC14S | summer-course-browser.spec.ts |
| E99 | Equivalent course blocked from picker | Add SOC13S/SOC14S to summer → open Semester 1 picker | SOC101/SOC102 does not appear in results | summer-planner.spec.ts |
| E100 | Equivalent course warning from validator | Try to force-add SOC101/SOC102 via API when SOC13S/SOC14S exists | Warning: "SOC101/SOC102 is equivalent to SOC13S/SOC14S which is already in your plan" | — |
| E101 | Full-year summer add from detail page | Open MTH15S/MTH16S detail → click "Add to Plan" | Adds to both Session 1 (-2) and Session 2 (-1), message says "both summer sessions" | — |
| E102 | Summer courses in validation report | Add SOC13S/SOC14S to summer cell → open validation report | World History graduation requirement shows as met (not gap) | summer-transcript-print.spec.ts |
| E103 | Summer courses in transcript | Complete a summer course with grade → view transcript | Summer course appears under grade section with amber "Pre-Summer Session" header | summer-transcript-print.spec.ts |
| E104 | Summer courses in print view | Add summer courses → open planner print | Summer courses appear inline under Semester 1/2 tables with ☀ prefix and amber text | summer-transcript-print.spec.ts |
| E105 | Summer courses in year-end wizard | Navigate to year-end with summer courses in plan | Summer courses appear in grade confirmation with amber "Pre-Summer Session" label | summer-transcript-print.spec.ts |
| E106 | Summer course GPA contribution | Complete a summer course with grade A → view transcript GPA | Summer course credits and grade counted in cumulative GPA | summer-transcript-print.spec.ts |
| E107 | Summer prerequisite satisfaction | Add summer Algebra 1 (MTH15S/MTH16S) → add regular Geometry (MTH251/252) | No prerequisite violation — summer Algebra 1 satisfies Geometry's prerequisite | — |
| E108 | Course browser summer filter | Click "☀ Summer" in Semester Offered filter | Only summer courses shown, semester text says "Summer" instead of "Sem -2 only" | summer-course-browser.spec.ts |

#### B21. Google OAuth
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E84 | Google sign-in button visible on login | Visit /login | "Sign in with Google" button visible | auth.spec.ts |
| E85 | Google sign-in redirects to OAuth provider | Click Google button | Page navigates to Google OAuth URL (cannot fully test in e2e) | — |

---

## Phase IV: Consolidation & Reporting

After all sub-agents complete, generate an HTML report file at:

```
saps/tests/report/QA_DEPLOYMENT_REPORT_<YYYY-MM-DD>.html
```

Use the Write tool to create this file. The HTML must be a single self-contained file (inline CSS, no external dependencies) that can be opened directly in a browser.

### Report template

Generate the HTML file with the following structure. Replace all `___` placeholders with actual values from the test run.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAPS QA Deployment Report — YYYY-MM-DD</title>
  <style>
    :root {
      --green: #16a34a; --red: #dc2626; --amber: #d97706;
      --bg: #f8fafc; --card: #ffffff; --border: #e2e8f0;
      --text: #1e293b; --muted: #64748b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.25rem; margin: 2rem 0 1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1rem; margin: 1.5rem 0 0.75rem; }
    .subtitle { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
    .verdict-banner { padding: 1.5rem; border-radius: 12px; text-align: center; font-size: 1.5rem; font-weight: 700; margin-bottom: 2rem; }
    .verdict-go { background: #dcfce7; color: var(--green); border: 2px solid var(--green); }
    .verdict-nogo { background: #fef2f2; color: var(--red); border: 2px solid var(--red); }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; text-align: center; }
    .summary-card .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
    .summary-card .value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
    .pass { color: var(--green); } .fail { color: var(--red); } .warn { color: var(--amber); }
    table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 10px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 1.5rem; }
    th { background: #f1f5f9; text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
    td { padding: 0.625rem 1rem; border-top: 1px solid var(--border); font-size: 0.875rem; }
    tr:hover { background: #f8fafc; }
    .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-pass { background: #dcfce7; color: var(--green); }
    .badge-fail { background: #fef2f2; color: var(--red); }
    .badge-skip { background: #fef9c3; color: var(--amber); }
    .failure-block { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1rem; font-size: 0.875rem; }
    .failure-block strong { color: var(--red); }
    .failure-block code { background: #fee2e2; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.8125rem; }
    .gap-row td:first-child { font-weight: 600; }
    .criteria-table td:last-child { font-weight: 600; text-align: center; }
    .timestamp { color: var(--muted); font-size: 0.75rem; margin-top: 3rem; text-align: center; padding-top: 1.5rem; border-top: 1px solid var(--border); }
  </style>
</head>
<body>

<h1>SAPS QA Deployment Report</h1>
<p class="subtitle">Generated: YYYY-MM-DD HH:MM — Environment: localhost:3000</p>

<!-- ═══ VERDICT BANNER ═══ -->
<!-- Use class="verdict-banner verdict-go" for GO, "verdict-banner verdict-nogo" for NO-GO -->
<div class="verdict-banner verdict-go">
  ✅ GO — All criteria met
  <!-- OR: ❌ NO-GO — ___ criteria failed -->
</div>

<!-- ═══ SUMMARY CARDS ═══ -->
<div class="summary-grid">
  <div class="summary-card">
    <div class="label">E2E Tests</div>
    <div class="value pass">___/652</div>
  </div>
  <div class="summary-card">
    <div class="label">Unit / API Tests</div>
    <div class="value pass">___/445</div>
  </div>
  <div class="summary-card">
    <div class="label">Critical Journeys</div>
    <div class="value pass">___/14</div>
  </div>
  <div class="summary-card">
    <div class="label">Edge Cases</div>
    <div class="value pass">___/108</div>
  </div>
  <div class="summary-card">
    <div class="label">Route Coverage</div>
    <div class="value pass">22/22</div>
  </div>
  <div class="summary-card">
    <div class="label">Failed</div>
    <div class="value fail">___</div>
  </div>
</div>

<h2>Per-Agent Results</h2>
<table>
  <thead>
    <tr><th>Sub-Agent</th><th>Tests</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Duration</th><th>Verdict</th></tr>
  </thead>
  <tbody>
    <!-- Repeat for each sub-agent. Example row: -->
    <tr>
      <td>Auth-Tester</td><td>60</td><td>___</td><td>___</td><td>___</td><td>___s</td>
      <td><span class="badge badge-pass">PASS</span></td>
      <!-- OR: <td><span class="badge badge-fail">FAIL</span></td> -->
    </tr>
    <tr><td>Onboarding-Tester</td><td>24</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Planner-Tester</td><td>148</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Plans-Tester</td><td>32</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Progress-Tester</td><td>76</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Transcript-Tester</td><td>24</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Settings-Tester</td><td>50</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Dashboard-Tester</td><td>38</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Public-Tester</td><td>19</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Role-Tester</td><td>26</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>YearEnd-Tester</td><td>19</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>A11y-Tester</td><td>20</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Join-Tester</td><td>8</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Gap-Tester</td><td>40</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
    <tr><td>Journey-Tester</td><td>14</td><td>___</td><td>___</td><td>___</td><td>___s</td><td><span class="badge badge-pass">PASS</span></td></tr>
  </tbody>
</table>

<h2>Critical Failures</h2>
<!-- If no failures, show: -->
<p style="color: var(--green); font-weight: 600;">No critical failures.</p>
<!-- If failures exist, repeat this block for each: -->
<!--
<div class="failure-block">
  <strong>[FAIL] E03 — Edit locked grade blocked</strong><br>
  File: <code>grade-lock.spec.ts:142</code><br>
  Expected: Add course button disabled for locked Grade 9<br>
  Actual: Button was enabled — user could add courses to locked grade<br>
  Severity: <strong>P0 — data integrity risk</strong>
</div>
-->

<h2>Known Gaps</h2>
<p style="color: var(--muted); font-size: 0.875rem; margin-bottom: 0.75rem;">Features with no automated coverage — require manual testing before release.</p>
<table>
  <thead><tr><th>Gap</th><th>Risk</th><th>Mitigation</th></tr></thead>
  <tbody>
    <tr class="gap-row"><td>J09: Fix progress gap via planner</td><td>Medium — core workflow</td><td>Manual test before release</td></tr>
    <tr class="gap-row"><td>J10: Transcript GPA matches planner</td><td>Medium — data accuracy</td><td>Manual verification with test data</td></tr>
    <tr class="gap-row"><td>E07: No graduation year GPA fallback</td><td>Low — edge case</td><td>Unit test covers logic</td></tr>
    <tr class="gap-row"><td>E08: Lock/unlock/re-lock same day</td><td>Low — dedup guard</td><td>Server-side dedup tested in unit tests</td></tr>
    <tr class="gap-row"><td>E76–E77: Manual completion checkboxes</td><td>Low — niche feature</td><td>Manual test with seeded data</td></tr>
    <tr class="gap-row"><td>E78–E79: Profile completion banner</td><td>Low — first-run only</td><td>Manual test with new account</td></tr>
    <tr class="gap-row"><td>E80–E81: Consent history display</td><td>Low — informational</td><td>Manual verification</td></tr>
    <tr class="gap-row"><td>E82–E83: What-if GPA</td><td>Medium — Plus+ feature</td><td>API unit tests exist</td></tr>
    <tr class="gap-row"><td>E85: Google OAuth full flow</td><td>Low — third-party OAuth</td><td>Manual test with real Google account</td></tr>
    <tr class="gap-row"><td>Mobile hamburger menu</td><td>Low — most users on desktop</td><td>Manual spot-check on iPhone</td></tr>
    <tr class="gap-row"><td>Drag-and-drop in planner</td><td>Medium — core feature</td><td>Manual test, Playwright lacks native drag</td></tr>
  </tbody>
</table>

<h2>Go / No-Go Criteria</h2>
<table class="criteria-table">
  <thead><tr><th>Criterion</th><th>Threshold</th><th>Status</th></tr></thead>
  <tbody>
    <tr><td>All P0 journeys (J01–J05) pass</td><td>5/5</td><td><span class="badge badge-pass">___</span></td></tr>
    <tr><td>All P1 journeys (J06–J08, J13–J14) pass</td><td>5/6 (J09 exempt — manual)</td><td><span class="badge badge-pass">___</span></td></tr>
    <tr><td>Zero critical (P0) failures in edge cases</td><td>0 failures</td><td><span class="badge badge-pass">___</span></td></tr>
    <tr><td>Unit/API tests 100% pass</td><td>445/445</td><td><span class="badge badge-pass">___</span></td></tr>
    <tr><td>No security vulnerabilities open</td><td>0 open</td><td><span class="badge badge-pass">___</span></td></tr>
  </tbody>
</table>

<div class="timestamp">
  Report generated by SAPS Test Orchestration — YYYY-MM-DD HH:MM<br>
  Playwright HTML report available via: <code>npx playwright show-report</code>
</div>

</body>
</html>
```

### How to populate the report

When filling the template above:
1. Replace all `YYYY-MM-DD HH:MM` with the actual date/time
2. Replace all `___` with actual counts from each sub-agent's test output
3. Set the verdict banner class to `verdict-go` or `verdict-nogo`
4. For each failed test, add a `failure-block` div under Critical Failures
5. For each sub-agent row, use `badge-pass`, `badge-fail`, or `badge-skip` based on results
6. Summary card `.value` should use class `pass`, `fail`, or `warn` based on thresholds
7. Write the file to `saps/tests/report/QA_DEPLOYMENT_REPORT_<YYYY-MM-DD>.html`

---

## Appendix: Execution Commands

### Quick run

```bash
cd saps

# Unit + API tests (445 tests)
npx vitest run

# E2E tests (~612 tests, auto-starts dev server)
npx playwright test

# View HTML report
npx playwright show-report
```

### Parallel sub-agent execution

```bash
# Run all sub-agents in parallel with 4 workers
npx playwright test --project=chromium --workers=4 --reporter=html

# Run with retries for flaky tests
npx playwright test --retries=2

# Run a single sub-agent group
npx playwright test auth claim consent signup-redesign consent-settings          # Auth
npx playwright test planner planner-add-course planner-grades planner-manage     # Planner
npx playwright test summer-planner summer-course-browser summer-transcript-print # Summer
npx playwright test progress gpa-trend grade-lock                                # Progress
npx playwright test critical-journeys                                            # Journeys
npx playwright test role-based                                                   # Roles

# Year-end and onboarding must run with 1 worker (shared state / sequential signup)
npx playwright test year-end.spec --workers=1
npx playwright test onboarding --workers=1
```

**Tests that require `--workers=1`:**
- **Year-end wizard**: Tests share server-side state (course grades). Parallel workers may grade courses that another worker expects to be ungraded, causing sporadic skips on Step 3 review tests.
- **Onboarding signup flows**: The Blank Plan and Template Plan tests create real accounts (`student2@test.com`, `student3@test.com`) sequentially. Running in parallel causes race conditions on account creation. The guided tour popover also interferes with page assertions if multiple tests hit the planner concurrently.

### Cleanup after destructive tests

```bash
# Remove ephemeral test accounts (student2@test.com, student3@test.com)
npx tsx scripts/cleanup-test-users.ts
```

### CI pipeline

```yaml
- name: Run SAPS test suite
  run: |
    cd saps
    npx vitest run
    npx playwright install --with-deps
    npx playwright test --reporter=html
    npx tsx scripts/cleanup-test-users.ts
```
