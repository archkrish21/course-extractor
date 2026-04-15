# Security Review — saps/components/

> Generated: 2026-04-09
> Status: Issues documented, fixes deferred until e2e tests complete

---

## Overall Assessment: Good

React best practices followed — no `dangerouslySetInnerHTML`, `eval()`, or `innerHTML`. All user data rendered via JSX auto-escaping. Main concerns are around unvalidated redirects, race conditions on double-clicks, and silent error swallowing.

---

## Issues Found

### 1. [HIGH] Unvalidated URL redirect in upgrade flow

**File:** `components/upgrade-modal.tsx` line 59

```typescript
const url = json.data?.url ?? json.url;
if (url) window.location.href = url;
```

The URL from the Stripe checkout API response is assigned directly to `window.location.href` without validating the hostname. If the API response is tampered with (MITM, compromised backend), users could be redirected to a phishing site.

**Fix:**
```typescript
if (url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("stripe.com")) {
      window.location.href = url;
    }
  } catch { /* invalid URL, ignore */ }
}
```

---

### 2. [HIGH] Double-submit race condition on course add (full-year courses)

**File:** `components/course-detail.tsx` lines 410-429

Two consecutive POST requests are fired for full-year courses (one per semester). If the user clicks "Add" again before both complete, courses can be added 3+ times.

```typescript
const res1 = await fetch(`/api/v1/plans/${selectedPlanId}/courses`, { method: "POST", ... });
const res2 = await fetch(`/api/v1/plans/${selectedPlanId}/courses`, { method: "POST", ... });
```

**Fix options:**
- Use a single bulk endpoint: `POST /api/v1/plans/{id}/courses/bulk`
- Add idempotency keys to prevent duplicate server-side processing
- Disable the button until BOTH responses complete (currently only checks one)

---

### 3. [HIGH] Race condition on rapid add-button clicks in course picker

**File:** `components/planner/course-picker.tsx` lines 287-307

The `addingCourseId` state disables the button, but React state updates are async — a fast double-click can fire two requests before the first `setAddingCourseId` takes effect.

**Fix:** Add an early return guard:
```typescript
const handleAdd = useCallback(async (courseId, ...) => {
  if (addingCourseId) return; // Prevent re-entry
  setAddingCourseId(courseId);
  // ...
}, [addingCourseId, ...]);
```

---

### 4. [MEDIUM] Client-side `readOnly` prop is not a security boundary

**Files:**
- `components/planner/plan-course-card.tsx` lines 44, 150, 157-158, 261
- `components/planner/planner-grid.tsx` (multiple lines)

The `readOnly` prop hides remove buttons, status dropdowns, grade inputs, and GPA waiver toggles. A user can bypass this via browser dev tools or by calling API endpoints directly.

**Status:** Backend validates via `getPlanAccess()` — this is defense-in-depth only, **not a vulnerability** as long as server-side checks remain in place. Noted for awareness.

---

### 5. [MEDIUM] Server error messages displayed directly to users

**File:** `components/course-detail.tsx` lines 438, 462

```typescript
message: data?.error?.message ?? data?.violations?.[0]?.message ?? "Failed to add course",
warnings: data?.violations,
```

If the backend returns verbose internal errors (e.g., database details, stack traces), they are rendered to users. This could aid attacker reconnaissance.

**Fix:** Backend should return only user-friendly messages. Frontend should have a fallback:
```typescript
message: isUserFriendly(data?.error?.message) ? data.error.message : "Something went wrong.",
```

---

### 6. [MEDIUM] Silent error handling across multiple components

**Files:**
- `components/upgrade-modal.tsx` line 61
- `components/trial-banner.tsx` line 48
- `components/plans/share-modal.tsx` lines 63, 114
- `components/feedback-widget.tsx` line 28
- `components/course-detail-modal.tsx` lines 50-51

Pattern: `} catch { /* silent */ }` or `.catch(() => {})`

Errors are swallowed with no user feedback. Auth failures (401/403), network errors, and server errors are all invisible to the user.

**Fix:** At minimum, log errors in development and show a generic toast on failure.

---

### 7. [MEDIUM] Unvalidated API response shapes (type safety)

**Files:**
- `components/course-detail.tsx` lines 375-381
- `components/plans/share-modal.tsx` lines 56-61

