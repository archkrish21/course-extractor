# The Plan with Genie tech stack, explained

This is a companion to my Claude Code writeup. That one was about *how* I built Plan with Genie. This one is about *what I built it with* — the tools and libraries I picked, what each one is for, and how they all fit together to make the app actually work.

I'm writing this for you specifically because when I started, I had no idea what any of this stuff was. "Next.js? Supabase? Drizzle? Why three things?" If you're staring at a tutorial and wondering why every modern web app uses ten libraries instead of one, this is for you.

The rule I followed: **every piece of the stack solves one specific problem.** If I can't explain what problem a tool solves, it doesn't belong. So that's how I'll explain them too — problem first, tool second.

---

## The big picture in one paragraph

A user types `planwithgenie.com`. **Namecheap**'s DNS records point that domain at **Vercel**, which serves them a page rendered by **Next.js** — built on **React**, written in **TypeScript**, and styled with **Tailwind CSS**. The signup form is protected by **hCaptcha** to keep bots out, and the "Sign in with Google" button hands off to a Google OAuth client I configured in **Google Cloud Console**. **Supabase Auth** turns the result into a session cookie. When the student clicks "add a course," React calls one of my API routes, which validates the input with **Zod** and then uses **Drizzle ORM** to write to the **PostgreSQL** database hosted on **Supabase**. If they're upgrading, **Stripe** runs the checkout and tells my server via a webhook; if they want to leave a tip, the footer link sends them to **Ko-fi**. Transactional emails go out through **Resend**. **Sentry** captures crashes, **PostHog** tracks behavior, **Pino** writes structured logs, and **Upstash Redis** rate-limits abusive endpoints. **Recharts** draws the GPA chart, **driver.js** runs the new-user tour, and the brand assets (logo, mascot, favicons) came out of an offline pipeline of AI design tools. The course catalog itself was extracted from the school's annual PDF by a separate **Python + pdfplumber** script. **Vitest** and **Playwright** test all of this. The whole project lives on **GitHub**, where every PR triggers CI and a Vercel preview deploy. That's the whole stack in one paragraph — the rest of this doc just expands each piece.

---

## The framework: Next.js + React + TypeScript

**The problem:** I needed a web app with a frontend (the part the user sees) AND a backend (the part that talks to the database, processes payments, etc.). Most apps split these into two separate codebases. That's twice as much to manage.

**Next.js** lets me write both in the same project. Pages live in `app/(app)/` and API routes live in `app/api/v1/`. Same language, same imports, same deploy. It's built on top of **React**, which is the library that handles "when this state changes, update this part of the screen." Everything is written in **TypeScript** instead of plain JavaScript so the editor catches bugs before I run the code — like passing a string where the function wanted a number.

**Why it matters:** if you're solo, having one codebase for frontend + backend is a huge win. You're not switching mental models. You're just writing pages and route handlers in the same project.

---

## The database: PostgreSQL + Supabase + Drizzle ORM

This one trips people up because it's three things. They each do something different.

**The problem layer 1 — storage:** I need somewhere to permanently keep students' course plans, grades, accounts, subscriptions. **PostgreSQL** is the database itself — a battle-tested open-source SQL database. It just stores rows in tables.

**The problem layer 2 — hosting and extras:** I don't want to run a Postgres server myself. **Supabase** is a hosted Postgres-as-a-service that also gives me a bunch of stuff for free: row-level security, an admin UI, auth, storage. I treat it as "Postgres in the cloud, plus other helpful things."

**The problem layer 3 — talking to the database from code:** Writing raw SQL strings in TypeScript is error-prone. **Drizzle ORM** lets me describe my schema in TypeScript, then write queries that look like normal code. The compiler catches typos in column names. The schema lives in `lib/db/schema.ts` — one file, all 37 tables.

So the chain is: my TypeScript code → Drizzle (the translator) → PostgreSQL (the database) → hosted by Supabase (the platform).

---

## Auth: Supabase Auth

**The problem:** people need to log in. I need to know who's making each request. I do *not* want to write password hashing, session management, password reset emails, or OAuth from scratch. That's how you ship security holes.

**Supabase Auth** handles all of it. Email/password signup, Google OAuth, password reset flows, session cookies. My server-side code reads the session via `lib/auth/get-user.ts` and trusts what Supabase says about who the user is.

**Why it matters:** auth is one of the few areas where rolling your own is genuinely dangerous. Use a service. Move on.

---

## Sign in with Google: Google Cloud Console

**The problem:** asking users to make yet another password is a friction wall. A lot of people will bounce off the signup page rather than think up a new password. "Sign in with Google" gets them in with one click.

