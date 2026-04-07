# SAPS UI Orchestration Plan

## I Am the Lead UI/UX Architect Agent

I own the visual quality, consistency, and user experience of every pixel in SAPS. My job is to deliver a frontend that looks and feels like a product built by a professional team — not a student project. I will create and direct **UI Expert Engineering Agents** to execute page-level work, but I make all design decisions, review all output, and personally verify that nothing breaks.

**My guarantees:**
1. Every page will follow a single, coherent design system
2. Every interaction will feel responsive and intentional
3. Every state (loading, empty, error, success) will be handled gracefully
4. Every page will work beautifully on mobile (390px) and desktop (1280px)
5. The full test suite will pass before and after every change — no exceptions
6. No functionality will be altered, only visual presentation

---

## What I'm Working With

### Tech Stack
- **Framework:** Next.js App Router, TypeScript, React
- **Styling:** Tailwind CSS, CSS variables via `@theme` in `globals.css`
- **Theme:** Light-only — **no `dark:` variants anywhere**
- **Font:** Inter (single family, loaded via `--font-sans`)
- **Testing:** Vitest (unit/component/API) + Playwright (E2E), run from `saps/` directory
- **Tours:** driver.js with `data-tour` attributes and CSS overrides in `globals.css`

### Page Discovery (Dynamic)

Before starting work, I run a full discovery to build my page inventory:

```bash
# Discover all pages
find saps/app -name "page.tsx" | sort

# Discover all shared components
ls saps/components/ui/
ls saps/components/

# Discover all test files
find saps/tests -name "*.test.ts" -o -name "*.test.tsx" | sort

# Count current test baseline
cd saps && npx vitest run 2>&1 | tail -5
```

I categorize every discovered page into groups:
- **Public** — pages under `app/(public)/`
- **Auth** — pages under `app/(auth)/`
- **App** — pages under `app/(app)/`
- **Legal** — pages under `app/terms/`, `app/privacy/`
- **Root** — `app/page.tsx`
- **Print** — any page under a `print/` subdirectory

Any page not listed in the design system references below is a **new page** and must still conform to all standards.

### Design System (Canonical Reference)

**Base UI Components** (`components/ui/`):
- `Card` — `rounded-xl border border-border bg-card shadow-sm`, content `p-5`
- `Button` — 4 variants (default/outline/ghost/destructive), 3 sizes, `rounded-lg`, `min-h-[44px]`
- `Badge` — 8 color variants (default/ap/honors/dual-credit/accelerated/success/warning/destructive), `rounded-full`
- `Input` — Label + error + helper text + password toggle, `rounded-lg`, `min-h-[44px]`
- `Checkbox` — Focus ring, label association, error state
- `Toast` — Context-based notification system, `aria-live="polite"`, auto-dismiss

**Feature Components** (`components/`):
Discover all feature components dynamically:
```bash
ls saps/components/*.tsx saps/components/*/*.tsx 2>/dev/null
```
Common ones include: `TrialBanner`, `FeedbackWidget`, `TourButton`, `UpgradeModal`, `CourseDetailModal`, `ShareModal`, `PlannerGrid`, `CoursePicker`, `PlanCourseCard`. New components may exist — audit them all.

**Color Tokens** (from `globals.css @theme`):

| Token | Semantic |
|---|---|
| `primary` | Interactive, CTA, links |
| `primary-hover` | Hover on primary |
| `primary-light` | Selected state backgrounds |
| `success` | Complete, met, positive |
| `success-light` | Success backgrounds |
| `warning` | Trial, caution, attention |
| `warning-light` | Warning backgrounds |
| `destructive` | Error, delete, gap |
| `destructive-light` | Error backgrounds |
| `foreground` | Primary text |
| `muted-foreground` | Secondary text |
| `muted` | Subtle backgrounds |
| `border` | Borders, dividers |
| `ap` | AP course badges |
| `honors` | Honors course badges |
| `dual-credit` | Dual credit badges |
| `accelerated` | Accelerated badges |

**Tier Badge Colors** (documented convention — not in @theme):
- Elite: `bg-purple-500/10 text-purple-600`
- Plus: `bg-primary/10 text-primary`
- Trial: `bg-warning/10 text-warning`
- Starter: `bg-success/10 text-success`

If new tokens have been added to `globals.css` since this document was last updated, use them. Always verify the current token list:
```bash
grep "^  --color-" saps/app/globals.css
```

---

## My Design Decisions (Non-Negotiable)

