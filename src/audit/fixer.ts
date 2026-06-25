import { writeFileSync, copyFileSync, existsSync } from "node:fs";
import { countTokens } from "../shared/counter.js";
import type { AuditFlag } from "./types.js";
import { BOILERPLATE_PATTERNS, extractSections, shingle, jaccard } from "./heuristics.js";

const SHOUTY_WORD_RE =
  /\b(NEVER|ALWAYS|MUST|CRITICAL|MANDATORY|ABSOLUTELY|REQUIRE|ESSENTIAL|IMPORTANT|IMPERATIVE)\b/g;

export interface FixResult {
  path: string;
  originalTokens: number;
  fixedTokens: number;
  savings: number;
  backupPath: string | null;
  transforms: string[];
}

function deBoilerplate(content: string): { result: string; removed: number } {
  const lines = content.split("\n");
  const kept: string[] = [];
  let removed = 0;
  for (const line of lines) {
    if (
      line.trim().startsWith("#") ||
      line.trim().length === 0 ||
      !BOILERPLATE_PATTERNS.some((p) => p.test(line))
    ) {
      kept.push(line);
    } else {
      removed++;
    }
  }
  return { result: kept.join("\n"), removed };
}

function deShoutify(content: string): { result: string; changes: number } {
  let changes = 0;
  const result = content.replace(SHOUTY_WORD_RE, (match) => {
    changes++;
    return match.charAt(0) + match.slice(1).toLowerCase();
  });
  return { result, changes };
}

function deduplicateSections(content: string): { result: string; merged: string[] } {
  const sections = extractSections(content);
  const merged: string[] = [];
  if (sections.length === 0) return { result: content, merged };

  const toRemove = new Set<number>();
  for (let i = 0; i < sections.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < sections.length; j++) {
      if (toRemove.has(j)) continue;
      const sim = jaccard(
        shingle(sections[i].body),
        shingle(sections[j].body)
      );
      if (sim > 0.6) {
        toRemove.add(j);
        merged.push(
          `"${sections[j].title}" merged into "${sections[i].title}"`
        );
      }
    }
  }

  if (toRemove.size === 0) return { result: content, merged };

  const lines = content.split("\n");
  const headerPositions: { lineIdx: number; sectionIdx: number }[] = [];
  let sectionIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s+/.test(lines[i])) {
      if (sectionIdx < sections.length) {
        headerPositions.push({ lineIdx: i, sectionIdx });
        sectionIdx++;
      }
    }
  }

  const removeLineRanges: Set<number> = new Set();
  for (const { sectionIdx: sIdx, lineIdx } of headerPositions) {
    if (toRemove.has(sIdx)) {
      const nextHeader = headerPositions.find(
        (h) => h.sectionIdx === sIdx + 1
      );
      const end = nextHeader ? nextHeader.lineIdx : lines.length;
      for (let k = lineIdx; k < end; k++) {
        removeLineRanges.add(k);
      }
    }
  }

  const kept = lines.filter((_, i) => !removeLineRanges.has(i));
  return { result: kept.join("\n"), merged };
}

function removeEmptySections(content: string): { result: string; removed: number } {
  const sections = extractSections(content);
  let removed = 0;

  const lines = content.split("\n");
  const headerPositions: { lineIdx: number; sectionIdx: number }[] = [];
  let sectionIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s+/.test(lines[i])) {
      if (sectionIdx < sections.length) {
        headerPositions.push({ lineIdx: i, sectionIdx });
        sectionIdx++;
      }
    }
  }

  const removeLineRanges: Set<number> = new Set();
  for (const { sectionIdx: sIdx, lineIdx } of headerPositions) {
    const section = sections[sIdx];
    if (section && section.body.trim().length === 0) {
      const nextHeader = headerPositions.find(
        (h) => h.sectionIdx === sIdx + 1
      );
      const end = nextHeader ? nextHeader.lineIdx : lines.length;
      for (let k = lineIdx; k < end; k++) {
        removeLineRanges.add(k);
      }
      removed++;
    }
  }

  const kept = lines.filter((_, i) => !removeLineRanges.has(i));
  return { result: kept.join("\n"), removed };
}

function addPathsStub(content: string, filePath: string): { result: string; added: boolean } {
  if (
    !filePath.includes(".claude/rules/") ||
    !filePath.endsWith(".md")
  ) {
    return { result: content, added: false };
  }

  if (/^---\s*\n[\s\S]*?\n---\s*\n/.test(content)) {
    if (/paths\s*:/.test(content)) {
      return { result: content, added: false };
    }
    return { result: content, added: false };
  }

  const stub = `---\npaths:\n  # TODO: add file path globs to scope this rule\n  # e.g., - "src/api/**/*.ts"\n---\n\n`;
  return { result: stub + content, added: true };
}

export function fixContent(
  content: string,
  filePath: string,
  flags: AuditFlag[]
): { result: string; transforms: string[] } {
  let current = content;
  const transforms: string[] = [];

  const hasFlag = (id: string) => flags.some((f) => f.id === id);

  if (hasFlag("high_boilerplate")) {
    const { result, removed } = deBoilerplate(current);
    if (removed > 0) {
      current = result;
      transforms.push(`Removed ${removed} boilerplate lines`);
    }
  }

  if (hasFlag("excessive_emphasis")) {
    const { result, changes } = deShoutify(current);
    if (changes > 0) {
      current = result;
      transforms.push(`Softened ${changes} ALL-CAPS emphasis words`);
    }
  }

  if (hasFlag("duplicate_section")) {
    const { result, merged } = deduplicateSections(current);
    if (merged.length > 0) {
      current = result;
      for (const m of merged) transforms.push(`Merged duplicate: ${m}`);
    }
  }

  if (hasFlag("empty_section")) {
    const { result, removed } = removeEmptySections(current);
    if (removed > 0) {
      current = result;
      transforms.push(`Removed ${removed} empty sections`);
    }
  }

  if (hasFlag("unscoped_rule")) {
    const { result, added } = addPathsStub(current, filePath);
    if (added) {
      current = result;
      transforms.push("Added paths: frontmatter stub to rule file");
    }
  }

  return { result: current, transforms };
}

export function applyFix(
  filePath: string,
  content: string,
  flags: AuditFlag[]
): FixResult {
  const originalTokens = countTokens(content);
  const { result: fixedContent, transforms } = fixContent(
    content,
    filePath,
    flags
  );
  const fixedTokens = countTokens(fixedContent);
  const savings = originalTokens - fixedTokens;

  let backupPath: string | null = null;

  if (transforms.length > 0) {
    backupPath = filePath + ".bak";
    if (!existsSync(backupPath)) {
      copyFileSync(filePath, backupPath);
    }
    writeFileSync(filePath, fixedContent, "utf-8");
  }

  return {
    path: filePath,
    originalTokens,
    fixedTokens,
    savings,
    backupPath,
    transforms,
  };
}
