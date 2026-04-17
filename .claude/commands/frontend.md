# Frontend Development Guide

Use this guide when building or modifying frontend code in the SAPS Next.js application (`saps/`).

## Architecture

- **All pages use `"use client"`** — this is a client-first app, no server-side rendering of pages
- **Data fetching**: `useEffect` + `useState` pattern (no SWR or React Query)
- **State**: React Context for account/user data, local useState for everything else. Zustand is installed but not actively used
- **Styling**: Tailwind CSS v4 with design tokens as CSS variables in `globals.css`. No class-variance-authority (cva) — variants use manual `Record<Type, string>` objects
- **Path alias**: `@/*` maps to `saps/` root (e.g., `@/components/ui/button`, `@/lib/api-client`)

## API Client

All client-side API calls must use `apiFetch()` from `@/lib/api-client`:

```tsx
import { apiFetch } from "@/lib/api-client";

const res = await apiFetch("/api/v1/plans", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, template_id }),
});
```

- Automatically injects `X-Account-Id` header from `localStorage("saps_current_account_id")`
- Uses `credentials: "same-origin"` for cookie-based Supabase auth
- Returns raw `Response` — handle errors in calling code
- Never use raw `fetch()` for authenticated API calls

## UI Components (`@/components/ui/`)

Use the existing component library. Do not create new base UI components without checking these first.

### Button
```tsx
import { Button } from "@/components/ui/button";
<Button variant="default" size="default">Label</Button>
```
- **Variants**: `"default"` | `"outline"` | `"ghost"` | `"destructive"`
- **Sizes**: `"sm"` | `"default"` | `"lg"`
- All sizes enforce `min-h-[44px]` for touch accessibility

### Badge
```tsx
import { Badge } from "@/components/ui/badge";
<Badge variant="ap">AP</Badge>
```
- **Variants**: `"default"` | `"ap"` | `"honors"` | `"dual-credit"` | `"accelerated"` | `"success"` | `"warning"` | `"destructive"`
- Use `creditTypeBadgeVariant()` from `@/lib/badge-utils` to map credit type strings to variants

### Card
```tsx
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
```
- Compositional pattern — no variants. Style via className.

### Input
```tsx
import { Input } from "@/components/ui/input";
<Input label="Email" type="email" error={errors.email} helperText="We'll never share your email" />
```
- `label` is required. Use `hideLabel` for visually hidden labels.
- Password type automatically gets a show/hide toggle button.
- Error state adds `border-destructive` and aria attributes.

### Checkbox
```tsx
import { Checkbox } from "@/components/ui/checkbox";
<Checkbox label={<span>I agree to the <a href="/terms">Terms</a></span>} error={errors.consent} />
```

### Toast
```tsx
import { useToast } from "@/components/ui/toast";
const { showToast } = useToast();
showToast("Plan created");
showToast("Course removed", () => undoRemove(), 5000); // with undo action
```
- Auto-dismisses after 5 seconds (configurable)
- Optional undo callback shows an "Undo" button

### Spinner
```tsx
import { Spinner } from "@/components/ui/spinner";
<Spinner /> // or <Spinner variant="svg" />
```

## Design Tokens

Colors are defined as CSS variables in `globals.css` and used via Tailwind classes:

| Token | Tailwind Class | Hex |
|-------|---------------|-----|
| Primary | `bg-primary`, `text-primary` | #2563eb |
| Destructive | `bg-destructive` | #dc2626 |
| Success | `bg-success` | #16a34a |
| Warning | `bg-warning` | #d97706 |
| AP | `bg-ap`, `text-ap` | #7c3aed (purple) |
| Honors | `bg-honors` | #0891b2 (cyan) |
| Dual Credit | `bg-dual-credit` | #0d9488 (teal) |
| Accelerated | `bg-accelerated` | #ea580c (orange) |
| Background | `bg-background` | #ffffff |
| Foreground | `text-foreground` | #111827 |
| Muted | `bg-muted`, `text-muted-foreground` | #f3f4f6 / #6b7280 |
| Card | `bg-card` | #ffffff |
| Border | `border-border` | #e5e7eb |

Light variants exist for badges: `bg-ap-light`, `bg-success-light`, `bg-warning-light`, etc.

Font: `Inter` (via `--font-sans`).

## Page Structure Pattern

Every app page follows this pattern:

```tsx
"use client";

import { useAccount } from "@/lib/account-context";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function MyPage() {
  const { currentAccount, userRole } = useAccount();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentAccount) return;
    apiFetch("/api/v1/my-endpoint")
      .then(r => r.ok ? r.json() : null)
      .then(json => setData(json?.data ?? json))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentAccount]);

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Page Title</h1>
      {/* content */}
    </div>
  );
}
```

## Account Context

```tsx
import { useAccount } from "@/lib/account-context";

const {
  currentAccount,    // Current account object (student's academic data)
  accounts,          // All accounts user is member of
  switchAccount,     // Switch to different account (triggers page reload)
  userEmail,         // Logged-in user's email
  userRole,          // "student" | "parent" | "counselor"
  userFirstName,
  userLastName,
  refetchAccounts,   // Re-fetch after membership changes
  refetchUser,       // Re-fetch after profile changes
} = useAccount();
```

