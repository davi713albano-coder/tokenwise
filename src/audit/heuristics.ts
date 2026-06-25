import type { AuditFlag } from "./types.js";
import { countTokens, countLines } from "../shared/counter.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BOILERPLATE_PATTERNS = [
  /always\s+(write|use|follow|ensure|make)\s+(clean|maintainable|readable|best|proper|good)/i,
  /follow\s+(best\s+)?practices/i,
  /use\s+(proper|appropriate|correct)\s+(naming|coding|formatting)/i,
  /make\s+sure\s+(your\s+)?code\s+is/i,
  /prefer\s+(clean|simple|readable)\s+code/i,
  /write\s+(well-structured|well-organized|well-documented)\s+code/i,
  /always\s+use\s+(const|let|var)\s+over/i,
  /never\s+use\s+(var|any)\s+type/i,
  /you\s+are\s+a\s+(helpful|expert|senior|professional)\s+(assistant|developer|engineer)/i,
  /you\s+must\s+(be|always|follow|write|ensure)/i,
  /please\s+(make|ensure|write|use|follow)\s+sure/i,
];

const SHOUTY_WORD_RE =
  /\b(NEVER|ALWAYS|MUST|CRITICAL|MANDATORY|ABSOLUTELY|REQUIRE|ESSENTIAL|IMPORTANT|IMPERATIVE)\b/;

const OBVIOUS_DESCRIPTION_PATTERNS = [
  /`?src\/?`?\s+(contains|has|holds|is)\s+(source|main|application)\s+code/i,
  /`?tests?\/?`?\s+(contains|has|holds|is)\s+(test)/i,
  /`?docs\/?`?\s+(contains|has|holds|is)\s+(documentation)/i,
  /`?config\/?`?\s+(contains|has|holds|is)\s+(configuration|config)/i,
  /`?lib\/?`?\s+(contains|has|holds|is)\s+(library|shared|utility)\s+code/i,
  /`?components?\/?`?\s+(contains|has|holds|is)\s+(ui|react|component)/i,
];

interface Section {
  title: string;
  body: string;
  startLine: number;
}

function extractSections(md: string): Section[] {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];
  let startLine = 0;
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const headerMatch = lines[i].match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      if (found) {
        sections.push({
          title: currentTitle,
          body: currentBody.join("\n"),
          startLine,
        });
      }
      currentTitle = headerMatch[2].trim();
      currentBody = [];
      startLine = i + 1;
      found = true;
    } else {
      currentBody.push(lines[i]);
    }
  }

  if (found) {
    sections.push({
      title: currentTitle,
      body: currentBody.join("\n"),
      startLine,
    });
  }

  return sections;
}

function shingle(text: string, k: number = 5): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - k; i++) {
    shingles.add(words.slice(i, i + k).join(" "));
  }
  return shingles;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface AuditContext {
  projectDir: string;
}