But "Sign in with Google" isn't a Supabase feature — Google has to *trust* my app first. That's what **Google Cloud Console** is for.

The flow: I created a project in the Google Cloud Console, enabled the OAuth consent screen, registered my app's authorized domains and redirect URLs, and got back a **client ID** and **client secret**. I gave those to Supabase Auth. Now when a user clicks "Sign in with Google" on my login page, Supabase redirects them to Google, Google checks their identity, and Google sends them back to my callback URL with a token. Supabase exchanges that token for a session, and from my code's perspective the user is just… logged in.

The only piece of Google Cloud I touch is the OAuth credentials. No servers, no APIs, no billing. It's a configuration step, not infrastructure. But you can't skip it — without those credentials Google has no idea who's asking it to verify users.

**Why it matters:** every "Sign in with X" button you've ever clicked has this same shape behind it. Once you understand the OAuth handshake for Google, the same pattern works for Apple, GitHub, Microsoft, anyone.

---

## Bot protection: hCaptcha

**The problem:** the moment your signup page goes live on the public internet, bots show up. They create thousands of fake accounts to test stolen credit cards, scrape your invite codes, or flood your contact form. Without protection, they can drain your free email tier, blow up your database, or get you flagged by your auth provider.

**hCaptcha** is the small "verify you're human" challenge that sits in front of every signup, login, password reset, and contact form. The user solves a quick puzzle (or invisible check), hCaptcha gives the browser a token, and my server verifies that token with hCaptcha's API before accepting the form. If the token's missing or invalid, the request is rejected before it touches Supabase.

I picked hCaptcha over Google's reCAPTCHA because it doesn't track users for ad targeting and it has a generous free tier. Wiring it in was a one-time thing: add the widget to the form, add the verification call to the server route, and put the hCaptcha origins in the Content Security Policy so the widget can load.

**Why it matters:** every public form is an attack surface. A captcha is the cheapest possible defense, and you'll be glad you added it the first time you check your error logs.

---

## Styling: Tailwind CSS

**The problem:** writing CSS in separate files, naming classes, and remembering what each class does is a nightmare in a multi-page app.

**Tailwind** flips it. Instead of writing `.button-primary { background: blue; padding: 8px 16px; ... }` in a CSS file, you write `<button className="bg-primary px-4 py-2">` directly. The styling lives next to the component. There's no naming, no hunting through stylesheets. The downside is your HTML looks busy, but for me the speed gain is worth it.

I also use **shadcn-style components** under `components/ui/` — these are pre-built buttons, inputs, cards, etc. that I copy into my project (not install as a dependency) so I can customize them.

---

## Brand and design assets: Claude, Ideogram, Recraft, remove.bg, vectorizer.io, RealFaviconGenerator

This is a cluster of tools, not one. I'm grouping them because they form a *workflow* — the pipeline I used to go from "the app needs a logo" to "every browser tab and OS shows the right icon at the right size."

**Step 1 — Brand strategy with Claude.** Before any image got generated, I used **Claude** (the chat AI on claude.ai, separate from Claude Code) as a design thinking partner. I'd describe what I was going for — friendly, trustworthy, aimed at high-school students and anxious parents — and we'd go back and forth on the name, the personality, the voice and tone, what the mascot should evoke. The output of this step wasn't an image. It was a brief: "an approachable purple genie, modern flat illustration, soft gradients, no clutter." That brief is what I fed into the image tools.

**Step 2 — Concept generation with Ideogram and Recraft.ai.** **Ideogram** is great when you need text inside the image (it gets letters right, which most image AIs still struggle with) — I used it for things like marketing banners and the wordmark prototype. **Recraft.ai** is stronger for design illustration and flat vector-style art — I used it for the mascot concepts, icons, and the marketing illustrations on the landing page. Same brief into both, picked the best result.

**Step 3 — Cleanup with remove.bg.** AI tools generate raster images on solid or busy backgrounds. To use the mascot on a card with a custom color, I needed a transparent PNG. **remove.bg** does one thing — strip the background — and does it shockingly well. Drop in the image, get back a clean PNG with the subject isolated.

**Step 4 — Vectorize with vectorizer.io.** A raster image only looks good at the resolution it was generated. The moment someone views it on a 4K display or zooms in, it gets pixelated. **Vectorizer.io** converts a PNG into an SVG — actual scalable vector paths instead of a grid of pixels. Once it's an SVG, it's crisp at any size, the file is tiny, and I can recolor it in code with CSS. The wordmark and the mascot in the app are both SVGs that started as raster AI output.

