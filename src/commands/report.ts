import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { findInstructionFiles } from "../audit/scanner.js";
import { auditContent } from "../audit/heuristics.js";
import { getPricing, estimateMonthly } from "../shared/pricing.js";
import { countTokens } from "../shared/counter.js";
import { formatNumber, formatCost, formatPercent } from "../shared/format.js";
import { detectAgents } from "../scan/detector.js";
import { findClaudeCodeSessions, parseSession, analyzeTokens } from "../scan/claude-code.js";
import { findOpenCodeDb, getLatestSession, analyzeOpenCodeSession } from "../scan/opencode.js";
import chalk from "chalk";

interface ReportData {
  projectDir: string;
  auditFiles: Array<{
    path: string;
    relPath: string;
    tokens: number;
    flags: Array<{ id: string; severity: string; message: string; savings?: number }>;
    reducibleTokens: number;
  }>;
  totalTokens: number;
  reducibleTokens: number;
  monthlyCost: number;
  monthlySavings: number;
  sessionData?: {
    inputTokens: number;
    outputTokens: number;
    cacheRead: number;
    cost: number;
  };
  topPatterns: Array<{ pattern: string; count: number; savings: number }>;
  days: number;
}

async function gatherReportData(projectDir: string, days: number, model: string): Promise<ReportData> {
  const pricing = getPricing(model);
  const files = findInstructionFiles(projectDir);
  const auditFiles: ReportData["auditFiles"] = [];
  let totalTokens = 0;
  let reducibleTokens = 0;
  const patternCounts: Record<string, { count: number; savings: number }> = {};

  for (const file of files) {
    if (!file.exists || !file.content) continue;
    const flags = auditContent(file.content, file.path, { projectDir });
    const fileReducible = flags.reduce((s, f) => s + (f.savings || 0), 0);
    totalTokens += file.tokens;
    reducibleTokens += fileReducible;

    for (const flag of flags) {
      if (!patternCounts[flag.id]) {
        patternCounts[flag.id] = { count: 0, savings: 0 };
      }
      patternCounts[flag.id].count++;
      patternCounts[flag.id].savings += flag.savings || 0;
    }

    auditFiles.push({
      path: file.path,
      relPath: file.relPath,
      tokens: file.tokens,
      flags: flags.map((f) => ({ id: f.id, severity: f.severity, message: f.message, savings: f.savings })),
      reducibleTokens: fileReducible,
    });
  }

  const alwaysLoaded = auditFiles
    .filter((f) => f.reducibleTokens > 0)
    .reduce((s, f) => s + f.tokens, 0);
  const perMsgCost = (alwaysLoaded * pricing.inputPerMillion) / 1_000_000;
  const perMsgSavings = (reducibleTokens * pricing.inputPerMillion) / 1_000_000;

  const topPatterns = Object.entries(patternCounts)
    .map(([pattern, data]) => ({ pattern, count: data.count, savings: data.savings }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 5);

  let sessionData: ReportData["sessionData"];
  try {
    const claudeSessions = findClaudeCodeSessions();
    if (claudeSessions.length > 0) {
      const session = parseSession(claudeSessions[0]);
      const breakdown = analyzeTokens(session);
      sessionData = {
        inputTokens: breakdown.totalInput,
        outputTokens: breakdown.totalOutput,
        cacheRead: breakdown.cacheRead,
        cost: breakdown.totalInput * pricing.inputPerMillion / 1_000_000 + breakdown.totalOutput * pricing.outputPerMillion / 1_000_000,
      };
    }
  } catch {}

  if (!sessionData) {
    try {
      const dbPath = findOpenCodeDb();
      if (dbPath) {
        const sessionInfo = await getLatestSession(dbPath);
        if (sessionInfo) {
          const breakdown = await analyzeOpenCodeSession(dbPath, sessionInfo.id);
          if (breakdown) {
            sessionData = {
              inputTokens: breakdown.totalInput,
              outputTokens: breakdown.totalOutput,
              cacheRead: breakdown.cacheRead,
              cost: breakdown.cost,
            };
          }
        }
      }
    } catch {}
  }

  return {
    projectDir,
    auditFiles,
    totalTokens,
    reducibleTokens,
    monthlyCost: estimateMonthly(perMsgCost),
    monthlySavings: estimateMonthly(perMsgSavings),
    sessionData,
    topPatterns,
    days,
  };
}

function generateHTML(data: ReportData): string {
  const savingsPct = data.totalTokens > 0 ? ((data.reducibleTokens / data.totalTokens) * 100).toFixed(1) : "0";
  const auditRows = data.auditFiles.map((f) => {
    const flagBadges = f.flags
      .map((fl) => `<span class="badge badge-${fl.severity}">${fl.id.replace(/_/g, " ")}</span>`)
      .join(" ");
    return `<tr>
      <td>${f.relPath}</td>
      <td class="num">${formatNumber(f.tokens)}</td>
      <td class="num">${f.reducibleTokens > 0 ? "-" + formatNumber(f.reducibleTokens) : "-"}</td>
      <td>${flagBadges || '<span class="badge badge-ok">ok</span>'}</td>
    </tr>`;
  }).join("\n");

  const patternRows = data.topPatterns.map((p) => {
    const barWidth = data.topPatterns[0] ? Math.round((p.savings / data.topPatterns[0].savings) * 100) : 0;
    return `<div class="pattern-row">
      <div class="pattern-name">${p.pattern.replace(/_/g, " ")}</div>
      <div class="pattern-bar" style="width: ${barWidth}%"></div>
      <div class="pattern-savings">-${formatNumber(p.savings)} tokens (${p.count} files)</div>
    </div>`;
  }).join("\n");

  const sessionSection = data.sessionData ? `
    <div class="card">
      <h2>Latest Session</h2>
      <div class="stat-row"><span>Input tokens</span><span class="num">${formatNumber(data.sessionData.inputTokens)}</span></div>
      <div class="stat-row"><span>Output tokens</span><span class="num">${formatNumber(data.sessionData.outputTokens)}</span></div>
      <div class="stat-row"><span>Cache hits</span><span class="num">${formatNumber(data.sessionData.cacheRead)}</span></div>
      <div class="stat-row"><span>Cost</span><span class="num">${formatCost(data.sessionData.cost)}</span></div>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>tokenwise report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 2rem; max-width: 960px; margin: 0 auto; }
  h1 { color: #58a6ff; font-size: 1.8rem; margin-bottom: 1.5rem; border-bottom: 1px solid #21262d; padding-bottom: 0.75rem; }
  h2 { color: #79c0ff; font-size: 1.2rem; margin-bottom: 1rem; }
  .card { background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .stat-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #21262d; }
  .stat-row:last-child { border-bottom: none; }
  .num { font-variant-numeric: tabular-nums; color: #f0f6fc; font-weight: 600; }
  .savings { color: #3fb950; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 1rem; text-align: center; }
  .stat-card .value { font-size: 1.8rem; font-weight: 700; color: #58a6ff; }
  .stat-card .label { font-size: 0.8rem; color: #8b949e; margin-top: 0.25rem; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #8b949e; font-size: 0.8rem; text-transform: uppercase; padding: 0.5rem 0.75rem; border-bottom: 1px solid #21262d; }
  td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #21262d; }
  .badge { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 3px; font-size: 0.7rem; margin-right: 0.25rem; }
  .badge-high { background: #490202; color: #f85149; }
  .badge-medium { background: #3b2e00; color: #d29922; }
  .badge-low { background: #1b1f23; color: #8b949e; }
  .badge-ok { background: #0f5323; color: #3fb950; }
  .pattern-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
  .pattern-name { min-width: 140px; font-size: 0.85rem; }
  .pattern-bar { height: 8px; background: #3fb950; border-radius: 4px; }
  .pattern-savings { font-size: 0.8rem; color: #8b949e; }
  .share-section { background: #0d1117; border: 1px solid #21262d; border-radius: 6px; padding: 1rem; margin-top: 1.5rem; }
  .share-section pre { background: #161b22; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; color: #3fb950; }
</style>
</head>
<body>
<h1>tokenwise report</h1>

<div class="grid">
  <div class="stat-card">
    <div class="value">${formatNumber(data.totalTokens)}</div>
    <div class="label">Total instruction tokens</div>
  </div>
  <div class="stat-card">
    <div class="value savings">-${formatNumber(data.reducibleTokens)}</div>
    <div class="label">Reducible tokens (${savingsPct}%)</div>
  </div>
  <div class="stat-card">
    <div class="value savings">${formatCost(data.monthlySavings)}</div>
    <div class="label">Monthly savings</div>
  </div>
</div>

<div class="card">
  <h2>Instruction files</h2>
  <table>
    <thead><tr><th>File</th><th>Tokens</th><th>Savings</th><th>Flags</th></tr></thead>
    <tbody>${auditRows}</tbody>
  </table>
</div>

${data.topPatterns.length > 0 ? `<div class="card">
  <h2>Top wasteful patterns</h2>
  ${patternRows}
</div>` : ""}

${sessionSection}

<div class="share-section">
  <h2>Share your savings</h2>
  <pre>tokenwise saved me ${formatCost(data.monthlySavings)}/month by cutting ${savingsPct}% of instruction file waste

${formatNumber(data.totalTokens)} tokens analyzed
${formatNumber(data.reducibleTokens)} tokens reducible

Run: npx @davizin713/tokenwise audit</pre>
</div>

</body>
</html>`;
}

export async function runReport(options: {
  dir: string;
  open?: boolean;
  days: number;
  model: string;
}) {
  const projectDir = options.dir || process.cwd();
  const data = await gatherReportData(projectDir, options.days || 30, options.model);

  const html = generateHTML(data);
  const outputPath = join(projectDir, "tokenwise-report.html");
  writeFileSync(outputPath, html, "utf-8");

  console.log("");
  console.log(chalk.green(`  Report generated: ${outputPath}`));

  if (options.open) {
    const { exec } = await import("node:child_process");
    const platform = process.platform;
    const cmd = platform === "win32" ? `start "" "${outputPath}"` : platform === "darwin" ? `open "${outputPath}"` : `xdg-open "${outputPath}"`;
    exec(cmd, (err) => {
      if (err) console.log(chalk.yellow("  Could not open browser automatically."));
    });
  }

  console.log(chalk.gray(`  ${formatNumber(data.totalTokens)} tokens analyzed, ${formatNumber(data.reducibleTokens)} reducible (${formatCost(data.monthlySavings)}/month savings)`));
  console.log("");
}
