import { describe, it, expect } from "vitest";
import { detectAgents, getAvailableAgents } from "../../src/scan/detector.js";
import type { DetectedAgent } from "../../src/scan/detector.js";

describe("detectAgents", () => {
  it("returns entries for all supported agents", () => {
    const detected = detectAgents();
    expect(detected.length).toBeGreaterThanOrEqual(7);

    const agentNames = detected.map((a) => a.agent);
    expect(agentNames).toContain("claude-code");
    expect(agentNames).toContain("opencode");
    expect(agentNames).toContain("aider");
    expect(agentNames).toContain("cline");
    expect(agentNames).toContain("codex-cli");
    expect(agentNames).toContain("goose");
    expect(agentNames).toContain("continue");
  });

  it("each agent has required fields", () => {
    const detected = detectAgents();
    for (const agent of detected) {
      expect(agent).toHaveProperty("agent");
      expect(agent).toHaveProperty("label");
      expect(agent).toHaveProperty("dataType");
      expect(agent).toHaveProperty("path");
      expect(agent).toHaveProperty("available");
      expect(typeof agent.available).toBe("boolean");
    }
  });
});

describe("getAvailableAgents", () => {
  it("filters to only available agents", () => {
    const available = getAvailableAgents();
    for (const agent of available) {
      expect(agent.available).toBe(true);
    }
  });
});