**Step 5 — Favicons with RealFaviconGenerator.** "Favicon" sounds simple — it's the little icon in the browser tab — but in reality you need about a dozen variants for different platforms: the legacy `.ico` file, multiple PNG sizes for different OSes, an Apple touch icon, an Android home-screen icon, a Microsoft tile, and a manifest file telling browsers which to use. **RealFaviconGenerator** takes one high-res master image, asks a few questions (background color, theme), and spits out the entire bundle plus the HTML tags to drop into my `<head>`. What would have been a half-day of fiddling becomes ten minutes.

The whole pipeline: **Claude (idea) → Ideogram or Recraft (raster image) → remove.bg (transparent PNG) → vectorizer.io (SVG) → RealFaviconGenerator (favicon bundle).**

**Why it matters for you:** none of this required a designer or a paid Figma seat. AI image tools have made it possible for one person to ship a brand that looks like a small studio worked on it. The trick is knowing the chain — generation alone gives you a flat raster image, which is *not* what a real product needs. The cleanup and conversion steps are what turn AI output into shippable assets.

---

## Payments: Stripe

**The problem:** I need to charge users for the Plus and Elite tiers. I don't want to handle credit card numbers ever — that's a compliance minefield (PCI DSS).

**Stripe** runs the entire checkout. The user clicks "upgrade," I send them to a Stripe-hosted checkout page, they pay Stripe, and Stripe sends a webhook to `/api/v1/stripe/webhook` saying "this user paid." My server then flips a `subscription` row in the database. I never see the credit card number.

The pattern is: **server creates a checkout session → user pays Stripe directly → webhook tells server it happened → server updates state.** Same shape works for one-time purchases, subscriptions, refunds, anything.

---

## Tips and donations: Ko-fi

**The problem:** not every user is going to upgrade to a paid tier, but some of them might want to support the project anyway. Stripe Checkout is overkill for "here's $5 because I like what you're building" — it requires me to set up products, taxes, receipts, the works.

**Ko-fi** is a hosted "buy me a coffee" page. I made an account, customized the page once, and dropped a small "Support" link in the footer of the app. Clicking it opens my Ko-fi page in a new tab. They take the payment, I see a notification. No code on my side. No webhook. No database row. Just a link.

The contrast is the lesson here: **Stripe is for the core business model (subscriptions). Ko-fi is for casual, optional support.** Different purposes, different tools. Wiring up Stripe for tip jars would have been a week of overengineering.

---

## Email: Resend

**The problem:** I need to send transactional emails — invite codes, password resets, "your trial is ending," etc. SMTP is ancient and configuring it correctly is painful.

**Resend** is a modern transactional email API. I write the email template as a React component (in `components/emails/`), call `resend.emails.send(...)` from my server, and it goes out. Resend also handles deliverability (the "did it actually land in their inbox" problem), which is harder than people realize.

---

## State management: Zustand + React Context

**The problem:** when the user makes a change in one component (say, dragging a course onto the planner), other components need to know about it (the GPA card, the validation report, the credit count). Passing data through every component manually gets messy fast.

**Zustand** is a tiny store — I define some shared state, and any component can read or update it. I use it for the planner's undo stack and the toast notifications. **React Context** is React's built-in version of the same idea — I use it for things that don't change often (like the current user/account info via `account-context.tsx`).

Rule of thumb: Context for "who is the user," Zustand for "what's the current planner state."

---

## Validation: Zod

**The problem:** when the frontend sends data to an API route, I have to assume that data is malformed or malicious until I check it.

**Zod** lets me describe what valid input looks like — "this is an object with a `courseId` (string) and a `semesterIndex` (number 0–7)" — and then either validates the input or returns a clean error. I use it on every API route. If the input doesn't match, the request is rejected before any database code runs.

---

## Monitoring: Sentry + PostHog + Pino

Three different things, often confused.

- **Sentry** — error tracking. When something throws an exception in production, Sentry catches it and tells me. With a stack trace, the user's browser, what they were doing. Saves hours of "what broke?"
- **PostHog** — product analytics. When users click things, view pages, complete flows, PostHog records events. I use it to answer "how many people who start onboarding finish it?"
- **Pino** — structured logging. My server writes JSON log lines (request paths, durations, errors) that I can search. Less flashy than Sentry, but invaluable when debugging weird production behavior.

Sentry catches *crashes*. PostHog tracks *behavior*. Pino records *what the server did*. Three different questions, three different tools.

---

## Rate limiting: Upstash Redis

**The problem:** if someone tries to brute-force invite codes or spam the contact form, I need to slow them down. Counting attempts per IP requires fast storage that's separate from my main database.

