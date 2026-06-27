import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { countTokens } from "../shared/counter.js";
import type { UniversalTokenBreakdown } from "./types.js";

export function findClineSessions(): string | null {
  const all = findAllClineSessions();
  return all.length > 0 ? all[0] : null;
}

export function findAllClineSessions(): string[] {
  const candidates = [
    join(homedir(), ".cline", "data", "sessions"),
    join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "cline",
      "data",
      "sessions"
    ),
    join(
      process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
      "cline",
      "data",
      "sessions"
    ),
  ];

  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      try {
        return readdirSync(dir)
          .filter((f) => f.endsWith(".json") || f.endsWith(".jsonl"))
          .map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime)
          .map((f) => f.path);
      } catch {}
    }
  }
  return [];
}

export interface ClineMessage {
  ts: number;
  type: string;
  text?: string;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
}

export function parseClineSession(filePath: string): ClineMessage[] {
  const content = readFileSync(filePath, "utf-8");
  return parseClineContent(content);
}

export function parseClineContent(content: string): ClineMessage[] {
  const messages: ClineMessage[] = [];

  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      for (const entry of data) {
        messages.push({
          ts: entry.ts || entry.timestamp || 0,
          type: entry.type || "unknown",
          text: entry.text || entry.message || "",
          tokensIn: entry.tokensIn || entry.inputTokens || 0,
          tokensOut: entry.tokensOut || entry.outputTokens || 0,
          cost: entry.cost || entry.totalCost || 0,
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
          ts: entry.ts || entry.timestamp || 0,
          type: entry.type || "unknown",
          text: entry.text || entry.message || "",
          tokensIn: entry.tokensIn || entry.inputTokens || 0,
          tokensOut: entry.tokensOut || entry.outputTokens || 0,
          cost: entry.cost || entry.totalCost || 0,
        });
      } catch {}
    }
  }

  return messages;
}

export function analyzeClineSession(messages: ClineMessage[]): UniversalTokenBreakdown {
  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;
  let msgCount = 0;
  let firstInput = 0;
  let toolOutputEstimate = 0;
  let codeReadEstimate = 0;
  let isFirstMsg = true;

  const assistantMsgs = messages.filter(
    (m) => m.type === "assistant" || m.type === "say" || m.type === "response"
  );

  for (const msg of assistantMsgs) {
    totalInput += msg.tokensIn || 0;
    totalOutput += msg.tokensOut || 0;
    totalCost += msg.cost || 0;
    msgCount++;

    if (isFirstMsg && msg.tokensIn) {
      firstInput = msg.tokensIn;
      isFirstMsg = false;
    }
  }

  if (totalInput === 0 && messages.length > 0) {
    const userMsgs = messages.filter(
      (m) => m.type === "user" || m.type === "ask" || m.type === "human"
    );
    for (const m of userMsgs) {
      totalInput += countTokens(m.text || "");
    }
    for (const m of assistantMsgs) {
      totalOutput += countTokens(m.text || "");
    }
    if (userMsgs.length > 0) {
      firstInput = countTokens(userMsgs[0].text || "");
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
    cost: totalCost,
    systemPromptEstimate,
    toolOutputEstimate,
    historyEstimate,
    codeReadEstimate,
  };
}
