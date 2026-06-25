import { describe, it, expect } from "vitest";
import {
  parseSession,
  analyzeTokens,
} from "../../src/scan/claude-code.js";

const SAMPLE_JSONL = `{"type":"user","message":{"role":"user","content":"hello"}}
{"type":"assistant","message":{"role":"assistant","content":"hi","usage":{"input_tokens":500,"output_tokens":20,"cache_creation_input_tokens":0,"cache_read_input_tokens":100}}}
{"type":"tool_result","toolResult":{"content":"file contents here"}}
{"type":"assistant","message":{"role":"assistant","content":"done","usage":{"input_tokens":800,"output_tokens":30,"cache_creation_input_tokens":50,"cache_read_input_tokens":200}}}
`;

describe("parseSession", () => {
  it("parses JSONL lines into messages", () => {
    const session = {
      filePath: "test.jsonl",
      messages: SAMPLE_JSONL.trim()
        .split("\n")
        .map((l) => JSON.parse(l)),
      mtime: new Date(),
    };

    expect(session.messages.length).toBe(4);
    expect(session.messages[0].type).toBe("user");
    expect(session.messages[1].type).toBe("assistant");
  });
});

describe("analyzeTokens", () => {
  it("aggregates token usage from assistant messages", () => {
    const messages = SAMPLE_JSONL.trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const session = {
      filePath: "test.jsonl",
      messages,
      mtime: new Date(),
    };

    const breakdown = analyzeTokens(session);
    expect(breakdown.totalInput).toBe(1300);
    expect(breakdown.totalOutput).toBe(50);
    expect(breakdown.cacheRead).toBe(300);
    expect(breakdown.cacheCreation).toBe(50);
    expect(breakdown.messageCount).toBe(2);
  });

  it("calculates cache hit rate", () => {
    const messages = SAMPLE_JSONL.trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const session = {
      filePath: "test.jsonl",
      messages,
      mtime: new Date(),
    };

    const breakdown = analyzeTokens(session);
    expect(breakdown.cacheHitRate).toBeGreaterThan(0);
    expect(breakdown.cacheHitRate).toBeLessThanOrEqual(1);
  });

  it("handles empty session", () => {
    const session = {
      filePath: "test.jsonl",
      messages: [],
      mtime: new Date(),
    };

    const breakdown = analyzeTokens(session);
    expect(breakdown.totalInput).toBe(0);
    expect(breakdown.totalOutput).toBe(0);
    expect(breakdown.messageCount).toBe(0);
    expect(breakdown.cacheHitRate).toBe(0);
  });

  it("skips malformed JSON lines", () => {
    const session = {
      filePath: "test.jsonl",
      messages: [
        { type: "assistant", message: { role: "assistant", content: "", usage: { input_tokens: 100, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } },
        { broken: true } as unknown,
        { type: "assistant", message: { role: "assistant", content: "", usage: { input_tokens: 200, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } },
      ],
      mtime: new Date(),
    };

    const breakdown = analyzeTokens(session);
    expect(breakdown.totalInput).toBe(300);
    expect(breakdown.messageCount).toBe(2);
  });
});
