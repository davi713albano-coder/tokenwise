import { describe, it, expect } from "vitest";
import { countTokens, countLines } from "../../src/shared/counter.js";

describe("countTokens", () => {
  it("counts tokens for a simple string", () => {
    const count = countTokens("hello world");
    expect(count).toBeGreaterThan(0);
    expect(typeof count).toBe("number");
  });

  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("counts more tokens for longer text", () => {
    const short = countTokens("hi");
    const long = countTokens("This is a longer sentence with more words in it.");
    expect(long).toBeGreaterThan(short);
  });

  it("counts tokens for multiline text", () => {
    const text = "line one\nline two\nline three";
    const count = countTokens(text);
    expect(count).toBeGreaterThan(0);
  });

  it("counts tokens consistently", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    expect(countTokens(text)).toBe(countTokens(text));
  });
});

describe("countLines", () => {
  it("counts lines in a string", () => {
    expect(countLines("one\ntwo\nthree")).toBe(3);
  });

  it("counts single line as 1", () => {
    expect(countLines("hello")).toBe(1);
  });

  it("returns 0 for empty string", () => {
    expect(countLines("")).toBe(0);
  });

  it("counts trailing newline as extra line", () => {
    expect(countLines("hello\n")).toBe(2);
  });
});
