# SAPS E2E Test Suite

Single-command test gate for the SAPS v1 release. Verifies business logic, UI smoke coverage, and cross-role journeys in **~4 minutes** with **100% pass rate**.

## Run it

```bash
cd saps
npm run test:e2e:desktop
```

That's it. The command wipes auth cache, starts the dev server if not running, and runs the full suite. Expected output: **74 passed, 0 failed, 0 skipped**.

### Related commands

```bash
npm run test:e2e            # Same as test:e2e:desktop (all projects; currently desktop-only)
npm run test:e2e:ui         # Interactive Playwright inspector
npm test                    # Vitest unit tests (separate from E2E)
```

### Running a single spec

```bash
npx playwright test tests/e2e/api/gpa.spec.ts
npx playwright test tests/e2e/ui/planner.spec.ts
npx playwright test --grep "adding a course"   # by test name
```

---

## Suite architecture

### Three tiers, four projects

```
tests/e2e/
├── auth.setup.ts                # Creates storageState for each role (runs first)
├── global-setup.ts              # Seeds deterministic DB state before tests
├── global-teardown.ts           # Removes orphaned test data after tests
│
├── fixtures/
│   └── test-users.ts            # Email/password constants for seeded users
├── helpers/
│   ├── auth.ts                  # loginViaForm, waitForHydration
│   └── api-client.ts            # Typed API wrappers (plans, courses, GPA, shares, ...)
│
├── api/                         # Tier 1: pure-API tests (fast, business logic)
│   ├── auth.spec.ts
│   ├── gpa.spec.ts
│   ├── member-permissions.spec.ts
│   ├── plan-limits.spec.ts
│   ├── plans.spec.ts            # Plan + course mutations + sharing + grade lock
│   ├── requirements.spec.ts
│   └── year-end.spec.ts
│
├── ui/                          # Tier 2: per-page UI smoke (with storageState)
│   ├── auth.spec.ts
│   ├── course-browser.spec.ts
│   ├── dashboard.spec.ts
│   ├── planner.spec.ts
│   ├── progress.spec.ts
│   ├── public-pages.spec.ts
│   ├── settings.spec.ts
│   ├── transcript.spec.ts
│   └── user-menu.spec.ts
│
└── journeys/                    # Tier 3: multi-page role-based flows
    ├── consent-gate.spec.ts
    ├── counselor-view-only.spec.ts
    ├── onboarding.spec.ts
    ├── parent-shared-plan.spec.ts
    └── student-course-planning.spec.ts
```

### Playwright projects

| Project | Source | Auth | Purpose |
|---|---|---|---|
| `setup` | `auth.setup.ts` | fresh login | Creates `.auth/student.json`, `parent.json`, `counselor.json` |
| `api` | `tests/e2e/api/` | student storageState | Pure API request-context tests |
| `ui-student` | `tests/e2e/ui/` | student storageState | UI pages under student auth |
| `journeys` | `tests/e2e/journeys/` | mixed (per-file) | Role-specific flows |

The `setup` project runs first; `api`, `ui-student`, and `journeys` depend on it. Non-student journeys use per-test `test.use({ storageState })` to switch roles.

---

## Design rationale

### Why fixture-driven, not UI-driven setup

The old suite had 500+ tests with pervasive `if (noPlan) test.skip()` conditionals — which meant 30-50% of tests silently skipped based on seeded data state. The new suite uses API fixtures (`createPlan`, `addCourseToPlan`, etc.) in `beforeAll` to establish deterministic state, then asserts on UI or data. No conditional skips.

### Why single-worker serialization

The shared `student@test.com` account is subject to a 3-plan launch-tier cap. Multiple parallel workers creating scratch plans trip the cap. `workers: 1` + `fullyParallel: false` trades raw speed for determinism (still hits ~4 min since most tests are API-tier and sub-second).

### Why per-role storageState instead of per-test login

Every test previously spent ~3-5s logging in through the UI. Now `auth.setup.ts` runs three logins ONCE and saves cookies; tests inherit the authenticated state via storageState. Eliminated ~4 min of login overhead across the suite.

### Why `forceDeletePlan` exists

The `DELETE /api/v1/plans/:id` endpoint rejects plans that contain completed courses (transcript-integrity guard). Test scratch plans often have completed courses (GPA/waiver tests). `forceDeletePlan` flips completed→planned first, removes courses, then deletes the plan shell.

---

## Seeded test data

`global-setup.ts` establishes a deterministic baseline before every run.

