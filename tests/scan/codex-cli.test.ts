import { describe, it, expect } from "vitest";
import { parseCodexContent, analyzeCodexSession } from "../../src/scan/codex-cli.js";

const SAMPLE_JSON = JSON.stringify({
  messages: [
    { role: "user", content: "Build a REST API" },
    { role: "assistant", content: "I'll create the API endpoints.", usage: { input_tokens: 400, output_tokens: 80 } },
    { role: "assistant", content: "The API is ready.", usage: { input_tokens: 600, output_tokens: 120 } },
  ],
});

describe("parseCodexContent", () => {
  it("parses JSON session with nested messages", () => {
    const messages = parseCodexContent(SAMPLE_JSON);
    expect(messages.length).toBe(3);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  it("handles empty content", () => {
    const messages = parseCodexContent("");
    expect(messages.length).toBe(0);
  });
});

describe("analyzeCodexSession", () => {
  it("aggregates token usage from assistant messages", () => {
    const messages = parseCodexContent(SAMPLE_JSON);
    const breakdown = analyzeCodexSession(messages);
    expect(breakdown.totalInput).toBe(1000);
    expect(breakdown.totalOutput).toBe(200);
    expect(breakdown.messageCount).toBe(2);
  });

  it("returns zero for empty sessions", () => {
    const breakdown = analyzeCodexSession([]);
    expect(breakdown.totalInput).toBe(0);
    expect(breakdown.totalOutput).toBe(0);
    expect(breakdown.messageCount).toBe(0);
  });

  it("estimates tokens from content when usage missing", () => {
    const messages = [
      { role: "user", content: "Please help me code this feature" },
      { role: "assistant", content: "Sure, I will implement it for you with a complete solution" },
    ];
    const breakdown = analyzeCodexSession(messages);
    expect(breakdown.totalInput).toBeGreaterThan(0);
    expect(breakdown.totalOutput).toBeGreaterThan(0);
  });
});
