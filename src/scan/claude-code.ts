import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { countTokens } from "../shared/counter.js";

export interface ClaudeCodeMessage {
  type: string;
  message?: {
    role?: string;
    content?: string | unknown[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
  };
  toolUse?: {
    name: string;
    input: Record<string, unknown>;
  };
  toolResult?: {
    content: string;
  };
}

export interface ClaudeCodeSession {
  filePath: string;
  messages: ClaudeCodeMessage[];
  mtime: Date;
}

export interface TokenBreakdown {
  totalInput: number;
  totalOutput: number;
  cacheRead: number;
  cacheCreation: number;
  systemPromptEstimate: number;
  toolOutputEstimate: number;
  codeReadEstimate: number;
  historyEstimate: number;
  messageCount: number;
  cacheHitRate: number;
}

function findClaudeCodeProjectsDir(): string {
  return join(homedir(), ".claude", "projects");
}

export function findClaudeCodeSessions(): string[] {
  const projectsDir = findClaudeCodeProjectsDir();
  if (!statSync(projectsDir)?.isDirectory()) return [];

  const jsonlFiles: string[] = [];
  try {
    const walkDir = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith(".jsonl")) {
          jsonlFiles.push(fullPath);
        }
      }
    };
    walkDir(projectsDir);
  } catch {
    return [];
  }

  return jsonlFiles.sort((a, b) => {
    const aTime = statSync(a).mtimeMs;
    const bTime = statSync(b).mtimeMs;
    return bTime - aTime;
  });
}

export function getLatestSession(): string | null {
  const sessions = findClaudeCodeSessions();
  return sessions.length > 0 ? sessions[0] : null;
}

export function parseSession(filePath: string): ClaudeCodeSession {
  const content = readFileSync(filePath, "utf-8");
  const messages: ClaudeCodeMessage[] = [];
  const mtime = statSync(filePath).mtime;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed) as ClaudeCodeMessage;
      messages.push(msg);
    } catch {
      // skip malformed lines
    }
  }

  return { filePath, messages, mtime };
}

export function analyzeTokens(session: ClaudeCodeSession): TokenBreakdown {
  let totalInput = 0;
  let totalOutput = 0;
  let cacheRead = 0;
  let cacheCreation = 0;
  let assistantMsgCount = 0;
  let firstInputTokens = 0;
  let toolOutputTokens = 0;
  let codeReadTokens = 0;

  let isFirstAssistant = true;

  for (const msg of session.messages) {
    if (msg.type === "assistant" && msg.message?.usage) {
      const usage = msg.message.usage;
      totalInput += usage.input_tokens || 0;
      totalOutput += usage.output_tokens || 0;
      cacheRead += usage.cache_read_input_tokens || 0;
      cacheCreation += usage.cache_creation_input_tokens || 0;
      assistantMsgCount++;

      if (isFirstAssistant) {
        firstInputTokens = usage.input_tokens || 0;
        isFirstAssistant = false;
      }
    }

    if (msg.type === "tool_result" && msg.toolResult?.content) {
      toolOutputTokens += countTokens(msg.toolResult.content);
    }

    if (msg.toolUse?.name && ["Read", "grep", "glob"].includes(msg.toolUse.name)) {
      if (msg.toolUse.input?.filePath && typeof msg.toolUse.input.filePath === "string") {
        codeReadTokens += countFileTokensApprox(msg.toolUse.input.filePath as string);
      }
    }
  }

  const systemPromptEstimate = firstInputTokens * 0.4;
  const historyEstimate =
    Math.max(0, totalInput - firstInputTokens) * 0.5;
  const actualCodeRead = Math.min(codeReadTokens, totalInput * 0.3);

  const totalWithCache = totalInput + cacheRead;
  const cacheHitRate = totalWithCache > 0 ? cacheRead / totalWithCache : 0;

  return {
    totalInput,
    totalOutput,
    cacheRead,
    cacheCreation,
    systemPromptEstimate,
    toolOutputEstimate: Math.min(toolOutputTokens, totalInput * 0.5),
    codeReadEstimate: actualCodeRead,
    historyEstimate,
    messageCount: assistantMsgCount,
    cacheHitRate,
  };
}

function countFileTokensApprox(_filePath: string): number {
  // Approximate: assume ~0.75 tokens per line for code, ~100 lines avg
  // Real file reading would require access to the project at the time of the session
  return 75;
}

export function formatSessionPath(filePath: string): string {
  const projectsDir = findClaudeCodeProjectsDir();
  return filePath.replace(projectsDir, "~/.claude/projects");
}
