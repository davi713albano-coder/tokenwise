import chalk from "chalk";
import Table from "cli-table3";
import type { AuditResult, FileAuditResult, AuditFlag } from "./types.js";
import {
  formatNumber,
  formatPercent,
  formatCost,
  barChart,
} from "../shared/format.js";
import { getPricing } from "../shared/pricing.js";

function severityColor(severity: "high" | "medium" | "low") {
  switch (severity) {
    case "high":
      return chalk.red;
    case "medium":
      return chalk.yellow;
    case "low":
      return chalk.gray;
  }
}

function loadFreqLabel(
  freq: "every_message" | "conditional" | "on_demand"
): string {
  switch (freq) {
    case "every_message":
      return chalk.red("EVERY MSG");
    case "conditional":
      return chalk.yellow("conditional");
    case "on_demand":
      return chalk.green("on demand");
  }
}

export function formatAuditTable(result: AuditResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    chalk.bold("  tokenwise audit") + chalk.gray(" — instruction file analysis")
  );
  lines.push("");

  const table = new Table({
    head: [
      chalk.gray("File"),
      chalk.gray("Tokens"),
      chalk.gray("Lines"),
      chalk.gray("Load Freq"),
      chalk.gray("Flags"),
      chalk.gray("Savings"),
    ],
    colAligns: ["left", "right", "right", "center", "left", "right"],
    style: { head: [], border: ["gray"], "padding-left": 1, "padding-right": 1 },
  });

  for (const file of result.files) {
    const flagSummary =
      file.flags.length > 0
        ? file.flags
            .map((f) => severityColor(f.severity)(f.id.replace(/_/g, " ")))
            .join(", ")
        : chalk.green("ok");
    const savingsStr =
      file.reducibleTokens > 0
        ? chalk.green(`-${formatNumber(file.reducibleTokens)}`)
        : "-";
    table.push([
      chalk.white(file.relPath),
      formatNumber(file.tokens),
      formatNumber(file.lines),
      loadFreqLabel(file.loadFrequency),
      flagSummary,
      savingsStr,
    ]);
  }

  lines.push(table.toString());
  lines.push("");

  const segments = result.files
    .filter((f) => f.loadFrequency === "every_message")
    .map((f) => ({
      label: f.relPath,
      value: f.tokens,
      color: "blue",
    }));

  if (segments.length > 0) {
    lines.push(chalk.bold("  Token budget per message (always-loaded files)"));
    lines.push(chalk.gray("  " + barChart(segments, 40)));
    lines.push("");
  }

  lines.push(chalk.bold("  Summary"));
  lines.push(
    `  Total tokens in instruction files:   ${chalk.white(formatNumber(result.totalTokens))}`
  );
  lines.push(
    `  Reducible tokens:                    ${chalk.green(formatNumber(result.reducibleTokens))} (${formatPercent(result.reduciblePercent)} reducible)`
  );
  lines.push(
    `  Est. monthly cost (${result.model}):     ${chalk.white(formatCost(result.monthlyCostEstimate))}`
  );
  lines.push(
    `  Est. monthly savings:                ${chalk.green(formatCost(result.monthlySavingsEstimate))}`
  );
  lines.push("");

  if (result.reducibleTokens > 0) {
    lines.push(
      chalk.green(
        `  Run ${chalk.bold("tokenwise audit --fix")} to auto-fix safe issues.`
      )
    );
    lines.push("");
  }

  return lines.join("\n");
}

export function formatAuditFlags(result: AuditResult, verbose: boolean): string {
  if (!verbose) return "";
  const lines: string[] = [];
  lines.push(chalk.bold("  Detailed flags"));
  lines.push("");

  for (const file of result.files) {
    if (file.flags.length === 0) continue;
    lines.push(chalk.underline(file.relPath));
    for (const flag of file.flags) {
      const icon = severityColor(flag.severity)(
        flag.severity === "high" ? "!" : flag.severity === "medium" ? "~" : "-"
      );
      lines.push(
        `  ${icon} [${flag.severity}] ${flag.id}: ${flag.message}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatAuditJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}
