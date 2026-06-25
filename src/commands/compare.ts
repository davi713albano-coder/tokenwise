import chalk from "chalk";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { getPricing, estimateMonthly } from "../shared/pricing.js";
import { formatNumber, formatCost, formatPercent } from "../shared/format.js";
import { findClaudeCodeSessions, parseSession, analyzeTokens } from "../scan/claude-code.js";
import { findOpenCodeDb, getLatestSession, analyzeOpenCodeSession } from "../scan/opencode.js";
import { detectAgents } from "../scan/detector.js";

interface ComparisonData {
  source: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  systemPromptEstimate: number;
  historyEstimate: number;
  cacheHitRate: number;
  cost: number;
  timestamp: string;
}

interface ComparisonResult {
  before: ComparisonData;
  after: ComparisonData;
  savings: {
    inputDiff: number;
    inputPercent: number;
    systemPromptDiff: number;
    systemPromptPercent: number;
    cacheHitRateDiff: number;
    cacheHitRatePercent: number;
    costDiff: number;
    costPercent: number;
    monthlySavings: number;
  };
}

function calcPercentDiff(before: number, after: number): number {
  if (before === 0) return after === 0 ? 0 : 100;
  return ((after - before) / before) * 100;
}

function formatDiff(value: number, percent: number): string {
  if (value < 0) {
    return chalk.green(`${formatNumber(Math.abs(value))} (${percent.toFixed(1)}%)`);
  } else if (value > 0) {
    return chalk.red(`+${formatNumber(value)} (+${percent.toFixed(1)}%)`);
  }
  return chalk.gray("no change");
}

function formatSignedPercent(percent: number): string {
  if (percent > 0) return chalk.green(`+${percent.toFixed(0)}%`);
  if (percent < 0) return chalk.red(`${percent.toFixed(0)}%`);
  return chalk.gray("0%");
}

async function getSessionData(path: string, agentOverride?: string): Promise<ComparisonData | null> {
  const claudeSessions = findClaudeCodeSessions();
  const openCodeDb = findOpenCodeDb();

  if (path && (path.endsWith(".jsonl") || agentOverride === "claude-code")) {
    try {
      const session = parseSession(path);
      const breakdown = analyzeTokens(session);
      return breakdownToComparison(breakdown, "claude-code");
    } catch { return null; }
  }

  if (path && (path.endsWith(".db") || agentOverride === "opencode")) {
    try {
      const dbPath = path || openCodeDb;
      if (!dbPath) return null;
      const sessionInfo = await getLatestSession(dbPath);
      if (!sessionInfo) return null;
      const breakdown = await analyzeOpenCodeSession(dbPath, sessionInfo.id);
      if (!breakdown) return null;
      return breakdownToComparison(breakdown, "opencode");
    } catch { return null; }
  }

  if (!path) {
    if (claudeSessions.length > 0) {
      const session = parseSession(claudeSessions[0]);
      const breakdown = analyzeTokens(session);
      return breakdownToComparison(breakdown, "claude-code");
    }
    if (openCodeDb) {
      try {
        const sessionInfo = await getLatestSession(openCodeDb);
        if (sessionInfo) {
          const breakdown = await analyzeOpenCodeSession(openCodeDb, sessionInfo.id);
          if (breakdown) return breakdownToComparison(breakdown, "opencode");
        }
      } catch {}
    }
  }

  return null;
}

function breakdownToComparison(breakdown: unknown, source: string): ComparisonData {
  const b = breakdown as { [k: string]: number };
  const cost = b["cost"] || 0;
  const totalInput = b["totalInput"] || 0;
  const totalOutput = b["totalOutput"] || 0;
  const cacheRead = b["cacheRead"] || 0;
  const systemPromptEstimate = b["systemPromptEstimate"] || 0;
  const historyEstimate = b["historyEstimate"] || 0;
  const cacheHitRate = b["cacheHitRate"] || 0;

  const computedCost = cost || (totalInput * 3 / 1_000_000 + totalOutput * 15 / 1_000_000);

  return {
    source,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheRead,
    systemPromptEstimate,
    historyEstimate,
    cacheHitRate,
    cost: computedCost,
    timestamp: new Date().toISOString(),
  };
}

async function getTwoLatestSessions(): Promise<[ComparisonData | null, ComparisonData | null]> {
  const claudeSessions = findClaudeCodeSessions();

  if (claudeSessions.length >= 2) {
    const before = await getSessionData(claudeSessions[1]);
    const after = await getSessionData(claudeSessions[0]);
    if (before && after) return [before, after];
  }

  if (claudeSessions.length === 1) {
    const after = await getSessionData(claudeSessions[0]);
    return [null, after];
  }

  const openCodeDb = findOpenCodeDb();
  if (openCodeDb) {
    const after = await getSessionData(openCodeDb);
    return [null, after];
  }

  return [null, null];
}

