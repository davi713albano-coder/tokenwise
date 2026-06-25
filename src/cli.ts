#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { findInstructionFiles, parseFrontmatter } from "./audit/scanner.js";
import { auditContent } from "./audit/heuristics.js";
import { formatAuditTable, formatAuditFlags, formatAuditJson } from "./audit/reporter.js";
import { applyFix } from "./audit/fixer.js";
import { formatScanTable, formatScanJson } from "./scan/reporter.js";
import { estimateMonthly, estimateMessageCost, estimateCost, getPricing } from "./shared/pricing.js";
import { countTokens } from "./shared/counter.js";
import { formatNumber, formatCost } from "./shared/format.js";
import type { AuditResult, FileAuditResult } from "./audit/types.js";
import {
  getLatestSession as getClaudeLatest,
  findClaudeCodeSessions,
  parseSession as parseClaudeSession,
  analyzeTokens as analyzeClaudeTokens,
} from "./scan/claude-code.js";
import {
  findOpenCodeDb,
  getLatestSession as getOpenCodeLatest,
  analyzeOpenCodeSession,
} from "./scan/opencode.js";
import type { ScanResult, ScanComponent } from "./scan/reporter.js";

const VERSION = "0.1.0";

const BANNER = `
  ┌─────────────────────────────────────────┐
  │  tokenwise — token waste analytics       │
  │  Find out where your AI agent burns $$  │
  └─────────────────────────────────────────┘
`;

const program = new Command();

program
  .name("tokenwise")
  .description("Find out where your AI coding agent burns tokens")
  .version(VERSION)
  .addHelpText("before", BANNER);

program
  .command("audit")
  .description("Analyze instruction files (CLAUDE.md, AGENTS.md, rules/)")
  .option("--dir <path>", "Project directory", process.cwd())
  .option("--fix", "Auto-fix safe issues (creates .bak backups)")
  .option("--json", "Output raw JSON")
  .option("--model <model>", "Model for cost estimation: sonnet, haiku, opus", "sonnet")
  .option("--verbose", "Show per-flag details")
  .action(runAudit);

program
  .command("scan")
  .description("Analyze session logs (Claude Code + OpenCode)")
  .option("--session <path>", "Path to specific session file")
  .option("--db <path>", "Path to OpenCode database")
  .option("--json", "Output raw JSON")
  .option("--model <model>", "Model for cost estimation: sonnet, haiku, opus", "sonnet")
  .action((opts) => { runScan(opts).catch(handleError); });

program.parse();

function handleError(e: unknown) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

function runAudit(options: {
  dir: string;
  fix?: boolean;
  json?: boolean;
  model: string;
  verbose?: boolean;
}) {
  const projectDir = resolve(options.dir);

  if (!existsSync(projectDir)) {
    console.error(`Directory not found: ${projectDir}`);
    process.exit(1);
  }

  const files = findInstructionFiles(projectDir);
  if (files.length === 0) {
    console.log("No instruction files found in " + projectDir);
    console.log("Looking for: CLAUDE.md, AGENTS.md, .claude/rules/, .opencode/");
    console.log("Are you in a project root?");
    process.exit(0);
  }

  const fileResults: FileAuditResult[] = [];

  for (const file of files) {
    if (!file.exists || !file.content) {
      fileResults.push({
        path: file.path,
        relPath: file.relPath,
        tokens: 0,
        lines: 0,
        flags: [],
        reducibleTokens: 0,
        loadFrequency: file.loadFrequency,
        content: "",
      });
      continue;
    }

    const flags = auditContent(file.content, file.path, { projectDir });
    const reducibleTokens = flags.reduce(
      (sum, f) => sum + (f.savings || 0),
      0
    );

    fileResults.push({
      path: file.path,
      relPath: file.relPath,
      tokens: file.tokens,
      lines: file.lines,
      flags,
      reducibleTokens,
      loadFrequency: file.loadFrequency,
      content: file.content,
    });
  }

  const totalTokens = fileResults.reduce((s, f) => s + f.tokens, 0);
  const reducibleTokens = fileResults.reduce((s, f) => s + f.reducibleTokens, 0);
  const reduciblePercent =
    totalTokens > 0 ? (reducibleTokens / totalTokens) * 100 : 0;

  const alwaysLoadedTokens = fileResults
    .filter((f) => f.loadFrequency === "every_message")
    .reduce((s, f) => s + f.tokens, 0);

  const pricing = getPricing(options.model);
  const perMessageCost =
    (alwaysLoadedTokens * pricing.inputPerMillion) / 1_000_000;
  const perMessageSavings =
    (reducibleTokens * pricing.inputPerMillion) / 1_000_000;
  const monthlyCostEstimate = estimateMonthly(perMessageCost);
  const monthlySavingsEstimate = estimateMonthly(perMessageSavings);

  const result: AuditResult = {
    files: fileResults,
    totalTokens,
    reducibleTokens,
    reduciblePercent,
    monthlyCostEstimate,
    monthlySavingsEstimate,
    model: options.model,
  };

  if (options.json) {
    console.log(formatAuditJson(result));
    return;
  }

  console.log(formatAuditTable(result));

  if (options.verbose) {
    console.log(formatAuditFlags(result, true));
  }

  if (options.fix) {
    console.log("");
    console.log("  Applying safe fixes...");

    for (const file of fileResults) {
      if (file.flags.length === 0) continue;
      if (!file.content) continue;

      const fixResult = applyFix(file.path, file.content, file.flags);
      if (fixResult.transforms.length > 0) {
        console.log(`\n  ${file.relPath}:`);
        for (const t of fixResult.transforms) {
          console.log(`    - ${t}`);
        }
        console.log(
          `    Tokens: ${formatNumber(fixResult.originalTokens)} → ${formatNumber(fixResult.fixedTokens)} (${formatNumber(fixResult.savings)} saved)`
        );
        if (fixResult.backupPath) {
          console.log(`    Backup: ${fixResult.backupPath}`);
        }
      }
    }

    console.log("");
    console.log(
      "  Run `tokenwise audit` again to see updated token counts."
    );
  }
}

