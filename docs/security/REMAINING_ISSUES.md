# SAPS — Remaining Issues

**Date:** 2026-04-09
**Context:** Full codebase audit completed. 61 of 82 issues were fixed. The 21 items below remain and can be addressed in future sprints.

---

## Design Decisions Required

### 1. Inconsistent plan authorization model
- **Files:** `app/api/v1/plans/[id]/route.ts`, `app/api/v1/plans/[id]/courses/route.ts`
- GET/PATCH use account-level membership (`getAccountContext`) while DELETE uses per-plan shares (`getPlanAccess`). Plan-level "view" permissions are meaningless since any account member can already read everything via GET.
- **Action:** Decide whether authorization is account-level or plan-level, then apply consistently across all plan endpoints.

### 2. `skip_validation` flag accepted from client
- **File:** `app/api/v1/plans/[id]/courses/route.ts` (~line 29)
- Any caller can bypass prerequisite validation by sending `skip_validation: true`. Currently used for undo operations.
- **Action:** Gate behind a server-side check (e.g., only allow when the request comes from an undo operation, or remove entirely).

### 3. `confirm()` browser dialog for member removal
- **File:** `app/(app)/settings/page.tsx` (~line 119)
- Uses native `confirm()` while the rest of the app uses custom modals.
- **Action:** Replace with a custom confirmation modal matching the app's pattern.

---

## Large Refactors

### 4. Planner page god component (2216 lines)
- **File:** `app/(app)/planner/page.tsx`
- ~30 `useState` calls, 15+ handlers, undo logic, validation panel, modals, and full JSX in one component.
- **Action:** Extract into `usePlannerState` hook, `ValidationSidePanel`, `NewPlanModal`, `PlannerToolbar`, `ConfirmationDialogs`.

### 5. DesktopGrid component too large (~600 lines)
- **File:** `components/planner/planner-grid.tsx`
- Grade row, semester cell, summer section, and grade header should be separate sub-components.

### 6. MobileAccordion duplicates DesktopGrid logic
- **File:** `components/planner/planner-grid.tsx` (~lines 708-917)
- Near-identical rendering logic with different layout. Also missing summer course support entirely.
- **Action:** Unify shared logic; add summer support to mobile view.

### 7. Prerequisite validator code duplication (~250 lines)
- **File:** `lib/prereq/validator.ts`
- `validateCourseAddition` and `validatePlanIntegrity` duplicate prerequisite/corequisite/grade-level/duplicate checking logic.
- **Action:** Extract shared validation into helper functions.

### 8. StepIndicator component duplication
- **Files:** `app/(onboarding)/onboarding/page.tsx`, `app/(app)/year-end/page.tsx`
- Nearly identical `StepIndicator` components in both files.
- **Action:** Extract to `components/ui/step-indicator.tsx`.

### 9. Course-flattening logic duplication
- **Files:** planner, transcript, print, dashboard pages
- The pattern of iterating `grouped[gradeKey][semKey]` and mapping API response to `PlanCourse` repeated in 4 files.
- **Action:** Extract to a shared `flattenCourses()` utility.

### 10. Filter chip markup duplication in course picker
- **File:** `components/planner/course-picker.tsx` (~lines 382-477)
- All 8 filter chips share ~120 lines of near-identical JSX.
- **Action:** Extract a `FilterChip` component.

---

## Performance

### 11. Sequential API calls in planner loops
- **File:** `app/(app)/planner/page.tsx` (~lines 620-632, 670-717)
- `executeClear` and `handleResetToTemplate` await each DELETE/POST sequentially for 30+ courses.
- **Action:** Use `Promise.all` with batched requests or add a bulk API endpoint.

### 12. N+1 DB inserts in API routes
- **Files:** `app/api/v1/transcript/route.ts` POST (up to 100 upserts), `app/api/v1/auth/signup/route.ts`, `app/api/v1/auth/consent/route.ts`
- Consent records and transcript grades inserted in loops.
- **Action:** Batch insert with multi-row VALUES or Drizzle batch API.

### 13. N+1 prerequisite queries
- **File:** `lib/prereq/validator.ts` (~lines 155-174)
- Single-course validation makes 3 sequential DB queries that could be combined.

### 14. Sequential DB queries in auth context
- **File:** `lib/auth/get-user.ts` (~lines 99-133)
- 3 sequential queries (role, account, membership) for students without explicit accountId. Could be one JOIN query.

---

## Minor / Cosmetic

### 15. Derived state stored as state (`plans`) in course detail
- **File:** `components/course-detail.tsx` (~line 351)
- `plans` initialized from `externalPlans` but also independently fetched. If `externalPlans` changes after mount, local state won't update.

### 16. Unnecessary effect dependencies in course detail
- **File:** `components/course-detail.tsx` (~lines 362-367)
- Effect lists `course.gradeLevels` and `course.semestersOffered` as deps (array references). Only `course.id` is needed.

### 17. Touch target collision on mobile
- **File:** `components/planner/plan-course-card.tsx` (~line 492)
- Remove button's negative margin overlaps parent card's click handler on mobile.

### 18. Hardcoded subscription prices
- **Files:** `config/subscription-plans.ts`, `components/upgrade-modal.tsx`
- Prices hardcoded in config and UI. No single source of truth with DB.

### 19. Summer equivalents not validated against catalog
- **File:** `config/summer-equivalents.ts`
- Hardcoded equivalence map must be manually synced with `summer_courses_2026.py`.

### 20. Silently swallowed errors in billing/year-end
- **Files:** `app/(app)/settings/billing/page.tsx` (3 empty catches), `app/(app)/year-end/page.tsx` (2 empty catches)
- User gets no feedback when API calls fail.

### 21. Escape handler doesn't check for nested modals
- **File:** `components/course-detail-modal.tsx` (~lines 62-69)
- Pressing Escape when stacked over `CoursePicker` closes both modals.
