Usage


cd saps
npm run test:orchestration                        # full run: vitest + all 15 agents + HTML report
npm run test:orchestration -- --list              # list sub-agents (no execution)
npm run test:orchestration -- --no-vitest         # skip vitest
npm run test:orchestration -- --no-report         # skip HTML report
npm run test:orchestration -- --agent=Auth-Tester # single sub-agent (skips vitest + report)
