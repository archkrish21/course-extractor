# The Plan with Genie business, explained

This is the third companion doc. The first one was *how* I built this thing (with Claude Code as the partner). The second one was *what I built it with* (the tech stack). This one is *why it exists* — the actual business problem it solves, who I built it for, and what's inside the product.

I'm writing this for you because you're thinking about building something yourself, and "what tech stack do I use" is the easy question. The hard question is "is anyone going to care?" Here's how I tried to answer that for Plan with Genie.

---

## The problem in three sentences

Picking high school courses is one of the highest-stakes decisions a teenager makes, and the tools we're given to make it are terrible. Right now, a kid at my school plans their entire four-year course load using a Google Sheet, an annual catalog PDF, and two thirty-minute meetings with a counselor who's juggling 400 other students. The result is bad plans, missed prerequisites, last-minute panic in junior year, regreting the missed courses/opportunities and college applications that look weaker than they should.

That's the problem. Plan with Genie is a structured tool that replaces the spreadsheet — it knows the catalog, it knows the prerequisites, it knows what counts toward graduation, and it watches what happens when you change something.

---

## Who it's for

There are four kinds of people involved in any high schooler's course planning. Plan with Genie has roles for all of them — though only three are turned on right now.

- **Students.** The primary user. They build the plan, track their grades, and own all the data. Everything else exists to support them.
- **Parents.** Want visibility into what their kid is taking, the GPA trajectory, and the path to graduation — without having to ask "did you do your homework" every night. Parents can create draft plans for their child to review, but they can't change a plan the student has marked primary.
- **Guardians.** Same behavior as parents in the system — separate role label for clarity (foster parents, grandparents, legal guardians).
- **Counselors.** Read-only access to linked student plans, with a future "comments" feature so they can leave suggestions without editing. *This role is built but hidden in v1.* The schema, permissions, and invite flow are all in place — the UI is just gated off until I'm ready to talk to schools.

The mental model: **the student is the center.** They own their account. Parents, guardians, and (eventually) counselors *attach* to a student via email invites. They never own the data; they just have access to it. This matters because it sidesteps a hard problem: a student who turns 18, or transfers schools, or leaves their parents' household, takes their own data with them. No transfer of ownership required.

---

## The three things it does

Different features, but they cluster into three pillars. Every feature in the product fits into one of these.

### 1. Planning — "what should I take?"

This is the headline feature. A student opens the planner and sees an 8-semester grid (4 years × 2 semesters). They drag courses from a catalog of 315 Stevenson courses into each semester. As they drop a course in, the system checks:

- Does this course have prerequisites? Have the prerequisites been placed in earlier semesters? (And it understands the **rigor ladder** — taking AP Calculus BC satisfies a Pre-Calc prerequisite, because AP Calc *is* a higher-level Pre-Calc.)
- Is this course offered at the student's grade level for this semester?
- Does it conflict with another course in the same slot?
- Is the semester overloaded or underloaded relative to graduation requirements?

Students can have **multiple plans** in parallel — a "balanced" plan, a "stretch" plan, a "definitely surviving" plan — and compare them side by side. One plan is marked primary; that's the one that flows into the rest of the app. They can start from scratch or from one of six **plan templates** at different intensity levels (general, college-prep, honors, AP-heavy, STEM-focused, humanities-focused).

The catalog also handles **summer courses** — Stevenson runs a separate summer program with its own credit rules. Plan with Genie shows summer courses in dedicated rows above each school year, lets students place them, and counts them toward graduation requirements.

When a student finishes a school year, a **year-end wizard** walks them through entering grades, locking the semester, and rolling forward. Locked semesters become part of their official record; future semesters are still editable.

### 2. Tracking — "where am I right now?"

Once a plan exists, the tracking engine answers questions a student would otherwise need to do math for.

