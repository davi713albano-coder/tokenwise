import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import { countTokens } from "../shared/counter.js";

export interface OpenCodeMessageTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
}

export interface OpenCodeSessionInfo {
  id: string;
  title: string;
  directory: string;
  model: string;
  cost: number;
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  tokensReasoning: number;
  timeCreated: number;
}

export interface OpenCodeTokenBreakdown {
  totalInput: number;
  totalOutput: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  messageCount: number;
  cacheHitRate: number;
  cost: number;
  systemPromptEstimate: number;
  toolOutputEstimate: number;
  historyEstimate: number;
}

function findOpenCodeDb(): string | null {
  const candidates = [
    join(homedir(), ".local", "share", "opencode", "opencode.db"),
    join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "opencode",
      "opencode.db"
    ),
    join(
      process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
      "opencode",
      "opencode.db"
    ),
  ];

  if (process.env.XDG_DATA_HOME) {
    candidates.unshift(
      join(process.env.XDG_DATA_HOME, "opencode", "opencode.db")
    );
  }

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

export { findOpenCodeDb };

async function openDb(dbPath: string): Promise<SqlJsDatabase | null> {
  if (!existsSync(dbPath)) return null;
  try {
    const SQL = await initSqlJs();
    const buffer = readFileSync(dbPath);
    return new SQL.Database(buffer);
  } catch {
    return null;
  }
}

function safeParseJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getNestedValue(obj: Record<string, unknown>, ...path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export async function getLatestSession(dbPath: string): Promise<OpenCodeSessionInfo | null> {
  const db = await openDb(dbPath);
  if (!db) return null;

  try {
    const rows = db.exec(
      `SELECT id, title, directory, model, cost,
              tokens_input, tokens_output, tokens_cache_read,
              tokens_cache_write, tokens_reasoning, time_created
       FROM session
       ORDER BY time_created DESC
       LIMIT 1`
    );

    if (!rows.length || !rows[0].values.length) return null;

    const val = rows[0].values[0] as unknown[];
    const cols = rows[0].columns;
    const row = Object.fromEntries(cols.map((c: string, i: number) => [c, val[i]])) as Record<string, unknown>;

    const modelData = typeof row.model === "string" ? safeParseJSON(row.model) : null;

    return {
      id: row.id as string,
      title: (row.title as string) || "Untitled",
      directory: (row.directory as string) || "",
      model: modelData
        ? ((modelData.id as string) || "unknown")
        : (row.model as string) || "unknown",
      cost: (row.cost as number) || 0,
      tokensInput: (row.tokens_input as number) || 0,
      tokensOutput: (row.tokens_output as number) || 0,
      tokensCacheRead: (row.tokens_cache_read as number) || 0,
      tokensCacheWrite: (row.tokens_cache_write as number) || 0,
      tokensReasoning: (row.tokens_reasoning as number) || 0,
      timeCreated: (row.time_created as number) || 0,
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function analyzeOpenCodeSession(
  dbPath: string,
  sessionId: string
): Promise<OpenCodeTokenBreakdown | null> {
  const db = await openDb(dbPath);
  if (!db) return null;

  try {
    const rows = db.exec(
      `SELECT data FROM message WHERE session_id = ? ORDER BY rowid ASC`,
      [sessionId]
    );

    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalReasoning = 0;
    let msgCount = 0;
    let firstInput = 0;
    let toolOutputEstimate = 0;

    let isFirstMsg = true;

    if (rows.length && rows[0].values.length) {
      for (const val of rows[0].values) {
        const data = safeParseJSON(val[0] as string);
        if (!data) continue;

        const role = getNestedValue(data, "role");
        if (role !== "assistant") continue;

        const tokens = getNestedValue(data, "tokens") as Record<string, unknown> | undefined;
        if (!tokens) continue;

        const input = (tokens.total as number) || 0;
        const output = (tokens.output as number) || 0;
        const cache = tokens.cache as Record<string, unknown> | undefined;

        totalInput += input;
        totalOutput += output;
        totalCacheRead += (cache ? (cache.read as number) : 0) || 0;
        totalCacheWrite += (cache ? (cache.write as number) : 0) || 0;
        totalReasoning += (tokens.reasoning as number) || 0;
        msgCount++;

        if (isFirstMsg) {
          firstInput = input;
          isFirstMsg = false;
        }
      }
    }

    const totalWithCache = totalInput + totalCacheRead;
    const cacheHitRate = totalWithCache > 0 ? totalCacheRead / totalWithCache : 0;
    const systemPromptEstimate = firstInput * 0.4;
    const historyEstimate = Math.max(0, totalInput - firstInput) * 0.5;

    let cost = 0;
    const session = await getLatestSession(dbPath);
    if (session && session.id === sessionId) {
      cost = session.cost;
    }

    return {
      totalInput,
      totalOutput,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      reasoning: totalReasoning,
      messageCount: msgCount,
      cacheHitRate,
      cost,
      systemPromptEstimate,
      toolOutputEstimate: Math.min(toolOutputEstimate, totalInput * 0.5),
      historyEstimate,
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function listSessions(dbPath: string): Promise<OpenCodeSessionInfo[]> {
  const db = await openDb(dbPath);
  if (!db) return [];

  try {
    const rows = db.exec(
      `SELECT id, title, directory, model, cost,
              tokens_input, tokens_output, tokens_cache_read,
              tokens_cache_write, tokens_reasoning, time_created
       FROM session
       ORDER BY time_created DESC
       LIMIT 20`
    );

    if (!rows.length || !rows[0].values.length) return [];

    const cols = rows[0].columns;
    return rows[0].values.map((val: unknown[]) => {
      const row = Object.fromEntries(cols.map((c: string, i: number) => [c, val[i]])) as Record<string, unknown>;
      const modelData = typeof row.model === "string" ? safeParseJSON(row.model) : null;
      return {
        id: row.id as string,
        title: (row.title as string) || "Untitled",
        directory: (row.directory as string) || "",
        model: modelData
          ? ((modelData.id as string) || "unknown")
          : (row.model as string) || "unknown",
        cost: (row.cost as number) || 0,
        tokensInput: (row.tokens_input as number) || 0,
        tokensOutput: (row.tokens_output as number) || 0,
        tokensCacheRead: (row.tokens_cache_read as number) || 0,
        tokensCacheWrite: (row.tokens_cache_write as number) || 0,
        tokensReasoning: (row.tokens_reasoning as number) || 0,
        timeCreated: (row.time_created as number) || 0,
      };
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}
