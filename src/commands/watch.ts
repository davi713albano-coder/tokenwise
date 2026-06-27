import chalk from "chalk";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { getPricing, estimateMonthly } from "../shared/pricing.js";
import { formatNumber, formatCost, formatPercent } from "../shared/format.js";
import { findClaudeCodeSessions, parseSession, analyzeTokens } from "../scan/claude-code.js";
import { findOpenCodeDb, getLatestSession, analyzeOpenCodeSession } from "../scan/opencode.js";
import { detectAgents } from "../scan/detector.js";
import { AGENT_LABELS } from "../scan/types.js";

const ESC = "\x1b[";
const HIDE_CURSOR = `${ESC}?25l`;
const SHOW_CURSOR = `${ESC}?25h`;
const CLEAR_SCREEN = `${ESC}2J`;
const CURSOR_HOME = `${ESC}H`;
const CLEAR_LINE = `${ESC}2K`;

function bar(value: number, max: number, width: number): string {
  const filled = Math.round((value / max) * width);
  return "\u2588".repeat(Math.max(0, filled)) + "\u2591".repeat(Math.max(0, width - filled));
}

interface WatchState {
  startTime: number;
  lastInputTokens: number;
  lastOutputTokens: number;
  lastCacheRead: number;
  lastCost: number;
  lastMessageTime: number;
  lastMessageTokens: number;
  agent: string;
  agentLabel: string;
  model: string;
  sessionModel: string;
  sessionId: string;
  duration: number;
}

function clearScreen() {
  process.stdout.write(CLEAR_SCREEN + CURSOR_HOME);
}

function moveCursor(row: number, col: number) {
  process.stdout.write(`${ESC}${row};${col}H`);
}

function writeAt(row: number, col: number, text: string) {
  process.stdout.write(`${ESC}${row};${col}H${CLEAR_LINE}${text}`);
}

