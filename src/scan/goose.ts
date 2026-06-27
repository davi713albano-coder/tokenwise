import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import { countTokens } from "../shared/counter.js";
import type { UniversalTokenBreakdown, UniversalSessionInfo } from "./types.js";

export function findGooseDb(): string | null {
  const XDG_DATA_HOME = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const candidates = [
    join(XDG_DATA_HOME, "goose", "sessions.db"),
    join(XDG_CONFIG_HOME, "goose", "sessions.db"),
    join(homedir(), ".local", "share", "goose", "sessions.db"),
    join(homedir(), ".config", "goose", "sessions.db"),
    join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "goose",
      "sessions.db"
    ),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function openGooseDb(dbPath: string): Promise<SqlJsDatabase | null> {
  if (!existsSync(dbPath)) return null;
  try {
    const SQL = await initSqlJs();
    const buffer = readFileSync(dbPath);
    return new SQL.Database(buffer);
  } catch {
    return null;
  }
}

export async function getGooseLatestSession(dbPath: string): Promise<UniversalSessionInfo | null> {
  const db = await openGooseDb(dbPath);
  if (!db) return null;

  try {
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.length > 0 ? tables[0].values.flat().map(String) : [];

    let rows;
    if (tableNames.includes("session")) {
      rows = db.exec(
        `SELECT * FROM session ORDER BY rowid DESC LIMIT 1`
      );
    } else if (tableNames.includes("sessions")) {
      rows = db.exec(
        `SELECT * FROM sessions ORDER BY rowid DESC LIMIT 1`
      );
    } else {
      return null;
    }

    if (!rows.length || !rows[0].values.length) return null;

    const cols = rows[0].columns;
    const val = rows[0].values[0] as unknown[];
    const row = Object.fromEntries(cols.map((c: string, i: number) => [c, val[i]])) as Record<string, unknown>;

    return {
      id: String(row.id || row.session_id || row.uuid || "unknown"),
      title: String(row.title || row.name || row.description || "Goose Session"),
      model: String(row.model || row.provider || "unknown"),
      cost: Number(row.cost || row.total_cost || 0),
      timeCreated: Number(row.created_at || row.timestamp || row.start_time || 0),
      agentName: "goose",
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function getAllGooseSessions(dbPath: string): Promise<UniversalSessionInfo[]> {
  const db = await openGooseDb(dbPath);
  if (!db) return [];

  try {
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.length > 0 ? tables[0].values.flat().map(String) : [];

    let rows;
    if (tableNames.includes("session")) {
      rows = db.exec(`SELECT * FROM session ORDER BY rowid DESC`);
    } else if (tableNames.includes("sessions")) {
      rows = db.exec(`SELECT * FROM sessions ORDER BY rowid DESC`);
    } else {
      return [];
    }

    if (!rows.length || !rows[0].values.length) return [];

    const cols = rows[0].columns;
    return rows[0].values.map((val) => {
      const row = Object.fromEntries(cols.map((c: string, i: number) => [c, (val as unknown[])[i]])) as Record<string, unknown>;
      return {
        id: String(row.id || row.session_id || row.uuid || "unknown"),
        title: String(row.title || row.name || row.description || "Goose Session"),
        model: String(row.model || row.provider || "unknown"),
        cost: Number(row.cost || row.total_cost || 0),
        timeCreated: Number(row.created_at || row.timestamp || row.start_time || 0),
        agentName: "goose",
      };
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function analyzeGooseSession(
  dbPath: string,
  sessionId: string
): Promise<UniversalTokenBreakdown | null> {
  const db = await openGooseDb(dbPath);
  if (!db) return null;

  try {
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.length > 0 ? tables[0].values.flat().map(String) : [];

    let messages;
    const msgTable = tableNames.find((t) => t.includes("message") || t.includes("exchange") || t.includes("turn"));
    if (!msgTable) return null;

    const sessionIdCol = tableNames.includes("session")
      ? "session_id"
      : tableNames.includes("sessions")
        ? "session_id"
        : "id";

    messages = db.exec(
      `SELECT * FROM ${msgTable} WHERE ${sessionIdCol} = ? ORDER BY rowid ASC`,
      [sessionId]
    );

    if (!messages.length || !messages[0].values.length) return null;

    const cols = messages[0].columns;
    let totalInput = 0;
    let totalOutput = 0;
    let msgCount = 0;
    let firstInput = 0;
    let isFirstMsg = true;

    for (const val of messages[0].values) {
      const row = Object.fromEntries(cols.map((c: string, i: number) => [c, (val as unknown[])[i]])) as Record<string, unknown>;

      const role = String(row.role || row.type || "");
      if (role !== "assistant" && role !== "response" && role !== "output") continue;

      const input = Number(row.input_tokens || row.inputTokens || row.tokens_in || 0);
      const output = Number(row.output_tokens || row.outputTokens || row.tokens_out || 0);

      if (input > 0 || output > 0) {
        totalInput += input;
        totalOutput += output;
        if (isFirstMsg) {
          firstInput = input;
          isFirstMsg = false;
        }
      } else {
        const content = String(row.content || row.text || row.message || row.response || "");
        if (content) totalOutput += countTokens(content);
      }

      msgCount++;
    }

    const systemPromptEstimate = firstInput * 0.4;
    const historyEstimate = Math.max(0, totalInput - firstInput) * 0.5;

    return {
      totalInput,
      totalOutput,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
      messageCount: msgCount,
      cacheHitRate: 0,
      cost: 0,
      systemPromptEstimate,
      toolOutputEstimate: 0,
      historyEstimate,
      codeReadEstimate: 0,
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
}
