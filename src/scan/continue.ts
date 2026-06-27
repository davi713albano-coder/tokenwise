import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { countTokens } from "../shared/counter.js";
import type { UniversalTokenBreakdown } from "./types.js";

export function findContinueSessions(): string | null {
  const all = findAllContinueSessions();
  return all.length > 0 ? all[0] : null;
}

export function findAllContinueSessions(): string[] {
  const candidates = [
    join(".continue", "sessions"),
    join(".continue", "dev", "sessions"),
    join(homedir(), ".continue", "sessions"),
    join(homedir(), ".continue", "dev", "sessions"),
  ];

  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      try {
        return readdirSync(dir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime)
          .map((f) => f.path);
      } catch {}
    }
  }
  return [];
}

export interface ContinueMessage {
  role: string;
  content: string;
}

export function parseContinueSession(filePath: string): ContinueMessage[] {
  const content = readFileSync(filePath, "utf-8");
  return parseContinueContent(content);
}

export function parseContinueContent(content: string): ContinueMessage[] {
  const messages: ContinueMessage[] = [];

  try {
    const data = JSON.parse(content);
    const msgArray = data.messages || data.history || (Array.isArray(data) ? data : []);
    for (const entry of msgArray) {
      if (entry.role && entry.content) {
        messages.push({
          role: entry.role,
          content: typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content),
        });
      }
    }
  } catch {}

  return messages;
}

export function analyzeContinueSession(messages: ContinueMessage[]): UniversalTokenBreakdown {
  let totalInput = 0;
  let totalOutput = 0;
  let msgCount = 0;
  let firstInput = 0;
  let isFirstMsg = true;

  const userMsgs = messages.filter((m) => m.role === "user");
  const assistantMsgs = messages.filter((m) => m.role === "assistant");

  for (const m of userMsgs) {
    totalInput += countTokens(m.content);
  }

  for (const m of assistantMsgs) {
    totalOutput += countTokens(m.content);
    msgCount++;
  }

  if (userMsgs.length > 0) {
    firstInput = countTokens(userMsgs[0].content);
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
