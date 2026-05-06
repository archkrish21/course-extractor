# How I built Plan with Genie with Claude Code

Hey — you've been asking me how I've been building Plan with Genie, and I figured the most useful thing I could do is write down what actually happened. Not a tutorial. A story, with the mistakes included, because the mistakes are where the real lessons are.

This is for you specifically: you're new to Claude Code and you've got ideas you want to ship. I'm not a senior engineer. I'm a junior in high school who started this project with zero lines of code and a Google Doc full of half-baked thoughts. There's now a real Next.js app with auth, payments, hundreds of tests, and a working four-year course planner. Claude Code did the typing. I did the steering. This is how the steering worked.

---

## What this is, and what it isn't

Claude Code is an AI agent that runs in your terminal. It reads your files, edits them, runs commands, runs tests. Treat it like a contractor who's incredibly fast, never tired, and has read every framework — but **does not know your project, your taste, or what "done" means**.

That last sentence is the entire job. You're not "prompting an AI." You're managing a junior dev who codes at 10x speed. The work is in giving them context, rails, and review.

---

## Start with a spec, not with code

This is the part I think most people skip and then suffer for.

Before I let Claude write any application code, I made it write **planning docs**. Four of them, actually:

- `EXECUTIVE_SUMMARY.md` — the pitch. Who is this for, what does it solve, why now.
- `PRODUCT_REQUIREMENTS.md` — every feature, every user role, every edge case.
- `FEATURE_ANALYSIS.md` — feature-by-feature breakdown.
- `TECH_DESIGN_DOC.md` — the architecture: Next.js, Postgres, Supabase, schema sketch.

Together they were over 5,000 lines. Sounds insane. It wasn't. Here's why it mattered:

When I finally said "okay, scaffold the first phase," Claude already knew what it was building. It produced 315 courses extracted from the Stevenson catalog PDF, a 32-table database schema, the course browser with filters, a 4-year planner grid, prerequisite validation, GPA calculation, and a plan-template system — all in one go. It worked because the spec was already written down.

If I'd just typed "build me a course planner app," I would have gotten random garbage and spent forever rewriting it.

**Takeaway for you:** before you let it write code, make it write the spec. Argue with it. Ask "what am I missing?" Force yourself to be specific about who the user is and what the smallest valuable version looks like. The doc is the contract. Without it, the agent invents the contract for you, and you'll hate what it invents.

---

## The mistake I made early: skipping branches and PRs

After the initial scaffold I went hard. Big features, fast. Stripe billing in one session. Email invites and the join flow in another. A "design system sweep across all 22 pages + 113 new tests" in one giant commit.

Here's the embarrassing truth: **I was committing directly to `main`. No branches. No PRs.** Just `git add`, `git commit`, `git push`. Claude was happy to help.

This worked until it didn't.

What went wrong: when something broke, I had no clean place to roll back to. When Claude "fixed" 462 E2E test failures by changing 30 files, I couldn't review it page by page — it was already on main. When I wanted to try a risky refactor, I had to do it live or stash everything. I was moving fast in the worst possible way: fast and reckless.

I want to be honest with you that this is what happened, because the lesson is more valuable than pretending I did it right from the start.

---

## The turning point: writing rules into CLAUDE.md

Eventually two things happened together:

1. I opened my first real pull request from a feature branch.
2. I added a hard rule to my project's `CLAUDE.md`: **"Never commit directly to main."**

`CLAUDE.md` is a file in your repo root that Claude Code reads automatically every session. Anything you put there becomes a standing instruction. That single line — "never commit directly to main" — changed how I worked for the rest of the project.

Soon after, I added another: **"Always rebase feature branches on main before opening a PR."** Then a pre-push git hook to enforce it. Both went in because I'd gotten burned by stale branches that conflicted with main when I tried to merge.

The pattern I learned: **every time I corrected Claude on the same thing twice, I wrote it into `CLAUDE.md`.** That stopped me from having to repeat myself, and it stopped Claude from drifting. By now my `CLAUDE.md` has rules about brand voice, sentence-case button labels, the test discipline I expect on every bug fix, and which branches deploy to prod.

