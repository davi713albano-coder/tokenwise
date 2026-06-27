import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { countTokens } from "../shared/counter.js";
import type { UniversalTokenBreakdown } from "./types.js";

export function findAiderHistory(projectDir: string): string | null {
  const candidates = [
    join(projectDir, ".aider.chat.history.md"),
    join(homedir(), ".aider.chat.history.md"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function findAllAiderHistory(projectDir: string): string[] {
  return [
    join(projectDir, ".aider.chat.history.md"),
    join(homedir(), ".aider.chat.history.md"),
  ].filter((p) => existsSync(p));
}

export function findAiderConventions(projectDir: string): string[] {
  const results: string[] = [];
  const dir = projectDir;
  try {
    for (const f of readdirSync(dir)) {
      if (f.startsWith(".aider.") && f.endsWith(".conventions.md")) {
        results.push(join(dir, f));
      }
    }
  } catch {}
  return results;
}

export interface AiderMessage {
  role: string;
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
}

export function parseAiderHistory(filePath: string): AiderMessage[] {
  const content = readFileSync(filePath, "utf-8");
  return parseAiderContent(content);
}

export function parseAiderContent(content: string): AiderMessage[] {
  const messages: AiderMessage[] = [];
  const lines = content.split("\n");
  let currentRole = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^####\s+(User|Assistant|System)/i);
    if (headerMatch) {
      if (currentRole && currentContent.length > 0) {
        messages.push({
          role: currentRole.toLowerCase(),
          content: currentContent.join("\n").trim(),
        });
      }
      currentRole = headerMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentRole && currentContent.length > 0) {
    messages.push({
      role: currentRole.toLowerCase(),
      content: currentContent.join("\n").trim(),
    });
  }

  return messages;
}

export function analyzeAiderSession(messages: AiderMessage[]): UniversalTokenBreakdown {
  let totalInput = 0;
  let totalOutput = 0;
  let msgCount = 0;
  let firstInput = 0;
  let toolOutputEstimate = 0;
  let isFirstMsg = true;

  const assistantMessages = messages.filter((m) => m.role === "assistant");

  for (const msg of assistantMessages) {
    if (msg.tokensIn) {
      totalInput += msg.tokensIn;
      if (isFirstMsg) {
        firstInput = msg.tokensIn;
        isFirstMsg = false;
      }
    } else {
      const estimated = countTokens(msg.content);
      totalOutput += estimated;
    }

    if (msg.tokensOut) {
      totalOutput += msg.tokensOut;
    }

    msgCount++;
  }

  if (totalInput === 0 && messages.length > 0) {
    const userMessages = messages.filter((m) => m.role === "user");
    for (const m of userMessages) {
      totalInput += countTokens(m.content);
    }
    const asstMessages = messages.filter((m) => m.role === "assistant");
    for (const m of asstMessages) {
      totalOutput += countTokens(m.content);
    }
    if (userMessages.length > 0) {
      firstInput = countTokens(userMessages[0].content);
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
    messageCount: msgCount || assistantMessages.length,
    cacheHitRate: 0,
    cost: 0,
    systemPromptEstimate,
    toolOutputEstimate,
    historyEstimate,
    codeReadEstimate: 0,
  };
}