- **GPA calculation.** Both *projected* (based on placed courses and target grades) and *actual* (based on grades they've entered for completed semesters). It handles weighted GPA (honors + 0.5, AP + 1.0), pass/fail courses correctly, and respects the school's grade scale (5.0 max for AP).
- **GPA trend chart.** A line chart on the progress page showing GPA semester by semester. Auto-snapshots are taken at semester completion, grade lock, and year-end so the chart is real history, not recomputed every load.
- **Graduation requirement validation.** Stevenson's grad requirements are split into four groups (subject minimums, total credits, electives, PE/health) covering 37 individual requirements. Plan with Genie shows progress on each one and flags shortfalls before they become a problem.
- **Honors and graduation cards.** Visual badges showing where the student stands on honors-level metrics, GPA bands, and credit milestones.
- **A validation report.** A single screen that lists every problem with the current plan: missing prereqs, requirement gaps, semester overloads, ineligible course placements. Students can click a problem and jump to where it is.
- **Cascading grade lock.** Once a student locks a semester, future semesters can't be edited above it. Unlocking a semester cascades — unlock fall 2024, and spring 2024 unlocks too. This prevents partial-history corruption.

### 3. Advisory — "what should I do next?" *(in progress)*

This is the future-facing pillar and the main reason a family would pay for the **Elite** tier. Right now the AI features are stubs and the abstraction is wired up but not turned on. The plan:

- **AI course recommendations.** Given the student's interests, current plan, and grade history, suggest courses for unfilled semesters — grounded in the actual catalog so it can't hallucinate fake courses.
- **AI plan review.** "Look at my plan and tell me what's wrong with it" — checks for risk factors a 17-year-old might not notice (e.g., scheduling AP Bio and AP Physics in the same semester is brutal).
- **AI chat.** A planning assistant the student can talk to: "what should I take if I want to do engineering?", "is taking 3 APs junior year too much?"
- **Counselor comments.** Once the counselor role is enabled, counselors can leave inline notes on shared plans without editing them.

I built the architecture for the advisory engine before I built the engine itself. That's deliberate — wiring up the abstraction early means I can ship the actual AI features without restructuring the app.

---

## How families actually use it

A typical flow:

1. A parent or student signs up with email or Google. There's a 14-day free trial — no credit card required.
2. Onboarding asks who they are, what school the student attends (Stevenson is built-in; other schools can request to be added), and which grade.
3. The student picks a plan template — usually "college prep" — and the planner fills in default courses by year.
4. The student drags in the AP/honors/elective choices that are personal to them.
5. The student invites their parent (or vice versa) by email. The parent now sees the plan in their own login. They can create a *draft* plan to suggest changes; the student decides whether to merge.
6. At year-end, the student locks the previous year's grades. The GPA trend chart updates. The graduation requirement card shows the new progress.
7. Repeat for four years.

The whole loop is designed so that **a single student account contains the entire four-year story.** No separate apps for grades, planning, comparing. Same data, different views.

---

## How it makes money

Three tiers. Free tier is genuinely useful — not crippled — because that's how you actually get adoption.

| Tier | Price | What you get |
|---|---|---|
| **Starter** | Free | 1 plan, course browser, requirement validation, GPA tracking, family invites |
| **Plus** | $9.99/mo (or $107.88/yr, or $399 for 4 years) | 10 plans, plan comparison, PDF export, share links, parent draft plans, dual-credit tracking |
| **Elite** | $19.99/mo (or $215.88/yr, or $799 for 4 years) | Everything in Plus plus AI course suggestions, AI plan review, AI chat, course rigor scoring, unlimited plans |

A few things worth pointing out about the pricing:

- **The 4-year plan is real, not a gimmick.** Most subscription products try to lock you into annual. Plan with Genie locks you into *4 years* — because that's the actual lifecycle of the product. A freshman who buys 4-year Plus uses it through senior year and never thinks about renewal.
- **One subscription covers the whole family.** The student's plan tier applies to whoever is linked to their account. Parents and guardians don't pay separately. (Linked-account limits scale with tier: Starter 3, Plus 5, Elite 8.)
- **No credit card for the trial.** Friction kills signup. Trials end automatically into the free tier — they don't auto-charge. This is a deliberate trust signal.
- **Downgrading never destroys data.** If you drop from Plus (10 plans) to Starter (1 plan), the extra plans become read-only archives. Nothing gets deleted.
- **Stripe runs the billing.** Five-day grace period on a failed payment before any restrictions kick in.

The math: a family that uses Plus for the full four years pays $399. A family that uses Elite pays $799. For comparison, one private college counselor session in Chicagoland costs $200+. The whole product, for the whole high school career, is the price of a few sessions — and you have it whenever you need it, not just twice a year.

---

## Design philosophy: a few decisions that shape everything

- **Students own the data, not the school.** This is a *personal/family* tool, not a school IT system. No district contracts, no procurement cycles, no FERPA compliance burden, no integration projects. Schools can be involved later; they don't need to be involved on day one.
- **One school first, deeply, before going wide.** I built it specifically for Stevenson because that's where I go. The course catalog, the graduation rules, the credit structure are all Stevenson-specific. Adding another school is an exercise in extending the schema and re-running the catalog extractor — the architecture supports it, but I'd rather have 1,000 happy Stevenson families than 100 lukewarm users from 10 schools.
- **Free tier that actually works.** A free user who plans their entire four years on Starter is *not a failure of the funnel.* They're a future Plus user when they hit the plan-comparison limit, a referrer to their friends, a credibility signal to the school. Giving away the core is the cheapest marketing I have.
- **Sentence case, plain language, no corporate tone.** Counselors aren't called "advisors." Plans aren't called "academic itineraries." Buttons say "Add a course" not "Initiate Course Selection." The voice is the voice of a friend who happens to know the catalog cold.
- **Trust signals for anxious parents.** Print views are watermarked "unofficial — not a substitute for your school's records." Disclaimers on the transcript page. Clear copy about what the tool does and doesn't do. Parents are the ones with the credit card; they need to know they're not being sold a fantasy.
- **Accessibility from day one.** Keyboard navigation on the planner grid, focus management, color tokens that work in dark mode. The product is for kids who use it for years; it has to feel right at 11pm on a Tuesday.

---

## What makes it different from "just a spreadsheet"

If a family said "we already do this in a Google Sheet, why do we need a product?", here's what I'd point at:

1. **Prerequisite intelligence.** A spreadsheet can't tell you that removing Algebra 2 in 9th grade puts AP Calculus BC in 11th grade at risk. Plan with Genie traces the dependency chain automatically. With the rigor ladder, it also knows that a higher-level course (AP Calc) satisfies a lower-level prereq (Pre-Calc) — something a naive checklist would miss.
2. **Live catalog updates.** When the school publishes a new catalog PDF, my Python extractor pulls the new courses into the database. Spreadsheets don't update themselves.
3. **Real GPA math.** Weighted, projected, what-if, with proper handling of pass/fail and AP weighting. Not a column of numbers people forget to recalculate.
4. **Multi-user without conflict.** A student and parent looking at the same plan from different accounts, in real time, without overwriting each other's edits.
5. **Print-quality outputs.** Plans, progress reports, and transcripts that a family can share with a tutor or college counselor — already formatted, watermarked, and dated.
6. **It remembers.** GPA snapshots, lock states, version history. A spreadsheet shows you today; Plan with Genie shows you the trajectory.

---

## Where it's going next

This is roughly the order I'm thinking about:

1. **Light up the AI features (Elite tier).** Course recommendations, plan review, chat. The infrastructure is in place; this is mostly prompt and UI work.
2. **Re-enable the counselor role.** Counselor invites, view-only dashboard, inline comments on shared plans. The backend is already there.
3. **Extend to a second school.** Probably another large Illinois district with a similar catalog format. The Python extractor is built to be re-pointed at a new PDF.
4. **Career-path overlays.** "I want to study engineering" → highlight the courses that align, surface dual-credit options, flag prereqs for typical engineering programs.
5. **Partner with counselors directly.** Once the counselor role ships, school-side adoption becomes possible — but only after the consumer-side product is loved.

Notice what's *not* on this list: building an LMS, integrating with PowerSchool, going national overnight, or pivoting to "AI for education" in general. Scope discipline is the same in business as in code: pick the next problem, solve it, ship it, repeat.

---

## Takeaway for you

If you're thinking about your own product, here's what I'd condense from all of this:

- **Pick a real, specific user.** Not "students." A junior at *my* school, who sat next to me in Algebra 2, who is panicking about his junior-year course load. If you can name a real person who has the problem, you'll build the right thing. If you can't, you won't.
- **One school, one neighborhood, one office, one game — first.** Niche down hard. The product gets better when it serves a small group deeply than when it tries to serve everyone shallowly.
- **Free has to be useful.** A crippled free tier is worse than no free tier. Give away the core; charge for the multiplier.
- **Think in lifecycles.** The product I'm building is *4-year-long.* The pricing reflects that. The data model reflects that. So does the onboarding. Find your natural lifecycle and build for it.
- **Trust matters more than features.** A polished free tier with a clear privacy posture, no dark patterns, watermarked unofficial outputs, and a real human-sounding voice is worth more than ten flashy features.

The reason I think this works is that I'm not building it for some hypothetical user. I'm building it for me, my classmates, and the families I see at parent-teacher conferences. The features that exist are the ones I actually wanted; the pricing is what I'd pay; the voice is how I'd want to be talked to. If you build for someone real, the rest is mostly engineering.

— Krishna
