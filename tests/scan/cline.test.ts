import { describe, it, expect } from "vitest";
import { parseClineContent, analyzeClineSession } from "../../src/scan/cline.js";

const SAMPLE_JSON = JSON.stringify([
  { ts: 1000, type: "user", text: "Fix the login bug" },
  { ts: 2000, type: "assistant", text: "I found the issue in auth.ts", tokensIn: 500, tokensOut: 50, cost: 0.01 },
  { ts: 3000, type: "assistant", text: "The fix is applied", tokensIn: 800, tokensOut: 100, cost: 0.02 },
]);

const SAMPLE_JSONL = `{"ts":1000,"type":"user","text":"Hello"}
{"ts":2000,"type":"assistant","text":"Hi there","tokensIn":200,"tokensOut":20,"cost":0.005}
`;

describe("parseClineContent", () => {
  it("parses JSON array sessions", () => {
    const messages = parseClineContent(SAMPLE_JSON);
    expect(messages.length).toBe(3);
    expect(messages[0].type).toBe("user");
    expect(messages[1].type).toBe("assistant");
  });

  it("parses JSONL sessions", () => {
    const messages = parseClineContent(SAMPLE_JSONL);
    expect(messages.length).toBe(2);
    expect(messages[0].type).toBe("user");
  });

  it("handles empty content", () => {
    const messages = parseClineContent("");
    expect(messages.length).toBe(0);
  });
});

describe("analyzeClineSession", () => {
  it("aggregates token usage", () => {
    const messages = parseClineContent(SAMPLE_JSON);
    const breakdown = analyzeClineSession(messages);
    expect(breakdown.totalInput).toBe(1300);
    expect(breakdown.totalOutput).toBe(150);
    expect(breakdown.messageCount).toBe(2);
    expect(breakdown.cost).toBeCloseTo(0.03);
  });

  it("returns zero for empty sessions", () => {
    const breakdown = analyzeClineSession([]);
    expect(breakdown.totalInput).toBe(0);
    expect(breakdown.totalOutput).toBe(0);
    expect(breakdown.messageCount).toBe(0);
  });
});