```typescript
const planList: PlanOption[] = (data.plans ?? data.data ?? []).map(
  (p: any) => ({ id: p.id, name: p.name, isPrimary: p.isPrimary })
);
```

API responses are cast via `as any` without runtime validation. If the response shape changes or is tampered with, the component may crash or render incorrect data.

**Fix:** Add Zod runtime validation for API responses, or at least null-check fields.

---

### 8. [MEDIUM] IDs from props used directly in URL paths without format validation

**Files:**
- `components/course-detail-modal.tsx` line 44
- `components/plans/share-modal.tsx` lines 52-53

```typescript
const res = await apiFetch(`/api/v1/courses/${id}`);
```

If `id` contains path traversal characters (e.g., `../../admin`), it could hit unintended endpoints. Backend routing should prevent this, but client-side validation adds defense-in-depth.

**Fix:** Validate IDs are UUIDs before using in URL:
```typescript
if (!/^[0-9a-f-]{36}$/.test(id)) return;
```

---

### 9. [MEDIUM] No explicit CSRF token in API calls

**File:** `lib/api-client.ts`

The `apiFetch` wrapper uses `credentials: "same-origin"` (good), but no CSRF token is included in headers. Relies on backend CORS + SameSite cookie policy for CSRF protection.

**Status:** Acceptable if backend enforces SameSite cookies and Origin/Referer header checks. Verify this is the case.

---

### 10. [LOW] Account ID stored in localStorage

**File:** `lib/api-client.ts` lines 12-14

```typescript
localStorage.getItem("saps_current_account_id")
```

Account ID (a UUID, not a secret) is stored in localStorage and sent as `X-Account-Id` header. If XSS occurs, attacker gains the account context. Low severity because:
- Account ID alone doesn't grant access (auth cookie still required)
- Backend validates membership via `getAccountContext()`

**Recommendation:** Consider httpOnly cookie for account context if feasible.

---

### 11. [LOW] `any` type casts bypass TypeScript safety

**Files:**
- `components/course-detail-modal.tsx` line 82: `const c = course as any;`
- `components/course-detail.tsx` line 378: `(p: any) =>`

Not a runtime security issue, but reduces compiler-assisted safety.

---

## Verified Non-Issues

- No `dangerouslySetInnerHTML` anywhere in components
- No `eval()`, `Function()`, or `document.write()`
- No external script loading from untrusted sources
- No iframes or embedded third-party content
- All event handlers are static functions, not dynamically generated
- `URLSearchParams` properly escapes query values in course-picker
- React auto-escapes all JSX-rendered user data (plan names, course names, emails)
- Proper `useEffect` cleanup with cancellation flags in course-detail-modal
- Keyboard/accessibility handlers are well-implemented

---

## Positive Patterns

- Centralized `apiFetch` wrapper with auth and account context injection
- Consistent use of `credentials: "same-origin"` — cookies not sent cross-origin
- `aria-*` attributes and `role` props for accessibility
- `maxLength` enforcement on textarea inputs (feedback-widget)
- Cancel flags in async effects prevent stale state updates

---

## Fix Priority

| # | Issue | Severity | Effort | When |
|---|-------|----------|--------|------|
| 1 | Validate redirect URL in upgrade-modal | HIGH | 5 min | After e2e tests |
| 2 | Prevent double-submit on full-year course add | HIGH | 15 min | After e2e tests |
| 3 | Prevent rapid double-click in course picker | HIGH | 5 min | After e2e tests |
| 5 | Sanitize error messages shown to users | MEDIUM | 10 min | After e2e tests |
| 6 | Replace silent catches with error feedback | MEDIUM | 20 min | After e2e tests |
| 7 | Add runtime validation for API responses | MEDIUM | 30 min | Long-term |
| 8 | Validate IDs before using in URLs | MEDIUM | 10 min | After e2e tests |
| 9 | Verify CSRF protection on backend | MEDIUM | 10 min | Before production |
| 4 | Document readOnly is UI-only | MEDIUM | N/A | Awareness |
| 10 | Consider httpOnly cookie for account ID | LOW | Variable | Long-term |
| 11 | Replace `any` type casts | LOW | 10 min | Anytime |
