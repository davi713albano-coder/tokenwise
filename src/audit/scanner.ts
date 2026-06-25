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

  // Cursor rules files
  const cursorRulesDir = join(absDir, ".cursor", "rules");
  if (existsSync(cursorRulesDir) && statSync(cursorRulesDir).isDirectory()) {
    for (const f of readdirSync(cursorRulesDir).filter((f) =>
      f.endsWith(".md") || f.endsWith(".mdc")
    )) {
      candidates.push({
        path: join(cursorRulesDir, f),
        relPath: `.cursor/rules/${f}`,
        loadFrequency: "conditional",
      });
    }
  }

  const cursorRulesFile = join(absDir, ".cursorrules");
  if (existsSync(cursorRulesFile)) {
    candidates.push({
      path: cursorRulesFile,
      relPath: ".cursorrules",
      loadFrequency: "every_message",
    });
  }

  // Cline rules
  const clineRulesDir = join(absDir, ".clinerules");
  if (existsSync(clineRulesDir) && statSync(clineRulesDir).isDirectory()) {
    for (const f of readdirSync(clineRulesDir)) {
      candidates.push({
        path: join(clineRulesDir, f),
        relPath: `.clinerules/${f}`,
        loadFrequency: "conditional",
      });
    }
  }

  const clineRulesFile = join(absDir, ".clinerules");
  if (existsSync(clineRulesFile) && statSync(clineRulesFile).isFile()) {
    candidates.push({
      path: clineRulesFile,
      relPath: ".clinerules",
      loadFrequency: "every_message",
    });
  }

  // Windsurf rules
  const windsurfRulesFile = join(absDir, ".windsurfrules");
  if (existsSync(windsurfRulesFile)) {
    candidates.push({
      path: windsurfRulesFile,
      relPath: ".windsurfrules",
      loadFrequency: "every_message",
    });
  }

  // Aider config
  const aiderConfFile = join(absDir, ".aider.conf.yml");
  if (existsSync(aiderConfFile)) {
    candidates.push({
      path: aiderConfFile,
      relPath: ".aider.conf.yml",
      loadFrequency: "on_demand",
    });
  }

  // Goose hints
  const gooseHintsFile = join(absDir, ".goosehints");
  if (existsSync(gooseHintsFile)) {
    candidates.push({
      path: gooseHintsFile,
      relPath: ".goosehints",
      loadFrequency: "every_message",
    });
  }

  // Codex instructions
  const codexDir = join(absDir, ".codex");
  if (existsSync(codexDir) && statSync(codexDir).isDirectory()) {
    for (const f of readdirSync(codexDir)) {
      candidates.push({
        path: join(codexDir, f),
        relPath: `.codex/${f}`,
        loadFrequency: "conditional",
      });
    }
  }

  // Augment rules
  const augmentRulesDir = join(absDir, ".augment", "rules");
  if (existsSync(augmentRulesDir) && statSync(augmentRulesDir).isDirectory()) {
    for (const f of readdirSync(augmentRulesDir)) {
      candidates.push({
        path: join(augmentRulesDir, f),
        relPath: `.augment/rules/${f}`,
        loadFrequency: "conditional",
      });
    }
  }

  // Kilocode rules
  const kilocodeRulesDir = join(absDir, ".kilocode", "rules");
  if (existsSync(kilocodeRulesDir) && statSync(kilocodeRulesDir).isDirectory()) {
    for (const f of readdirSync(kilocodeRulesDir)) {
      candidates.push({
        path: join(kilocodeRulesDir, f),
        relPath: `.kilocode/rules/${f}`,
        loadFrequency: "conditional",
      });
    }
  }

  // Continue config
  const continueConfigFile = join(absDir, ".continue", "config.json");
  if (existsSync(continueConfigFile)) {
    candidates.push({
      path: continueConfigFile,
      relPath: ".continue/config.json",
      loadFrequency: "on_demand",
    });
  }

  const continueConfigYaml = join(absDir, ".continue", "config.yaml");
  if (existsSync(continueConfigYaml)) {
    candidates.push({
      path: continueConfigYaml,
      relPath: ".continue/config.yaml",
      loadFrequency: "on_demand",
    });
  }

  const continueConfigYml = join(absDir, ".continue", "config.yml");
  if (existsSync(continueConfigYml)) {
    candidates.push({
      path: continueConfigYml,
      relPath: ".continue/config.yml",
      loadFrequency: "on_demand",
    });
  }

  // Continue dev instructions
  const continueDevDir = join(absDir, ".continue", "dev");
  if (existsSync(continueDevDir) && statSync(continueDevDir).isDirectory()) {
    for (const f of readdirSync(continueDevDir).filter((f) =>
      f.endsWith(".md") || f.endsWith(".txt")
    )) {
      candidates.push({
        path: join(continueDevDir, f),
        relPath: `.continue/dev/${f}`,
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

  // Global Cursor rules
  const globalCursorRules = join(homedir(), ".cursorrules");
  if (existsSync(globalCursorRules)) {
    candidates.push({
      path: globalCursorRules,
      relPath: "~/.cursorrules",
      loadFrequency: "every_message",
    });
  }

  // Global Cline rules
  const globalClineRules = join(homedir(), ".clinerules");
  if (existsSync(globalClineRules)) {
    candidates.push({
      path: globalClineRules,
      relPath: "~/.clinerules",
      loadFrequency: "every_message",
    });
  }

  // Global Aider config
  const globalAiderConf = join(homedir(), ".aider.conf.yml");
  if (existsSync(globalAiderConf)) {
    candidates.push({
      path: globalAiderConf,
      relPath: "~/.aider.conf.yml",
      loadFrequency: "on_demand",
    });
  }

  // Global Goose hints
  const globalGooseHints = join(homedir(), ".goosehints");
  if (existsSync(globalGooseHints)) {
    candidates.push({
      path: globalGooseHints,
      relPath: "~/.goosehints",
      loadFrequency: "every_message",
    });
  }

  // Global Windsurf rules
  const globalWindsurfRules = join(homedir(), ".windsurfrules");
  if (existsSync(globalWindsurfRules)) {
    candidates.push({
      path: globalWindsurfRules,
      relPath: "~/.windsurfrules",
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
