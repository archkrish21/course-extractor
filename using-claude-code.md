# How I built Plan with Genie with Claude Code

Hey — you've been asking me how I've been building Plan with Genie, and I figured the most useful thing I could do is write down what actually happened, week by week. Not a tutorial. A story, with the mistakes included, because the mistakes are where the real lessons are.

This is for you specifically: you're new to Claude Code and you've got ideas you want to ship. I'm not a senior engineer. I'm a junior in high school who started this project on **March 26, 2026** with zero lines of code and a Google Doc full of half-baked thoughts. About six weeks later there's a real Next.js app with auth, payments, hundreds of tests, and a working four-year course planner. Claude Code did the typing. I did the steering. This is how the steering worked.

---

## What this is, and what it isn't

Claude Code is an AI agent that runs in your terminal. It reads your files, edits them, runs commands, runs tests. Treat it like a contractor who's incredibly fast, never tired, and has read every framework — but **does not know your project, your taste, or what "done" means**.

That last sentence is the entire job. You're not "prompting an AI." You're managing a junior dev who codes at 10x speed. The work is in giving them context, rails, and review.

---

## Day 1 — March 26: I didn't write a line of code

This is the part I think most people skip and then suffer for.

Before I let Claude write anything, I made it write **planning docs**. Four of them, actually:

- `EXECUTIVE_SUMMARY.md` — the pitch. Who is this for, what does it solve, why now.
- `PRODUCT_REQUIREMENTS.md` — every feature, every user role, every edge case.
- `FEATURE_ANALYSIS.md` — feature-by-feature breakdown.
- `TECH_DESIGN_DOC.md` — the architecture: Next.js, Postgres, Supabase, schema sketch.

Together they were over 5,000 lines. Sounds insane. It wasn't. Here's why it mattered:

When I finally said "okay, scaffold Phase 1," Claude already knew what it was building. It produced **315 courses extracted from the Stevenson catalog PDF, a 32-table database schema, the course browser with filters, a 4-year planner grid, prerequisite validation, GPA calculation, and a plan-template system — all in one day**. One commit. It worked because the spec was already written down.

If I'd just typed "build me a course planner app," I would have gotten random garbage and spent the next week rewriting it.

**Takeaway for you:** before you let it write code, make it write the spec. Argue with it. Ask "what am I missing?" Force yourself to be specific about who the user is and what the smallest valuable version looks like. The doc is the contract. Without it, the agent invents the contract for you, and you'll hate what it invents.

---

## Weeks 1–3: Building fast, breaking things (April 1 – April 14)

After the initial scaffold I went hard for about three weeks. Big features, fast. Stripe billing in one session. Email invites and the join flow in another. A "design system sweep across all 22 pages + 113 new tests" in one giant commit.

Here's the embarrassing truth: **I was committing directly to `main`. No branches. No PRs.** Just `git add`, `git commit`, `git push`. Claude was happy to help.

This worked until it didn't.

What went wrong: when something broke, I had no clean place to roll back to. When Claude "fixed" 462 E2E test failures by changing 30 files, I couldn't review it page by page — it was already on main. When I wanted to try a risky refactor, I had to do it live or stash everything. I was moving fast in the worst possible way: fast and reckless.

I want to be honest with you that this is what happened, because the lesson is more valuable than pretending I did it right from day one.

---

## April 16: The turning point

After three weeks of cowboy commits, two things happened on April 16:

1. I opened my first real pull request from a feature branch (`auth-hardening`).
2. I added a hard rule to my project's `CLAUDE.md`: **"Never commit directly to main."**

`CLAUDE.md` is a file in your repo root that Claude Code reads automatically every session. Anything you put there becomes a standing instruction. That single line — "never commit directly to main" — changed how I worked for the rest of the project.

A day later I added another: **"Always rebase feature branches on main before opening a PR."** Then a pre-push git hook to enforce it. Both went in because I'd gotten burned by stale branches that conflicted with main when I tried to merge.

The pattern I learned: **every time I corrected Claude on the same thing twice, I wrote it into `CLAUDE.md`.** That stopped me from having to repeat myself, and it stopped Claude from drifting. By now my `CLAUDE.md` has rules about brand voice, sentence-case button labels, the test discipline I expect on every bug fix, and which branches deploy to prod.

