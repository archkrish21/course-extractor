---
description: Run the SAPS test orchestration suite (vitest + Playwright sub-agents + HTML report)
argument-hint: "[--list | --no-vitest | --no-report | --agent=<name>]"
allowed-tools: Bash
---

# SAPS Test Orchestration

Run the SAPS test orchestration script with the user's arguments: `$ARGUMENTS`

## What to do

1. Execute exactly this command (no other tools, no file reads, no analysis up front):

   ```bash
   cd saps && npm run test:orchestration -- $ARGUMENTS
   ```

2. The script handles everything itself: vitest, all 15 Playwright sub-agents, JSON parsing, and the consolidated HTML report at `saps/tests/report/QA_DEPLOYMENT_REPORT_<date>.html`. Do **not** spawn sub-agents, read [saps/tests/TEST_ORCHESTRATION.md](saps/tests/TEST_ORCHESTRATION.md), parse the per-agent JSON files yourself, or re-run any sub-agents in parallel.

3. After the command exits:
   - **Exit code 0** → reply in 1–2 lines: "All tests passed" + the report path.
   - **Non-zero exit code** → reply with a short bullet list of which sub-agents failed and how many tests in each (the script's stdout already prints a summary table at the end). Then give the report path. Do not paste full error stacks unless the user asks.
   - If the user passed `--list`, just show the script's output verbatim.

4. Never re-run failing tests automatically. Never edit spec files. The user will decide what to do with failures.

## Argument cheatsheet

| Args | Effect |
|---|---|
| (none) | Full run: vitest + 15 sub-agents + HTML report |
| `--list` | List sub-agents and exit (no execution) |
| `--no-vitest` | Skip the vitest unit/API run |
| `--no-report` | Skip writing the HTML report |
| `--agent=<Name>` | Run a single sub-agent (e.g. `--agent=Auth-Tester`) |
