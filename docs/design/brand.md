# Plan with Genie — Brand System

> **Audience:** engineers building UI, marketing designers producing assets, and anyone adding a new surface that needs brand identity.
>
> **Companion docs:** [`brand-exploration/`](./brand-exploration/) holds the design artifacts and iteration history that led to this system.

---

## Overview

The brand has three visual components, each with a distinct role:

| Component | Role | Asset |
|---|---|---|
| **Mascot** — green genie | Character-driven warmth. Used for marketing and hero moments. | [`saps/public/brand/genie-mascot.png`](../../saps/public/brand/genie-mascot.png) |
| **Logo mark** — cap + turban | Scalable identity. Used at any size where the mascot won't render legibly. | [`saps/public/favicon.svg`](../../saps/public/favicon.svg) + PNG variants |
| **Wordmark** — `planwithGenie` | Typography with a shared tall-i ligature. Used in nav bars, headers, and anywhere the brand name appears inline. | [`saps/components/ui/genie-wordmark.tsx`](../../saps/components/ui/genie-wordmark.tsx) |

---

## 1. The Mascot

A confident green-skinned genie with a maroon turban (gold filigree, ruby gem), folded arms, and a warm smile. Intentionally original — not blue, not lamp-based — to sit clearly outside Disney/Aladdin trade-dress.

### Where it's used
- **Landing page hero** — [`saps/app/(public)/page.tsx`](../../saps/app/(public)/page.tsx): side-by-side with the value-prop headline.
- **Marketing surfaces** — email templates, social shares, "About" pages, empty states.

### Do
- Place on clean backgrounds where the emerald skin pops.
- Use at 400px+ where facial detail is legible.
- Pair with the wordmark when you need the brand name.

### Don't
- Don't use at favicon/app-icon sizes — use the logo mark instead.
- Don't alter the skin color, turban palette, or filigree.
- Don't place on a crowded background (reduces impact).

### Available formats
| File | When to use |
|---|---|
| `genie-mascot.png` | Default. Works everywhere. `next/image` will serve optimized WebP/AVIF. |
| `genie-mascot.svg` | When you need vector scaling (print, giant banners). |
| `genie-mascot.webp` | Direct `<img>` tags where you control format support. |

---

## 2. The Logo Mark

A **graduation mortarboard fused with a genie turban**, with a ruby gem centered on the gold band. Combines "academic" (cap) and "magical helper" (turban) in a single silhouette.

### Where it's used
- **Browser tab favicon** — `.ico`, `.svg`, `96x96`
- **Apple touch icon** — `180x180` for iOS home screen
- **PWA icons** — `192x192` and `512x512` maskable
- **Nav bar icon** (rendered via [`<SapsLogo>`](../../saps/components/ui/saps-logo.tsx) next to the wordmark)

### Wiring
Installed via Next.js `metadata` API in [`saps/app/layout.tsx`](../../saps/app/layout.tsx). Favicon files live at `saps/public/` root; paths resolve as `/favicon.svg`, `/favicon.ico`, etc.

```tsx
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/site.webmanifest",
  appleWebApp: { title: "Plan with Genie" },
};
```

### Component usage
```tsx
import { SapsLogo } from "@/components/ui/saps-logo";

<SapsLogo size="md" />   // 32px — nav bars
<SapsLogo size="sm" />   // 28px — compact contexts
<SapsLogo size="lg" />   // 40px — tablet/medium headers
<SapsLogo size="xl" />   // 48px — large headers, auth pages
```

Renders `/favicon-96x96.png` via `next/image` for automatic optimization.