There's also an auto-memory system that persists *across* conversations — so if I tell Claude "remember that I want you to ask before resolving merge conflicts," it'll remember that next session, and the one after, forever. I use it for the smaller, more personal stuff. Project rules go in `CLAUDE.md`. Personal preferences go in memory.

**Takeaway for you:** start with a `CLAUDE.md` from day one. Even if it just says "always make a branch, always open a PR, never push to main." Add to it as you go. The rules don't have to be smart. They just have to be written down.

---

## After April 17: How I actually work now

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

## A real example: the rebrand

About a month in (April 22), I decided the original name "SAPS" was terrible. I wanted to rebrand the whole product to **Plan with Genie**.

If I'd done this in one session, it would've been a mess — the name appears in UI copy, emails, the database, marketing pages, the README, the docs, everywhere. So I broke it up:

- **PR #67** — the brand itself: logo, mascot, wordmark.
- **PR #71** — rename SAPS to Plan with Genie across UI and emails.
- **PR #73** — voice and tone guide as a new doc.
- **PRs #74 / #75 / #76 / #77 / #78** — the voice framework rolled out across error pages, modals, settings, auth, app pages, and marketing. *Five separate PRs, one per surface area.*
- **PRs #81–#88** — the brand redesign: tokens, fonts, hero, dark mode, error pages, marketing polish.

Each PR was small enough for me to actually review. If I'd tried to ship "rebrand the whole app" as one PR, I would've missed half the rough edges. Splitting it cost almost nothing — Claude is fast — and the quality was way higher.

**Takeaway:** even big projects are a sequence of small PRs. Resist the urge to do everything at once.

---

## Tests: the part I learned the hard way

Around April 8 I had a mortifying moment: **462 E2E tests failed at once.** A single ambiguous selector had broken the entire suite. I'd been writing tests, but I hadn't been disciplined about them — I'd let Claude "make the tests pass" by patching around real bugs instead of fixing root causes.

After that I added a hard rule: **bug fixes ship with tests in the same commit, and the test must be one that would have caught the bug.** No exceptions. If Claude says "the tests pass," I check what they actually test.

I also stopped trusting "all tests pass" as a signal that a feature works. Tests pass on broken UX all the time. For UI work, I open the browser and click the feature myself. Type checks and unit tests verify *correctness*, not *usefulness*. You have to verify usefulness yourself.

---

## Mistakes that taught me the most

I'll just list them so you can avoid the same ones:

- **Committing directly to main** for three weeks. Cost me real recovery work. Fixed by adding a hard rule.
- **Vague prompts.** "Make the planner better" returned 600 lines of nothing. Specific prompts return specific code.
- **Trusting "tests pass."** Tests passed; the feature was broken in the browser. Now I always click through.
- **Auto-resolving merge conflicts.** Claude once resolved a conflict by deleting the side it didn't understand. Now I do conflicts myself.
- **Skipping the diff review when I was tired.** This is when bugs shipped. If you're too tired to read the diff, you're too tired to merge.
- **One-prompt mega-features.** "Add Stripe billing" worked, but reviewing 2000 lines was a nightmare. Now I split it: schema first, then API, then UI, then tests. Four PRs.

---

## Cheat sheet for you

| Situation | What to do |
|---|---|
| Starting a new project | Spend a day on planning docs *before* any code |
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

The agent is fast. It doesn't get tired. It can write a feature in 20 minutes that would take me a day. But it doesn't know what good looks like for *your* product. You do. Your job is to:

- Define what you're building and write it down before any code.
- Set the rules and put them in `CLAUDE.md` so the agent follows them every session.
- Break work into small, reviewable PRs.
- Read every diff. Run every change. Test every fix.
- Keep the merge button in your hand.

Do that, and a 17-year-old with no formal training can ship a real product. I'm proof. Plan with Genie has subscriptions, role-based access, three roles, prereq validation with a rigor ladder, summer course handling, GPA snapshots, plan sharing, email invites, and over 300 tests. Six weeks ago none of it existed.

If you want to start: pick something small and real. Not "the next big startup." Pick "an annoying thing in my life I want to fix." That's how this started — I was tired of planning courses in spreadsheets. Six weeks later, here we are.

DM me when you start. I'll review your `CLAUDE.md`.

— Arun
