import chalk from "chalk";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { getPricing, estimateMonthly } from "../shared/pricing.js";
import { formatNumber, formatCost, formatPercent } from "../shared/format.js";
import { findClaudeCodeSessions, parseSession, analyzeTokens } from "../scan/claude-code.js";
import { findOpenCodeDb, getLatestSession, analyzeOpenCodeSession } from "../scan/opencode.js";

interface DayEntry {
  date: string;
  inputTokens: number;
  cost: number;
  label?: string;
}

function barForValue(value: number, maxValue: number, width: number = 20): string {
  if (maxValue === 0) return "\u2591".repeat(width);
  const filled = Math.round((value / maxValue) * width);
  return "\u2588".repeat(Math.max(0, filled)) + "\u2591".repeat(Math.max(0, width - filled));
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

async function getAllSessionEntries(sinceDays: number): Promise<DayEntry[]> {
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const entries: DayEntry[] = [];
  const seen = new Map<string, DayEntry>();

  const claudeSessions = findClaudeCodeSessions();
  for (const sessionPath of claudeSessions) {
    try {
      const stat = statSync(sessionPath);
      if (stat.mtimeMs < cutoff) continue;

      const session = parseSession(sessionPath);
      const breakdown = analyzeTokens(session);
      const date = formatDate(stat.mtimeMs);
      const pricing = getPricing("sonnet");
      const cost = breakdown.totalInput * pricing.inputPerMillion / 1_000_000;

      const existing = seen.get(date);
      if (existing) {
        existing.inputTokens += breakdown.totalInput;
        existing.cost += cost;
      } else {
        const entry: DayEntry = { date, inputTokens: breakdown.totalInput, cost };
        seen.set(date, entry);
      }
    } catch {}
  }

  try {
    const dbPath = findOpenCodeDb();
    if (dbPath) {
      const sessionInfo = await getLatestSession(dbPath);
      if (sessionInfo) {
        const breakdown = await analyzeOpenCodeSession(dbPath, sessionInfo.id);
        if (breakdown) {
          const date = formatDate(sessionInfo.timeCreated);
          const entry: DayEntry = { date, inputTokens: breakdown.totalInput, cost: breakdown.cost };
          const existing = seen.get(date);
          if (existing) {
            existing.inputTokens += breakdown.totalInput;
            existing.cost += breakdown.cost;
          } else {
            seen.set(date, entry);
          }
        }
      }
    }
  } catch {}

  for (const entry of seen.values()) {
    entries.push(entry);
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const drop = curr.inputTokens < prev.inputTokens * 0.6;
    if (drop) {
      curr.label = "after audit --fix";
    }
  }

  return entries;
}

export async function runHistory(options: {
  days?: number;
  export?: string;
  model: string;
}) {
  const days = options.days || 14;
  const pricing = getPricing(options.model);
  const entries = await getAllSessionEntries(days);

  if (entries.length === 0) {
    console.log(chalk.yellow("  No session data found for the specified period."));
    process.exit(0);
  }

  if (options.export === "csv") {
    const csvLines = ["date,input_tokens,cost"];
    for (const e of entries) {
      csvLines.push(`${e.date},${e.inputTokens},${e.cost.toFixed(4)}`);
    }
    const csv = csvLines.join("\n");
    const outputPath = join(process.cwd(), "tokenwise-history.csv");
    writeFileSync(outputPath, csv, "utf-8");
    console.log(chalk.green(`  Exported ${entries.length} entries to ${outputPath}`));
    return;
  }

  const maxTokens = Math.max(...entries.map((e) => e.inputTokens), 1);

  console.log("");
  console.log(chalk.bold(`  Token usage — last ${days} days`));
  console.log("");

  for (const entry of entries) {
    const bar = barForValue(entry.inputTokens, maxTokens);
    const label = entry.label ? chalk.green(` ← ${entry.label}`) : "";
    console.log(
      `  ${chalk.white(entry.date)}  ${chalk.cyan(bar)}  ${chalk.white(formatNumber(entry.inputTokens))}  ${formatCost(entry.cost)}${label}`
    );
  }

  if (entries.length >= 2) {
    const first = entries[0];
    const last = entries[entries.length - 1];
    const trendPct = first.inputTokens > 0
      ? ((last.inputTokens - first.inputTokens) / first.inputTokens) * 100
      : 0;
    const trendStr = trendPct < -10
      ? chalk.green(`${trendPct.toFixed(0)}%`)
      : trendPct > 10
        ? chalk.red(`+${trendPct.toFixed(0)}%`)
        : chalk.gray(`${trendPct.toFixed(0)}%`);

    console.log("");
    console.log(`  Trend: ${trendStr} over the period`);

    const worst = entries.reduce((a, b) => a.cost > b.cost ? a : b);
    const best = entries.reduce((a, b) => a.cost < b.cost ? a : b);
    console.log(`  Most expensive: ${chalk.red(worst.date)} (${formatCost(worst.cost)})`);
    console.log(`  Most efficient: ${chalk.green(best.date)} (${formatCost(best.cost)})`);

    const avgCost = entries.reduce((s, e) => s + e.cost, 0) / entries.length;
    const lastEntry = entries[entries.length - 1];
    if (lastEntry.cost > avgCost * 1.5) {
      console.log(chalk.yellow(`  ⚠ Last session cost is above your average (${formatCost(avgCost)})`));
    }
  }

  console.log("");
}
