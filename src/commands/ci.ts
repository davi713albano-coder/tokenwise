import chalk from "chalk";
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { findInstructionFiles } from "../audit/scanner.js";
import { auditContent } from "../audit/heuristics.js";
import { formatNumber, formatCost, formatPercent } from "../shared/format.js";
import type { AuditFlag } from "../audit/types.js";

interface CIViolation {
  file: string;
  line?: number;
  severity: "error" | "warning";
  message: string;
}

function githubAnnotation(severity: "error" | "warning", file: string, message: string, line?: number): string {
  const lineStr = line ? `,line=${line}` : "";
  return `::${severity} file=${file}${lineStr}::tokenwise: ${message}`;
}

export function runCI(options: {
  dir: string;
  maxTokens?: number;
  maxBoilerplate?: number;
  warnOnly?: boolean;
  init?: boolean;
}) {
  if (options.init) {
    initWorkflow();
    return;
  }

  const projectDir = resolve(options.dir || process.cwd());
  const maxTokens = options.maxTokens || 500;
  const maxBoilerplate = options.maxBoilerplate || 30;
  const warnOnly = options.warnOnly || false;

  const files = findInstructionFiles(projectDir);
  const violations: CIViolation[] = [];
  let totalInstructionTokens = 0;

  if (files.length === 0) {
    console.log(chalk.green("  tokenwise ci: No instruction files found. Clean."));
    process.exit(0);
  }

  for (const file of files) {
    if (!file.exists || !file.content) continue;

    const flags = auditContent(file.content, file.path, { projectDir });
    totalInstructionTokens += file.tokens;

    if (file.tokens > maxTokens) {
      violations.push({
        file: file.relPath,
        severity: "error",
        message: `${formatNumber(file.tokens)} tokens (threshold: ${maxTokens}). Run tokenwise audit --fix`,
      });
    }

    for (const flag of flags) {
      if (flag.id === "high_boilerplate") {
        const boilerplateMatch = flag.message.match(/(\d+)%/);
        const boilerplatePct = boilerplateMatch ? parseInt(boilerplateMatch[1], 10) : 0;
        if (boilerplatePct > maxBoilerplate) {
          violations.push({
            file: file.relPath,
            line: flag.line,
            severity: "error",
            message: `${boilerplatePct}% boilerplate (threshold: ${maxBoilerplate}%). ${flag.message}`,
          });
        }
      }

      if (flag.id === "unscoped_rule") {
        violations.push({
          file: file.relPath,
          line: flag.line,
          severity: warnOnly ? "warning" : "error",
          message: `unscoped rule loads on every message. ${flag.message}`,
        });
      }
    }
  }

  if (totalInstructionTokens > 2000) {
    violations.push({
      file: "total",
      severity: "warning",
      message: `Total instruction tokens (${formatNumber(totalInstructionTokens)}) exceeds 2,000. Review for reduction opportunities.`,
    });
  }

  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

  if (isGitHubActions) {
    for (const v of violations) {
      console.log(githubAnnotation(v.severity, v.file, v.message, v.line));
    }
  } else {
    console.log("");
    console.log(chalk.bold("  tokenwise ci") + chalk.gray(" — token waste check"));

    if (errors.length > 0) {
      console.log(chalk.red(`\n  ${errors.length} error(s):`));
      for (const e of errors) {
        const loc = e.line ? `:${e.line}` : "";
        console.log(chalk.red(`    ✗ ${e.file}${loc} — ${e.message}`));
      }
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow(`\n  ${warnings.length} warning(s):`));
      for (const w of warnings) {
        const loc = w.line ? `:${w.line}` : "";
        console.log(chalk.yellow(`    ⚠ ${w.file}${loc} — ${w.message}`));
      }
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log(chalk.green("\n  All checks passed. Instruction files are optimized."));
    }

    console.log("");
  }

  if (!warnOnly && errors.length > 0) {
    process.exit(1);
  }
}

function initWorkflow() {
  const dir = join(process.cwd(), ".github", "workflows");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const workflow = `name: tokenwise ci

on:
  pull_request:
    paths:
      - 'CLAUDE.md'
      - 'AGENTS.md'
      - '.claude/rules/**'
      - '.opencode/**'
      - '.cursorrules'
      - '.cursor/rules/**'
      - '.clinerules'

jobs:
  tokenwise:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @davizin713/tokenwise
      - run: tokenwise ci
`;

  const filePath = join(dir, "tokenwise.yml");
  if (existsSync(filePath)) {
    console.log(chalk.yellow("  .github/workflows/tokenwise.yml already exists."));
    return;
  }

  writeFileSync(filePath, workflow, "utf-8");
  console.log(chalk.green("  Created .github/workflows/tokenwise.yml"));
  console.log(chalk.gray("  Commit it to enable token waste checks on PRs."));
}
