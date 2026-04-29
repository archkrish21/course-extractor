# Plan with Genie — DESIGN.md

> **Purpose:** machine-readable source of truth for AI design tools (Claude Design, Pencil.dev) and human reference for anyone producing new surfaces. Drop this file into a Claude Design workspace and every prototype inherits the system automatically.
>
> **Companion docs:**
> - [`brand.md`](./brand.md) — mascot, logo, wordmark assets and usage
> - [`voice-and-tone.md`](./voice-and-tone.md) — how Genie speaks
>
> **This file owns:** color tokens, typography, spacing, component shape, motion, deployment rules. Where it conflicts with older files, **this file wins** and the older file should be updated.

---

## 1. Brand aesthetic

**Confident, considered, warmth-in-restraint.**

A painted mascot lives in a world of clean typography and generous whitespace. Premium without being precious. The mascot carries character; the UI carries confidence.

**We are:** serious, warm, uncluttered, data-dense on app surfaces, mascot-forward on marketing. Think Linear's restraint with a hand-painted hero.

**We are not:** folk-tale, storybook, ornate-everywhere, corporate-blue, generic-edtech, breathless-hypey, cluttered.

**Differentiation anchors:**
- Mascot is **green-skinned**, not blue. No magic lamp.
- Palette is warm — earthy greens, deep crimsons, antique golds — not SaaS blue.
- Whitespace, not decoration, carries the premium feel.

---

## 2. Color system

The color system has two layers: a **source palette** (31 colors, extracted from the mascot illustration, reserved for illustration and decoration) and **UI anchors** (10 colors that do all functional work).

### 2.1 Source palette — illustration & decoration only

Use these for: the mascot asset itself, hero background washes (≤8% opacity), footer ornament, premium-tier badges, social share cards. **Never** for buttons, form controls, borders, body text, or chrome.

| Hex | Name | Family |
|---|---|---|
| `#000000` | Pure Black | Outlines |
| `#141215` | Near-Black | Neutrals |
| `#1C191D` | Deep Charcoal | Neutrals |
| `#262128` | Dark Purple-Grey | Neutrals |
| `#2F1B1E` | Dark Maroon Shadow | Reds |
| `#301A1E` | Dark Brown-Red | Reds |
| `#491C1E` | Deep Burgundy | Reds |
| `#661517` | Rich Crimson | Reds |
| `#A32B4A` | Deep Magenta | Pinks |
| `#B7355B` | Bright Pink-Red | Pinks |
| `#C3335A` | Rose Red | Pinks |
| `#203314` | Dark Forest Green | Greens |
| `#274C13` | Deep Olive | Greens |
| `#3C7624` | Grass Green | Greens |
| `#4F8534` | Mid-Green | Greens |
| `#60933C` | Light Olive | Greens |
| `#2F5C5C` | Teal-Grey | Greens |
| `#317052` | Sea Green | Greens |
| `#38A876` | Vibrant Green (skin tone) | Greens |
| `#45936D` | Muted Mint | Greens |
| `#4A2C1F` | Dark Brown | Browns |
| `#5F3827` | Warm Brown | Browns |
| `#6D402D` | Chestnut | Browns |
| `#864C31` | Copper | Browns |
| `#93623D` | Tan | Browns |
| `#B18D48` | Antique Gold | Golds |
| `#C79C4E` | Mustard Gold | Golds |
| `#E0A956` | Golden Yellow | Golds |
| `#E5B359` | Pale Gold | Golds |
| `#F7BE5C` | Bright Yellow Highlight | Golds |
| `#FFFFFE` | Magic Smoke (off-white) | Neutrals |

### 2.2 UI anchors — light mode

Background is `#FFFFFE` Magic Smoke. Every pick below is contrast-verified.

