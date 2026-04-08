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
| Student | `student@test.com` | `Test1234!` | global-setup.ts | Persistent — survives across runs |
| Parent | `parent@test.com` | `Test1234!` | global-setup.ts | Persistent — linked to student |
| Counselor | `counselor@test.com` | `Test1234!` | global-setup.ts | Persistent — read-only access |
| Ephemeral | `student2@test.com` | `Test1234!` | onboarding.spec.ts | Cleaned up by global-teardown.ts |
| Ephemeral | `student3@test.com` | `Test1234!` | onboarding.spec.ts | Cleaned up by global-teardown.ts |

**Test data created by global-setup.ts:**
- Student account with Grade 10, graduation year 2028, IL/Stevenson HS
- Primary plan ("E2E Test Plan") with 16 courses across Grades 9–10
- Grade 9 courses marked as completed with grades (A, A-, B+, B)
- Grade 10 courses marked as enrolled
- Grade 9 locked on primary plan
- GPA snapshot (3.500 UW / 3.750 W)
- Parent and counselor linked to student's account
- Consent records for all 3 users

**Automatic cleanup by global-teardown.ts (runs after all tests):**
- Removes plans named "E2E %" or "Demo" (created during planner tests)
- Removes ephemeral accounts (student2/student3@test.com) and all their data
- Removes orphaned plan_history and accounts with no members

**Shared test helpers** (available to all spec files):
```typescript
import { login, loginAndGoTo } from "./helpers";
```

### Sub-Agent assignments

Each sub-agent runs its spec files via `npx playwright test <files>` and reports results.

| Sub-Agent | Command | Spec Files | Tests |
|-----------|---------|-----------|-------|
| Auth-Tester | `npx playwright test auth claim consent signup-redesign consent-settings` | 5 files | ~60 |
| Onboarding-Tester | `npx playwright test onboarding` | 1 file | ~24 |
| Planner-Tester | `npx playwright test planner planner-add-course planner-grades planner-manage planner-validation course-browser` | 6 files | ~118 |
| Plans-Tester | `npx playwright test plan-management print-gating` | 2 files | ~32 |
| Progress-Tester | `npx playwright test progress gpa-trend grade-lock` | 3 files | ~76 |
| Transcript-Tester | `npx playwright test transcript` | 1 file | ~12 |
| Settings-Tester | `npx playwright test linked-accounts billing` | 2 files | ~50 |
| Dashboard-Tester | `npx playwright test dashboard` | 1 file | ~38 |
| Public-Tester | `npx playwright test homepage` | 1 file | ~19 |
| Role-Tester | `npx playwright test role-based` | 1 file | ~26 |
| YearEnd-Tester | `npx playwright test year-end` | 1 file | ~19 |
| A11y-Tester | `npx playwright test accessibility user-menu` | 2 files | ~20 |
| Join-Tester | `npx playwright test join` | 1 file | ~8 |
| Gap-Tester | `npx playwright test gaps-high-priority gaps-medium-priority` | 2 files | ~40 |
| Journey-Tester | `npx playwright test critical-journeys` | 1 file | ~14 |
| **TOTAL** | | **31 files** | **~612** |

### Selector resilience guidelines

When a test fails due to a changed selector, sub-agents should update selectors following this priority:

1. `getByRole("button", { name: "..." })` — most resilient
2. `getByLabel("...")` — form inputs
3. `getByText("...")` — content assertions
4. `locator('[data-testid="..."]')` — custom markers
5. `locator('a[href="..."]')` — navigation links
6. **Avoid:** raw CSS selectors, XPath, positional indexes

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

#### B21. Google OAuth
| ID | Scenario | Steps | Expected | Spec |
|----|----------|-------|----------|------|
| E84 | Google sign-in button visible on login | Visit /login | "Sign in with Google" button visible | auth.spec.ts |
| E85 | Google sign-in redirects to OAuth provider | Click Google button | Page navigates to Google OAuth URL (cannot fully test in e2e) | — |

---

## Phase IV: Consolidation & Reporting

After all sub-agents complete, produce this report:

### Summary block

```
╔══════════════════════════════════════════════════════════════╗
║                  SAPS E2E TEST REPORT                       ║
║                  Date: YYYY-MM-DD HH:MM                     ║
╠══════════════════════════════════════════════════════════════╣
║  E2E Tests:        612 total | ___ passed | ___ failed      ║
║  Unit/API Tests:   445 total | ___ passed | ___ failed      ║
║  Critical Journeys: 12 (J01–J12) | ___ passed | ___ gaps    ║
║  Edge Cases:        85 (E01–E85) | ___ covered | ___ gaps   ║
║  Route Coverage:    22/22 pages (100%)                       ║
║  Verdict:           GO / NO-GO                               ║
╚══════════════════════════════════════════════════════════════╝
```

### Per-agent results

| Sub-Agent | Tests | Passed | Failed | Skipped | Duration | Verdict |
|-----------|-------|--------|--------|---------|----------|---------|
| Auth-Tester | 60 | | | | | |
| Onboarding-Tester | 24 | | | | | |
| Planner-Tester | 118 | | | | | |
| ... | ... | | | | | |

### Critical failures

Any test failure gets escalated here with full context:

```
[FAIL] E03 — Edit locked grade blocked
  File: grade-lock.spec.ts:142
  Expected: Add course button disabled for locked Grade 9
  Actual: Button was enabled — user could add courses to locked grade
  Screenshot: test-results/E03-locked-grade-edit.png
  Severity: P0 — data integrity risk
```

### Known gaps

Features with no automated coverage:

| Gap | Risk | Mitigation |
|-----|------|-----------|
| J09: Fix progress gap via planner | Medium — core workflow | Manual test before release |
| J10: Transcript GPA matches planner | Medium — data accuracy | Manual verification with test data |
| E07: No graduation year GPA fallback | Low — edge case | Unit test covers logic |
| E08: Lock/unlock/re-lock same day | Low — dedup guard exists | Server-side dedup tested in unit tests |
| E76–E77: Manual completion checkboxes | Low — niche feature | Manual test with seeded data |
| E78–E79: Profile completion banner | Low — first-run only | Manual test with new account |
| E80–E81: Consent history display | Low — informational | Manual verification |
| E82–E83: What-if GPA | Medium — Plus+ feature, disabled in FREE_LAUNCH_MODE | API unit tests exist |
| E85: Google OAuth full flow | Low — cannot automate third-party OAuth | Manual test with real Google account |
| Mobile hamburger menu | Low — most users on desktop | Manual spot-check on iPhone |
| Drag-and-drop in planner | Medium — core feature | Manual test, Playwright lacks native drag support |

### Go/No-Go criteria

| Criterion | Threshold | Status |
|-----------|-----------|--------|
| All P0 journeys (J01–J05) pass | 5/5 | |
| All P1 journeys (J06–J08) pass | 3/4 (J09 exempt — manual) | |
| Zero critical (P0) failures in edge cases | 0 failures | |
| Unit/API tests 100% pass | 445/445 | |
| No security vulnerabilities open | 0 open | |

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
npx playwright test progress gpa-trend grade-lock                                # Progress
npx playwright test critical-journeys                                            # Journeys
npx playwright test role-based                                                   # Roles
```

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