**Upstash Redis** is a serverless Redis (an in-memory key-value store). I use it for "this IP has tried to join 5 times in the last minute, block them." If Redis is unavailable, the rate limiter fails open — the request goes through rather than locking out real users.

---

## Charts: Recharts

**The problem:** the GPA trend chart on the progress page needs to render real data points as a smooth line. Doing this with raw SVG is awful.

**Recharts** takes my data array and renders a chart. That's it. One library, one job.

---

## Guided tour: driver.js

**The problem:** when a new student signs up, the dashboard is empty and confusing. I need to walk them through the first steps.

**driver.js** highlights specific elements on the page with a tooltip — "this is your planner, this is the course browser, click here to start." It's a tiny library that does exactly one annoying thing well.

---

## Testing: Vitest + Playwright

Two layers of tests because they answer two different questions.

- **Vitest** runs fast unit tests. "Does the GPA calculator return 3.85 when given these inputs?" These run in milliseconds. I have hundreds of them.
- **Playwright** runs end-to-end tests in a real browser. "If a user logs in, adds a course, and refreshes the page, is the course still there?" Slower (minutes), but tests the actual user experience.

The rule from my last writeup applies here: **bug fixes ship with tests in the same commit.** Whichever layer makes sense for the bug.

---

## AI: Anthropic Claude SDK

**The problem (future):** course recommendations and "smart alerts" — looking at a student's plan and saying "you're behind on math credits" or "this course load is unrealistic for senior year." That kind of fuzzy reasoning is what LLMs are good at.

The **Anthropic SDK** is installed but the AI features are mostly stubs right now. The architecture is in place — when I'm ready, the route handler will gather the student's plan, send it to Claude with a prompt, and stream the answer back. Worth wiring up early so the abstraction is in place.

---

## The course data pipeline: Python + pdfplumber

This is the part of the project that doesn't run in production at all. It runs *once a year*, on my laptop, when the school publishes its updated course catalog as a PDF.

**The problem:** Stevenson High School publishes its annual coursebook as one giant PDF — over 8 megabytes, two-column layout, hundreds of courses with codes, names, descriptions, prerequisites, credits, and grade-level eligibility. None of that data is in any structured format. The PDF is for humans, not computers. But the entire app is useless without that catalog data inside the database.

So I needed a one-shot pipeline: **PDF in → JSON out → loaded into Postgres.** That pipeline lives in `saps/extractor/`, written in Python (separate from the Next.js app) because PDF processing libraries are far better in Python than in JavaScript.

### The tools

