#!/usr/bin/env tsx
/**
 * SAPS Test Orchestration Runner
 *
 * Replaces the manual "execute TEST_ORCHESTRATION.md via Claude" workflow.
 * Runs vitest + 15 Playwright sub-agent groups, then writes an HTML
 * deployment report to tests/report/QA_DEPLOYMENT_REPORT_<date>.html.
 *
 * Sub-agent groupings, spec files, and --workers=1 rules mirror Phase II
 * of saps/tests/TEST_ORCHESTRATION.md. Keep them in sync when either
 * changes.
 *
 * Usage:
 *   npm run test:orchestration
 *   npm run test:orchestration -- --agent=Auth-Tester
 *   npm run test:orchestration -- --no-vitest
 *   npm run test:orchestration -- --no-report
 *   npm run test:orchestration -- --list
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPORT_DIR = join(ROOT, "tests", "report");
const RESULTS_DIR = join(REPORT_DIR, "orchestration-runs");

interface SubAgent {
  name: string;
  specs: string[];
  workers?: number;
  expected: number;
}

// Mirror of saps/tests/TEST_ORCHESTRATION.md Phase II "Sub-Agent assignments"
const SUB_AGENTS: SubAgent[] = [
  {
    name: "Auth-Tester",
    specs: ["auth", "claim", "consent", "signup-redesign", "consent-settings"],
    expected: 60,
  },
  {
    name: "Onboarding-Tester",
    specs: ["onboarding"],
    workers: 1,
    expected: 24,
  },
  {
    name: "Planner-Tester",
    specs: [
      "planner",
      "planner-add-course",
      "planner-grades",
      "planner-manage",
      "planner-validation",
      "course-browser",
      "summer-planner",
      "summer-course-browser",
    ],
    expected: 148,
  },
  { name: "Plans-Tester", specs: ["plan-management", "print-gating"], expected: 32 },
  { name: "Progress-Tester", specs: ["progress", "gpa-trend", "grade-lock"], expected: 76 },
  { name: "Transcript-Tester", specs: ["transcript", "summer-transcript-print"], expected: 24 },
  { name: "Settings-Tester", specs: ["linked-accounts", "billing"], expected: 50 },
  { name: "Dashboard-Tester", specs: ["dashboard"], expected: 38 },
  { name: "Public-Tester", specs: ["homepage"], expected: 19 },
  { name: "Role-Tester", specs: ["role-based"], expected: 26 },
  { name: "YearEnd-Tester", specs: ["year-end"], workers: 1, expected: 19 },
  { name: "A11y-Tester", specs: ["accessibility", "user-menu"], expected: 20 },
  { name: "Join-Tester", specs: ["join"], expected: 8 },
  { name: "Gap-Tester", specs: ["gaps-high-priority", "gaps-medium-priority"], expected: 40 },
  { name: "Journey-Tester", specs: ["critical-journeys"], expected: 14 },
];

const TOTAL_EXPECTED_E2E = SUB_AGENTS.reduce((sum, a) => sum + a.expected, 0);

interface AgentResult {
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  total: number;
  durationMs: number;
  expected: number;
  exitCode: number;
  failures: FailureDetail[];
}

interface FailureDetail {
  title: string;
  file: string;
  line?: number;
  error: string;
}

interface VitestResult {
  ran: boolean;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs: number;
  exitCode: number;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

interface Cli {
  agent?: string;
  noVitest: boolean;
  noReport: boolean;
  list: boolean;
  noMobile: boolean;
  retries?: number;
}

function parseCli(): Cli {
  const args = process.argv.slice(2);
  const cli: Cli = { noVitest: false, noReport: false, list: false, noMobile: false };
  for (const arg of args) {
    if (arg === "--no-vitest") cli.noVitest = true;
    else if (arg === "--no-report") cli.noReport = true;
    else if (arg === "--list") cli.list = true;
    else if (arg === "--no-mobile") cli.noMobile = true;
    else if (arg.startsWith("--agent=")) cli.agent = arg.slice("--agent=".length);
    else if (arg.startsWith("--retries=")) {
      const n = parseInt(arg.slice("--retries=".length), 10);
      if (Number.isNaN(n) || n < 0) {
        console.error(`Invalid --retries value: ${arg}. Must be a non-negative integer.`);
        process.exit(2);
      }
      cli.retries = n;
    }
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(2);
    }
  }
  return cli;
}

function printHelp(): void {
  console.log(`SAPS test orchestration runner

Usage:
  npm run test:orchestration [-- options]

Options:
  --agent=<name>   Run a single sub-agent (e.g. Auth-Tester). Skips vitest.
  --no-vitest      Skip the vitest unit/API run.
  --no-report      Skip writing the HTML deployment report.
  --no-mobile      Skip the Playwright mobile project (run desktop chromium only).
  --retries=<n>    Override Playwright retry count (e.g. --retries=0 to disable).
  --list           List sub-agents and exit.
  -h, --help       Show this help.`);
}

// ─── Process helpers ────────────────────────────────────────────────────────

function runCommand(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveFn) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const s = chunk.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (chunk) => {
      const s = chunk.toString();
      stderr += s;
      process.stderr.write(s);
    });
    child.on("close", (code) => resolveFn({ code: code ?? 1, stdout, stderr }));
  });
}

// ─── Vitest ─────────────────────────────────────────────────────────────────

async function runVitest(): Promise<VitestResult> {
  const start = Date.now();
  console.log("\n────────────────────────────────────────");
  console.log("▶ Running vitest (unit + API tests)");
  console.log("────────────────────────────────────────\n");

  const { code, stdout } = await runCommand("npx", ["vitest", "run", "--reporter=default"]);
  const durationMs = Date.now() - start;

  // Parse vitest's "Tests  X passed | Y failed | Z skipped (N)" line
  const passed = parseInt(stdout.match(/(\d+)\s+passed/)?.[1] ?? "0", 10);
  const failed = parseInt(stdout.match(/(\d+)\s+failed/)?.[1] ?? "0", 10);
  const skipped = parseInt(stdout.match(/(\d+)\s+skipped/)?.[1] ?? "0", 10);
  const total = passed + failed + skipped;

  return { ran: true, passed, failed, skipped, total, durationMs, exitCode: code };
}

// ─── Playwright sub-agent runner ────────────────────────────────────────────

async function runAgent(agent: SubAgent, opts: { noMobile?: boolean; retries?: number } = {}): Promise<AgentResult> {
  const jsonPath = join(RESULTS_DIR, `${agent.name}.json`);

  const retriesNote = opts.retries !== undefined ? `  [retries=${opts.retries}]` : "";
  console.log("\n────────────────────────────────────────");
  console.log(`▶ ${agent.name}`);
  console.log(`  specs: ${agent.specs.join(", ")}${agent.workers ? `  (workers=${agent.workers})` : ""}${opts.noMobile ? "  [chromium only]" : ""}${retriesNote}`);
  console.log("────────────────────────────────────────\n");

  const args = ["playwright", "test", ...agent.specs, "--reporter=line,json"];
  if (agent.workers) args.push(`--workers=${agent.workers}`);
  if (opts.noMobile) args.push("--project=chromium");
  if (opts.retries !== undefined) args.push(`--retries=${opts.retries}`);

  const start = Date.now();
  const { code } = await runCommand("npx", args, {
    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath,
  });
  const durationMs = Date.now() - start;

  return parsePlaywrightJson(jsonPath, agent, durationMs, code);
}

interface PwSuite {
  title?: string;
  file?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}

interface PwSpec {
  title?: string;
  file?: string;
  line?: number;
  tests?: PwTest[];
}

interface PwTest {
  results?: PwResult[];
}

interface PwResult {
  status?: string;
  error?: { message?: string };
}

interface PwReport {
  stats?: { expected?: number; unexpected?: number; skipped?: number; flaky?: number; duration?: number };
  suites?: PwSuite[];
}

function parsePlaywrightJson(
  jsonPath: string,
  agent: SubAgent,
  durationMs: number,
  exitCode: number,
): AgentResult {
  const empty: AgentResult = {
    name: agent.name,
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    total: 0,
    durationMs,
    expected: agent.expected,
    exitCode,
    failures: [],
  };

  if (!existsSync(jsonPath)) {
    console.warn(`  ⚠ no JSON output at ${jsonPath} — agent may have crashed`);
    return empty;
  }

  let data: PwReport;
  try {
    data = JSON.parse(readFileSync(jsonPath, "utf-8")) as PwReport;
  } catch (err) {
    console.warn(`  ⚠ failed to parse ${jsonPath}: ${(err as Error).message}`);
    return empty;
  }

  const stats = data.stats ?? {};
  const passed = stats.expected ?? 0;
  const failed = stats.unexpected ?? 0;
  const skipped = stats.skipped ?? 0;
  const flaky = stats.flaky ?? 0;
  const total = passed + failed + skipped + flaky;

  const failures: FailureDetail[] = [];
  walkSuites(data.suites ?? [], failures);

  return {
    name: agent.name,
    passed,
    failed,
    skipped,
    flaky,
    total,
    durationMs,
    expected: agent.expected,
    exitCode,
    failures,
  };
}

function walkSuites(suites: PwSuite[], failures: FailureDetail[]): void {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const finalResult = (test.results ?? []).slice(-1)[0];
        if (!finalResult) continue;
        if (finalResult.status === "failed" || finalResult.status === "timedOut") {
          failures.push({
            title: spec.title ?? "(unknown test)",
            file: spec.file ?? suite.file ?? suite.title ?? "(unknown file)",
            line: spec.line,
            error: (finalResult.error?.message ?? "Unknown error").slice(0, 500),
          });
        }
      }
    }
    if (suite.suites) walkSuites(suite.suites, failures);
  }
}

// ─── HTML report ────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function generateHtmlReport(
  vitest: VitestResult | null,
  agents: AgentResult[],
  generatedAt: Date,
): string {
  const totalE2EPassed = agents.reduce((s, a) => s + a.passed, 0);
  const totalE2EFailed = agents.reduce((s, a) => s + a.failed, 0);
  const totalE2ESkipped = agents.reduce((s, a) => s + a.skipped, 0);
  const totalE2E = totalE2EPassed + totalE2EFailed + totalE2ESkipped;
  const totalFailed = totalE2EFailed + (vitest?.failed ?? 0);

  const goNoGo = totalFailed === 0;
  const verdictClass = goNoGo ? "verdict-go" : "verdict-nogo";
  const verdictText = goNoGo
    ? "✅ GO — All criteria met"
    : `❌ NO-GO — ${totalFailed} test${totalFailed === 1 ? "" : "s"} failed`;

  const dateStr = generatedAt.toISOString().slice(0, 10);
  const timeStr = generatedAt.toTimeString().slice(0, 5);

  const agentRows = agents
    .map((a) => {
      const verdict =
        a.failed > 0
          ? '<span class="badge badge-fail">FAIL</span>'
          : a.total === 0
            ? '<span class="badge badge-skip">SKIP</span>'
            : '<span class="badge badge-pass">PASS</span>';
      return `    <tr>
      <td>${escapeHtml(a.name)}</td>
      <td>${a.expected}</td>
      <td>${a.passed}</td>
      <td>${a.failed}</td>
      <td>${a.skipped}</td>
      <td>${fmtDuration(a.durationMs)}</td>
      <td>${verdict}</td>
    </tr>`;
    })
    .join("\n");

  const allFailures = agents.flatMap((a) => a.failures.map((f) => ({ ...f, agent: a.name })));
  const failuresSection =
    allFailures.length === 0
      ? '<p style="color: var(--green); font-weight: 600;">No critical failures.</p>'
      : allFailures
          .map(
            (f) => `<div class="failure-block">
  <strong>[FAIL] ${escapeHtml(f.title)}</strong> <span style="color: var(--muted);">(${escapeHtml(f.agent)})</span><br>
  File: <code>${escapeHtml(f.file)}${f.line ? ":" + f.line : ""}</code><br>
  <pre style="white-space: pre-wrap; margin-top: 0.5rem; font-size: 0.8125rem;">${escapeHtml(f.error)}</pre>
</div>`,
          )
          .join("\n");

  const vitestCard = vitest
    ? `<div class="summary-card">
    <div class="label">Unit / API Tests</div>
    <div class="value ${vitest.failed === 0 ? "pass" : "fail"}">${vitest.passed}/${vitest.total}</div>
  </div>`
    : `<div class="summary-card">
    <div class="label">Unit / API Tests</div>
    <div class="value warn">skipped</div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAPS QA Deployment Report — ${dateStr}</title>
  <style>
    :root {
      --green: #16a34a; --red: #dc2626; --amber: #d97706;
      --bg: #f8fafc; --card: #ffffff; --border: #e2e8f0;
      --text: #1e293b; --muted: #64748b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.25rem; margin: 2rem 0 1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1rem; margin: 1.5rem 0 0.75rem; }
    .subtitle { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
    .verdict-banner { padding: 1.5rem; border-radius: 12px; text-align: center; font-size: 1.5rem; font-weight: 700; margin-bottom: 2rem; }
    .verdict-go { background: #dcfce7; color: var(--green); border: 2px solid var(--green); }
    .verdict-nogo { background: #fef2f2; color: var(--red); border: 2px solid var(--red); }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; text-align: center; }
    .summary-card .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
    .summary-card .value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
    .pass { color: var(--green); } .fail { color: var(--red); } .warn { color: var(--amber); }
    table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 10px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 1.5rem; }
    th { background: #f1f5f9; text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
    td { padding: 0.625rem 1rem; border-top: 1px solid var(--border); font-size: 0.875rem; }
    tr:hover { background: #f8fafc; }
    .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-pass { background: #dcfce7; color: var(--green); }
    .badge-fail { background: #fef2f2; color: var(--red); }
    .badge-skip { background: #fef9c3; color: var(--amber); }
    .failure-block { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1rem; font-size: 0.875rem; }
    .failure-block strong { color: var(--red); }
    .failure-block code { background: #fee2e2; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.8125rem; }
    .timestamp { color: var(--muted); font-size: 0.75rem; margin-top: 3rem; text-align: center; padding-top: 1.5rem; border-top: 1px solid var(--border); }
  </style>
</head>
<body>

<h1>SAPS QA Deployment Report</h1>
<p class="subtitle">Generated: ${dateStr} ${timeStr} — Environment: localhost:3000</p>

<div class="verdict-banner ${verdictClass}">
  ${verdictText}
</div>

<div class="summary-grid">
  <div class="summary-card">
    <div class="label">E2E Tests</div>
    <div class="value ${totalE2EFailed === 0 ? "pass" : "fail"}">${totalE2EPassed}/${TOTAL_EXPECTED_E2E}</div>
  </div>
  ${vitestCard}
  <div class="summary-card">
    <div class="label">Sub-Agents Run</div>
    <div class="value pass">${agents.length}/${SUB_AGENTS.length}</div>
  </div>
  <div class="summary-card">
    <div class="label">Failed</div>
    <div class="value ${totalFailed === 0 ? "pass" : "fail"}">${totalFailed}</div>
  </div>
  <div class="summary-card">
    <div class="label">Skipped</div>
    <div class="value ${totalE2ESkipped === 0 ? "pass" : "warn"}">${totalE2ESkipped}</div>
  </div>
</div>

<h2>Per-Agent Results</h2>
<table>
  <thead>
    <tr><th>Sub-Agent</th><th>Expected</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Duration</th><th>Verdict</th></tr>
  </thead>
  <tbody>
${agentRows}
  </tbody>
</table>

<h2>Critical Failures</h2>
${failuresSection}

<div class="timestamp">
  Report generated by run-test-orchestration.ts — ${dateStr} ${timeStr}<br>
  Playwright HTML report available via: <code>npx playwright show-report</code>
</div>

</body>
</html>
`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cli = parseCli();

  if (cli.list) {
    console.log("Sub-agents:");
    for (const a of SUB_AGENTS) {
      const w = a.workers ? `  [workers=${a.workers}]` : "";
      console.log(`  ${a.name.padEnd(20)} ~${a.expected} tests   ${a.specs.join(", ")}${w}`);
    }
    console.log(`\nTotal expected E2E tests: ${TOTAL_EXPECTED_E2E}`);
    return;
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  mkdirSync(REPORT_DIR, { recursive: true });

  const overallStart = Date.now();
  let vitestResult: VitestResult | null = null;

  // Filter sub-agents to run
  let agentsToRun = SUB_AGENTS;
  if (cli.agent) {
    agentsToRun = SUB_AGENTS.filter((a) => a.name.toLowerCase() === cli.agent!.toLowerCase());
    if (agentsToRun.length === 0) {
      console.error(`Unknown agent: ${cli.agent}`);
      console.error(`Run with --list to see available agents.`);
      process.exit(2);
    }
  }

  // 1. Run vitest (unless skipped or running a single agent)
  if (!cli.noVitest && !cli.agent) {
    vitestResult = await runVitest();
  }

  // 2. Run each sub-agent sequentially
  const agentResults: AgentResult[] = [];
  for (const agent of agentsToRun) {
    const result = await runAgent(agent, { noMobile: cli.noMobile, retries: cli.retries });
    agentResults.push(result);
  }

  const totalDurationMs = Date.now() - overallStart;

  // 3. Print console summary
  console.log("\n════════════════════════════════════════");
  console.log("ORCHESTRATION SUMMARY");
  console.log("════════════════════════════════════════");
  if (vitestResult) {
    console.log(
      `vitest:           ${vitestResult.passed} passed, ${vitestResult.failed} failed, ${vitestResult.skipped} skipped (${fmtDuration(vitestResult.durationMs)})`,
    );
  }
  for (const r of agentResults) {
    const status = r.failed > 0 ? "FAIL" : r.total === 0 ? "SKIP" : "PASS";
    console.log(
      `${r.name.padEnd(22)} [${status}]  ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped  (${fmtDuration(r.durationMs)})`,
    );
  }
  const totalFailed = agentResults.reduce((s, a) => s + a.failed, 0) + (vitestResult?.failed ?? 0);
  console.log(`\nTotal duration: ${fmtDuration(totalDurationMs)}`);
  console.log(`Total failed:   ${totalFailed}`);

  // 4. Write HTML report
  if (!cli.noReport && !cli.agent) {
    const generatedAt = new Date();
    const dateStr = generatedAt.toISOString().slice(0, 10);
    const reportPath = join(REPORT_DIR, `QA_DEPLOYMENT_REPORT_${dateStr}.html`);
    const html = generateHtmlReport(vitestResult, agentResults, generatedAt);
    writeFileSync(reportPath, html, "utf-8");
    console.log(`\nReport: ${reportPath}`);
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