| Role | Token | Hex | Source | Contrast | Use for |
|---|---|---|---|---|---|
| Background | `--background` | `#FFFFFE` | Magic Smoke | — | Page background |
| Surface muted | `--surface-muted` | `#F5EFE8` | derived (warm off-white) | — | Subtle section backgrounds, card fills |
| Surface elevated | `--surface-elevated` | `#FFFFFE` | Magic Smoke + shadow | — | Cards, dialogs |
| Foreground | `--foreground` | `#141215` | Near-Black | 18.2:1 ✓AAA | Headlines, body text, primary icons |
| Foreground muted | `--foreground-muted` | `#6B6460` | derived (warm neutral) | 5.8:1 ✓AA | Secondary text, placeholders, helper copy |
| Border | `--border` | `#E8DED5` | derived (warm hairline) | — | Dividers, input borders, card outlines |
| Primary | `--primary` | `#317052` | Sea Green | 6.4:1 ✓AA | Primary CTAs, active states, focus rings, links |
| Primary hover | `--primary-hover` | `#274C13` | Deep Olive (darker step) | 10.1:1 ✓AAA | Hover state |
| Primary soft | `--primary-soft` | `#E3F0E8` | derived (Sea Green 10%) | — | Subtle backgrounds, badge fills, selected states |
| Accent | `--accent` | `#661517` | Rich Crimson | 10.8:1 ✓AAA | Wordmark `planwith`, footer brand, anchor moments only — **not** general UI chrome |
| Accent soft | `--accent-soft` | `#FCE8EF` | derived (Crimson 5%) | — | Rare — premium tier backgrounds |
| Highlight | `--highlight` | `#B18D48` | Antique Gold | 4.5:1 ✓AA large | Premium ribbons, testimonial stars, earned brand-beat moments |
| Destructive | `--destructive` | `#A32B4A` | Deep Magenta | 6.6:1 ✓AA | Destructive buttons, error states, dangerous confirmations |
| Success | `--success` | `#317052` | (same as primary) | 6.4:1 ✓AA | Success toasts, positive GPA deltas — reuses primary |
| Warning | `--warning` | `#864C31` | Copper | 6.3:1 ✓AA | Warnings, schedule conflicts, attention-without-danger |

### 2.3 UI anchors — dark mode

Background is `#1C191D` Deep Charcoal (warm maroon-tinted, not neutral). Dark mode follows system preference (`prefers-color-scheme: dark`), no manual toggle. Accent role-swaps from crimson → gold, mirroring the wordmark's dark-mode behavior.

| Role | Token | Hex | Source | Contrast | Use for |
|---|---|---|---|---|---|
| Background | `--background` | `#1C191D` | Deep Charcoal | — | Page background |
| Surface muted | `--surface-muted` | `#262128` | Dark Purple-Grey | — | Subtle section backgrounds |
| Surface elevated | `--surface-elevated` | `#262128` | Dark Purple-Grey | — | Cards, dialogs — same family as background, one step lighter. Cards differentiate via border, not hue |
| Foreground | `--foreground` | `#FFFFFE` | Magic Smoke | 16:1 ✓AAA | Headlines, body text |
| Foreground muted | `--foreground-muted` | `#A89D96` | derived (warm gray) | 6.8:1 ✓AA | Secondary text |
| Border | `--border` | `#3A2930` | derived (warm dark hairline) | — | Dividers, input borders |
| Primary | `--primary` | `#38A876` | Vibrant Green (skin tone) | 6.1:1 ✓AA | Primary CTAs — mascot's own green becomes primary on dark |
| Primary hover | `--primary-hover` | `#45936D` | Muted Mint | 5.2:1 ✓AA | Hover state |
| Primary soft | `--primary-soft` | `#203314` | Dark Forest Green | — | Subtle backgrounds, selected states |
| Accent (**role-swapped**) | `--accent` | `#B18D48` | Antique Gold | 6.4:1 ✓AA | Footer brand band, hero halo role-swap target, one premium moment per page. **Crimson demoted to decoration** |
| Accent soft | `--accent-soft` | `#491C1E` | Deep Burgundy | — | Card tints, footer backgrounds |
| Highlight | `--highlight` | `#E0A956` | Golden Yellow | 9.1:1 ✓AAA | Wordmark `Genie` text (lifted from `--accent` so the brand mark keeps punch on dark), premium ribbons, testimonial stars, large ornament |
| Destructive | `--destructive` | `#C3335A` | Rose Red | 5.2:1 ✓AA | Destructive buttons, errors |
| Success | `--success` | `#38A876` | (same as primary) | 6.1:1 ✓AA | Reuses primary |
| Warning | `--warning` | `#C79C4E` | Mustard Gold | 7.3:1 ✓AA | Warnings |

### 2.4 Usage rules

**Per-surface discipline (the confidence lever):**