These are the rules I enforce across the entire app. Sub-agents do not deviate.

### Typography Scale

| Role | Classes | When |
|---|---|---|
| Page title | `text-2xl font-bold text-foreground` | Exactly one per page, top-left |
| Page subtitle | `text-sm text-muted-foreground mt-1` | Immediately below page title |
| Section label | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` | Above card groups |
| Card title | `text-base font-semibold text-foreground` | Inside `CardHeader` |
| Body | `text-sm text-foreground` | Default readable text |
| Secondary | `text-sm text-muted-foreground` | Descriptions, captions |
| Caption | `text-xs text-muted-foreground` | Timestamps, counts, metadata |

### Spacing Rules

| Context | Value | Rationale |
|---|---|---|
| Inside cards | `p-5` (20px) | Content padding — set by Card component |
| Between cards | `gap-4` or `gap-6` | Visual grouping — use `gap-4` within a group, `gap-6` between groups |
| Between sections | `mb-8` (32px) | Clear section separation |
| Page top | `pt-0` | App layout `main` already has `p-4 sm:p-6 lg:p-8` |
| Form field gaps | `gap-4` (16px) | Between label-input pairs |
| Inline element gaps | `gap-2` (8px) | Between icon and text, badge and text |

### Page Shell (Every Authenticated Page)

```tsx
{/* Page header — every page starts with this */}
<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
  </div>
  <div className="flex items-center gap-2">
    {/* Page-level actions: print, filter toggle, etc. */}
  </div>
</div>
```

Every authenticated page must use this exact header structure. No exceptions.

### Component Standards

| Component | Radius | Shadow | Border | Min Height |
|---|---|---|---|---|
| Card | `rounded-xl` | `shadow-sm` | `border-border` | — |
| Button | `rounded-lg` | none | varies | `min-h-[44px]` on default/lg |
| Badge | `rounded-full` | none | none | — |
| Input | `rounded-lg` | none | `border-border` | `min-h-[44px]` |
| Modal overlay | `rounded-2xl` | `shadow-xl` | `border-border` | — |
| Dropdown menu | `rounded-lg` | `shadow-lg` | `border-border` | — |
| Public section card | `rounded-2xl` | `shadow-sm` | `border-border` | — |

### State Handling (Mandatory on Every Data Page)

**Loading state:**
```tsx
{/* Skeleton that matches the real layout — NOT a centered spinner */}
<div className="space-y-6">
  <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
    ))}
  </div>
</div>
```

**Empty state:**
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
    {/* Relevant icon */}
  </div>
  <h3 className="mt-4 text-base font-semibold text-foreground">{headline}</h3>
  <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
  <Button className="mt-6">{ctaLabel}</Button>
</div>
```

**Error state:**
```tsx
<div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive-light p-4">
  <svg className="h-5 w-5 shrink-0 text-destructive" ...>...</svg>
  <div>
    <p className="text-sm font-medium text-destructive">{errorTitle}</p>
    <p className="mt-1 text-sm text-muted-foreground">{errorDetail}</p>
    <Button variant="outline" size="sm" className="mt-3" onClick={retry}>Try again</Button>
  </div>
</div>
```

### Status → Color Mapping (Universal)

| Status | Token | Badge Variant | Used In |
|---|---|---|---|
| Complete / Met / Earned | `success` | `success` | Dashboard, Progress, Transcript |
| In Progress / Planned / Active | `primary` | — (use `primary-light` bg) | Dashboard, Planner, Progress |
| Gap / Missing / Failed | `destructive` | `destructive` | Progress, Validation |
| Not Started / Pending | `muted` | `default` | Progress |
| Warning / Overload / Underload | `warning` | `warning` | Validation, Alerts |
| Trial | `warning` | — | TierBadge, Banner |
| Draft / Archived | `muted` | `default` | Plans |

New statuses added in the future must follow this mapping. If a new semantic status doesn't fit any existing token, flag it for a token to be added.

### Interactive Element States (All 5 Required)

| State | Treatment |
|---|---|
| Default | Base styling |
| Hover | `hover:bg-*` (subtle background change) |
| Focus | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring` |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none` |
| Loading | Button text replaced with "Loading..." or spinner + text |

### Mobile Responsive Patterns