function saveComparison(result: ComparisonResult) {
  const dir = join(homedir(), ".tokenwise");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const historyPath = join(dir, "comparisons.json");
  let history: ComparisonResult[] = [];
  try {
    if (existsSync(historyPath)) {
      history = JSON.parse(readFileSync(historyPath, "utf-8"));
    }
  } catch {}

  history.push(result);
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

export async function runCompare(options: {
  before?: boolean;
  after?: boolean;
  json?: boolean;
  session1?: string;
  session2?: string;
  model: string;
}) {
  let beforeData: ComparisonData | null = null;
  let afterData: ComparisonData | null = null;

  if (options.session1 && options.session2) {
    beforeData = await getSessionData(options.session1);
    afterData = await getSessionData(options.session2);
  } else if (options.before && options.after) {
    [beforeData, afterData] = await getTwoLatestSessions();
  } else {
    [beforeData, afterData] = await getTwoLatestSessions();
  }

  if (!beforeData && !afterData) {
    console.log(chalk.red("  No session data found for comparison."));
    console.log(chalk.gray("  Usage: tokenwise compare <session1> <session2>"));
    console.log(chalk.gray("         tokenwise compare --before --after"));
    process.exit(1);
  }

  if (!afterData) {
    console.log(chalk.yellow("  Only one session found. Need at least two for comparison."));
    process.exit(0);
  }

  if (!beforeData) {
    console.log(chalk.yellow("  Only one session available. Showing single session data:"));
    console.log(`  Input tokens:     ${formatNumber(afterData.inputTokens)}`);
    console.log(`  System prompt:    ${formatNumber(afterData.systemPromptEstimate)}`);
    console.log(`  Cache hit rate:   ${formatPercent(afterData.cacheHitRate * 100)}`);
    console.log(`  Cost:            ${formatCost(afterData.cost)}`);
    process.exit(0);
  }

  const pricing = getPricing(options.model);
  const costDiff = afterData.cost - beforeData.cost;
  const monthlySavings = estimateMonthly(-costDiff);

  const result: ComparisonResult = {
    before: beforeData,
    after: afterData,
    savings: {
      inputDiff: afterData.inputTokens - beforeData.inputTokens,
      inputPercent: calcPercentDiff(beforeData.inputTokens, afterData.inputTokens),
      systemPromptDiff: afterData.systemPromptEstimate - beforeData.systemPromptEstimate,
      systemPromptPercent: calcPercentDiff(beforeData.systemPromptEstimate, afterData.systemPromptEstimate),
      cacheHitRateDiff: afterData.cacheHitRate - beforeData.cacheHitRate,
      cacheHitRatePercent: (afterData.cacheHitRate - beforeData.cacheHitRate) * 100,
      costDiff,
      costPercent: calcPercentDiff(beforeData.cost, afterData.cost),
      monthlySavings: costDiff < 0 ? monthlySavings : 0,
    },
  };

  saveComparison(result);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("");
  console.log(chalk.bold("  tokenwise compare") + chalk.gray(" — before/after savings proof"));
  console.log("");

  const colWidth = 30;
  console.log(chalk.bold("  Before:").padEnd(colWidth) + chalk.bold("After:"));
  console.log(chalk.gray("  " + "─".repeat(60)));

  console.log(
    `  Input tokens:     ${chalk.white(formatNumber(beforeData.inputTokens))}`.padEnd(colWidth) +
    `Input tokens:     ${formatDiff(result.savings.inputDiff, -result.savings.inputPercent)}`
  );

  console.log(
    `  System prompt:    ${chalk.white(formatNumber(beforeData.systemPromptEstimate))}`.padEnd(colWidth) +
    `System prompt:    ${formatDiff(result.savings.systemPromptDiff, -result.savings.systemPromptPercent)}`
  );

  console.log(
    `  Cache hit rate:   ${chalk.white(formatPercent(beforeData.cacheHitRate * 100))}`.padEnd(colWidth) +
    `Cache hit rate:   ${formatSignedPercent(result.savings.cacheHitRatePercent)}`
  );

  console.log(
    `  Cost:             ${chalk.white(formatCost(beforeData.cost))}`.padEnd(colWidth) +
    `Cost:             ${formatDiff(result.savings.costDiff, -result.savings.costPercent)}`
  );

  console.log("");

  if (result.savings.costDiff < 0) {
    console.log(chalk.green(`  You saved ${formatCost(Math.abs(result.savings.costDiff))} per session`));
    console.log(chalk.green(`  Monthly savings estimate: ${formatCost(result.savings.monthlySavings)}/month`));
  } else if (result.savings.costDiff > 0) {
    console.log(chalk.yellow(`  Cost increased by ${formatCost(result.savings.costDiff)} per session`));
  } else {
    console.log(chalk.gray("  No cost change between sessions"));
  }

  console.log("");
}