## Responsive Design

Use Tailwind breakpoints — mobile-first:
- Default: mobile (<640px)
- `sm:` — 640px+
- `md:` — 768px+ (tablet)
- `lg:` — 1024px+ (desktop)

Common patterns:
```tsx
{/* Desktop grid, mobile stack */}
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

{/* Desktop only */}
<div className="hidden md:block">

{/* Mobile only */}
<div className="md:hidden">

{/* Mobile hamburger menu */}
<button className="flex md:hidden">
```

Touch targets: All interactive elements must have `min-h-[44px]`.

## Subscription Gating

```tsx
import { useUpgradeModal } from "@/components/upgrade-modal";

const { checkResponse, UpgradeModalComponent } = useUpgradeModal();

const res = await apiFetch("/api/v1/some-gated-endpoint");
if (checkResponse(res, "Feature Name")) return; // Shows upgrade modal on 402

// For print buttons:
import { canPrint } from "@/components/upgrade-modal"; // or inline check
const printAllowed = tier === "plus" || tier === "elite";
```

Disabled buttons for gated features use a wrapping `<span>` with `title="Upgrade to Plus to..."` for accessibility.

## Form Patterns

- Client-side validation with error object per field
- Single `loading` boolean per form operation
- Success state replaces form with confirmation UI
- Disable submit button while loading or validation fails

```tsx
const [errors, setErrors] = useState<Record<string, string>>({});
const [loading, setLoading] = useState(false);

function validate() {
  const errs: Record<string, string> = {};
  if (!name.trim()) errs.name = "Name is required";
  setErrors(errs);
  return Object.keys(errs).length === 0;
}

async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  if (!validate()) return;
  setLoading(true);
  try {
    const res = await apiFetch(...);
    if (res.ok) showToast("Saved!");
    else setErrors({ form: "Failed to save" });
  } catch { setErrors({ form: "Something went wrong" }); }
  finally { setLoading(false); }
}
```

## Custom Hooks

### useTour
```tsx
import { useTour } from "@/lib/hooks/use-tour";
const { startTour } = useTour({ tourId: "welcome_completed", steps, autoStart: true });
```
Tour IDs: `welcome_completed`, `planner_completed`, `progress_completed`. State persisted server-side via `PATCH /api/v1/auth/me`.

### useUndoStack
```tsx
import { useUndoStack } from "@/lib/hooks/use-undo-stack";
const { push, pop, canUndo } = useUndoStack();
push({ label: "Added Biology", action: { type: "add_course", planCourseIds: [id] } });
```
Max 20 entries. Action types: `add_course`, `remove_course`, `clear_semester`, `clear_grade`, `change_status`, `change_grade`.

## Key Feature Components

| Component | Import | Purpose |
|-----------|--------|---------|
| `FeedbackWidget` | `@/components/feedback-widget` | Floating feedback button (bottom-right) on all app pages |
| `TrialBanner` | `@/components/trial-banner` | Trial countdown banner (shows when <=4 days left) |
| `UpgradeModal` | `@/components/upgrade-modal` | Tier upgrade prompt (triggered by 402 responses) |
| `TourButton` | `@/components/tour-button` | Global tour button in nav bar |
| `CourseDetailModal` | `@/components/course-detail-modal` | Course info modal (used in browser + planner) |
| `ShareModal` | `@/components/plans/share-modal` | Plan sharing permissions modal |
| `BackButton` | `@/components/back-button` | Smart back (closes tab or router.back()) |
| `PlannerGrid` | `@/components/planner/planner-grid` | 4-year planner with desktop grid / mobile accordion |
| `CoursePicker` | `@/components/planner/course-picker` | Slide-over course search for adding to plan |
| `PlanCourseCard` | `@/components/planner/plan-course-card` | Course card in planner with status/grade dropdowns |

## Storage Patterns

- **localStorage**: `saps_current_account_id` (account switching)
- **sessionStorage**: `trial-banner-dismissed`, `planner:selectedPlanId`
- **URL params**: `?validation=open` (auto-open validation panel), `?newPlan=true` (open new plan modal), `?welcome=1` (show welcome banner)

## Accessibility Requirements

- ARIA: `role="grid"`, `role="row"`, `role="gridcell"` on planner grid. `aria-live="assertive"` for validation errors. `aria-describedby` for form inputs.
- Focus: Visible focus rings (`focus-visible:outline-2 focus-visible:outline-ring`). Modal focus trapping. Focus restored on modal close.
- Keyboard: Arrow keys in planner grid. Enter/Space to activate. Escape to close modals.
- Color: Never use color alone — always pair with icons and/or text labels.
- Touch: `min-h-[44px]` on all interactive elements.

## Analytics

```tsx
import { trackPlanCreated, trackCourseAddedToPlan } from "@/lib/analytics/posthog";
trackPlanCreated({ from_template: true, template_id: "uuid" });
```

Never track grade values, GPA numbers, or course names — only behavioral events.