export async function runWatch(options: {
  model: string;
  alert?: number;
}) {
  const pricing = getPricing(options.model);
  const detected = detectAgents(process.cwd());
  const available = detected.filter((a) => a.available);

  if (available.length === 0) {
    console.log(chalk.red("  No AI agent data found. Start a Claude Code or OpenCode session first."));
    process.exit(1);
  }

  const primaryAgent = available[0];
  const agentKey = primaryAgent.agent as string;
  const agentLabel = AGENT_LABELS[agentKey] || agentKey;

  let state: WatchState = {
    startTime: Date.now(),
    lastInputTokens: 0,
    lastOutputTokens: 0,
    lastCacheRead: 0,
    lastCost: 0,
    lastMessageTime: Date.now(),
    lastMessageTokens: 0,
    agent: agentKey,
    agentLabel,
    model: options.model,
    sessionModel: "",
    sessionId: "",
    duration: 0,
  };

  let alerted = false;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdout.write(HIDE_CURSOR);

  const onKey = (key: string) => {
    if (key === "q" || key === "Q" || key === "\u0003") {
      cleanup();
      process.exit(0);
    }
    if (key === "s" || key === "S") {
      takeSnapshot(state);
    }
  };
  process.stdin.on("data", onKey);

  const cleanup = () => {
    process.stdout.write(SHOW_CURSOR);
    process.stdin.setRawMode(false);
    process.stdin.removeListener("data", onKey);
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  async function poll() {
    try {
      if (agentKey === "claude-code") {
        const sessions = findClaudeCodeSessions();
        if (sessions.length > 0) {
          const session = parseSession(sessions[0]);
          const breakdown = analyzeTokens(session);
          state.lastInputTokens = breakdown.totalInput;
          state.lastOutputTokens = breakdown.totalOutput;
          state.lastCacheRead = breakdown.cacheRead;
          state.sessionModel = "claude-sonnet-4";
          state.sessionId = sessions[0].split(/[/\\]/).pop() || "unknown";
          const costResult =
            breakdown.totalInput * pricing.inputPerMillion / 1_000_000 +
            breakdown.totalOutput * pricing.outputPerMillion / 1_000_000 +
            breakdown.cacheRead * pricing.cacheReadPerMillion / 1_000_000;
          state.lastCost = costResult;
          state.lastCacheRead = breakdown.cacheRead;
          state.lastMessageTime = Date.now();
          state.lastMessageTokens = breakdown.totalInput;
        }
      } else if (agentKey === "opencode") {
        const dbPath = findOpenCodeDb();
        if (dbPath) {
          const sessionInfo = await getLatestSession(dbPath);
          if (sessionInfo) {
            const breakdown = await analyzeOpenCodeSession(dbPath, sessionInfo.id);
            if (breakdown) {
              state.lastInputTokens = breakdown.totalInput;
              state.lastOutputTokens = breakdown.totalOutput;
              state.lastCacheRead = breakdown.cacheRead;
              state.sessionModel = sessionInfo.model || "unknown";
              state.sessionId = sessionInfo.id;
              state.lastCost = breakdown.cost;
            }
          }
        }
      }
    } catch {}

    if (options.alert && !alerted && state.lastCost >= options.alert) {
      alerted = true;
      process.stdout.write("\x07");
      writeAt(14, 1, chalk.red.bold(`  ⚠ ALERT: Session cost $${state.lastCost.toFixed(2)} exceeds $${options.alert} threshold!`));
    }

    render(state);
  }

  function render(s: WatchState) {
    const durationMs = Date.now() - s.startTime;
    const hours = Math.floor(durationMs / 3600000).toString().padStart(2, "0");
    const minutes = Math.floor((durationMs % 3600000) / 60000).toString().padStart(2, "0");
    const seconds = Math.floor((durationMs % 60000) / 1000).toString().padStart(2, "0");
    const durationStr = `${hours}:${minutes}:${seconds}`;
    const startTimeStr = new Date(s.startTime).toLocaleTimeString();

    const maxBarVal = Math.max(s.lastInputTokens, 1);
    const cachePercent = s.lastInputTokens + s.lastCacheRead > 0
      ? Math.round((s.lastCacheRead / (s.lastInputTokens + s.lastCacheRead)) * 100)
      : 0;
    const rate = durationMs > 0 ? (s.lastCost / (durationMs / 3600000)) : 0;
    const projected = rate * 8;

    const headerBar = "─".repeat(51);
    const rows = [
      chalk.bold.cyan("  ┌─ tokenwise watch ") + chalk.gray("─").repeat(34) + chalk.bold.cyan("┐"),
      chalk.bold.cyan("  │") + ` Agent: ${chalk.white(s.agentLabel)}  Model: ${chalk.white(s.sessionModel || s.model)}`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │") + ` Session started: ${chalk.white(startTimeStr)}  Duration: ${chalk.white(durationStr)}`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  ├") + chalk.gray(headerBar) + chalk.bold.cyan("┤"),
      chalk.bold.cyan("  │") + chalk.bold(" LIVE TOKEN COUNTER").padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │").padEnd(52) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │") + ` Input tokens:   ${chalk.cyan(bar(s.lastInputTokens, maxBarVal, 14))}  ${chalk.white(formatNumber(s.lastInputTokens))}`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │") + ` Cache hits:     ${chalk.green(bar(s.lastCacheRead, maxBarVal, 14))}  ${chalk.white(formatNumber(s.lastCacheRead))} (${formatPercent(cachePercent)})`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │") + ` Output tokens:  ${chalk.yellow(bar(s.lastOutputTokens, maxBarVal, 14))}  ${chalk.white(formatNumber(s.lastOutputTokens))}`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │").padEnd(52) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │") + ` This session:   ${chalk.white(formatCost(s.lastCost))}`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │") + ` Rate:            ${chalk.white(formatCost(rate) + "/hour")}`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  │") + ` Projected today: ${chalk.white(formatCost(projected))}`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  ├") + chalk.gray(headerBar) + chalk.bold.cyan("┤"),
      chalk.bold.cyan("  │") + ` Last message: ${chalk.gray("+")}${chalk.white(formatNumber(s.lastMessageTokens))} tokens  ${chalk.gray(new Date(s.lastMessageTime).toLocaleTimeString())}`.padEnd(51) + chalk.bold.cyan("│"),
      chalk.bold.cyan("  └") + chalk.gray("─".repeat(51)) + chalk.bold.cyan("┘"),
      "",
      chalk.gray("  Press Q to quit  |  Press S to save snapshot"),
    ];

    clearScreen();
    for (let i = 0; i < rows.length; i++) {
      writeAt(i + 1, 1, rows[i]);
    }
  }

  await poll();
  const interval = setInterval(poll, 2000);

  process.on("exit", () => {
    clearInterval(interval);
    cleanup();
  });
}

function takeSnapshot(state: WatchState) {
  const dir = join(homedir(), ".tokenwise");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `snapshot-${timestamp}.json`;
  const filepath = join(dir, filename);

  writeFileSync(filepath, JSON.stringify({
    timestamp: new Date().toISOString(),
    agent: state.agent,
    inputTokens: state.lastInputTokens,
    outputTokens: state.lastOutputTokens,
    cacheRead: state.lastCacheRead,
    cost: state.lastCost,
    model: state.model,
  }, null, 2));

  writeAt(19, 1, chalk.green(`  Snapshot saved: ${filename}`));
}