### Test users (all password `Test1234!`)

| Email | Role | Grade | Notes |
|---|---|---|---|
| `student@test.com` | student | Gr10 | Primary user; owns a seeded primary plan with 15 completed Gr9 courses |
| `student-b@test.com` | student | Gr9 | Parent's second child (multi-child switcher) |
| `parent@test.com` | parent | — | Linked to both student accounts; has edit share on primary plan |
| `counselor@test.com` | counselor | — | Linked to student's account; view share on primary plan |
| `consent-test@test.com` | student | — | No consent records (reset each run) — drives consent form tests |
| `student-onboarding@test.com` | student | — | No `onboarding_completed_at` — lets `/onboarding` render |
| `student-password@test.com` | student | — | Reserved for password-mutation tests |

### Primary plan baseline

- Named "E2E Test Plan", `is_primary = true`, `locked_grade_levels = [9]`
- 15 completed Gr9 courses with grades (A, A-, B+, B — 4 per semester × 4 semesters minus dropouts)
- Gr10 courses: 14 enrolled (2 deliberately ungraded to exercise year-end wizard)
- Parent share: `edit` permission; counselor share: `view` permission
- One `gpa_snapshots` row (cumulative 3.500 / weighted 3.750)

### Legal documents (optional)

The `consent-gate` journey test exercises the consent form UI. If `legal_documents` table is empty, the test takes a softer path (just verifies the page isn't 404'd). To exercise the full flow:

```bash
cd saps
npx tsx scripts/seed-legal-documents.ts
```

This is a one-time setup per local env.

---

## Cleanup

### Automatic, per-run

- `rm -rf tests/e2e/.auth` at the start of every `test:e2e*` command — forces auth.setup.ts to re-authenticate fresh each run
- `global-teardown.ts` after every run:
  - Deletes **all** non-primary plans owned by test users (nuclear cleanup for leftover scratch plans)
  - Belt-and-suspenders: any plan named `E2E %` or `Demo` with `is_primary = false`
  - Resets primary plan's `locked_grade_levels` to `[9]` baseline
  - Removes unclaimed invite codes from test users
  - Deletes ephemeral accounts (`student2@test.com`, `student3@test.com`) and all their data
  - Removes memberless orphan accounts

### Manual (rare — only when teardown fails)

```bash
cd saps
npx tsx scripts/cleanup-test-users.ts    # nuclear: wipes ephemeral accounts
```

---

## V1 coverage

Mapped to v1 launch scope.

