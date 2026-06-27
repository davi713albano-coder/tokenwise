import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { countTokens } from "../shared/counter.js";
import type { UniversalTokenBreakdown } from "./types.js";

export function findCodexSessions(): string | null {
  const all = findAllCodexSessions();
  return all.length > 0 ? all[0] : null;
}

export function findAllCodexSessions(): string[] {
  const XDG_DATA_HOME = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const candidates = [
    join(XDG_DATA_HOME, "codex", "sessions"),
    join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "codex",
      "sessions"
    ),
    join(
      process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
      "codex",
      "sessions"
    ),
    join(XDG_DATA_HOME, "openai", "codex", "sessions"),
  ];

  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      try {
        return readdirSync(dir, { recursive: true })
          .filter((f): f is string => {
            const full = join(dir, f.toString());
            try { return statSync(full).isFile(); } catch { return false; }
          })
          .filter((f) => f.endsWith(".json") || f.endsWith(".jsonl"))
          .map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime)
          .map((f) => f.path);
      } catch {}
    }
  }
  return [];
}

export function findCodexConfig(): string | null {
  const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const candidates = [
    join(XDG_CONFIG_HOME, "codex", "codex.json"),
    join(XDG_CONFIG_HOME, "codex", "config.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export interface CodexMessage {
  role: string;
  content: string;
  tokens?: { input: number; output: number };
}

export function parseCodexSession(filePath: string): CodexMessage[] {
  const content = readFileSync(filePath, "utf-8");
  return parseCodexContent(content);
}

export function parseCodexContent(content: string): CodexMessage[] {
  const messages: CodexMessage[] = [];

  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      for (const entry of data) {
        messages.push({
          role: entry.role || "unknown",
          content: typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content),
          tokens: entry.usage
            ? { input: entry.usage.input_tokens || entry.usage.prompt_tokens || 0, output: entry.usage.output_tokens || entry.usage.completion_tokens || 0 }
            : entry.tokens || undefined,
        });
      }
    } else if (data.messages && Array.isArray(data.messages)) {
      for (const entry of data.messages) {
        const normalizedTokens = entry.usage
          ? { input: entry.usage.input_tokens || entry.usage.prompt_tokens || 0, output: entry.usage.output_tokens || entry.usage.completion_tokens || 0 }
          : entry.tokens || undefined;
        messages.push({
          role: entry.role || "unknown",
          content: typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content),
          tokens: normalizedTokens,
        });
      }
    }
  } catch {
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        messages.push({
          role: entry.role || "unknown",
          content: typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content || ""),
          tokens: entry.usage
            ? { input: entry.usage.input_tokens || entry.usage.prompt_tokens || 0, output: entry.usage.output_tokens || entry.usage.completion_tokens || 0 }
            : undefined,
        });
      } catch {}
    }
  }

  return messages;
}

export function analyzeCodexSession(messages: CodexMessage[]): UniversalTokenBreakdown {
  let totalInput = 0;
  let totalOutput = 0;
  let msgCount = 0;
  let firstInput = 0;
  let isFirstMsg = true;

  const assistantMsgs = messages.filter((m) => m.role === "assistant");

  for (const msg of assistantMsgs) {
    if (msg.tokens) {
      totalInput += msg.tokens.input;
      totalOutput += msg.tokens.output;
      if (isFirstMsg) {
        firstInput = msg.tokens.input;
        isFirstMsg = false;
      }
    } else {
      totalOutput += countTokens(msg.content);
    }
    msgCount++;
  }

  if (totalInput === 0) {
    const userMsgs = messages.filter((m) => m.role === "user");
    for (const m of userMsgs) {
      totalInput += countTokens(m.content);
    }
    if (userMsgs.length > 0) {
      firstInput = countTokens(userMsgs[0].content);
    }
  }

  const systemPromptEstimate = firstInput * 0.4;
  const historyEstimate = Math.max(0, totalInput - firstInput) * 0.5;

  return {
    totalInput,
    totalOutput,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    messageCount: msgCount || assistantMsgs.length,
    cacheHitRate: 0,
    cost: 0,
    systemPromptEstimate,
    toolOutputEstimate: 0,
    historyEstimate,
    codeReadEstimate: 0,
  };
}
