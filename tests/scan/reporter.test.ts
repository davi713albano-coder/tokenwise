import { describe, it, expect } from "vitest";
import { formatScanTable, formatScanJson } from "../../src/scan/reporter.js";
import type { ScanResult } from "../../src/scan/reporter.js";

const SAMPLE_RESULT: ScanResult = {
  source: "claude-code",
  sessionId: "sess-abc123",
  sessionDate: "2026-06-25",
  model: "sonnet",
  messageCount: 42,
  components: [
    {
      label: "System Prompt",
      tokens: 50000,
      percentOfTotal: 33.3,
      estCost: 0.15,
    },
    {
      label: "History/Context",
      tokens: 40000,
      percentOfTotal: 26.7,
      estCost: 0.12,
    },
    {
      label: "Tool Output",
      tokens: 30000,
      percentOfTotal: 20.0,
      estCost: 0.09,
    },
    {
      label: "Code Reads",
      tokens: 15000,
      percentOfTotal: 10.0,
      estCost: 0.045,
    },
    {
      label: "Cache Hits (discounted)",
      tokens: 15000,
      percentOfTotal: 10.0,
      estCost: 0.0045,
    },
  ],
  cacheHitRate: 0.3,
  topHogs: [
    {
      label: "System Prompt",
      tokens: 50000,
      tip: "Run `tokenwise audit` to trim instruction files.",
    },
  ],
  totalInput: 150000,
  totalOutput: 15000,
  cacheRead: 15000,
  estimatedCost: 0.41,
  estimatedMonthlyCost: 9.02,
  modelUsed: "sonnet",
};

describe("formatScanTable", () => {
  it("renders scan output with components", () => {
    const output = formatScanTable(SAMPLE_RESULT);
    expect(output).toContain("tokenwise scan");
    expect(output).toContain("System Prompt");
    expect(output).toContain("History/Context");
    expect(output).toContain("50,000");
    expect(output).toContain("33.3%");
    expect(output).toContain("Top token hogs");
    expect(output).toContain("Monthly");
  });

  it("renders cache hit rate", () => {
    const output = formatScanTable(SAMPLE_RESULT);
    expect(output).toContain("30.0%");
    expect(output).toContain("(ok)");
  });
});

describe("formatScanJson", () => {
  it("outputs valid JSON", () => {
    const output = formatScanJson(SAMPLE_RESULT);
    const parsed = JSON.parse(output);
    expect(parsed.source).toBe("claude-code");
    expect(parsed.components.length).toBe(5);
  });
});
