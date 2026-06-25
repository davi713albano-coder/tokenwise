import { describe, it, expect } from "vitest";
import { parseAiderContent, analyzeAiderSession } from "../../src/scan/aider.js";

const SAMPLE_HISTORY = `#### User
Can you fix the bug in app.ts?

#### Assistant
I'll look at the file and fix the bug.

#### User
Now add a test for it

#### Assistant
Here's the test I added.
`;

describe("parseAiderContent", () => {
  it("parses markdown sections into messages", () => {
    const messages = parseAiderContent(SAMPLE_HISTORY);
    expect(messages.length).toBe(4);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  it("extracts content for each message", () => {
    const messages = parseAiderContent(SAMPLE_HISTORY);
    expect(messages[0].content).toContain("fix the bug");
    expect(messages[1].content).toContain("look at the file");
  });

  it("handles empty history", () => {
    const messages = parseAiderContent("");
    expect(messages.length).toBe(0);
  });
});

describe("analyzeAiderSession", () => {
  it("estimates tokens from messages", () => {
    const messages = parseAiderContent(SAMPLE_HISTORY);
    const breakdown = analyzeAiderSession(messages);
    expect(breakdown.totalInput).toBeGreaterThan(0);
    expect(breakdown.totalOutput).toBeGreaterThan(0);
    expect(breakdown.messageCount).toBe(2);
  });

  it("returns zero for empty messages", () => {
    const breakdown = analyzeAiderSession([]);
    expect(breakdown.totalInput).toBe(0);
    expect(breakdown.totalOutput).toBe(0);
    expect(breakdown.messageCount).toBe(0);
  });

  it("estimates system prompt from first input", () => {
    const messages = parseAiderContent(SAMPLE_HISTORY);
    const breakdown = analyzeAiderSession(messages);
    expect(breakdown.systemPromptEstimate).toBeGreaterThan(0);
  });
});
