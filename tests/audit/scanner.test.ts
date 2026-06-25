import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { findInstructionFiles, parseFrontmatter } from "../../src/audit/scanner.js";

const TMP = join(process.env.TEMP || process.env.TMPDIR || "/tmp", "tokenwise-test-scanner");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("findInstructionFiles", () => {
  it("finds CLAUDE.md in project root", () => {
    writeFileSync(join(TMP, "CLAUDE.md"), "# Test\nHello world", "utf-8");
    const files = findInstructionFiles(TMP);
    expect(files.some((f) => f.relPath === "CLAUDE.md")).toBe(true);
    expect(files.find((f) => f.relPath === "CLAUDE.md")!.tokens).toBeGreaterThan(0);
  });

  it("finds AGENTS.md with priority over CLAUDE.md", () => {
    writeFileSync(join(TMP, "AGENTS.md"), "# Agents\nHello", "utf-8");
    writeFileSync(join(TMP, "CLAUDE.md"), "# Claude\nHello", "utf-8");
    const files = findInstructionFiles(TMP);
    expect(files.some((f) => f.relPath === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.relPath === "CLAUDE.md")).toBe(false);
  });

  it("finds .claude/rules/ files", () => {
    const rulesDir = join(TMP, ".claude", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, "api.md"), "---\npaths:\n  - \"src/api/**\"\n---\n\n# API Rules", "utf-8");
    writeFileSync(join(rulesDir, "general.md"), "# General Rules", "utf-8");
    const files = findInstructionFiles(TMP);
    expect(files.some((f) => f.relPath.includes("rules/api.md"))).toBe(true);
    expect(files.some((f) => f.relPath.includes("rules/general.md"))).toBe(true);
  });

  it("classifies unscoped rules as every_message", () => {
    const rulesDir = join(TMP, ".claude", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, "noscope.md"), "# No paths rule", "utf-8");
    const files = findInstructionFiles(TMP);
    const unscoped = files.find((f) => f.relPath.includes("noscope.md"));
    expect(unscoped?.loadFrequency).toBe("every_message");
  });

  it("classifies scoped rules as conditional", () => {
    const rulesDir = join(TMP, ".claude", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "scoped.md"),
      "---\npaths:\n  - \"src/**/*.ts\"\n---\n\n# Scoped rule",
      "utf-8"
    );
    const files = findInstructionFiles(TMP);
    const scoped = files.find((f) => f.relPath.includes("scoped.md"));
    expect(scoped?.loadFrequency).toBe("conditional");
  });

  it("returns empty array when no files found", () => {
    const files = findInstructionFiles(TMP);
    expect(files).toEqual([]);
  });
});

describe("parseFrontmatter", () => {
  it("parses YAML frontmatter", () => {
    const content = "---\npaths:\n  - \"src/**/*.ts\"\n---\n\n# Body";
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter).not.toBeNull();
    expect(frontmatter!.paths).toEqual(["src/**/*.ts"]);
    expect(body.trim()).toBe("# Body");
  });

  it("returns null frontmatter when no frontmatter present", () => {
    const content = "# Just markdown\nNo frontmatter.";
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter).toBeNull();
    expect(body).toBe(content);
  });

  it("handles invalid YAML gracefully", () => {
    const content = "---\n: invalid : yaml\n---\n\n# Body";
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter).toBeNull();
  });
});