async function runScan(options: {
  session?: string;
  db?: string;
  json?: boolean;
  model: string;
}) {
  const pricing = getPricing(options.model);

  const claudeSessionPath =
    options.session || getClaudeLatest();
  const openCodeDbPath = options.db || findOpenCodeDb();

  let claudeResult: ScanResult | null = null;
  let openCodeResult: ScanResult | null = null;

  if (claudeSessionPath) {
    try {
      const session = parseClaudeSession(claudeSessionPath);
      const breakdown = analyzeClaudeTokens(session);
      claudeResult = buildClaudeScanResult(
        claudeSessionPath,
        breakdown,
        options.model,
        pricing
      );
    } catch (e) {
      console.error(
        `Failed to parse Claude Code session: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  if (openCodeDbPath) {
    try {
      const sessionInfo = await getOpenCodeLatest(openCodeDbPath);
      if (sessionInfo) {
        const breakdown = await analyzeOpenCodeSession(
          openCodeDbPath,
          sessionInfo.id
        );
        if (breakdown) {
          openCodeResult = buildOpenCodeScanResult(
            sessionInfo,
            breakdown,
            options.model,
            pricing
          );
        }
      }
    } catch (e) {
      console.error(
        `Failed to parse OpenCode session: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  if (!claudeResult && !openCodeResult) {
    console.log("No session data found.");
    console.log("Checked: ~/.claude/projects/, OpenCode database");
    console.log("Start a session first, then re-run `tokenwise scan`.");
    process.exit(0);
  }

  const results = [claudeResult, openCodeResult].filter(
    (r): r is ScanResult => r !== null
  );

  for (const result of results) {
    if (options.json) {
      console.log(formatScanJson(result));
    } else {
      console.log(formatScanTable(result));
    }
  }
}

function buildClaudeScanResult(
  sessionPath: string,
  breakdown: ReturnType<typeof analyzeClaudeTokens>,
  model: string,
  pricing: ReturnType<typeof getPricing>
): ScanResult {
  const totalInput = breakdown.totalInput;
  const totalWithCache = totalInput + breakdown.cacheRead;
  const costResult = estimateCost(
    {
      input: totalInput,
      output: breakdown.totalOutput,
      cacheRead: breakdown.cacheRead,
      cacheWrite: breakdown.cacheCreation,
    },
    model
  );

  const components: ScanComponent[] = [
    {
      label: "System Prompt",
      tokens: Math.round(breakdown.systemPromptEstimate),
      percentOfTotal:
        totalWithCache > 0
          ? (breakdown.systemPromptEstimate / totalWithCache) * 100
          : 0,
      estCost:
        (breakdown.systemPromptEstimate * pricing.inputPerMillion) /
        1_000_000,
    },
    {
      label: "History/Context",
      tokens: Math.round(breakdown.historyEstimate),
      percentOfTotal:
        totalWithCache > 0
          ? (breakdown.historyEstimate / totalWithCache) * 100
          : 0,
      estCost:
        (breakdown.historyEstimate * pricing.inputPerMillion) / 1_000_000,
    },
    {
      label: "Tool Output",
      tokens: Math.round(breakdown.toolOutputEstimate),
      percentOfTotal:
        totalWithCache > 0
          ? (breakdown.toolOutputEstimate / totalWithCache) * 100
          : 0,
      estCost:
        (breakdown.toolOutputEstimate * pricing.inputPerMillion) /
        1_000_000,
    },
    {
      label: "Code Reads",
      tokens: Math.round(breakdown.codeReadEstimate),
      percentOfTotal:
        totalWithCache > 0
          ? (breakdown.codeReadEstimate / totalWithCache) * 100
          : 0,
      estCost:
        (breakdown.codeReadEstimate * pricing.inputPerMillion) / 1_000_000,
    },
    {
      label: "Cache Hits (discounted)",
      tokens: breakdown.cacheRead,
      percentOfTotal:
        totalWithCache > 0 ? (breakdown.cacheRead / totalWithCache) * 100 : 0,
      estCost:
        (breakdown.cacheRead * pricing.cacheReadPerMillion) / 1_000_000,
    },
  ];

  const sortedComponents = [...components].sort(
    (a, b) => b.tokens - a.tokens
  );
  const topHogs = sortedComponents
    .filter((c) => c.tokens > 0)
    .slice(0, 3)
    .map((c) => ({
      label: c.label,
      tokens: c.tokens,
      tip: getTip(c.label),
    }));

  return {
    source: "claude-code",
    sessionId: sessionPath.split(/[/\\]/).pop() || "unknown",
    sessionDate: new Date().toISOString().split("T")[0],
    model,
    messageCount: breakdown.messageCount,
    components,
    cacheHitRate: breakdown.cacheHitRate,
    topHogs,
    totalInput: breakdown.totalInput,
    totalOutput: breakdown.totalOutput,
    cacheRead: breakdown.cacheRead,
    estimatedCost: costResult.totalCost,
    estimatedMonthlyCost: estimateMonthly(costResult.totalCost),
    modelUsed: model,
  };
}

function buildOpenCodeScanResult(
  sessionInfo: Awaited<ReturnType<typeof getOpenCodeLatest>>,
  breakdown: NonNullable<Awaited<ReturnType<typeof analyzeOpenCodeSession>>>,
  model: string,
  pricing: ReturnType<typeof getPricing>
): ScanResult {
  const totalInput = breakdown.totalInput;
  const totalWithCache = totalInput + breakdown.cacheRead;

  const components: ScanComponent[] = [
    {
      label: "System Prompt",
      tokens: Math.round(breakdown.systemPromptEstimate),
      percentOfTotal:
        totalWithCache > 0
          ? (breakdown.systemPromptEstimate / totalWithCache) * 100
          : 0,
      estCost:
        (breakdown.systemPromptEstimate * pricing.inputPerMillion) /
        1_000_000,
    },
    {
      label: "History/Context",
      tokens: Math.round(breakdown.historyEstimate),
      percentOfTotal:
        totalWithCache > 0
          ? (breakdown.historyEstimate / totalWithCache) * 100
          : 0,
      estCost:
        (breakdown.historyEstimate * pricing.inputPerMillion) / 1_000_000,
    },
    {
      label: "Tool Output",
      tokens: Math.round(breakdown.toolOutputEstimate),
      percentOfTotal:
        totalWithCache > 0
          ? (breakdown.toolOutputEstimate / totalWithCache) * 100
          : 0,
      estCost:
        (breakdown.toolOutputEstimate * pricing.inputPerMillion) /
        1_000_000,
    },
    {
      label: "Reasoning",
      tokens: breakdown.reasoning,
      percentOfTotal:
        totalWithCache > 0 ? (breakdown.reasoning / totalWithCache) * 100 : 0,
      estCost:
        (breakdown.reasoning * pricing.outputPerMillion) / 1_000_000,
    },
    {
      label: "Cache Hits (discounted)",
      tokens: breakdown.cacheRead,
      percentOfTotal:
        totalWithCache > 0 ? (breakdown.cacheRead / totalWithCache) * 100 : 0,
      estCost:
        (breakdown.cacheRead * pricing.cacheReadPerMillion) / 1_000_000,
    },
  ];

  const sortedComponents = [...components].sort(
    (a, b) => b.tokens - a.tokens
  );
  const topHogs = sortedComponents
    .filter((c) => c.tokens > 0)
    .slice(0, 3)
    .map((c) => ({
      label: c.label,
      tokens: c.tokens,
      tip: getTip(c.label),
    }));

  const costResult = estimateCost(
    {
      input: breakdown.totalInput,
      output: breakdown.totalOutput,
      cacheRead: breakdown.cacheRead,
      cacheWrite: breakdown.cacheWrite,
    },
    model
  );

  return {
    source: "opencode",
    sessionId: sessionInfo!.id,
    sessionDate: new Date(sessionInfo!.timeCreated).toISOString().split("T")[0],
    model: sessionInfo!.model,
    messageCount: breakdown.messageCount,
    components,
    cacheHitRate: breakdown.cacheHitRate,
    topHogs,
    totalInput: breakdown.totalInput,
    totalOutput: breakdown.totalOutput,
    cacheRead: breakdown.cacheRead,
    estimatedCost: breakdown.cost || costResult.totalCost,
    estimatedMonthlyCost: estimateMonthly(breakdown.cost || costResult.totalCost),
    modelUsed: model,
  };
}

function getTip(component: string): string {
  switch (component) {
    case "System Prompt":
      return "Run `tokenwise audit` to trim instruction files loaded every message.";
    case "History/Context":
      return "Use /compact more frequently to prune conversation history.";
    case "Tool Output":
      return "Compress build/test output before it enters context (PostToolUse hooks).";
    case "Code Reads":
      return "Use AST-based tools to read specific functions instead of full files.";
    case "Reasoning":
      return "Extended thinking tokens. Consider if the task needs deep reasoning.";
    case "Cache Hits (discounted)":
      return "Good — cache reads cost 90% less. Keep static content early in prompt.";
    default:
      return "Review this component for optimization opportunities.";
  }
}