export function auditContent(
  content: string,
  filePath: string,
  context: AuditContext
): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const lines = content.split("\n");
  const nonHeaderLines = lines.filter(
    (l) => !l.trim().startsWith("#") && l.trim().length > 0
  );
  const totalTokens = countTokens(content);

  // 1. Excessive length (>200 lines)
  const lineCount = countLines(content);
  if (lineCount > 200) {
    const overBy = lineCount - 200;
    const estimatedSavings = Math.round(
      totalTokens * (overBy / lineCount) * 0.5
    );
    flags.push({
      id: "excessive_length",
      severity: "high",
      message: `${lineCount} lines (recommended max: 200). ${overBy} lines over threshold.`,
      savings: estimatedSavings,
    });
  }

  // 2. High boilerplate ratio
  const boilerplateHits = nonHeaderLines.filter((line) =>
    BOILERPLATE_PATTERNS.some((p) => p.test(line))
  );
  const boilerplateRatio =
    nonHeaderLines.length > 0
      ? boilerplateHits.length / nonHeaderLines.length
      : 0;
  if (boilerplateRatio > 0.25) {
    flags.push({
      id: "high_boilerplate",
      severity: "medium",
      message: `${boilerplateHits.length} boilerplate lines (${(boilerplateRatio * 100).toFixed(0)}% of non-header content). AI already knows these defaults.`,
      savings: countTokens(boilerplateHits.join("\n")),
    });
  }

  // 3. Excessive emphasis (ALL CAPS)
  const shoutyLines = lines.filter((l) => SHOUTY_WORD_RE.test(l));
  if (shoutyLines.length > 3) {
    flags.push({
      id: "excessive_emphasis",
      severity: "low",
      message: `${shoutyLines.length} lines with ALL-CAPS emphasis (NEVER/ALWAYS/MUST/CRITICAL). Modern models follow normal-tone instructions.`,
      savings: countTokens(
        shoutyLines
          .map((l) =>
            l.replace(
              /\b(NEVER|ALWAYS|MUST|CRITICAL|MANDATORY|ABSOLUTELY|REQUIRE|ESSENTIAL|IMPORTANT|IMPERATIVE)\b/g,
              (m) => m.charAt(0) + m.slice(1).toLowerCase()
            )
          )
          .join("\n")
      ) - countTokens(shoutyLines.join("\n")),
    });
  }

  // 4. Duplicate sections
  const sections = extractSections(content);
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const sim = jaccard(
        shingle(sections[i].body),
        shingle(sections[j].body)
      );
      if (sim > 0.6) {
        const smallerBody =
          sections[i].body.length <= sections[j].body.length
            ? sections[i].body
            : sections[j].body;
        flags.push({
          id: "duplicate_section",
          severity: "medium",
          message: `"${sections[i].title}" and "${sections[j].title}" are ${Math.round(sim * 100)}% similar. Consider merging.`,
          line: sections[j].startLine,
          savings: countTokens(smallerBody),
        });
      }
    }
  }

  // 5. Unscoped rule (no paths: frontmatter)
  if (filePath.includes("rules") && filePath.endsWith(".md")) {
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (fmMatch) {
      if (!/paths\s*:/.test(fmMatch[1])) {
        flags.push({
          id: "unscoped_rule",
          severity: "high",
          message: `Rule has no "paths:" frontmatter. It loads on every message regardless of context. Add paths to scope it.`,
          savings: Math.round(totalTokens * 0.59),
        });
      }
    } else {
      // No frontmatter at all on a rules file
      if (filePath.includes(".claude/rules/")) {
        flags.push({
          id: "unscoped_rule",
          severity: "high",
          message: `Rule has no YAML frontmatter. Add --- with paths: to scope loading. Without paths, loads every message.`,
          savings: Math.round(totalTokens * 0.59),
        });
      }
    }
  }

  // 6. Redundant with config files
  const configRedundancies = checkConfigRedundancy(content, context.projectDir);
  flags.push(...configRedundancies);

  // 7. Obvious directory descriptions
  const obviousMatches = nonHeaderLines.filter((line) =>
    OBVIOUS_DESCRIPTION_PATTERNS.some((p) => p.test(line))
  );
  for (const match of obviousMatches) {
    flags.push({
      id: "obvious_description",
      severity: "low",
      message: `Describes directory structure that AI can discover: "${match.trim()}"`,
      line: lines.indexOf(match) + 1,
      savings: countTokens(match),
    });
  }

  // 8. Empty sections
  for (const section of sections) {
    const bodyTrimmed = section.body.trim();
    if (bodyTrimmed.length === 0 || /^[-*]\s*$/.test(bodyTrimmed)) {
      flags.push({
        id: "empty_section",
        severity: "low",
        message: `Section "${section.title}" is empty. Remove or fill it.`,
        line: section.startLine,
        savings: countTokens(`## ${section.title}\n\n`),
      });
    }
  }

  return flags;
}

function checkConfigRedundancy(
  content: string,
  projectDir: string
): AuditFlag[] {
  const flags: AuditFlag[] = [];

  const checks: Array<{
    pattern: RegExp;
    configFile: string;
    configKey: string;
    description: string;
  }> = [
    {
      pattern: /use\s+(\d)[\s-]space\s+indent(?:ation)?/i,
      configFile: ".prettierrc",
      configKey: "tabWidth",
      description: "indentation setting",
    },
    {
      pattern: /strict\s+mode/i,
      configFile: "tsconfig.json",
      configKey: "compilerOptions.strict",
      description: "TypeScript strict mode",
    },
    {
      pattern: /single\s+quotes?/i,
      configFile: ".prettierrc",
      configKey: "singleQuote",
      description: "quote style",
    },
    {
      pattern: /run\s+(eslint|lint)\s+before/i,
      configFile: ".husky/pre-commit",
      configKey: "lint",
      description: "pre-commit lint hook",
    },
  ];

  const lines = content.split("\n");
  for (const check of checks) {
    const matchingLines = lines.filter((l) => check.pattern.test(l));
    if (matchingLines.length > 0) {
      const configPath = join(projectDir, check.configFile);
      if (existsSync(configPath)) {
        flags.push({
          id: "redundant_with_config",
          severity: "medium",
          message: `Instruction about ${check.description} is redundant — ${check.configFile} already enforces this.`,
          savings: countTokens(matchingLines.join("\n")),
        });
      }
    }
  }

  return flags;
}

export { extractSections, shingle, jaccard, BOILERPLATE_PATTERNS };
