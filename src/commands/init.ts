import chalk from "chalk";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { findInstructionFiles } from "../audit/scanner.js";
import { auditContent } from "../audit/heuristics.js";
import { getPricing, estimateMonthly } from "../shared/pricing.js";
import { formatNumber, formatCost } from "../shared/format.js";
import { detectAgents } from "../scan/detector.js";
import { createInterface } from "node:readline";

interface Config {
  defaultModel: string;
  alertThreshold: number | null;
  ignorePatterns: string[];
  agents: string[];
}

const DEFAULT_CONFIG: Config = {
  defaultModel: "sonnet",
  alertThreshold: null,
  ignorePatterns: [],
  agents: [],
};

function getConfigPath(): string {
  return join(homedir(), ".tokenwise", "config.json");
}

function loadConfig(): Config {
  const path = getConfigPath();
  try {
    if (existsSync(path)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(path, "utf-8")) };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: Config) {
  const dir = join(homedir(), ".tokenwise");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runInit() {
  console.log("");
  console.log(chalk.bold.cyan("  Welcome to tokenwise!"));
  console.log(chalk.gray("  Let's set up your token waste analytics in 60 seconds."));
  console.log("");

  console.log(chalk.bold("  Detecting your AI agents..."));
  const detected = detectAgents(process.cwd());

  for (const agent of detected) {
    const status = agent.available
      ? chalk.green("\u2713")
      : chalk.red("\u2717");
    const detail = agent.available
      ? agent.path
      : "not detected";
    console.log(`  ${status} ${chalk.white(agent.label)} — ${chalk.gray(detail)}`);
  }

  const available = detected.filter((a) => a.available);
  console.log("");

  console.log(chalk.bold("  Scanning your instruction files..."));
  const files = findInstructionFiles(process.cwd());
  const pricing = getPricing("sonnet");
  let quickWinAvailable = false;
  let monthlySavingsEstimate = 0;

  for (const file of files) {
    if (!file.exists || !file.content) continue;
    const flags = auditContent(file.content, file.path, { projectDir: process.cwd() });
    const reducible = flags.reduce((s, f) => s + (f.savings || 0), 0);
    const high = flags.some((f) => f.severity === "high");

    if (high || file.tokens > 500) {
      const icon = high ? chalk.red("\u26a0") : chalk.yellow("\u26a0");
      console.log(`  ${icon} ${chalk.white(file.relPath)} — ${formatNumber(file.tokens)} tokens (${high ? "HIGH" : "MEDIUM"} — threshold: 500)`);
      if (reducible > 0) quickWinAvailable = true;
      monthlySavingsEstimate += reducible * pricing.inputPerMillion / 1_000_000;
    }
  }

  if (files.length === 0) {
    console.log(chalk.gray("  No instruction files found in current directory."));
  }

  console.log("");

  const config = loadConfig();
  config.agents = available.map((a) => a.agent as string);

  if (quickWinAvailable) {
    const monthlyTotal = estimateMonthly(monthlySavingsEstimate);
    console.log(chalk.green(`  Quick win available: run tokenwise audit --fix to save ~${formatCost(monthlyTotal)}/month`));
    const answer = await ask(chalk.bold("  Run it now? (Y/n) "));
    if (answer.toLowerCase() !== "n" && answer.toLowerCase() !== "no") {
      const { applyFix } = await import("../audit/fixer.js");
      for (const file of files) {
        if (!file.exists || !file.content) continue;
        const flags = auditContent(file.content, file.path, { projectDir: process.cwd() });
        if (flags.length === 0) continue;
        const result = applyFix(file.path, file.content, flags);
        if (result.transforms.length > 0) {
          console.log(chalk.green(`  Fixed ${file.relPath}: ${result.transforms.join(", ")}`));
        }
      }
    }
  }

  saveConfig(config);

  const ignorePath = join(process.cwd(), ".tokenwise-ignore");
  if (!existsSync(ignorePath)) {
    writeFileSync(ignorePath, "# Files/patterns for tokenwise to ignore\n# Example:\n# node_modules/**\n# *.generated.md\n", "utf-8");
  }

  console.log("");
  console.log(chalk.green("  Setup complete!"));
  console.log(chalk.gray(`  Config saved to ${getConfigPath()}`));
  console.log(chalk.gray(`  Ignore file created at .tokenwise-ignore`));
  console.log("");
  console.log(chalk.bold("  Get started:"));
  console.log(chalk.white("    npx @davizin713/tokenwise audit") + chalk.gray("  # analyze instruction files"));
  console.log(chalk.white("    npx @davizin713/tokenwise scan") + chalk.gray("   # analyze session costs"));
  console.log(chalk.white("    npx @davizin713/tokenwise watch") + chalk.gray("  # live cost ticker"));
  console.log("");
}