- **Python 3.12+** — chosen specifically because the PDF and data-handling ecosystem in Python is a generation ahead of JavaScript's. The whole pipeline is a few hundred lines of Python.
- **pdfplumber** — the actual PDF parsing library. It opens the PDF, lets me read each page as text, and (critically) lets me crop the page by coordinates. The Stevenson coursebook is laid out in two columns, and a naive `extract_text()` call interleaves the left and right columns row-by-row, producing total garbage. The fix is to crop each page at the horizontal midpoint and process each column independently. This kind of geometric control is why pdfplumber wins for structured PDFs.
- **Regex + a hand-built parser** — once I have clean text, I use regular expressions to identify course headers (a code like `MTH 451`, a name, a credit value), then state-machine logic to gather the description and prerequisite block that follows.
- **A division map** — courses use codes like `MTH`, `ENG`, `CSC`. The catalog never spells out which division each code belongs to, so I keep a `DIVISION_MAP` constant that translates `"MTH" → ("Mathematics", "Mathematics")`, `"CSC" → ("Computer Science, Engineering and Technology", "Computer Science")`, etc. Maintaining this map is the only manual upkeep — when the school adds a new department, I add one line.
- **Manual override list** — a handful of course names are mangled by the PDF's text encoding. For those, I keep a small dictionary of overrides keyed by course code.
- **psycopg2-binary** — the PostgreSQL driver. The loader script reads the JSON the extractor produced and writes rows directly into the database using SQL. (I don't use Drizzle here because Drizzle is TypeScript and the extractor is Python — different worlds.)
- **pytest** — Python's standard test framework. The extractor has its own test suite that asserts "for this fixture PDF, we should produce these courses." If the parser regresses, the tests catch it before bad data gets near production.

### The pipeline

```
Source PDF ──▶ extract.py ──▶ YYYY-courses.json ──▶ loader.py ──▶ PostgreSQL
                  │                  │
                  │                  └─▶ YYYY-extraction-report.json
                  ▼                       (counts, warnings, anomalies)
              pdfplumber crops pages,
              parses each column,
              regex-matches courses,
              applies division map,
              writes structured JSON
```

The intermediate JSON file is *deliberate*. It means I can:

1. Re-run the extractor as many times as I want without touching the database.
2. Hand-inspect the JSON to verify the parse before loading.
3. Diff this year's JSON against last year's to see which courses were added, removed, or changed.
4. Hand-edit the JSON for one-off fixes if I find a bug after the fact.

The extraction report (`YYYY-extraction-report.json`) is a sanity check — it logs how many courses were found, how many had missing fields, and any oddities the parser couldn't classify. I read it every time I run the pipeline. If the count drops by 30 from last year, that's a signal something broke.

### Summer courses are their own pipeline

Summer school is published as a separate, smaller PDF in a different format. Rather than complicate the main extractor with conditionals, there's a parallel `extract_summer.py` plus a curated `summer_courses_2026.py` file that handles the cases where the PDF is too messy to parse cleanly. Two small focused pipelines beat one giant pipeline with a dozen branches.

### Why this matters for you

If you're building a product that depends on data from the real world — PDFs, scraped websites, public datasets — a one-shot extraction pipeline is a normal, useful pattern. It doesn't have to be elegant. It runs once and produces JSON. The JSON is the contract; everything downstream consumes JSON. If the PDF format changes next year, only the extractor breaks — the loader, the database, and the app stay the same.

The other lesson: **use the right language for each job.** Python for PDFs and data wrangling. TypeScript for the running web app. Don't force one language to do both poorly.

---

## Source control and collaboration: GitHub

**The problem:** I need somewhere to store the code, track changes over time, manage pull requests, run automated checks on every commit, and deploy from. Doing all of that on my laptop alone would be a disaster — one bad `rm -rf` and the project is gone.

**GitHub** is where the entire project lives. Every line of code, every PR, every issue, every rebase. The repo gets cloned to my laptop, I work on a feature branch, I push the branch up, GitHub renders the diff for me to review, and I merge through their UI. If my laptop dies tomorrow, the project is fine — GitHub has every version of every file going back to the very first commit.

GitHub also runs **CI checks** on every PR — automated runs of my type checker, linter, and test suite. The PR can't be merged unless those checks pass. And GitHub talks to Vercel: when I open a PR, Vercel automatically builds a preview deploy, posts the URL back into the PR, and lets me click through the changes in a real browser before I merge.

The other thing GitHub gives me is a **trail.** Every change has an author, a timestamp, a commit message, and a diff. When something breaks weeks later, I can `git blame` the line and find the exact commit and PR that introduced it. That history is worth more than the code itself.

**Why it matters:** version control is non-negotiable. GitHub is where solo projects become reviewable, recoverable, and deployable. Even on a project with one human collaborator (me), the discipline of commits + PRs is what kept the codebase from drifting into chaos.

---

## Domain: Namecheap

**The problem:** Vercel will happily host my app at some URL like `plan-with-genie.vercel.app`, but that's not a real product. I needed to own a real domain — `planwithgenie.com` — that I could put on business cards, in the email "from" line, and in marketing.

**Namecheap** is a domain registrar. I searched for the domain I wanted, paid them about $10/year, and now I "own" it (technically I lease it from ICANN, but close enough). After buying it I went into the Namecheap DNS dashboard and pointed the domain's DNS records at Vercel. Vercel handled the HTTPS certificate automatically.

That's it. Namecheap doesn't host the app. They don't see my traffic. They just tell the internet "when someone types planwithgenie.com, send them to Vercel." DNS is the phonebook of the internet, and Namecheap is one of many companies that lets you publish entries in it.

**Why it matters:** registrars are mostly interchangeable. Namecheap, Cloudflare, Google Domains — pick one, buy your domain, point it at your hosting. You don't need to think about it again until renewal.

---

## Hosting and deploy: Vercel

**The problem:** I need somewhere to actually run this app on the public internet, with HTTPS and automatic deploys when I merge a PR.

**Vercel** is the company that makes Next.js, so deploying a Next.js app there is one button. Every PR gets a preview deployment. Every merge to main goes to production automatically. I don't think about servers.

The full picture for "how does plan-with-genie.com reach my code": user types the domain → DNS (Namecheap's records) points at Vercel → Vercel runs my Next.js build → my code talks to Supabase and the third-party APIs. Three independent services with one job each, glued together by configuration.

---

## The architecture

Knowing the tools is one thing. Knowing how the project is *organized* is a different thing, and just as important. If you open the repo and don't know where to find anything, the tools don't help.

### Where things run

There are three runtime locations and two offline pipelines. First, the runtime picture:

```
                   User types planwithgenie.com
                              │
                              ▼
                Namecheap DNS → "send to Vercel"
                              │
                              ▼
   ┌────────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐
   │   User's browser   │ → │  Vercel (Next.js)   │ → │  Supabase / Postgres │
   │  React, Tailwind,  │   │  Pages + API routes │   │  Schema, RLS, Auth   │
   │  hCaptcha widget,  │   │  Auth helpers, Zod  │   │                      │
   │  Recharts, tour    │   │  Drizzle queries    │   │                      │
   └────────────────────┘   └─────────────────────┘   └──────────────────────┘
                                       │
                                       ▼
                    ┌────────────────────────────────────────┐
                    │  Third-party APIs (server-to-server)   │
                    │  Google OAuth (via Supabase),          │
                    │  Stripe, Resend, hCaptcha verify,      │
                    │  Sentry, PostHog, Upstash Redis,       │
                    │  Anthropic SDK                         │
                    └────────────────────────────────────────┘

           Direct browser-to-third-party (no server hop):
              Stripe Checkout (hosted page), Ko-fi link
```

The browser only ever talks to Vercel directly — except in two cases. The Stripe checkout flow sends the user to a Stripe-hosted page (so I never see the card), and the Ko-fi tip link opens in a new tab. Everything else (database writes, payment verification, email sends, error reporting) goes through Vercel first and out from there. The user never reaches Postgres directly — every database access goes through an API route on Vercel that has already authenticated the user.

Then there are two offline pipelines that produce inputs for the running app:

```
   Build / deploy:    GitHub PR ──▶ CI checks ──▶ Vercel preview / prod
   Course catalog:    Source PDF ──▶ Python extractor ──▶ JSON ──▶ Postgres
   Brand assets:      Claude → Ideogram/Recraft → remove.bg → vectorizer.io → /public
```

These don't run when a user clicks something. They run when *I* push code, when the school publishes a new catalog, or when I need a new logo. The output of each pipeline becomes input to the runtime stack.

### Code organization

The Next.js app lives in `saps/`. The Python PDF pipeline lives next to it under `saps/extractor/`. Documentation lives in a top-level `docs/` folder. Here's the full layout:

```
.
├── docs/                 Product, architecture, design, ops, security docs
└── saps/
    ├── app/              Next.js App Router — pages and API routes
    │   ├── (app)/        Authenticated pages (dashboard, planner, plans, transcript)
    │   ├── (auth)/       Login, signup, password reset
    │   ├── (onboarding)/ New-user onboarding flow
    │   ├── (public)/     Marketing pages (landing, about, contact)
    │   └── api/v1/       REST API routes (16 resource groups)
    ├── lib/
    │   ├── db/schema.ts  Drizzle schema — every table in one file
    │   ├── auth/         Session helpers, plan permissions
    │   ├── supabase/     Three client factories: server, client, admin
    │   ├── gpa/          GPA calculation engine
    │   ├── prereq/       Prerequisite DAG validation
    │   ├── stripe/       Subscription / checkout helpers
    │   ├── subscription/ Tier limits, gating helpers
    │   ├── email/        Resend wrapper + templates
    │   ├── analytics/    PostHog event helpers
    │   ├── audit/        Audit-log writers for sensitive actions
    │   ├── onboarding/   Onboarding state + checklist logic
    │   ├── planner/      Planner business logic (shared between client and server)
    │   ├── hooks/        React hooks (tour, undo stack, etc.)
    │   ├── api/          Response shape + error helpers
    │   ├── api-client.ts The frontend's HTTP client
    │   ├── account-context.tsx  React context for current user / account
    │   └── logger.ts     Pino logger setup
    ├── components/
    │   ├── ui/           Base components (Button, Input, Card, Toast, …)
    │   ├── planner/      Course planner grid components
    │   ├── plans/        Plan management components
    │   ├── charts/       Recharts wrappers
    │   └── emails/       React-rendered email templates
    ├── config/           App config (subscription tiers, grade scales, seeds)
    ├── extractor/        Python PDF extraction pipeline (separate from npm)
    │   ├── extract.py    Main coursebook extractor
    │   ├── extract_summer.py  Summer-school extractor
    │   ├── loader.py     Loads JSON output into Postgres via psycopg2
    │   └── tests/        pytest tests for the extractor
    ├── scripts/          Node utilities (db:seed, db:setup, env switcher)
    ├── worker/           Background job stubs (future)
    ├── public/           Static assets — logo, mascot SVG, favicon bundle
    └── tests/
        ├── unit/         Vitest unit tests
        └── e2e/          Playwright tests (api/, ui/, journeys/)
```

A few things worth calling out:

- **Route groups in parentheses** like `(app)` are a Next.js pattern — they're just folders for organizing pages, and they don't appear in the URL. So `app/(app)/planner/page.tsx` becomes `/planner`, and `app/(public)/about/page.tsx` becomes `/about`. The groups exist so each one can have its own layout (the authenticated layout has the sidebar; the public layout has the marketing nav).
- **`extractor/` is a separate Python project.** It has its own `requirements.txt`, its own `pytest` test suite, and never gets imported by the Next.js app. The connection point is the JSON file it produces, which `loader.py` writes into Postgres.
- **`public/`** is where browsers fetch static files directly — the logo, mascot SVG, and the favicon bundle from RealFaviconGenerator all live here.
- **`docs/`** is checked into git but never deployed. It holds product specs, architecture notes, the brand and voice guides, security audits, and these writeups.

### The layered architecture

Every feature flows through four layers, top to bottom:

1. **Pages and components** (`app/(app)/...`, `components/...`) — what the user sees and interacts with. React + Tailwind. No business logic here, just rendering and event handling.
2. **API client** (`lib/api-client.ts`) — the *only* way the frontend talks to the backend. One file, typed, used everywhere.
3. **API routes** (`app/api/v1/.../route.ts`) — the actual backend. Each one authenticates the user, validates input with Zod, calls the business logic, returns a typed response.
4. **Domain logic + database** (`lib/gpa/`, `lib/prereq/`, `lib/db/`) — the actual rules. GPA calculation, prerequisite validation, etc. Drizzle is the door to Postgres.

The reason for the layers: **each layer can only call the layer below it.** Pages don't talk to Drizzle. API routes don't render UI. The boundaries make it impossible to accidentally write database queries in a React component, which is a common way to leak data or break performance.

### The data model

The core tables are simpler than they sound:

- **`users`** — one row per person who's signed up. Linked to a Supabase Auth user.
- **`accounts`** — one row per *student*. The student is the center of everything. A student account holds all their plans, grades, and subscription.
- **`account_members`** — joins users to accounts with a role (student, parent, guardian, counselor). This is how parents and counselors get access to a student without owning the data.
- **`courses`** — the school's course catalog. 315 rows for Stevenson, refreshed yearly from the PDF.
- **`four_year_plans`** — a student can have multiple plans. One is marked primary.
- **`plan_courses`** — the actual placements. "Course X is in Year 2, Semester 1 of Plan Y."
- **`grades`** — when a student locks a semester, the grades land here.
- **`subscriptions`** — what tier the student is on, synced from Stripe via webhook.

The mental model: **the student owns the account, the account owns the plans, the plans own the course placements.** Other users (parents, counselors) attach to the student via `account_members`. That's the whole permission story.

### Auth and permissions

There are two flows worth understanding here: how a session gets *created*, and what happens on every subsequent request.

**Creating a session (signup or login):**

1. The user fills out the form. The browser solves the **hCaptcha** challenge and gets a token.
2. The form submits to my server route. The route first verifies the hCaptcha token by calling hCaptcha's API — if it's missing or invalid, return 400 immediately.
3. Then either: (a) for email/password, hand the credentials to **Supabase Auth**, which hashes and verifies them; or (b) for "Sign in with Google," redirect to Google's OAuth page (using the client ID I configured in **Google Cloud Console**), and Google redirects back to my callback URL with a token that Supabase exchanges for a session.
4. Supabase sets a session cookie on the response. The user is now logged in.

**Every subsequent API request:**

1. Read the Supabase session cookie.
2. Look up the user.
3. Check whether that user has the required role on the relevant account.
4. *Then* run the actual business logic.

If any of those steps fail, return 401 or 403 immediately. There's a helper in `lib/auth/plan-permissions.ts` that handles "can this user view / edit / delete this plan?" so the rules live in one place, not scattered across 50 routes.

Postgres also has **row-level security (RLS)** enabled on all tables as a second line of defense — even if a route handler forgot to check permissions, the database itself would refuse to return rows the user shouldn't see. Belt and suspenders.

The only code path that *deliberately* bypasses RLS is the Stripe webhook handler — it uses the `admin.ts` Supabase client because Stripe is the trusted caller and there's no logged-in user. That's why the three-clients folder structure matters: bypass-RLS is an opt-in import, not a default.

### Three Supabase clients, one purpose each

Inside `lib/supabase/` there are three different client factories, and which one you import matters:

- **`server.ts`** — used in API routes and server components. Reads the session cookie, acts as the user.
- **`client.ts`** — used in the browser. Same identity as `server.ts`, just running on the client side.
- **`admin.ts`** — used in trusted server-side code that needs to bypass RLS (like the Stripe webhook handler when it needs to update a subscription regardless of who's logged in). Uses the service role key. Never exposed to the browser.

Mixing these up is one of the most common ways to introduce a security bug. The folder structure makes the intent obvious every time you import.

### Configuration and environments

The whole app is configured by environment variables, kept in `.env.local`. There's a `.env.local.example` checked in showing every var the app needs (without the secret values). The vars come from every third-party service in the stack:

- **Supabase** — `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Google Cloud** — OAuth client ID and secret (registered in Supabase, not used in app code directly)
- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, plus the Plus/Elite price IDs
- **hCaptcha** — site key (public, in the form) and secret key (server, used to verify tokens)
- **Resend** — `RESEND_API_KEY` and the verified `from:` email
- **Sentry** — DSN for the Next.js SDK
- **PostHog** — project API key and host
- **Upstash Redis** — REST URL + token (optional; rate limiter fails open if absent)
- **Anthropic** — API key for the future AI features

A small script (`scripts/use-env.sh`) lets me switch between dev and prod env files when I need to point local dev at the prod database for one-off tasks. The seed script also refuses to run if it detects a `PRODUCTION_DATABASE` flag, as a safety guard.

For local development, I run a full Supabase stack locally via the Supabase CLI — Postgres on a high port, auth, the works. So I'm not hitting prod when I'm building. The local setup uses test keys for Stripe and hCaptcha so I can exercise the full flows without real charges or real captchas.

---

## How it all flows on a single user action

Let me walk through what happens when a logged-in student adds a course to their planner:

1. Student drags a course card onto a semester cell. **React** updates the UI optimistically.
2. The component calls `apiClient.updatePlanCourse(...)` which sends a `POST` to `/api/v1/plan-courses`.
3. The request includes a Supabase session cookie. Next.js routes it to the API handler.
4. The handler calls `getUser()` which uses **Supabase Auth** to verify the session and return the user.
5. The body is validated with **Zod** — if it's malformed, return 400.
6. **Drizzle** runs an `INSERT` against **PostgreSQL** on **Supabase**. Drizzle also ensures the user owns the plan they're modifying.
7. If the insert violates a check constraint (say, exceeding the plan's course load), Postgres rejects it and Drizzle throws. The handler catches that and returns 422.
8. On success, the handler returns the updated plan-course row.
9. **React** receives the response and confirms the optimistic update.
10. **PostHog** logs a `plan_course_added` event for analytics.
11. If anything in steps 4–8 threw an unexpected exception, **Sentry** captures it.
12. **Pino** has been logging the request the whole time.

That's twelve steps and seven different tools, all for *one click*. But each tool is doing a job none of the others can do well.

---

## How I picked all this

Honestly? I didn't pick most of it from scratch. I asked Claude "what's the standard modern stack for a SaaS web app in 2026?" and most of these names came up. I researched each one before adding it, asked "what problem does this solve?" — and if I couldn't answer that in one sentence, I didn't add it.

The two filters I used:

1. **Does this solve a real problem I have right now?** Not "might have someday." Right now.
2. **Is it the standard, boring choice?** New shiny tools have more bugs and worse docs. Boring choices have huge communities and Stack Overflow answers for every error message.

That's it. No magic. Just "what's the boring choice that solves my actual problem."

---

## Takeaway for you

When you start your project, you'll be tempted to pick tools because they look cool. Don't. Pick tools because they solve a specific problem you actually have. If you're building a static site, you don't need a database. If you have ten users, you don't need analytics. If you're not charging money, you don't need Stripe.

Add tools when you hit the problem they solve. Not before.

The other thing: most of this stack is free at my scale. Vercel free, Supabase free, GitHub free, Stripe (only pay per transaction), Resend free for the first 3,000 emails/month, Sentry free for small projects, PostHog free up to 1M events, hCaptcha free for low traffic, Upstash free tier, Google Cloud OAuth free, Ko-fi free (small cut on tips). The handful of things I actually pay for are tiny — Namecheap (~$10/year for the domain), the AI image tools when I'm generating brand assets, and Anthropic API tokens whenever I use them. Total ongoing cost is something like $1/month plus whatever I spend on AI usage. You can build a real product for almost nothing until you have actual users.

If you ever wonder *why* a tool is in the stack, ask "what problem does this solve?" If you can't answer, take it out. Simple.

— Krishna
