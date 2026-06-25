import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { applyFix, fixContent } from "../../src/audit/fixer.js";
import type { AuditFlag } from "../../src/audit/types.js";
import { countTokens } from "../../src/shared/counter.js";

const TMP = join(process.env.TEMP || process.env.TMPDIR || "/tmp", "tokenwise-test-fixer");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("fixContent", () => {
  it("removes boilerplate", () => {
    const content = `# Project\n\nAlways write clean code that follows best practices.\nUse proper naming conventions.\n\n## Build\n- bun test\n`;
    const flags: AuditFlag[] = [
      {
        id: "high_boilerplate",
        severity: "medium",
        message: "boilerplate",
      },
    ];
    const { result, transforms } = fixContent(content, "CLAUDE.md", flags);
    expect(transforms.length).toBeGreaterThan(0);
    expect(result).not.toContain("Always write clean code");
    expect(result).toContain("bun test");
  });

  it("softens ALL-CAPS emphasis", () => {
    const content = `# Project\n\nNEVER skip tests.\nALWAYS run lint.\nYou MUST be careful.\n`;
    const flags: AuditFlag[] = [
      {
        id: "excessive_emphasis",
        severity: "low",
        message: "emphasis",
      },
    ];
    const { result, transforms } = fixContent(content, "CLAUDE.md", flags);
    expect(transforms.some((t) => t.includes("Softened"))).toBe(true);
    expect(result).not.toContain("NEVER");
    expect(result).toContain("Never");
  });

  it("removes empty sections", () => {
    const content = `# Project\n\n## Architecture\n\n## Testing\nRun tests\n`;
    const flags: AuditFlag[] = [
      {
        id: "empty_section",
        severity: "low",
        message: "empty section",
        line: 3,
      },
    ];
    const { result, transforms } = fixContent(content, "CLAUDE.md", flags);
    expect(transforms.some((t) => t.includes("empty sections"))).toBe(true);
    expect(result).not.toContain("## Architecture");
    expect(result).toContain("## Testing");
  });

  it("adds paths stub to unscoped rules", () => {
    const content = `# API Rules\n\nValidate all inputs.\n`;
    const flags: AuditFlag[] = [
      {
        id: "unscoped_rule",
        severity: "high",
        message: "unscoped",
      },
    ];
    const { result, transforms } = fixContent(
      content,
      ".claude/rules/api.md",
      flags
    );
    expect(transforms.some((t) => t.includes("paths:"))).toBe(true);
    expect(result).toContain("paths:");
    expect(result).toContain("TODO");
  });

  it("does not add paths stub to CLAUDE.md", () => {
    const content = `# Project\nHello\n`;
    const flags: AuditFlag[] = [
      {
        id: "unscoped_rule",
        severity: "high",
        message: "unscoped",
      },
    ];
    const { result, transforms } = fixContent(content, "CLAUDE.md", flags);
    expect(transforms.some((t) => t.includes("paths:"))).toBe(false);
  });
});

describe("applyFix", () => {
  it("writes fixed file and creates backup", () => {
    const filePath = join(TMP, "test.md");
    const content = `# Project\n\nAlways write clean code that follows best practices.\nNEVER skip tests.\n\n## Build\n- npm test\n`;
    writeFileSync(filePath, content, "utf-8");

    const flags: AuditFlag[] = [
      { id: "high_boilerplate", severity: "medium", message: "boilerplate" },
      { id: "excessive_emphasis", severity: "low", message: "emphasis" },
    ];

    const result = applyFix(filePath, content, flags);
    expect(result.savings).toBeGreaterThan(0);
    expect(result.backupPath).toBe(filePath + ".bak");
    expect(existsSync(filePath + ".bak")).toBe(true);
    expect(readFileSync(filePath, "utf-8")).not.toBe(content);
  });

  it("skips write when no transforms apply", () => {
    const filePath = join(TMP, "clean.md");
    const content = `# Project\n\n## Build\n- npm test\n`;
    writeFileSync(filePath, content, "utf-8");

    const flags: AuditFlag[] = [];
    const result = applyFix(filePath, content, flags);
    expect(result.transforms.length).toBe(0);
    expect(result.backupPath).toBeNull();
  });
});
