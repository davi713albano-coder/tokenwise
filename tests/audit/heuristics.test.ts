import { describe, it, expect } from "vitest";
import { auditContent, extractSections, shingle, jaccard } from "../../src/audit/heuristics.js";

const BLOATED_CLAUDE_MD = `# Project

You are a helpful assistant that writes clean, maintainable code.

## Code Style

Always write clean code that follows best practices.
Always use proper naming conventions.
Make sure your code is well-structured.

## Formatting

Use proper coding formatting.
Follow best practices for code style.
Prefer clean code conventions.

## Architecture

\`src/\` contains source code for the application.
\`tests/\` contains test files for the project.
\`docs/\` contains documentation for the project.
\`config/\` contains configuration files.

## Testing

NEVER skip writing tests.
ALWAYS run tests before committing.
You MUST ensure test coverage above 80%.
CRITICAL: Tests are MANDATORY.

## API Rules

NEVER expose internal APIs.
ALWAYS validate input on API endpoints.
You MUST handle errors gracefully.
CRITICAL: Security is ESSENTIAL.
`;

describe("auditContent", () => {
  it("flags excessive length", () => {
    const content = "# Title\n" + "line\n".repeat(250);
    const flags = auditContent(content, "CLAUDE.md", {
      projectDir: "/tmp",
    });
    expect(flags.some((f) => f.id === "excessive_length")).toBe(true);
  });

  it("flags boilerplate", () => {
    const flags = auditContent(BLOATED_CLAUDE_MD, "CLAUDE.md", {
      projectDir: "/tmp",
    });
    expect(flags.some((f) => f.id === "high_boilerplate")).toBe(true);
  });

  it("flags excessive emphasis", () => {
    const flags = auditContent(BLOATED_CLAUDE_MD, "CLAUDE.md", {
      projectDir: "/tmp",
    });
    expect(flags.some((f) => f.id === "excessive_emphasis")).toBe(true);
  });

  it("flags obvious descriptions", () => {
    const flags = auditContent(BLOATED_CLAUDE_MD, "CLAUDE.md", {
      projectDir: "/tmp",
    });
    expect(flags.some((f) => f.id === "obvious_description")).toBe(true);
  });

  it("does not flag minimal clean content", () => {
    const clean = `# Project

SST v3 monorepo with TypeScript.

## Build
- bun install && bun dev
- bun test from package dirs

## Conventions
- Snake_case for Drizzle schema fields
- Import workspace packages by name
`;
    const flags = auditContent(clean, "CLAUDE.md", {
      projectDir: "/tmp",
    });
    expect(flags.some((f) => f.id === "excessive_length")).toBe(false);
    expect(flags.some((f) => f.id === "high_boilerplate")).toBe(false);
    expect(flags.some((f) => f.id === "excessive_emphasis")).toBe(false);
  });

  it("flags unscoped rules file", () => {
    const ruleContent = `# API Rules\n\nAll API endpoints must validate input.`;
    const flags = auditContent(
      ruleContent,
      ".claude/rules/api.md",
      { projectDir: "/tmp" }
    );
    expect(flags.some((f) => f.id === "unscoped_rule")).toBe(true);
  });

  it("flags duplicate sections", () => {
    const content = `# Project

## Code Style
Always write clean maintainable code using best practices.
Follow proper naming conventions.
Use appropriate coding formatting.

## Formatting
Always write clean maintainable code using best practices.
Follow proper naming conventions.
Use appropriate coding formatting.
`;
    const flags = auditContent(content, "CLAUDE.md", {
      projectDir: "/tmp",
    });
    expect(flags.some((f) => f.id === "duplicate_section")).toBe(true);
  });

  it("flags empty sections", () => {
    const content = `# Project

## Architecture

## Testing
Run bun test
`;
    const flags = auditContent(content, "CLAUDE.md", {
      projectDir: "/tmp",
    });
    expect(flags.some((f) => f.id === "empty_section")).toBe(true);
  });
});

describe("extractSections", () => {
  it("extracts sections from markdown", () => {
    const md = `## A\nbody a\n\n## B\nbody b`;
    const sections = extractSections(md);
    expect(sections.length).toBe(2);
    expect(sections[0].title).toBe("A");
    expect(sections[1].title).toBe("B");
  });

  it("returns empty array for no headers", () => {
    expect(extractSections("no headers here")).toEqual([]);
  });
});

describe("jaccard", () => {
  it("returns 1 for identical sets", () => {
    const a = shingle("the quick brown fox jumps over");
    const b = shingle("the quick brown fox jumps over");
    expect(jaccard(a, b)).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    const a = shingle("alpha beta gamma delta epsilon");
    const b = shingle("kappa lambda mu nu xi omicron");
    expect(jaccard(a, b)).toBe(0);
  });

  it("returns between 0 and 1 for partial overlap", () => {
    const a = shingle("the quick brown fox jumps over the lazy dog and the cat");
    const b = shingle("the quick brown fox jumps over the tired dog and the cat");
    const sim = jaccard(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});
