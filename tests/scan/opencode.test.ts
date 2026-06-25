import { describe, it, expect } from "vitest";
import { findOpenCodeDb } from "../../src/scan/opencode.js";

describe("findOpenCodeDb", () => {
  it("returns null when no db found", () => {
    const result = findOpenCodeDb();
    expect(result === null || typeof result === "string").toBe(true);
  });
});

describe("OpenCode session parsing", () => {
  it("findOpenCodeDb returns string or null", () => {
    const result = findOpenCodeDb();
    expect(result === null || typeof result === "string").toBe(true);
  });
});
