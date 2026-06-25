import chalk from "chalk";
import Table from "cli-table3";
import {
  formatNumber,
  formatPercent,
  formatCost,
  barChart,
} from "../shared/format.js";
import { estimateCost, estimateMonthly, getPricing } from "../shared/pricing.js";
import type { TokenBreakdown as CostTokenBreakdown } from "../shared/pricing.js";

export interface ScanComponent {
  label: string;
  tokens: number;
  percentOfTotal: number;
  estCost: number;
}

import { AGENT_LABELS } from "./types.js";

export interface ScanResult {
  source: string;
  sessionId: string;
  sessionDate: string;
  model: string;
  messageCount: number;
  components: ScanComponent[];
  cacheHitRate: number;
  topHogs: Array<{ label: string; tokens: number; tip: string }>;
  totalInput: number;
  totalOutput: number;
  cacheRead: number;
  estimatedCost: number;
  estimatedMonthlyCost: number;
  modelUsed: string;
}

export function formatScanTable(result: ScanResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    chalk.bold("  tokenwise scan") +
      chalk.gray(" — session token analysis")
  );
  lines.push("");

  lines.push(`  Source:     ${chalk.white(AGENT_LABELS[result.source] || result.source)}`);
  lines.push(`  Session:   ${chalk.white(result.sessionId)}`);
  lines.push(`  Date:      ${chalk.white(result.sessionDate)}`);
  lines.push(`  Model:     ${chalk.white(result.model)}`);
  lines.push(
    `  Messages:  ${chalk.white(formatNumber(result.messageCount))}`
  );
  lines.push("");

  const table = new Table({
    head: [
      chalk.gray("Component"),
      chalk.gray("Tokens"),
      chalk.gray("% of Input"),
      chalk.gray("Est. Cost"),
    ],
    colAligns: ["left", "right", "right", "right"],
    style: { head: [], border: ["gray"], "padding-left": 1, "padding-right": 1 },
  });

  for (const comp of result.components) {
    const costStr =
      comp.estCost > 0 ? formatCost(comp.estCost) : chalk.gray("-");
    table.push([
      chalk.white(comp.label),
      formatNumber(comp.tokens),
      formatPercent(comp.percentOfTotal),
      costStr,
    ]);
  }

  lines.push(table.toString());
  lines.push("");

  const segments = result.components
    .filter((c) => c.tokens > 0)
    .map((c) => ({ label: c.label, value: c.tokens, color: "blue" }));

  if (segments.length > 0) {
    lines.push(chalk.bold("  Token distribution"));
    lines.push(chalk.gray("  " + barChart(segments, 40)));
    lines.push("");
  }

  lines.push(chalk.bold("  Cache performance"));
  const cacheColor =
    result.cacheHitRate > 0.5
      ? chalk.green
      : result.cacheHitRate > 0.2
        ? chalk.yellow
        : chalk.red;
  lines.push(
    `  Cache hit rate: ${cacheColor(formatPercent(result.cacheHitRate * 100))} ${cacheColor(
      result.cacheHitRate > 0.5
        ? "(good)"
        : result.cacheHitRate > 0.2
          ? "(ok)"
          : "(low — cache may be breaking)"
    )}`
  );
  lines.push("");

  if (result.topHogs.length > 0) {
    lines.push(chalk.bold("  Top token hogs"));
    for (let i = 0; i < result.topHogs.length; i++) {
      const hog = result.topHogs[i];
      lines.push(
        `  ${i + 1}. ${chalk.yellow(hog.label)} — ${formatNumber(hog.tokens)} tokens`
      );
      lines.push(`     ${chalk.gray(hog.tip)}`);
    }
    lines.push("");
  }

  lines.push(chalk.bold("  Cost estimate"));
  lines.push(
    `  This session:     ${chalk.white(formatCost(result.estimatedCost))}`
  );
  lines.push(
    `  Monthly (22 days): ${chalk.white(formatCost(result.estimatedMonthlyCost))}`
  );
  lines.push("");

  return lines.join("\n");
}

export function formatScanJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