| Layout | Desktop | Mobile (< md) |
|---|---|---|
| Card grid | `grid-cols-2` or `grid-cols-3` | `grid-cols-1` |
| Sidebar + content | Side-by-side | Stacked (sidebar below or collapsible) |
| Action buttons | Inline row | Full-width stacked |
| Tables | Full table | Horizontal scroll or card reformat |
| Page header | Title left, actions right | Title above, actions below |
| Modal | Centered `max-w-lg` | Near-full width with `mx-4` |

---

## Execution Plan

### Phase 0: Baseline & Discovery

Before creating any sub-agents:

1. **Discover all pages:**
   ```bash
   find saps/app -name "page.tsx" | sort
   ```
   Count them. Categorize them into Public, Auth, App, Legal, Root, Print.

2. **Discover all components:**
   ```bash
   ls saps/components/ui/
   ls saps/components/*.tsx saps/components/*/*.tsx 2>/dev/null
   ```

3. **Discover all tests and record baseline:**
   ```bash
   find saps/tests -name "*.test.ts" -o -name "*.test.tsx" | sort
   cd saps && npx vitest run
   ```
   Record exact counts: `N passed | M skipped (T total)`. This is the baseline. Every phase must match or exceed this.

4. **Verify current color tokens:**
   ```bash
   grep "^  --color-" saps/app/globals.css
   ```

5. **Check for hardcoded colors (pre-existing issues):**
   ```bash
   grep -rn "bg-\(green\|red\|blue\|yellow\|purple\|orange\|cyan\|teal\|pink\|indigo\|violet\|emerald\|lime\|amber\|rose\|sky\|fuchsia\)-" saps/app/ --include="*.tsx"
   ```
   Note any that need fixing.

### Phase 1: Design System Foundation

**I do this myself — no sub-agent.** These are shared infrastructure changes that cascade to every page.

#### 1a. Audit Base Components
Read each file in `components/ui/` and verify against the component standards table. Fix any drift:
- Card: confirm `rounded-xl shadow-sm border-border`, `p-5` content
- Button: confirm all variants, `min-h-[44px]`, focus ring, loading state support
- Badge: confirm all variants match token colors
- Input: confirm label/error/helper, password toggle, focus ring, `min-h-[44px]`
- Checkbox: confirm focus ring
- Toast: confirm positioning doesn't overlap FeedbackWidget
- **Any new components in `components/ui/`**: audit against the same standards (radius, shadow, border, focus ring, disabled state)

#### 1b. Verify Color Token Usage
Grep the entire codebase for hardcoded Tailwind color classes outside `globals.css`:
```bash
grep -rn "bg-\(green\|red\|blue\|yellow\|gray\)-\d" saps/app/ --include="*.tsx"
grep -rn "text-\(green\|red\|blue\|yellow\|gray\)-\d" saps/app/ --include="*.tsx"
grep -rn "border-\(green\|red\|blue\|yellow\|gray\)-\d" saps/app/ --include="*.tsx"
```

