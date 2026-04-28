---
name: voice-guardian
description: Review user-visible copy in a PR diff for voice/tone deviations and factual accuracy. Use when invoked manually (e.g. /voice-guardian) or by CI to evaluate copy changes in a pull request.
---

# Voice Guardian

A copy reviewer for Plan with Genie. Evaluates changed user-visible strings against the project's voice and tone guide, flags deviations with suggested rewrites, and fact-checks any factual claim about product behavior by greping the codebase before flagging it.

## When to run

- **In CI:** triggered automatically by `.github/workflows/voice-guardian.yml` on pull requests that touch `**.tsx`, `**.md`, or `saps/components/emails/**`.
- **Locally:** invoke as `/voice-guardian` to review the current branch's copy changes against the guide before pushing.

## Inputs

- `docs/design/voice-and-tone.md` — the authoritative voice doc. **Always reload this on every run** so updates to the guide propagate without code changes here.
- `docs/design/brand.md` — brand glossary; product name, character ("Genie"), wordmark rules, banned phrasings.
- The unified diff of the PR (CI mode) or the working-tree diff vs `origin/main` (local mode).

## Procedure

### 1. Load the rules

Read `docs/design/voice-and-tone.md` and `docs/design/brand.md` in full. These are the only sources of truth — do not invent rules.

### 2. Filter the diff to user-visible strings

Consider only:
- JSX text content and string-literal props that render to the DOM (`title=`, `alt=`, `aria-label=`, `placeholder=`, button/link labels, headings, paragraph text) in `.tsx` files
- Markdown body text in `.md` files **under `docs/product/`, `docs/design/`, or any file ending in `README.md`** — but only if it would be read by an end user, not internal docs
- Any string in `saps/components/emails/**` (subject lines, body copy)

Exclude:
- Comments
- Variable names, identifiers, type names
- Test fixtures (anything under `tests/`)
- Internal logging / error messages not surfaced to users
- Tailwind class strings, CSS, JSON keys

### 3. Per-string evaluation

For each candidate string in the diff, evaluate it against the voice guide and assign at most one severity:

| Severity | When to flag | Examples |
|---|---|---|
| `error` | Factual inaccuracy about product behavior, banned phrasing per `brand.md`, or a confidently wrong claim a user would believe | "Plan with Genie supports manual course entry" when the codebase only allows picking from the catalog |
| `warn` | Voice deviation: wish-language on a decision surface, "we" used where "I" belongs, breathless/hypey phrasing, exclamation-point overuse, decision-surface whimsy | CTA says "Grant my wish for free" instead of "Get Started Free" |
| `info` | Polish suggestion: a clearer phrasing exists but the original is not wrong | Long sentence that could be split; mild thesaurus reach |

If the string passes all rules, do **not** include it in findings. Silence is a pass.

### 4. Fact-check pass

Before flagging anything as `error` based on a factual claim about product behavior, verify by greping the codebase. Examples:

- Claim: "manual course entry" → run `grep -ri "manual" saps/components/planner saps/app/(app)/planner` to confirm whether such a feature exists.
- Claim: "import your transcript" → check `git log --oneline | grep -i transcript` and look for an actual import flow.
- Claim about pricing tiers → cross-reference `saps/config/subscription-plans.ts`.

If the grep contradicts the copy, escalate to `error` with a code reference. If the grep is inconclusive, downgrade to `warn` and note the uncertainty.

### 5. Output format

Emit a single JSON object on stdout matching this schema, and nothing else:

```json
{
  "summary": "One-sentence overall verdict.",
  "findings": [
    {
      "severity": "error|warn|info",
      "file": "saps/app/(public)/page.tsx",
      "line": 142,
      "rule": "wish-language-on-cta | factual-inaccuracy | voice-i-vs-we | banned-phrasing | exclamation-overuse | other",
      "quote": "the offending string verbatim",
      "explanation": "Why it deviates, citing the voice doc section.",
      "suggested_rewrite": "A concrete replacement string."
    }
  ]
}
```

If there are no findings, emit `{"summary": "No copy issues found.", "findings": []}`.

### 6. Constraints

- **Never invent a rule.** Every flag must cite the voice doc or brand doc.
- **Never flag a string that wasn't changed in this diff.** Drive-by copy criticism is out of scope.
- **Never block a merge.** This skill produces advisory output only; the workflow posts as `event: COMMENT`.
- **One finding per string.** Don't double-flag the same line under multiple rules — pick the highest-severity one.
- **Be terse.** Each `explanation` is one sentence. Each `suggested_rewrite` is shorter than the original where possible.

## Failure modes to avoid

- Flagging Tailwind class names because they contain English words.
- Flagging code identifiers like `userName` or `getCurrentPlan`.
- Flagging strings inside `tests/` — those are fixtures, not user-facing.
- Repeating the same finding for the same string across multiple files.
- Suggesting rewrites that violate other voice rules (e.g., "fix" wish-language on a CTA by replacing it with corporate-speak).
