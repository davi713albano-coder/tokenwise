import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { homedir } from "node:os";
import { countTokens, countLines } from "../shared/counter.js";
import type { FileAuditResult, AuditFlag } from "./types.js";

const YAML_FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;

interface RuleFrontmatter {
  paths?: string[];
}

function parseFrontmatter(content: string): {
  frontmatter: RuleFrontmatter | null;
  body: string;
} {
  const match = content.match(YAML_FRONTMATTER_RE);
  if (!match) return { frontmatter: null, body: content };
  try {
    const YAML = require("yaml");
    const parsed = YAML.parse(match[1]) as RuleFrontmatter;
    return { frontmatter: parsed, body: content.slice(match[0].length) };
  } catch {
    return { frontmatter: null, body: content };
  }
}

export interface ScannerFile {
  path: string;
  relPath: string;
  tokens: number;
  lines: number;
  exists: boolean;
  loadFrequency: "every_message" | "conditional" | "on_demand";
  content: string;
  frontmatter: RuleFrontmatter | null;
}

export function findInstructionFiles(projectDir: string): ScannerFile[] {
  const results: ScannerFile[] = [];
  const absDir = resolve(projectDir);

  const candidates: Array<{
    path: string;
    relPath: string;
    loadFrequency: "every_message" | "conditional" | "on_demand";
  }> = [];

  // AGENTS.md takes priority over CLAUDE.md (OpenCode spec)
  if (existsSync(join(absDir, "AGENTS.md"))) {
    candidates.push({
      path: join(absDir, "AGENTS.md"),
      relPath: "AGENTS.md",
      loadFrequency: "every_message",
    });
  } else if (existsSync(join(absDir, "CLAUDE.md"))) {
    candidates.push({
      path: join(absDir, "CLAUDE.md"),
      relPath: "CLAUDE.md",
      loadFrequency: "every_message",
    });
  }

  // .claude/rules/*.md
  const rulesDir = join(absDir, ".claude", "rules");
  if (existsSync(rulesDir) && statSync(rulesDir).isDirectory()) {
    for (const f of readdirSync(rulesDir).filter((f) =>
      f.endsWith(".md")
    )) {
      candidates.push({
        path: join(rulesDir, f),
        relPath: `.claude/rules/${f}`,
        loadFrequency: "conditional",
      });
    }
  }

  // .opencode/agents/*.md
  const agentsDir = join(absDir, ".opencode", "agents");
  if (existsSync(agentsDir) && statSync(agentsDir).isDirectory()) {
    for (const f of readdirSync(agentsDir).filter((f) =>
      f.endsWith(".md")
    )) {
      candidates.push({
        path: join(agentsDir, f),
        relPath: `.opencode/agents/${f}`,
        loadFrequency: "conditional",
      });
    }
  }

  // Global files
  const globalAgents = join(homedir(), ".config", "opencode", "AGENTS.md");
  if (existsSync(globalAgents)) {
    candidates.push({
      path: globalAgents,
      relPath: "~/.config/opencode/AGENTS.md",
      loadFrequency: "every_message",
    });
  }

  const globalClaude = join(homedir(), ".claude", "CLAUDE.md");
  if (existsSync(globalClaude)) {
    candidates.push({
      path: globalClaude,
      relPath: "~/.claude/CLAUDE.md",
      loadFrequency: "every_message",
    });
  }

  // Also check .claude/CLAUDE.md (project-level Claude Code instructions)
  const projClaude = join(absDir, ".claude", "CLAUDE.md");
  if (existsSync(projClaude) && !candidates.some((c) => c.path === projClaude)) {
    candidates.push({
      path: projClaude,
      relPath: ".claude/CLAUDE.md",
      loadFrequency: "every_message",
    });
  }

  for (const cand of candidates) {
    try {
      const content = readFileSync(cand.path, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);
      const isUnscoped =
        cand.loadFrequency === "conditional" && !frontmatter?.paths?.length;
      results.push({
        path: cand.path,
        relPath: cand.relPath,
        tokens: countTokens(content),
        lines: countLines(content),
        exists: true,
        loadFrequency: isUnscoped ? "every_message" : cand.loadFrequency,
        content,
        frontmatter,
      });
      void body;
    } catch {
      results.push({
        path: cand.path,
        relPath: cand.relPath,
        tokens: 0,
        lines: 0,
        exists: false,
        loadFrequency: cand.loadFrequency,
        content: "",
        frontmatter: null,
      });
    }
  }

  return results;
}

export { parseFrontmatter };