**Acceptable hardcoded colors:**
- Google OAuth SVG brand colors (#4285F4, #34A853, #FBBC05, #EA4335)
- `#fff` / `#000` in Stripe/driver.js overrides
- Tier badge purple (`bg-purple-500/10 text-purple-600`) — documented convention
- Amber celebration/honors colors (`text-amber-*`, `bg-amber-*`) — semantic decorative use
- Print page table borders (`border-gray-300`) — print-specific

Everything else must use Tailwind token classes (`text-primary`, `bg-muted`, etc.).

#### 1c. Run Tests After Foundation Changes
```bash
cd saps && npx vitest run
```
All tests must pass with the same count as baseline. If foundation changes broke something, fix before proceeding.

---

### Phase 2: Page Sweeps (Parallelized by Priority)

I create **UI Expert Engineering Agents** for page-level work. Each agent receives:
- The exact page file(s) to modify
- This document's design decisions
- The specific review checklist for that page
- A list of `data-tour` and `aria-label` attributes to preserve (discovered by grepping)
- A constraint: **do not change any API calls, data logic, or routing — only JSX structure and Tailwind classes**

#### Priority Order

1. **First Impressions** — Public pages + Auth pages (determines whether a visitor becomes a user)
2. **Core App Experience** — Daily-use app pages (Dashboard, Planner, Progress, Transcript, Courses, Plans)
3. **Settings & Supporting** — Settings, Billing, Year-End, Join
4. **Legal & Print** — Terms, Privacy, Print pages

#### Per-Page Checklist (Apply to EVERY Page)

For each page discovered in Phase 0, the assigned agent must verify:

**Structure:**
- [ ] Page header matches shell template (authenticated pages) or has clear hierarchy (public pages)
- [ ] Uses `Card`/`CardHeader`/`CardContent`/`CardFooter` — no one-off `<div className="rounded-xl border shadow-sm">`
- [ ] Uses `Button` component — no raw `<button>` with inline Tailwind (exception: nav links, tiny icon-only buttons)
- [ ] Uses `Badge` component for status indicators — no one-off `<span className="bg-green-100 text-green-700 rounded-full px-2 text-xs">`
- [ ] Uses `Input` component for form fields — no raw `<input>` with inline styling
- [ ] Uses `Checkbox` component — no raw `<input type="checkbox">`

**States:**
- [ ] Loading state: shaped skeletons with `animate-pulse` on `bg-muted` (not a centered spinner)
- [ ] Empty state: centered icon + headline + description + CTA (if applicable)
- [ ] Error state: inline recovery with `border-destructive/30 bg-destructive-light`

**Accessibility:**
- [ ] All `data-tour` attributes preserved (grep before and after)
- [ ] All `aria-label`, `aria-*`, `role`, `id` attributes preserved
- [ ] Focus ring on every interactive element (`focus-visible:outline-2 outline-offset-2 outline-ring`)
- [ ] All `<img>` have alt text, all icon `<svg>` have `aria-hidden="true"`
- [ ] Form inputs have associated labels
- [ ] Error messages have `role="alert"`

**Responsive:**
- [ ] Card grids: `grid-cols-1` on mobile, `sm:grid-cols-2` or `lg:grid-cols-3` on desktop
- [ ] Action buttons stack on mobile (`flex-col sm:flex-row`)
- [ ] Tables scroll horizontally or reformat to cards on mobile
- [ ] No horizontal overflow at 390px (except intentional: planner grid)

**Colors:**
- [ ] No hardcoded Tailwind color classes (use tokens)
- [ ] Status colors follow the universal mapping table

**Typography:**
- [ ] Section labels use `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- [ ] Page title is `text-2xl font-bold text-foreground`
- [ ] Body text is `text-sm text-foreground`

#### Page-Specific Checklists

In addition to the universal checklist above, apply these page-specific requirements:

**Public Pages (Home, About, Contact):**
- Hero: gradient text readable at all sizes, CTA button pair prominent
- Feature/pricing/testimonial cards: equal height with `flex flex-col` + `flex-1`
- Stats: responsive grid (4-col → 2-col on mobile)
- FAQ: smooth expand/collapse animation, icon rotates on open
- Public section cards use `rounded-2xl`

**Auth Pages (Login, Signup, Onboarding, Consent, Claim):**
- Centered card layout (shared auth layout provides this)
- Google OAuth button: white bg, border, hardcoded brand colors OK
- "or continue with" divider pattern
- Step indicators (onboarding): progress bar + step labels, completed = checkmark
- Code inputs: `text-center text-lg font-mono tracking-[0.3em] uppercase`

**Dashboard:**
- Card grid: 1-col → 2-col → 3-col responsive
- GPA numbers: `text-2xl font-bold`
- Progress bars: `h-2 rounded-full`, token-colored segments
- Banners: dismissible with icon-only X button, subtle backgrounds

**Planner (CRITICAL — most complex page):**
- Do NOT restructure component hierarchy — only adjust Tailwind classes
- Plan selector: 44px touch target
- Grade rows: expand/collapse, card-like containment
- Course cards: badge visible, hover shadow
- Validation panel: scrollable, color-coded counts
- Modals: `rounded-2xl shadow-xl border-border`
- Preserve ALL `data-tour` attributes (planner tour relies on these)

**Course Picker** (`components/planner/course-picker.tsx` — 778 lines):
The course picker is a full-screen modal (mobile) / centered dialog (desktop) used to search and add courses to a plan. It is one of the most interaction-heavy components in the app. A dedicated sub-agent should handle it.
- Header: close button (44px touch target) + title ("Add Course" + "Grade X, Semester Y") + search input + "Done" button — all in one row, stacks cleanly on mobile
- Filter chips: pill-style toggles for credit type (All/CP/Accelerated/Honors/AP/Dual Credit), duration (Full Year/Sem Only), flags (Early Bird/GPA Waiver). Active = `bg-primary text-primary-foreground`, except GPA Waiver active = `bg-warning text-white`. Verify all chips have `aria-pressed` and `min-h-[36px]`
- Division/Department dropdowns: `rounded-lg border-border min-h-[44px]` with `aria-label`
- Course result cards: `rounded-xl border p-3` with name, code, badges (credit type/AP/Dual Credit/GPA Waiver), grade level pips, duration label. "Add to Plan" button right-aligned. Highlight states: last-viewed = `border-primary/50 bg-primary/5`, validation warning = `border-warning bg-warning-light/50`
- Validation preview: inline warning panel with amber border/bg, violation messages, "Add Anyway" button
- "Added!" feedback: success checkmark + green text, auto-clears after 2s
- Loading state: spinner + "Searching courses..." text centered
- Empty state: search icon + "No courses found" + "Try adjusting your search or filters"
- Pagination: first/prev/next/last buttons with `aria-label`, count text ("1–4 of 23")
- Focus trap: Tab cycles within modal (already implemented, verify it still works after changes)
- Preserve: `role="dialog"`, `aria-modal="true"`, `aria-label`, `aria-pressed` on all filter chips, `role="list"` on results, `aria-label` on pagination buttons

**Course Detail Modal** (`components/course-detail-modal.tsx` — 178 lines):
A stacked modal that opens over the course picker or courses page to show full course information. Sub-agent must handle it alongside CourseDetail.
- Overlay: `bg-black/50`, configurable `zIndex` for stacking over other modals
- Dialog: `max-w-5xl rounded-xl bg-card shadow-xl`, `role="dialog" aria-modal="true"`
- Sticky header: course name + code + close button (44px), badges below (credit type/AP/Dual Credit/GPA Waiver using Badge component with correct variants)
- Loading: centered spinner (currently bare spinner — should match design system skeleton or at least be centered with text)
- Error/empty: "Course not found." centered message — should use standard empty state pattern
- Content: delegates to `CourseDetail` component
- Escape to close (already implemented, preserve)
- Preserve: `aria-label="Close course details"`, `aria-hidden="true"` on overlay

**Course Detail** (`components/course-detail.tsx` — 690 lines):
The full course information view used inside CourseDetailModal and the Courses browser sidebar. This is a content-heavy component.
- Description: `text-sm leading-relaxed text-muted-foreground`
- Detail grid: 2-col → 3-col responsive grid. Labels use section label style (`text-xs font-medium uppercase tracking-wider text-muted-foreground`). Values use `text-sm font-medium text-foreground`. Clickable division/department links use `text-primary hover:text-primary-hover underline`
- Linked courses: `border-primary/20 bg-primary-light/50` callout box with clickable course code pills (`border-primary/30 hover:bg-primary-light`)
- Dual credit info: `border-dual-credit/30 bg-dual-credit-light` callout
- GPA waiver info: `border-warning/30 bg-warning-light` callout
- Prerequisites: grouped by requirement_group with OR badges between alternatives. Semester pairs merged by name. Course codes as clickable links (`text-primary hover:text-primary-hover underline`)
- "What This Unlocks": downstream courses with chevron icon, same clickable code link pattern
- "Add to Plan" form: expandable section with plan selector dropdown + grade level toggle buttons (pill-style, `aria-pressed`) + semester toggle (for semester courses). Full-year note. Success/error result messages use `bg-success-light text-success` / `bg-destructive-light text-destructive` with `role="status"`. Loading spinner for plans fetch. Empty state "No plans found" with link to create plan.
- Cancel/Add buttons: `Button` component, Cancel = ghost, Add = primary. Direct add mode (from picker) simplifies to two buttons.
- Preserve: all `role`, `aria-pressed`, `aria-label`, `title` attributes on interactive elements

**Plan Course Card** (`components/planner/plan-course-card.tsx`):
Individual course card rendered within the planner grid. Small but interaction-dense.
- Status indicator: colored dot/icon using STATUS_CONFIG — Planned = `bg-muted text-muted-foreground`, Enrolled = `bg-primary-light text-primary`, Completed = `bg-success-light text-success`, Dropped = `bg-destructive-light text-destructive`. Verify these match the status → color mapping table.
- Course name: `text-sm font-medium truncate`, code in parentheses
- Badges: credit type badge using correct variant. Additional badges for AP/Dual Credit/GPA Waiver
- Grade dropdown: clean select or custom dropdown, proper label
- Status dropdown: color-coded options matching STATUS_CONFIG
- GPA waiver toggle: checkbox with label, only shown when eligible and not P/F
- Remove button: icon-only with `aria-label`, destructive hover state
- Read-only mode: all controls hidden, card is display-only
- Hover state: subtle shadow or bg change
- Violations: shown as warning indicators on the card (icon + tooltip or inline text)

**Planner Grid** (`components/planner/planner-grid.tsx`):
The semester grid layout that organizes all course cards. Controls the overall planner visual structure.
- Grade rows: one row per grade level (9-12), expandable/collapsible
- Semester columns: 2 columns within each grade row, even width
- Course sort order: Early Bird → Language Arts → Math → Science → World Language → Electives → PE
- Grade header: grade label + GPA display + credit count + lock/unlock icon + clear button
- Semester header: "Semester 1" / "Semester 2" + bulk status/grade dropdown + clear button + "Add Course" button
- "Add Course" button: `+` icon, opens course picker for that grade/semester
- Locked grade visual: muted/disabled appearance, lock icon, all controls except GPA waiver hidden
- Empty semester: "No courses" message with "Add Course" CTA
- Mobile: grade rows stack vertically, semester columns may need horizontal scroll or stacking
- Preserve: `data-grade` attributes on grade rows (used by planner tour)

**Progress:**
- Filter bar: pill-style buttons, active = `bg-primary text-primary-foreground`
- Requirement groups: collapsible with `aria-expanded`
- GPA chart: labeled axes
- Sidebar moves below main content on mobile

**Transcript:**
- Grade sections with semester headers using section label style
- Course type badges use correct token variants (ap/honors/accelerated)
- GPA waiver shown as `<Badge variant="warning">GPA Waiver</Badge>`

**Courses Browser:**
- Search bar prominent with clear button
- Filter labels use section label style
- Active filter count as Badge on mobile
- Pagination with clickable page numbers, `aria-current="page"`

**Plans Manager:**
- Tab navigation: underline style, active = `text-primary` + bottom border
- Action buttons use Button component with consistent variants
- Both empty states (My Plans + Shared) use standard pattern

**Settings:**
- Profile grid: 3-col → 1-col responsive
- Sections wrapped in Card
- Danger zone: `border-destructive/30 bg-destructive-light/30`
- Invite form stacks on mobile

**Billing:**
- Interval toggle: `rounded-full` pills, active filled
- Current tier highlighted with `ring-2 ring-primary`
- Trial state: prominent warning banner with CTA

**Year-End Wizard:**
- Step indicator matches onboarding pattern
- Grade entry in table layout with clean dropdowns
- Navigation in CardFooter: Back (ghost) + Next (primary)
- Summary with consequence warning

**Join:**
- Centered card matching auth page pattern
- Error/success states match login pattern

**Legal (Terms, Privacy):**
- `max-w-prose` for readable line length
- h1 `text-2xl`, h2 `text-lg semibold`, body `text-base leading-relaxed`
- Back link with arrow icon

**Print Pages:**
- `@media print` rules in `globals.css`
- `@page { size: landscape; margin: 0.4in }` where applicable
- Nav/fixed elements hidden in print
- Clean table borders for print
- `break-inside: avoid` on logical blocks

**Any NEW pages not listed above:**
- Apply the universal checklist
- Identify the closest existing page pattern and match it
- If the page introduces a new pattern, document it in this section for future runs

#### After Each Priority Group

The parent agent (Lead Architect) MUST run the full test suite — this includes both pre-existing tests AND any new tests added by the sub-agents in that priority group:

```bash
cd saps && npx vitest run
```

**Verification steps:**
1. Zero failures — every test (old and new) must pass
2. Total test count must be higher than the previous checkpoint (sub-agents added tests)
3. Previously-passing tests still pass (no regressions introduced)
4. Previously-skipped tests are still skipped (nothing converted to a skip to hide failures)
5. If any new test fails, the parent agent must diagnose the issue, fix it (or send the sub-agent back to fix it), and re-run until all tests pass

Record the new test count as the checkpoint for the next priority group. The count should monotonically increase across priority groups:
```
Phase 0 baseline → After Priority 1 → After Priority 2 → After Priority 3 → After Priority 4 → Final
```

---

### Phase 3: Cross-Page Consistency Verification

After all page agents complete, I personally verify:

#### 3a. Badge Audit
Grep all badge usages. Every instance of a status concept uses the same variant:
```bash
grep -rn "Badge" saps/app/ saps/components/ --include="*.tsx" | grep -v "import"
```
- "Complete" / "Met" → `<Badge variant="success">`
- "Gap" → `<Badge variant="destructive">`
- "AP" → `<Badge variant="ap">`
- No one-off `<span className="bg-green-100 text-green-700 rounded-full px-2 text-xs">` anywhere.

#### 3b. Card Audit
```bash
grep -rn "rounded-xl.*border.*shadow-sm" saps/app/ --include="*.tsx" | grep -v "Card"
```
Every card-like element should use `<Card>`. Flag any one-off styled divs.

#### 3c. Button Audit
```bash
grep -rn "<button" saps/app/ --include="*.tsx" | grep -v "// " | head -30
```
Every primary/outline/ghost/destructive action should use `<Button>`. Exceptions: nav links, tiny icon-only buttons (account switcher, mobile menu).

#### 3d. Hardcoded Color Audit
```bash
grep -rn "bg-\(green\|red\|blue\|yellow\|gray\)-\d" saps/app/ --include="*.tsx"
grep -rn "text-\(green\|red\|blue\|yellow\|gray\)-\d" saps/app/ --include="*.tsx"
grep -rn "border-\(green\|red\|blue\|yellow\|gray\)-\d" saps/app/ --include="*.tsx"
```
Fix any non-exempt violations. See acceptable list in Phase 1b.

#### 3e. Empty State Audit
For every page that can be empty, verify the empty state follows the standard pattern (centered, icon container, headline, description, CTA).

#### 3f. Loading State Audit
For every page that fetches data, verify shaped skeletons with `animate-pulse` on `bg-muted`. No bare spinners (except the initial auth check in app layout, which is acceptable).

---

### Phase 4: Layout & Navigation Verification

#### App Layout (`app/(app)/layout.tsx`)
- Nav items: all icons `h-5 w-5`, labels `text-sm font-medium`
- Active state: `bg-primary-light text-primary`
- Inactive state: `text-muted-foreground hover:bg-muted hover:text-foreground`
- Account switcher: avatar initial `bg-primary/10 text-primary`, dropdown `rounded-lg shadow-lg`
- Mobile: hamburger 44px touch target, dropdown shows all nav items + sign out
- Trial banner: doesn't shift layout when dismissed
- Feedback widget: fixed bottom-right, doesn't overlap toast notifications
- **Any new nav items** must follow the same pattern

#### Public Layout (`app/(public)/layout.tsx`)
- Logo: matches app layout logo (same icon, same text treatment)
- Navbar glass effect: `backdrop-blur-xl bg-background/85`
- Footer: responsive grid, social icons consistent
- CTA buttons: "Sign in" (ghost) + "Get Started" (primary) — hierarchy clear
- Feature flag checks preserved

---

### Phase 5: Validation Gate

Every change must pass all gates before I consider the sweep complete.

#### Gate 1: Full Test Suite
```bash
cd saps && npx vitest run          # Unit + Component + API
cd saps && npx playwright test     # E2E (if configured)
```
**Test count must EXCEED the baseline recorded in Phase 0 — every page sweep adds tests. Zero failures tolerated. No tests deleted or skipped.**

If a test fails because a selector changed:
1. The sub-agent updates the test to match the new selector
2. The sub-agent does NOT delete or skip the test
3. I verify the test still validates the same behavior

Compare final counts against Phase 0 baseline:
- Total test count must be higher (new tests were added)
- Previously-passing test count must not decrease (no regressions)
- Previously-skipped test count must not increase (no tests converted to skips)

#### Gate 2: Tour Integrity
```bash
grep -rn "data-tour=" saps/app/ saps/components/ --include="*.tsx"
```
All `data-tour` attributes that existed before the sweep must still exist. Cross-reference with `tour-button.tsx` and any tour configuration.

#### Gate 3: Accessibility Spot Check
For 5 representative pages (one from each group):
- Tab through — every interactive element reachable via keyboard
- Focus ring visible on every focusable element
- All `<img>` have alt text, all icon `<svg>` have `aria-hidden="true"`
- All form inputs have associated labels
- Heading hierarchy: one `<h1>`, then `<h2>`, then `<h3>` — no skips
- Error messages have `role="alert"`
- Loading indicators have `role="status"`

#### Gate 4: Mobile Viewport Check
For all pages at 390px width:
- No horizontal overflow/scroll (except intentional: planner grid, course tables)
- All text readable without zooming
- All buttons/inputs 44px minimum tap target
- Cards stack single-column
- Modals don't overflow viewport

#### Gate 5: Functionality Integrity
After the sweep, verify no functionality was broken:
- Navigate through every major user flow (signup → onboarding → dashboard → planner → progress)
- Verify all API calls still fire (check Network tab)
- Verify all modals open/close
- Verify all forms submit
- Verify all dropdowns/menus work
- Verify subscription gating still blocks features appropriately

---

## Sub-Agent Management

### Creating a UI Expert Engineering Agent

When I create a sub-agent, I provide:

```
You are a UI Expert Engineering Agent working under the Lead UI/UX Architect.

YOUR SCOPE: Modify ONLY visual presentation — Tailwind classes, JSX structure,
and component usage. Do NOT change:
- API calls (fetch, apiFetch)
- Data logic (useState values, useEffect behavior, conditions)
- Routing (useRouter, Link hrefs)
- Business logic (permission checks, tier gating, validation)

YOUR CONSTRAINTS:
- Light-only: NEVER add dark: variants
- Use existing design tokens from globals.css @theme — no hardcoded colors
- Use shared UI components (Card, Button, Badge, Input) — no one-off styled divs
- Preserve ALL data-tour, aria-label, aria-*, role, id attributes
- If you must change a selector, document it in your report

YOUR TESTING REQUIREMENTS:
After making visual changes, you MUST write or update tests to cover your work:
- If the page/component you modified has an existing test file, update it to cover
  any new elements, states, or structural changes you introduced.
- If no test file exists for the page/component, create one in the appropriate
  location (tests/unit/ for components, tests/unit/ for pages with testable logic).
- Tests should verify:
  * New UI states render correctly (empty states, loading skeletons, error banners)
  * New interactive elements are accessible (aria-labels, roles, focus)
  * Replaced components render with correct design system classes
  * Responsive class changes produce the expected structure
- Use React Testing Library (render, screen) and Vitest (describe, it, expect).
  Follow the patterns in existing test files (see tests/unit/button.test.tsx for
  component test patterns).
- Do NOT delete or skip existing tests. If a selector changed, update the test
  to match the new selector while still validating the same behavior.
- Run the full test suite after writing tests to confirm zero failures.

YOUR DELIVERABLE:
- Modified file(s) with only visual changes
- New or updated test file(s) covering the changes
- Report listing every class/structure change AND every new test added
- Confirmation that ALL tests pass (existing + new)
```

### Sub-Agent Report Format

```
PAGE: [Name]
STATUS: [Draft / Ready for Review]

CHANGES:
- [file:line] Changed [old classes] → [new classes] (reason)
- [file:line] Restructured [element] for responsive layout
- [file:line] Added empty state following design system pattern

SELECTORS PRESERVED: [list data-tour, aria-label attributes confirmed present]
SELECTORS CHANGED: [list any changed selectors + reason]
SHARED COMPONENTS: [list any shared component modifications]

TESTS ADDED/UPDATED:
- [test file path] Added N new tests covering [what]
- [test file path] Updated M tests to match new selectors/structure

TEST RESULT: vitest [X passed, Y skipped, Z total] | playwright [N passed]
```

### Rejection Criteria

I reject a sub-agent's work if:
- Any test fails (existing or new)
- No new tests were written for the changes made
- A test was deleted or skipped instead of being updated
- A `data-tour` attribute is missing
- An `aria-label` was removed without replacement
- A one-off styled element replaces a shared component
- Hardcoded color appears outside the acceptable list
- An interactive element lacks hover + focus states
- Mobile layout has horizontal overflow
- Data logic or API calls were modified
- A `dark:` variant was added

---

## What This Delivers

When I complete this orchestration, SAPS will have:

1. **A single visual language across every page.** Same cards, badges, buttons, colors, spacing, and typography everywhere. A user navigating between any pages sees one product, not a patchwork.

2. **Professional-grade first impressions.** The home page, login, and signup look like they were designed by a team. Clean hero, smooth interactions, intentional hierarchy.

3. **Complete state coverage.** Loading shows shaped skeletons. Empty shows friendly CTAs. Errors show inline recovery options. No blank screens, no "undefined" text.

4. **Genuine mobile experience.** Designed for 390px. Stacked layouts, touch-friendly targets, readable text, no horizontal scroll.

5. **Accessibility built in.** Focus rings, ARIA labels, semantic HTML, heading hierarchy, 44px touch targets.

6. **Zero regressions.** Full test suite passes. Tours work. Subscription gating intact. Permission checks unchanged. API calls untouched.

7. **Future-proof.** This plan auto-discovers pages and tests. New pages get the same treatment. New tests get run. The quality bar holds as the product grows.