There's also an auto-memory system that persists *across* conversations — so if I tell Claude "remember that I want you to ask before resolving merge conflicts," it'll remember that next session, and the one after, forever. I use it for the smaller, more personal stuff. Project rules go in `CLAUDE.md`. Personal preferences go in memory.

**Takeaway for you:** start with a `CLAUDE.md` from the very beginning. Even if it just says "always make a branch, always open a PR, never push to main." Add to it as you go. The rules don't have to be smart. They just have to be written down.

---

## How I actually work now

Once the PR workflow stuck, the loop became this. Every feature, no exceptions:

1. **Branch off main.** `git checkout -b feat/whatever`.
2. **Tell Claude the feature in plain English.** What it should do, where it fits, what *not* to touch. Point at specific files when I can.
3. **Read the diff before I run anything.** Even if the diff is 200 lines. Especially if the diff is 200 lines.
4. **Run the app locally.** Click the thing. Try edge cases on purpose.
5. **Tests live in the same commit as the fix.** Not "I'll add them later." Same commit.
6. **Rebase on main once, right before opening the PR.** Not constantly. Once.
7. **Open the PR, review my own diff like a stranger wrote it, and merge it myself.**

That last word is important: **myself.** Claude doesn't merge PRs. I do. The merge button is the moment code goes to production, and I'm not letting an agent decide that. PR creation is fine — it's reversible. Merging isn't.

You'll notice this loop is small. That's deliberate. If a session sprawls into "fix the bug, then refactor the planner, then update the docs," I lose the thread, the diffs become unreviewable, and bugs ship. **One thing per session.** When a session ends up doing too much, I throw it away and start fresh with a tighter prompt.

---

## How I keep it focused

This is the stuff I wish someone had told me earlier:

- **Point at files.** "Fix the prerequisite validator" is bad. "In `lib/prereq/validator.ts`, fix the case where a higher-level course should satisfy a lower-level prereq" is good. File paths give the agent ground truth.
- **Tell it what *not* to do.** "Don't change the database schema." "Don't add new dependencies." Negative constraints are underrated — they shrink the blast radius dramatically.
- **Ask for a plan first.** For anything non-trivial, I ask Claude to *just write a plan, no code*. I review the plan. Then I say "go." This catches bad approaches before any code gets written.
- **Use sub-agents.** When I need to search the codebase, I use the **Explore** agent — it runs in its own context so my main session stays clean. When I need a real implementation plan, I use the **Plan** agent. Same principle: keep the main session focused on the actual work, not the research.
- **Slash commands for repeatable workflows.** I have a `/frontend` and `/backend` skill that loads my project's UI and API conventions before any new work. So I don't have to re-explain "use sentence case" or "all routes go through this auth helper" every session. The skill loads them automatically.

---

## The four ways I customize Claude Code

Out of the box, Claude Code is generic. It doesn't know my project, my preferences, or the patterns I want to follow. The longer I worked on Plan with Genie, the more I realized there are *four* distinct mechanisms for teaching it — and they each solve a different problem. If you confuse them, you'll either over-stuff one or under-use another.

### 1. `CLAUDE.md` — project rules that everyone shares

**What it is:** a markdown file at the root of your repo. Claude Code reads it automatically at the start of every session. Anything in it becomes a standing instruction.

