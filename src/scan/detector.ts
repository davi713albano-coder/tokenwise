import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, statSync } from "node:fs";
import type { AgentName } from "./types.js";

export interface DetectedAgent {
  agent: AgentName | string;
  label: string;
  dataType: "session" | "database" | "history";
  path: string;
  available: boolean;
}

export function detectAgents(projectDir?: string): DetectedAgent[] {
  const results: DetectedAgent[] = [];
  const XDG_DATA_HOME = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");

  const checks: Array<{
    agent: AgentName | string;
    label: string;
    dataType: "session" | "database" | "history";
    paths: string[];
  }> = [
    {
      agent: "claude-code",
      label: "Claude Code",
      dataType: "session",
      paths: [join(homedir(), ".claude", "projects")],
    },
    {
      agent: "opencode",
      label: "OpenCode",
      dataType: "database",
      paths: [
        join(XDG_DATA_HOME, "opencode", "opencode.db"),
        join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode", "opencode.db"),
        join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "opencode", "opencode.db"),
      ],
    },
    {
      agent: "aider",
      label: "Aider",
      dataType: "history",
      paths: [
        projectDir ? join(projectDir, ".aider.chat.history.md") : "",
        join(homedir(), ".aider.chat.history.md"),
      ].filter(Boolean),
    },
    {
      agent: "cline",
      label: "Cline",
      dataType: "session",
      paths: [
        join(homedir(), ".cline", "data", "sessions"),
        join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "cline", "data", "sessions"),
      ],
    },
    {
      agent: "codex-cli",
      label: "Codex CLI",
      dataType: "session",
      paths: [
        join(XDG_DATA_HOME, "codex", "sessions"),
        join(XDG_DATA_HOME, "openai", "codex", "sessions"),
      ],
    },
    {
      agent: "goose",
      label: "Goose",
      dataType: "database",
      paths: [
        join(XDG_DATA_HOME, "goose", "sessions.db"),
        join(XDG_CONFIG_HOME, "goose", "sessions.db"),
        join(homedir(), ".local", "share", "goose", "sessions.db"),
      ],
    },
    {
      agent: "continue",
      label: "Continue.dev",
      dataType: "session",
      paths: [
        projectDir ? join(projectDir, ".continue", "sessions") : "",
        join(homedir(), ".continue", "sessions"),
      ].filter(Boolean),
    },
    {
      agent: "augment",
      label: "Augment",
      dataType: "history",
      paths: [
        join(process.env.TEMP || process.env.TMPDIR || join(homedir(), "AppData", "Local", "Temp"), "augment-log.txt"),
      ],
    },
  ];

  for (const check of checks) {
    let found = false;
    let foundPath = "";
    for (const p of check.paths) {
      try {
        if (existsSync(p)) {
          const s = statSync(p);
          if (s.isFile() || s.isDirectory()) {
            found = true;
            foundPath = p;
            break;
          }
        }
      } catch {}
    }

    results.push({
      agent: check.agent,
      label: check.label,
      dataType: check.dataType,
      path: foundPath || check.paths[0],
      available: found,
    });
  }

  return results;
}

export function getAvailableAgents(projectDir?: string): DetectedAgent[] {
  return detectAgents(projectDir).filter((a) => a.available);
}
