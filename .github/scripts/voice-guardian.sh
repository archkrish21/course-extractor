#!/usr/bin/env bash
# Voice Guardian — invoked by .github/workflows/voice-guardian.yml on PRs.
# Reads the PR diff, sends voice doc + brand doc + diff to Anthropic, parses JSON
# findings, and posts them as a single PR review comment.
#
# Required env:
#   ANTHROPIC_API_KEY  — Anthropic Messages API key
#   GITHUB_TOKEN       — for posting the review (provided by Actions)
#   PR_NUMBER          — PR number to comment on
#   GITHUB_REPOSITORY  — owner/repo (provided by Actions)

set -euo pipefail

: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${PR_NUMBER:?PR_NUMBER is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

VOICE_DOC="docs/design/voice-and-tone.md"
BRAND_DOC="docs/design/brand.md"
SKILL_DOC=".claude/skills/voice-guardian/SKILL.md"

if [ ! -f "$VOICE_DOC" ] || [ ! -f "$BRAND_DOC" ] || [ ! -f "$SKILL_DOC" ]; then
  echo "Missing required doc(s); skipping voice-guardian." >&2
  exit 0
fi

# 1. Get the unified diff for the PR, restricted to copy-relevant paths.
DIFF=$(gh pr diff "$PR_NUMBER" \
  -- '*.tsx' '*.md' 'saps/components/emails/**' 2>/dev/null || true)

if [ -z "$DIFF" ]; then
  echo "No copy-relevant changes in PR #$PR_NUMBER; skipping."
  exit 0
fi

# Truncate diff to keep request size bounded (Anthropic input cap + cost).
DIFF_TRUNCATED=$(printf '%s' "$DIFF" | head -c 200000)

VOICE_CONTENT=$(cat "$VOICE_DOC")
BRAND_CONTENT=$(cat "$BRAND_DOC")
SKILL_CONTENT=$(cat "$SKILL_DOC")

# 2. Build the request body. Static rules go in `system` with prompt caching
# (~30KB of doc content reused across every PR run); the dynamic diff stays
# in `messages` uncached.
SYSTEM_PREAMBLE='You are voice-guardian, an automated copy reviewer for Plan with Genie. Follow the SKILL.md procedure exactly. Output a single JSON object matching the schema in SKILL.md §5 — no prose, no markdown fences, no commentary.'

REQUEST_BODY=$(jq -n \
  --arg preamble "$SYSTEM_PREAMBLE" \
  --arg skill "$SKILL_CONTENT" \
  --arg voice "$VOICE_CONTENT" \
  --arg brand "$BRAND_CONTENT" \
  --arg diff "$DIFF_TRUNCATED" \
  '{
    model: "claude-opus-4-7",
    max_tokens: 4096,
    system: [
      {type: "text", text: $preamble},
      {
        type: "text",
        text: ("# SKILL.md\n\n" + $skill + "\n\n# voice-and-tone.md\n\n" + $voice + "\n\n# brand.md\n\n" + $brand),
        cache_control: {type: "ephemeral"}
      }
    ],
    messages: [
      {
        role: "user",
        content: ("# PR diff\n\n```diff\n" + $diff + "\n```\n\nProduce findings JSON now.")
      }
    ]
  }')

# 3. Call Anthropic Messages API.
RESPONSE=$(curl -sS https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$REQUEST_BODY")

# 4. Extract the JSON findings from the response.
FINDINGS_JSON=$(printf '%s' "$RESPONSE" | jq -r '.content[0].text // empty')

if [ -z "$FINDINGS_JSON" ]; then
  echo "::warning::voice-guardian: empty response from Anthropic API"
  echo "$RESPONSE" | jq -r '.error // .' >&2
  exit 0
fi

# Validate it's parseable JSON; if not, dump and bail without failing the build.
if ! printf '%s' "$FINDINGS_JSON" | jq -e . >/dev/null 2>&1; then
  echo "::warning::voice-guardian: model output was not valid JSON"
  printf '%s' "$FINDINGS_JSON" >&2
  exit 0
fi

SUMMARY=$(printf '%s' "$FINDINGS_JSON" | jq -r '.summary // "voice-guardian: no summary"')
FINDING_COUNT=$(printf '%s' "$FINDINGS_JSON" | jq '.findings | length')

# 5. Compose the review comment body.
if [ "$FINDING_COUNT" -eq 0 ]; then
  BODY="### voice-guardian

✓ $SUMMARY

_Reviewed against [voice-and-tone.md](docs/design/voice-and-tone.md) and [brand.md](docs/design/brand.md). This is an advisory check — it does not block merge._"
else
  FINDINGS_TABLE=$(printf '%s' "$FINDINGS_JSON" | jq -r '
    .findings | map(
      "| `" + .severity + "` | [`" + .file + ":" + (.line|tostring) + "`](" + .file + "#L" + (.line|tostring) + ") | **" + .rule + "** — " + .explanation + "<br><br>**Original:** " + .quote + "<br>**Suggested:** " + .suggested_rewrite + " |"
    ) | join("\n")')

  BODY=$(cat <<EOF
### voice-guardian

$SUMMARY ($FINDING_COUNT finding(s))

| Severity | Location | Rule & Suggestion |
|---|---|---|
$FINDINGS_TABLE

_Reviewed against [voice-and-tone.md](docs/design/voice-and-tone.md) and [brand.md](docs/design/brand.md). This is an advisory check — it does not block merge._
EOF
)
fi

# 6. Post as a PR review (event: COMMENT — non-blocking).
REVIEW_BODY=$(jq -n --arg body "$BODY" '{event: "COMMENT", body: $body}')

curl -sS -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/reviews" \
  -d "$REVIEW_BODY" \
  | jq -r '.html_url // .message // "review posted"'