- **Maximum two brand colors per surface**, outside the mascot illustration itself. A hero may use Sea Green + Antique Gold. It may not also use Crimson. Crimson lives in the footer and the wordmark, never stacked with other brand colors on the same viewport.
- **Primary is the default for any interactive element.** Buttons, links, focus rings, tab indicators, checkbox fills, progress bars → all Sea Green (light) / Vibrant Green (dark).
- **Accent is an anchor, not a tool.** Reserve Crimson (light) / Antique Gold (dark) for the footer brand band, the hero halo's dark-mode role-swap, and one premium-tier moment per marketing page. Never a button, border, or body-text color. *Note:* the wordmark's `Genie` glyph uses `--primary` in light and `--highlight` (Golden Yellow, brighter than Antique Gold) in dark — a deliberate exception so the brand mark keeps visual punch on the dark background.
- **Highlight is a garnish.** Use once per screen, max. Ribbons, stars, one "Granted" brand beat. Never fill a button or an input.
- **Destructive is destructive.** Never decorative.

**Course-type colors** (used inside the planner for subject categorization — AP violet, honors cyan, dual-credit teal, accelerated orange) live in the app shell, not the marketing site. They're defined in `globals.css` and are out of scope for this document.

### 2.5 CSS variable declaration

Tailwind 4 `@theme` block in [`saps/app/globals.css`](../../saps/app/globals.css). Dark mode via `prefers-color-scheme: dark` media query overriding variables on `:root` (no `.dark` class, no toggle).

```css
@theme {
  /* Semantic UI tokens — light mode defaults */
  --color-background: #FFFFFE;
  --color-foreground: #141215;
  --color-muted: #F5EFE8;
  --color-muted-foreground: #6B6460;
  --color-foreground-muted: #6B6460;
  --color-surface-muted: #F5EFE8;
  --color-surface-elevated: #FFFFFE;
  --color-border: #E8DED5;
  --color-card: #FFFFFE;
  --color-card-foreground: #141215;
  --color-ring: #317052;

  --color-primary: #317052;
  --color-primary-hover: #274C13;
  --color-primary-soft: #E3F0E8;
  --color-primary-foreground: #FFFFFE;

  --color-accent: #661517;
  --color-accent-soft: #FCE8EF;

  --color-highlight: #B18D48;

  --color-destructive: #A32B4A;
  --color-success: #317052;
  --color-warning: #864C31;

  /* Course-type colors — planner/app-shell only; see §2.4 */
  --color-ap: #7c3aed;
  --color-honors: #0891b2;
  --color-dual-credit: #0d9488;
  --color-accelerated: #ea580c;

  --font-sans: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #1C191D;
    --color-foreground: #FFFFFE;
    --color-muted: #262128;
    --color-muted-foreground: #A89D96;
    --color-foreground-muted: #A89D96;
    --color-surface-muted: #262128;
    --color-surface-elevated: #262128;
    --color-border: #3A2930;
    --color-card: #262128;
    --color-card-foreground: #FFFFFE;
    --color-ring: #38A876;

    --color-primary: #38A876;
    --color-primary-hover: #45936D;
    --color-primary-soft: #203314;
    --color-primary-foreground: #141215;

    --color-accent: #B18D48;
    --color-accent-soft: #491C1E;

    --color-highlight: #E0A956;

    --color-destructive: #C3335A;
    --color-success: #38A876;
    --color-warning: #C79C4E;
  }
}
```

The hero halo role-swaps via a dedicated utility (see §10.1):

```css
.hero-glow {
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--color-primary) 22%, transparent) 0%,
    color-mix(in srgb, var(--color-primary) 8%, transparent) 45%,
    transparent 70%
  );
}
@media (prefers-color-scheme: dark) {
  .hero-glow {
    background: radial-gradient(
      ellipse at center,
      color-mix(in srgb, var(--color-accent) 28%, transparent) 0%,
      color-mix(in srgb, var(--color-accent) 12%, transparent) 45%,
      transparent 70%
    );
  }
}
```

---

## 3. Typography