### Regenerating the favicon set
The full icon suite (all sizes, manifest, Apple touch, `.ico`) was generated via **[RealFaviconGenerator](https://realfavicongenerator.net)** from [`logo-mark-primary.png`](./brand-exploration/logo-mark-primary.png) in the exploration archive. To regenerate, re-upload that source PNG and replace the output in `saps/public/`.

---

## 3. The Wordmark

`planwithGenie` rendered as a hand-tuned SVG with a **shared tall-i ligature** — a single tall vertical stroke serves as the "i" in both `planwith` (top) and `Genie` (bottom). An extra-tall capital `G` mirrors the tall i for visual balance. A subtle curved stem evokes rising smoke, at 75% opacity.

### Anatomy
```
planw    th       ← small (size 18 bold), maroon
     │            ← shared tall-i stem (curved, 75% opacity)
     ●            ← i dot
Gen      e        ← large (G at size 72, "en"/"e" at size 56)
```

### Where it's used
- **Public nav + footer** — [`saps/app/(public)/layout.tsx`](../../saps/app/(public)/layout.tsx)
- **App nav** (logged-in) — [`saps/app/(app)/layout.tsx`](../../saps/app/(app)/layout.tsx)
- **Auth pages** (login, signup) — [`saps/app/(auth)/layout.tsx`](../../saps/app/(auth)/layout.tsx)
- **Onboarding** — [`saps/app/(onboarding)/layout.tsx`](../../saps/app/(onboarding)/layout.tsx)

### Component usage
```tsx
import { GenieWordmark } from "@/components/ui/genie-wordmark";

<GenieWordmark size="md" />   // 44px — nav bars
<GenieWordmark size="sm" />   // 32px — footer
<GenieWordmark size="lg" />   // 56px — medium headers
<GenieWordmark size="xl" />   // 72px — auth + onboarding headers
```

### Typography
- **Font:** Inter (system fallbacks: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`)
- **`planwith`:** weight 600 (semibold), letter-spacing 1.2
- **`Genie`:** weight 900 (black), letter-spacing −2
- **`G`:** fontSize 72 (taller than `en`/`e` at 56 to match the tall-i height)

---

## Color Palette

| Name | Hex | Usage |
|---|---|---|
| **Maroon** | `#6B1F3D` | Turban, cap, `planwith` text (light mode) |
| **Gold** | `#FCD34D` | Filigree, band, tassel, `Genie` text (dark mode), theme color |
| **Ruby** | `#E11D48` | Gem accent |
| **Emerald** | `#059669` | Mascot skin, `Genie` text (light mode), `theme_color` in webmanifest |
| **Foreground** | `text-foreground` | `planwith` text (dark mode) — theme-adaptive |

### Dark mode behavior
- `planwith` (maroon in light) → foreground token (white-ish in dark)
- `Genie` (emerald in light) → gold in dark

This mirrors the mascot's own palette: the turban's maroon becomes the filigree's gold in inverted/dark contexts.

---

## File Map

```
saps/public/
├── favicon.svg              # browser tab — vector
├── favicon.ico              # legacy browsers
├── favicon-96x96.png        # modern browsers + nav logo source
├── apple-touch-icon.png     # iOS home screen (180×180)
├── web-app-manifest-192x192.png   # PWA maskable
├── web-app-manifest-512x512.png   # PWA maskable
├── site.webmanifest         # PWA manifest
└── brand/
    ├── genie-mascot.png     # hero illustration (primary)
    ├── genie-mascot.svg     # vector fallback
    └── genie-mascot.webp    # small-footprint raster

saps/components/ui/
├── saps-logo.tsx            # <SapsLogo> — favicon-as-image wrapper
└── genie-wordmark.tsx       # <GenieWordmark> — hand-tuned SVG wordmark

docs/design/
├── brand.md                 # this file
└── brand-exploration/       # design history + AI-generated sources
```

---

## Design Rationale

The brand was deliberately engineered to avoid the **Disney/Aladdin** trade-dress trap. Key moves:

- **Green skin**, not blue — the single most important visual differentiator.
- **No magic lamp and no smoke-from-lamp origin** — replaced with a stardust swirl base for the mascot.
- **Graduation cap fused with turban** — original character/prop concept; the cap grounds it in academic context.
- **Maroon + gold + ruby** palette — regal without invoking a specific existing character.

For the full iteration history (including rejected concepts), see [`brand-exploration/`](./brand-exploration/).

---

## Tools Used

These external tools produced the brand assets. Each fills a specific gap that pure code can't.

| Tool | Role in this brand |
|---|---|
| **[Ideogram](https://ideogram.ai/)** | Primary AI image generator for the **mascot** and the ornate **primary logo mark** (grad cap + turban). Version 3.0's Style Reference feature made it possible to lock palette + pattern across iterations by uploading the mascot as a reference image. |
| **[Recraft](https://www.recraft.ai/)** | Used when Ideogram struggled with **simple symmetric logos** (the favicon mark). Recraft is trained on vector/logo data and handles geometric, bilateral-symmetric shapes better than general-purpose image AI. |
| **[remove.bg](https://www.remove.bg/)** | Quick background cleanup for AI-generated PNGs. AI models often leave faint gradients, color fringes, or stray sparkles in the "transparent" areas — remove.bg wipes those in one pass and returns a clean alpha channel. |
| **[vectorizer.io](https://www.vectorizer.io/)** | Converts finalized raster mascot/logo renders into clean SVGs. Used so the mascot can scale for print, giant banners, or future design work without quality loss. Free alternative to the paid [vectorizer.ai](https://vectorizer.ai/). |
| **[RealFaviconGenerator](https://realfavicongenerator.net/)** | Generates the full favicon suite (20+ files — `.ico`, SVG, Apple touch, PWA manifests, Android Chrome, Safari pinned tab) from a single source PNG. Also emits the exact HTML snippet to wire into `<head>`. Indispensable for shipping a cross-platform favicon. |

### Typical workflow (for future brand asset work)

1. **Design concept / sketch** — hand-tuned SVG component (for wordmarks and precise shapes) or AI prompt (for characters, illustrations, ornate marks).
2. **Generate via Ideogram or Recraft** — iterate with explicit negative prompts (`"no blue skin, no magic lamp, no Aladdin"`) until the result lands.
3. **Clean with remove.bg** — strip background artifacts.
4. **Vectorize with vectorizer.io** — convert raster to SVG if scaling is needed.
5. **Favicon suite via RealFaviconGenerator** — upload final PNG, download zipped output, drop into `saps/public/`.
6. **Archive sources** in [`brand-exploration/`](./brand-exploration/) so the workflow is reproducible.