| Feature | Tested |
|---|---|
| Authentication (login, route protection, signup gating) | ✅ `ui/auth`, `api/auth` |
| Consent gate + acceptance | ✅ `journeys/consent-gate` (needs legal docs) |
| Onboarding page reachability | ✅ `journeys/onboarding` |
| Dashboard: GPA, Academic Progress, Attention Required, Quick Actions | ✅ `ui/dashboard` |
| Course browser: search, detail modal | ✅ `ui/course-browser` |
| Planner: grid, selector, validation panel | ✅ `ui/planner` |
| Plan CRUD (create, list, delete, primary invariant) | ✅ `api/plans` |
| Plan-course CRUD (add, update, remove, duplicate rejection) | ✅ `api/plans` |
| 3-plan launch-tier cap enforced | ✅ `api/plan-limits` |
| Plan sharing (edit, view, revoke) | ✅ `api/plans` Plan sharing |
| Grade lock safety (locked grade can't be edited) | ✅ `api/plans` Grade locking |
| GPA math (cumulative/projected/weighted sanity) | ✅ `api/gpa` |
| GPA waiver toggle persists | ✅ `api/plans` Course mutations |
| Prerequisite validation wiring | ✅ `api/plans` |
| Graduation requirements (groups, credit math, opt-in) | ✅ `api/requirements` |
| Year-end state endpoint | ✅ `api/year-end` |
| Member removal permissions (student vs others) | ✅ `api/member-permissions` |
| Transcript: GPA display, grade sections | ✅ `ui/transcript` |
| Progress: sidebar, requirement groups | ✅ `ui/progress` |
| Settings: profile, Shared With, Legal, Delete Account dialog | ✅ `ui/settings` |
| Role-based: counselor view-only | ✅ `journeys/counselor-view-only` |
| Role-based: parent shared access | ✅ `journeys/parent-shared-plan` |
| Public pages: homepage, terms, privacy | ✅ `ui/public-pages` |

### Known gaps (tracked for post-v1)

| Gap | Status | Reason |
|---|---|---|
| COPPA age check on signup | Not tested | Legal/security — add before launch |
| Full-year course credit halving | Not tested | GPA math edge case |
| P/F courses excluded from GPA | Not tested | GPA math edge case |
| Set primary plan flow | Not tested | Core UX |
| Year-end POST transition | Not tested | Irreversible; safety covered via grade-lock tests |
| Print view | Not tested | FREE_LAUNCH_MODE gates it |
| OAuth flow, email confirmation, password reset | Not tested | External-service dependencies |
| Accessibility (axe-core scans, keyboard nav, focus management) | Not in default suite | See below |

---

## Accessibility (a11y)

**Current status:** Not part of the default `test:e2e:desktop` gate.

**History:** The old suite contained `accessibility.spec.ts` with axe-core scans on login, signup, and course browser pages. It was removed during the v1 redesign because:
- Each axe scan took 5–10s, adding ~30–60s to every CI run regardless of what changed
- The scans only caught WCAG 2.0 AA violations at the component level — not keyboard focus traps, screen reader flow, or reduced-motion respect, which are the more impactful a11y concerns for this app
- The scans didn't actually block on violations — they logged to console without failing the test

**Plan for v1:**
- Manual a11y audit before launch against the [v1 scope screens](../../docs/product/) using axe DevTools, keyboard-only nav, and VoiceOver
- Document findings in `docs/security/` (or a new `docs/accessibility/`) and file tickets for P0 issues
- Add a separate `npm run test:a11y` command post-launch that runs axe scans nightly (not per-PR), covering:
  - All public pages (login, signup, homepage, terms, privacy)
  - Key authenticated pages (dashboard, planner grid, course detail modal, settings)
  - Focus traps for modals (delete account, plan share, course picker)
  - Keyboard-only course-add flow

**Why it's separate from the main gate:** axe scans are noisy (false positives on third-party components), slow, and produce findings that need human judgment to prioritize. Running them as a non-blocking nightly job catches regressions without slowing the PR loop.

**Until then:** If you're adding a new page, run axe DevTools manually in the browser and keyboard-test the happy path before merging.

---

## Troubleshooting

### "`test:e2e:desktop` script not found"

You're at the repo root instead of `saps/`. Run: `cd saps && npm run test:e2e:desktop`.

### Tests cascade-fail with `Plan limit reached (3)`

Leftover non-primary plans from an interrupted previous run. The teardown runs automatically at end-of-suite, but if you `Ctrl+C` mid-run, manually reset:

```bash
cd saps
npx tsx -e "
import pg from 'pg';
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
await c.query(\"DELETE FROM plan_courses WHERE plan_id IN (SELECT id FROM four_year_plans WHERE name LIKE 'E2E %' AND is_primary = false)\");
await c.query(\"DELETE FROM four_year_plans WHERE name LIKE 'E2E %' AND is_primary = false\");
await c.end();
"
```

Or just run `npm run test:e2e:desktop` again — global-teardown will clean up before the next suite finishes.

### `consent-gate` test skips

The test takes a soft path when `legal_documents` is empty. To exercise the full flow:

```bash
npx tsx scripts/seed-legal-documents.ts
```

### Cold Next.js dev server makes tests time out

The first few tests hit a cold server and trigger route compilation (5–15s per route). Subsequent runs use the warm cache. If consistently slow, check that the dev server is running before the test:

```bash
npm run dev &
sleep 10
npm run test:e2e:desktop
```

---

## CI

```yaml
- name: Install deps
  run: cd saps && npm ci
- name: Install Playwright browsers
  run: cd saps && npx playwright install --with-deps chromium
- name: Run E2E suite
  run: cd saps && npm run test:e2e:desktop
- name: Upload HTML report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: saps/playwright-report/
```

## Editing the suite

- Adding a new API test → drop a spec in `tests/e2e/api/`; use `helpers/api-client.ts` helpers
- Adding a new UI page test → drop a spec in `tests/e2e/ui/`; storageState auto-applies
- Adding a new role-based flow → `tests/e2e/journeys/`; use `test.use({ storageState: "./.auth/<role>.json" })` at the top
- Adding a new API endpoint helper → extend `helpers/api-client.ts` with a typed wrapper
- Always use `forceDeletePlan` in `afterAll`/`finally` for scratch plans to avoid completed-course delete blocks

## Philosophy

Tests should verify **behavior** (the user gets what they expect when they do X), not **existence** (the DOM has a button with text Y). If a test can pass while the feature is broken, delete it.
