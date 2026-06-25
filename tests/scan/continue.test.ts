import { describe, it, expect } from "vitest";
import { parseContinueContent, analyzeContinueSession } from "../../src/scan/continue.js";

const SAMPLE_SESSION = JSON.stringify({
  messages: [
    { role: "user", content: "Explain this function" },
    { role: "assistant", content: "This function processes the input data and returns a transformed result based on the configuration." },
    { role: "user", content: "Can you optimize it?" },
    { role: "assistant", content: "I've optimized the function by caching intermediate results and reducing unnecessary computations." },
  ],
});

describe("parseContinueContent", () => {
  it("parses session messages", () => {
    const messages = parseContinueContent(SAMPLE_SESSION);
    expect(messages.length).toBe(4);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  it("handles empty JSON", () => {
    const messages = parseContinueContent("{}");
    expect(messages.length).toBe(0);
  });
});

describe("analyzeContinueSession", () => {
  it("estimates tokens from messages", () => {
    const messages = parseContinueContent(SAMPLE_SESSION);
    const breakdown = analyzeContinueSession(messages);
    expect(breakdown.totalInput).toBeGreaterThan(0);
    expect(breakdown.totalOutput).toBeGreaterThan(0);
    expect(breakdown.messageCount).toBe(2);
  });

  it("returns zero for empty sessions", () => {
    const breakdown = analyzeContinueSession([]);
    expect(breakdown.totalInput).toBe(0);
    expect(breakdown.totalOutput).toBe(0);
    expect(breakdown.messageCount).toBe(0);
  });
});
