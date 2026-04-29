Usage


cd saps
npm run test:orchestration                        # full run: vitest + all 15 agents + HTML report
npm run test:orchestration -- --list              # list sub-agents (no execution)
npm run test:orchestration -- --no-vitest         # skip vitest
npm run test:orchestration -- --no-report         # skip HTML report
npm run test:orchestration -- --agent=Auth-Tester # single sub-agent (skips vitest + report)
npm run test:orchestration -- --no-mobile
npm run test:orchestration -- --agent=Journey-Tester --no-mobile
npm run test:orchestration -- --no-mobile --retries=0
npm run test:orchestration -- --agent=Journey-Tester --no-mobile --retries=0

## Skills (Claude Code)

- **`/voice-guardian`** — review user-visible copy in the working diff against [`docs/design/voice-and-tone.md`](../design/voice-and-tone.md) and [`docs/design/brand.md`](../design/brand.md). Mirrors the CI check at [`.github/workflows/voice-guardian.yml`](../../.github/workflows/voice-guardian.yml). Useful before pushing a copy change to dry-run the same review CI will post on the PR.