**The problem it solves:** project-specific rules. Things that are true *for this codebase* and should apply to every contributor (even if right now that's just me). My `CLAUDE.md` includes "never commit directly to main," "always rebase before opening a PR," "the product is called Plan with Genie, not SAPS," "use sentence case for buttons except for proper nouns like AP and GPA Waiver," and "all deploys come from `main`, never from `prod`."

**How I use it:** every time I correct Claude on the same thing twice, I add a line to `CLAUDE.md`. That's the whole heuristic. The rules don't need to be smart — they just need to be written down. Because the file is checked into git, anyone who clones the repo gets the same rules. It's the codified contract between me and the agent.

### 2. Memory — personal continuity across conversations

**What it is:** a separate, file-based system that lives outside the repo (in my Claude Code config on my laptop). It stores user preferences, project context, and feedback patterns that persist across *every conversation*, not just the current session.

**The problem it solves:** repetition across sessions. I shouldn't have to tell Claude every single time that "I'm a junior in high school," "don't pigeonhole me as a CS applicant in marketing copy," or "never resolve merge conflicts autonomously — always ask me first." With memory, I tell it once, and the next session already knows.

**How I use it:** when Claude does something I want to keep doing (or correct it on something), I tell it to remember. It writes a small file with a name and description. Future sessions read those files automatically. By now my memory has notes about who I am, my project goals, my collaboration style, and a long list of corrections that have hardened into rules.

**The big distinction:** `CLAUDE.md` is *project* scope (lives in git, applies to anyone working on this repo). Memory is *user* scope (lives on my machine, applies to me across all my projects). I use both because they answer different questions: "what does this project require?" vs. "what does *Arun* prefer?"

### 3. Skills — packaged domain knowledge that loads on demand

**What it is:** a self-contained bundle of instructions and patterns for a specific domain. You install a skill once, and Claude can invoke it when relevant. Skills can be shipped by Anthropic, by the community, or written by me for my own project.

**The problem it solves:** context bloat. If I dumped every UI convention, every API pattern, every git rule into `CLAUDE.md`, the file would be enormous and Claude would have to re-read all of it on every session — diluting attention and burning tokens. Skills fix that by being **loaded only when needed.**

**How I use it:** I have a `/frontend` skill that contains all my UI conventions (component APIs, design tokens, accessibility requirements, form patterns). I have a `/backend` skill that contains all my API patterns (route handler anatomy, auth helpers, Drizzle query patterns, Zod validation). When I'm about to start a new piece of UI work, I run `/frontend` first — Claude loads the skill, now it knows my conventions, and the rest of the session benefits from that context. Same for backend work. There's also `/git-rules` for branch ops, `/review` for PR reviews, and `/security-review` for security passes.

The mental model: **`CLAUDE.md` is what's true for the whole project. Skills are what's true for a specific kind of task.**

### 4. Slash commands — the keyboard-friendly entry point

**What it is:** anything I type starting with `/` is a command. Some are built into Claude Code (`/help`, `/clear`, `/config`, `/memory`). Others are skills I (or the community) wrote — `/frontend`, `/backend`, `/grill-me`, `/loop`, `/schedule`. Typing the slash is just the way to invoke them.

**The problem it solves:** discoverability and speed. Instead of writing a paragraph of instructions to start a UI task, I type `/frontend` and Claude loads everything it needs. Slash commands are the user interface to skills and built-in features.

**How I use it:** like keyboard shortcuts. `/frontend` to start UI work. `/backend` to start API work. `/review` when I want a code review. `/security-review` before merging anything that touches auth or payments. `/loop` when I want Claude to retry something on a timer. `/schedule` to set up a recurring agent run. The full list lives in the autocomplete — I just type `/` and browse.

---

### Putting them together

Here's how the four mechanisms layer in practice. Imagine I sit down to add a new feature on the planner page:

1. **Memory** has already loaded — Claude knows I'm a high schooler building this solo, that I want to be asked before risky operations, and that I prefer a certain tone.
2. **`CLAUDE.md`** has already loaded — Claude knows the project rules: branch + PR, sentence case, rebase before push, tests with fixes.
3. I type **`/frontend`** — Claude loads the UI skill, now it knows my component APIs and design tokens.
4. I type the actual feature request: *"In `components/planner/grid.tsx`, add a tooltip on locked cells explaining why they're locked. Don't change the schema."*

That last prompt is short because the first three layers have already established context. Without them, that prompt would have to be five paragraphs. With them, it's one sentence and Claude has everything it needs.

**Takeaway for you:** treat these four mechanisms as a stack. Memory is *you*. `CLAUDE.md` is *the project*. Skills are *the task*. Slash commands are *how you invoke them*. Build all four up over time and your prompts get shorter while your output gets better.

---

## A real example: the rebrand

At some point I decided the original product name "SAPS" was terrible. I wanted to rebrand the whole product to **Plan with Genie**.

If I'd done this in one session, it would've been a mess — the name appears in UI copy, emails, the database, marketing pages, the README, the docs, everywhere. So I broke it up into a sequence of small PRs:

- One PR for the brand itself: logo, mascot, wordmark.
- One PR for the rename across UI and emails.
- One PR for the voice and tone guide as a new doc.
- A handful of PRs that rolled the voice framework out across error pages, modals, settings, auth, app pages, and marketing — *one PR per surface area.*
- Several more PRs for the brand redesign: tokens, fonts, hero, dark mode, error pages, marketing polish.

Each PR was small enough for me to actually review. If I'd tried to ship "rebrand the whole app" as one PR, I would've missed half the rough edges. Splitting it cost almost nothing — Claude is fast — and the quality was way higher.

**Takeaway:** even big projects are a sequence of small PRs. Resist the urge to do everything at once.

---

## Tests: the part I learned the hard way

I had one mortifying moment: **462 E2E tests failed at once.** A single ambiguous selector had broken the entire suite. I'd been writing tests, but I hadn't been disciplined about them — I'd let Claude "make the tests pass" by patching around real bugs instead of fixing root causes.

After that I added a hard rule: **bug fixes ship with tests in the same commit, and the test must be one that would have caught the bug.** No exceptions. If Claude says "the tests pass," I check what they actually test.

I also stopped trusting "all tests pass" as a signal that a feature works. Tests pass on broken UX all the time. For UI work, I open the browser and click the feature myself. Type checks and unit tests verify *correctness*, not *usefulness*. You have to verify usefulness yourself.

---

## Mistakes that taught me the most

I'll just list them so you can avoid the same ones:

- **Committing directly to main.** Cost me real recovery work. Fixed by adding a hard rule.
- **Vague prompts.** "Make the planner better" returned 600 lines of nothing. Specific prompts return specific code.
- **Trusting "tests pass."** Tests passed; the feature was broken in the browser. Now I always click through.
- **Auto-resolving merge conflicts.** Claude once resolved a conflict by deleting the side it didn't understand. Now I do conflicts myself.
- **Skipping the diff review when I was tired.** This is when bugs shipped. If you're too tired to read the diff, you're too tired to merge.
- **One-prompt mega-features.** "Add Stripe billing" worked, but reviewing 2000 lines was a nightmare. Now I split it: schema first, then API, then UI, then tests. Four PRs.

---

## Cheat sheet for you

| Situation | What to do |
|---|---|
| Starting a new project | Write planning docs *before* any code |
| Starting a new feature | New branch, fresh session, point at files, give negative constraints |
| Same correction twice | Write the rule into `CLAUDE.md` |
| About to do something risky | Ask Claude to explain why first |
| Need to search the codebase | Use the Explore sub-agent |
| Need a plan before coding | Ask Claude to write the plan, no code, then review it |
| About to push | Run tests, run the app in a browser, read the diff |
| About to merge | You merge. Never the agent. |
| Session is sprawling | Stop, throw it away, start fresh with a tighter scope |

---

## The real lesson

Claude Code didn't build Plan with Genie. **I built Plan with Genie**, with Claude Code as the most leveraged tool I've ever used. That distinction is everything.

The agent is fast. It doesn't get tired. It can write a feature in twenty minutes that would take me a day. But it doesn't know what good looks like for *your* product. You do. Your job is to:

- Define what you're building and write it down before any code.
- Set the rules and put them in `CLAUDE.md` so the agent follows them every session.
- Break work into small, reviewable PRs.
- Read every diff. Run every change. Test every fix.
- Keep the merge button in your hand.

Do that, and a 17-year-old with no formal training can ship a real product. I'm proof. Plan with Genie has subscriptions, role-based access, three roles, prereq validation with a rigor ladder, summer course handling, GPA snapshots, plan sharing, email invites, and hundreds of tests. None of it existed before I started.

If you want to start: pick something small and real. Not "the next big startup." Pick "an annoying thing in my life I want to fix." That's how this started — I was tired of planning courses in spreadsheets.

DM me when you start. I'll review your `CLAUDE.md`.

— Krishna