**Font family:** Inter, with fallbacks `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. No second font — the wordmark provides all the typographic personality needed.

**Weights in use:**
- 400 (regular) — body
- 500 (medium) — UI labels, buttons
- 600 (semibold) — subheadings, wordmark `planwith`
- 700 (bold) — section headings
- 900 (black) — wordmark `Genie`, display hero only

**Scale:**

| Token | Size | Line height | Weight | Use for |
|---|---|---|---|---|
| `display-2xl` | 72px / 4.5rem | 1.05 | 700 | Hero headline (desktop) |
| `display-xl` | 56px / 3.5rem | 1.1 | 700 | Hero headline (tablet), page H1 |
| `display-lg` | 44px / 2.75rem | 1.15 | 700 | Section heading |
| `display-md` | 36px / 2.25rem | 1.2 | 600 | Sub-section heading |
| `heading-lg` | 28px / 1.75rem | 1.25 | 600 | Card heading |
| `heading-md` | 22px / 1.375rem | 1.3 | 600 | Small heading |
| `heading-sm` | 18px / 1.125rem | 1.4 | 600 | Label, small heading |
| `body-lg` | 18px / 1.125rem | 1.6 | 400 | Marketing body copy |
| `body-md` | 16px / 1rem | 1.55 | 400 | Default body, UI text |
| `body-sm` | 14px / 0.875rem | 1.5 | 400 | Helper text, captions |
| `body-xs` | 12px / 0.75rem | 1.4 | 500 | Micro-labels, metadata |

**Rules:**
- Display type uses tight tracking (`letter-spacing: -0.02em`).
- Body type uses default tracking.
- Never mix `display-*` weights within a single headline.
- Hero headlines may use a **single color accent** on one word — typically the brand-beat word ("Granted"). Accent word uses `--primary` in light mode, `--accent` (Antique Gold) in dark. Never both colored words in one headline.

---

## 4. Spacing & layout

**Base unit:** 4px. All spacing is a multiple: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.

**Container widths:**
- Marketing pages: `max-w-6xl` (72rem / 1152px) centered
- App shell: full width with `max-w-7xl` content containers
- Forms, auth: `max-w-md` (28rem / 448px)
- Reading content (about, legal): `max-w-2xl` (42rem / 672px)

**Section rhythm (marketing):**
- Above-the-fold hero: `py-20` (5rem / 80px) top + bottom
- Standard section: `py-16` (4rem / 64px)
- Tight section (feature strip, stat row): `py-12` (3rem / 48px)

**Vertical rhythm:**
- Between headline and subhead: `mt-4` (16px)
- Between subhead and CTA row: `mt-8` (32px)
- Between sections: `py-16` or `py-20` per above

**Generous whitespace is load-bearing.** When in doubt, add more. Confidence reads as restraint.

---

## 5. Components

The app uses shadcn-style primitives. AI tools generating new surfaces should **reference these by name** rather than rebuild them.

### 5.1 Button

Import: [`@/components/ui/button`](../../saps/components/ui/button.tsx)

| Variant | Appearance | Use for |
|---|---|---|
| `default` | Filled `--color-primary`, `--color-primary-foreground` text, hover to `--color-primary-hover` | Primary CTA, form submit |
| `outline` | `border border-border`, transparent bg, `text-foreground`, hover `bg-muted` | Secondary action, Google OAuth button, "See how it works" |
| `ghost` | No background, `text-foreground`, hover `bg-muted` | Tertiary, nav-style actions |
| `destructive` | Filled `--color-destructive`, white text, hover `--color-destructive-hover` | Delete, remove |

**Sizes:** `sm` (32px height, `h-9`), `default` (40px, `h-11`, `min-h-[44px]` for mobile tap target), `lg` (48px, `h-12`, `min-h-[44px]`).

**Rules:**
- One `default` button per view or section — the primary action. Everything else is `outline` or `ghost`.
- No gradient fills. Flat color + one hover state.
- Icons go left of label, 16px, same color as text.
- **Primary CTA text uses title case** — proven patterns like "Get Started Free", "Start Free Trial". Secondary and nav actions stay sentence case ("See how it works", "Read the FAQ", "Sign in"). See voice-and-tone.md.

### 5.2 Card

Import: `@/components/ui/card`

- Border: 1px `--border`.
- Radius: 12px.
- Padding: 24px default, 32px for featured cards.
- Background: `--surface-elevated`.
- No shadow by default. Shadow only on hover for interactive cards.

### 5.3 Badge

Import: [`@/components/ui/badge`](../../saps/components/ui/badge.tsx)

The Badge primitive is currently scoped to **planner/app-shell** usage — the variants encode course categorization, not marketing states.

| Variant | Fill | Text | Use for |
|---|---|---|---|
| `default` | `--color-muted` | `--color-muted-foreground` | Neutral status, tags |
| `ap` | `--color-ap-light` | `--color-ap` | AP course chips |
| `honors` | `--color-honors-light` | `--color-honors` | Honors course chips |
| `dual-credit` | `--color-dual-credit-light` | `--color-dual-credit` | Dual-credit chips |
| `accelerated` | `--color-accelerated-light` | `--color-accelerated` | Accelerated-track chips |
| `success` | `--color-success-light` | `--color-success` | Positive state, earned credits |
| `warning` | `--color-warning-light` | `--color-warning` | Conflicts, attention |
| `destructive` | `--color-destructive-light` | `--color-destructive` | Error states |

**Future additions (not yet shipped):** marketing-only variants `accent` (`--accent-soft` fill + `--accent` text — premium moments) and `gold` (Antique Gold fill + near-black text — "Most popular", once-per-page earned moments). Both would be additive, not replacements. File the issue when a marketing surface needs one.

Shape: `inline-flex` pill, 9999px border-radius, `text-xs font-semibold`, `px-2.5 py-0.5`, `whitespace-nowrap`.

### 5.4 Input

Import: `@/components/ui/input`

- Border: 1px `--border`.
- Focus ring: 2px `--primary` with 2px offset.
- Radius: 8px.
- Padding: 12px 16px.
- Placeholder uses `--foreground-muted`.
- Error state: border + focus ring switch to `--destructive`, helper text shows below.

---

## 6. Motion

**Principles:**
- Motion serves clarity, never decoration.
- Respect `prefers-reduced-motion: reduce` — all non-essential motion disabled.
- No parallax. No scroll-linked reveal animations. No bouncy easing.

**Durations:**
- Micro (hover, focus): 150ms
- UI (toasts, popovers, modals open): 200ms
- Page transitions: 300ms (opacity only)

**Easing:** `cubic-bezier(0.2, 0, 0, 1)` — Material "standard" curve. One curve everywhere. Never bounce, never overshoot.

**Allowed:**
- Fade on mount (opacity 0 → 1, 200ms)
- Scale hover on cards (1.0 → 1.02, 150ms)
- Mascot: single 300ms fade-in on page load, ornamental background glow pulsing at 8s cycle (reduced-motion disables)

**Forbidden:**
- Parallax scrolling
- Scroll-triggered element entrances
- Floating/bobbing decorative elements
- Elastic/bounce easing anywhere

---

## 7. Voice & tone (summary)

Full guide: [`voice-and-tone.md`](./voice-and-tone.md). **Three rules:**

1. **Genie is a wise expert, not a miracle vendor.** The magic is in the knowledge, not passivity.
2. **Clarity wins on decision surfaces. Warmth wins everywhere else.**
3. **Wish-language belongs in microcopy and ambient moments — not on CTAs, pricing, or comparison-facing copy.**

**Per-page budget for wish-language:** one earned brand beat per viewport. The landing hero gets *"Granted."* — that's the entire wish-budget for the hero. The "How it works" section might get *"Three steps. No incantations."* — that's the wish-budget for that section. Never stack.

**Vocabulary:**
- Use: *plan*, *path*, *course*, *four years*, *granted*, *wish* (sparingly)
- Avoid: *journey*, *unleash*, *empower*, *disrupt*, *unlock your potential*, *your wish is my command*

---

## 8. Deployment rules — confident vs folk-tale

This is the section that matters most. Any single surface that violates these rules tips from "confident" → "folk-tale."

### DO
- Maximum two brand colors per surface (mascot illustration doesn't count)
- Primary for interactive elements, always. Accent for brand moments only.
- Generous whitespace — more than feels comfortable
- Tight typography, flat backgrounds, hairline borders
- Data density on app screenshots — show real planner grids, real GPA charts
- Mascot prominent in hero; absent elsewhere on marketing
- Footer is the one place maroon/crimson can live with visible brand presence

### DON'T
- No filigree or decorative ornament on chrome (buttons, inputs, cards, section dividers)
- No warm-brown or copper backgrounds — browns stay in illustration
- No gradient buttons (single exception: hero background wash, ≤8% opacity)
- No more than one "wish-language" moment per viewport
- No stacked brand colors (Crimson + Gold + Emerald on the same surface = folk-tale)
- No decorative wave dividers or section-separator patterns
- No stock photos of students — mascot or abstract illustration only
- No exclamation points in body copy (one per page max, reserved for toasts)

### The four-color test
If you squint at the page and see more than **four distinct colors** (not counting the mascot illustration pixels), you've overbuilt. Strip one.

---

## 9. Mascot & wordmark

Full details: [`brand.md`](./brand.md). Quick reference:

- **Mascot** (`/brand/genie-mascot.png`): hero illustration on landing and key marketing surfaces. 512px+ render size. Clean background (`--background` or `--surface-muted`). Never on photographs.
- **Wordmark** (`<GenieWordmark>` component): nav bars, footer, auth/onboarding headers. Adapts to light/dark automatically — `planwith` uses `--color-accent` in light / `--color-foreground` in dark; `Genie` uses `--color-primary` in light / `--color-highlight` (Golden Yellow) in dark. See [`brand.md`](./brand.md#wordmark-dark-mode-behavior) for the rationale on the dark-mode exception.
- **Logo mark** (`<SapsLogo>` component): favicon-sized contexts only. Paired with wordmark in nav.

**Do not** use the mascot at favicon size, on crowded backgrounds, or alter its palette.

---

## 10. Surface recipes

Canonical shapes for common surfaces. AI tools can treat these as templates.

### 10.1 Marketing landing hero

Shipped in [`saps/app/(public)/page.tsx`](../../saps/app/(public)/page.tsx). Reference.

- Section contained within `max-w-6xl` + horizontal padding; **not** full-bleed or `min-h-screen` (keeps the how-it-works strip on or near the fold)
- Asymmetric two-column grid on desktop: `lg:grid-cols-[1.1fr_1fr]` with `lg:gap-16`; stacked on mobile
- "Early access" badge above the headline: `bg-primary-soft` fill, `text-primary`, `text-sm`, with a small `bg-primary` dot
- Headline: **inline** `text-[clamp(2.25rem,5vw,4rem)]` with `font-bold`, `leading-[1.05]`, `tracking-[-0.025em]` — **not** the `.display-2xl` utility class, because the hero needs a specific responsive clamp. One word in `--primary` accent (the earned brand beat — "Granted.")
- Headline stability: wrap the first phrase in `whitespace-nowrap` so it never breaks at the hyphen in "four-year" and becomes 3 lines
- Subhead: `text-lg`, `text-foreground-muted`, `max-w-xl`, approved copy from [`voice-and-tone.md`](./voice-and-tone.md)
- CTA row: primary `<Link>` styled as `bg-primary` filled button + secondary anchor styled as outline button (`border border-border`). **Not** a ghost button. Gap: 12px mobile / 16px desktop
- Proof row below CTAs: 3 short proof-points separated by `bg-primary` dots, in `text-foreground-muted text-sm`
- Mascot column: radial halo behind the mascot — **role-swaps with the accent**: `--color-primary` in light mode (Sea Green), `--color-accent` in dark mode (Antique Gold). No other decoration. Implemented as the `.hero-glow` utility in [`saps/app/globals.css`](../../saps/app/globals.css) so the swap happens at the CSS layer, not per-component
- Section background rhythm across the whole landing page: `W-M-W-M-W-M-W-W` (W = `--color-background`, M = `bg-surface-muted`). The hero is W, the immediately-following how-it-works strip is M

### 10.2 Feature grid
- 3-column on desktop, 2 on tablet, 1 on mobile
- Each card: icon top (24px, `--primary`), `heading-md` title, `body-md` description
- Card background: transparent (not `Card` primitive — cleaner for grids)
- Gap: 32px

### 10.3 Pricing
- 3 tiers horizontal, featured tier slightly larger with `--highlight` ribbon "Most popular"
- Featured tier ribbon is the only place Antique Gold touches chrome
- Price: `display-lg`, foreground; cadence (/month) in `--foreground-muted`
- Feature list: checkmark icons in `--primary`, 8px gap between rows

### 10.4 Footer

Shipped in [`saps/app/(public)/layout.tsx`](../../saps/app/(public)/layout.tsx) (#87). Reference.

- **Background:** `bg-accent-soft` in **both** modes — `#FCE8EF` pale crimson in light, `#491C1E` deep burgundy in dark. Distinct from the page bg in either mode and ties to the email header. *Earlier draft of this spec said `--surface-elevated` for dark; that's now same as `--surface-muted` (`#262128`) so it would blend with section tints. `--accent-soft` is the right choice for a distinctive footer in both modes.*
- **Wordmark:** top row, `md` size, paired with `<SapsLogo size="md">`. Below it, a `text-foreground-muted` subtitle in one paragraph (no forced break) merging the "Built by a Stevenson HS student" + "Currently supporting Stevenson — more schools coming soon" copy. The "more schools coming soon" phrase is a `text-primary` link to [`/request-school`](../../saps/app/(public)/request-school/page.tsx).
- **Four columns** below the wordmark row: **Product / Resources / Connect / Legal**. (Replaced the original spec's "Company" column — too thin to populate. Connect now owns social icons.)
  - Product: About, Pricing, FAQ, Get Started
  - Resources: Support, Contact
  - Connect: social icons (Instagram, Facebook, X, LinkedIn)
  - Legal: Terms, Privacy
- **Bottom bar:** split layout — `© <year> · Academic planning, granted.` left, `Not affiliated with Adlai E. Stevenson High School.` right. Stacks on mobile. *"All rights reserved." was dropped — no legal effect under the Berne Convention.*
- **Vertical rhythm:** `py-10` outer, `mt-10` between wordmark row and columns, `mt-8` before bottom bar, `pt-5` above bottom bar text. Lands at ~400px — modern SaaS sweet spot for a 4-column footer.
- **No ornament.** First pass shipped a decorative mascot in the upper-right; removed because the hero halo already carries the page's earned ornamental moment and a second mascot doubled-down without earning it.

### 10.5 Error / 404

Shipped via shared primitive [`<ErrorState>`](../../saps/components/ui/error-state.tsx) (#88). All six error/404 surfaces use it:

| Surface | File | Type | CTA destination |
|---------|------|------|-----------------|
| Public 404 | [`(public)/not-found.tsx`](../../saps/app/(public)/not-found.tsx) | numeral | `/` |
| Public error | [`(public)/error.tsx`](../../saps/app/(public)/error.tsx) | icon | Try again + `/` |
| App 404 | [`(app)/not-found.tsx`](../../saps/app/(app)/not-found.tsx) | numeral | `/dashboard` |
| App error | [`(app)/error.tsx`](../../saps/app/(app)/error.tsx) | icon | Try again + `/dashboard` |
| Root 404 (catch-all) | [`app/not-found.tsx`](../../saps/app/not-found.tsx) | numeral, fullScreen | auth-aware (`/dashboard` or `/`) |
| Last-resort error | [`app/global-error.tsx`](../../saps/app/global-error.tsx) | icon | Try again + `/` |

Visual rules:

- **Centered content**, `max-w-md`, `min-h-[60vh]` (or `min-h-screen` for `fullScreen` root catch-all)
- **Numeral** (404 surfaces): `text-[8rem]` mobile / `sm:text-[10rem]` desktop, `font-bold`, `text-foreground-muted/30`. Large, ambient, subtle — reads as a watermark-style anchor, not a loud declaration
- **Icon** (error surfaces): 96px, `text-foreground-muted/30`, no decorative wrapper. *Earlier shipped versions used a 32px destructive-red icon in a circle — replaced because "real errors deserve calm" per the voice guide; calm visuals match calm copy*
- **Headline:** plain language, no wish-theming for real errors. *"Page not found"*, *"Something went wrong"*
- **404 / empty-state exception:** one earned wish-language beat is OK. Current copy: *"Even genies lose track sometimes."* on 404
- **Real errors:** plain. Current copy: *"Something broke on our end. Try again, or head back home."*
- **Actions:**
  - 404: single primary CTA (back to safe destination)
  - Error: two actions — `Try again` (primary) + `Back to ...` (outline)
- **Action implementation:** when `href` is provided, render a styled `<Link>` (wrapping `<Button>` inside `<Link>` produces invalid `<a><button>` markup). When `onClick` is provided, render a `<Button>` from the primitive.

Special case — `global-error.tsx`:
- Renders **outside** the layout (no shared chrome), so it can't import `<ErrorState>` which assumes layout context
- Inlines the same visual pattern with its own `<html><body>`
- Keeps Sentry capture on mount

---

## 11. For AI design tools

**Claude Design:**
1. Upload this file to a workspace under "Create new design system" → "Add assets"
2. Also attach [`genie-mascot.png`](../../saps/public/brand/genie-mascot.png) and [`wordmark-email.png`](../../saps/public/brand/wordmark-email.png) as brand assets
3. Prompts should reference token names (`--primary`, `--accent`) and component names (`<Button variant="default">`, `<Card>`, `<Badge variant="gold">`) rather than raw hex
4. When generating prototypes, request **both light and dark mode variants** — the role-swap (Crimson → Antique Gold in dark) is the brand's signature move

**Pencil.dev / Claude Code:**
- The token declarations in §2.5 are the canonical source. `saps/app/globals.css` should match this file.
- Generated React should use `bg-primary`, `text-accent`, `border-border` (Tailwind tokens) — never inline hex, never arbitrary values like `bg-[#317052]`
- Components should import from `@/components/ui/*` — do not reinvent primitives

---

## 12. Change log

| Date | Change | PR |
|---|---|---|
| 2026-04-23 | Initial DESIGN.md — replaces legacy blue `#2563eb` primary with Sea Green palette; introduces warm maroon-tinted dark mode with crimson→gold role-swap | #81 |
| 2026-04-24 | Phase 1 lands tokens in `globals.css`; Inter ships via `next/font/google`; wordmark refactored to read tokens | #83 |
| 2026-04-24 | Phase 2 — landing hero V1 + how-it-works V3 strip implemented; section background alternation normalized | #84 |
| 2026-04-24 | Dark-mode polish: surface-elevated `#301A1E` → `#262128` (remove maroon clash); wordmark `Genie` uses `--highlight` in dark (was `--accent`) for visual punch; hero halo role-swaps via `.hero-glow`; tour popover theming fixed (combined-selector bug); Google button `bg-white` dropped. Plus doc sync: DESIGN.md §2.3, §2.5, §5.1, §5.3, §9, §10.1 and brand.md wordmark section reconciled with the code shipped in #83, #84, #85 | #85 |
| 2026-04-24 | Phase 3 marketing polish: footer redesign (--accent-soft bg, 4-column grid, ~400px height); new `/request-school` page; voice cleanup ("journey" → approved vocab; Final CTA stacked beats fixed); pricing "Most popular" upgraded to gold pill ribbon | #87 |
| 2026-04-24 | Error / 404 redesign per §10.5: shared `<ErrorState>` primitive at [`saps/components/ui/error-state.tsx`](../../saps/components/ui/error-state.tsx); 404 numeral promoted to `text-[8rem]` / `sm:text-[10rem]` at `text-foreground-muted/30`; error icon at 96px subtle (was 32px in destructive red circle); `global-error.tsx` rebranded with inline standalone markup since it renders outside the layout | #88 |
| 2026-04-28 | **voice-guardian** PR copy reviewer ships: skill at [`.claude/skills/voice-guardian/SKILL.md`](../../.claude/skills/voice-guardian/SKILL.md), workflow at [`.github/workflows/voice-guardian.yml`](../../.github/workflows/voice-guardian.yml), script at [`.github/scripts/voice-guardian.sh`](../../.github/scripts/voice-guardian.sh). Reviews user-visible copy in `**.tsx`, `**.md`, `saps/components/emails/**` against `voice-and-tone.md` + `brand.md` and posts non-blocking findings; loads rules fresh on every run with prompt caching on the static portion | #114 |
| 2026-04-28 | Copy fixes from the voice-guardian dogfood pass on #113/#108/#107: founder paragraph on `/about` made subject-neutral ("computer science classes" → "classes"); "counselors review" removed from the v1 family-roles line (counselor role hidden from v1 UI); Illinois roadmap softened from "onboarding through 2026" to demand-driven framing; FAQ "AI-powered features for users" → "AI features"; trimmed "with the care it deserves" platitude; "Plan Not Found" / "Back to Plans" sentence-cased to "Plan not found" / "Back to plans" | #115 |
| 2026-04-28 | CLAUDE.md gains four top-level sections — Response Length, Git Workflow, Brand & Copy, Testing — and renames Project Overview from "SAPS (Student Academic Planning System)" to "Plan with Genie (formerly SAPS)" | #116 |
