import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatPercent,
  formatCost,
  truncate,
  barChart,
  pluralize,
} from "../../src/shared/format.js";

describe("formatNumber", () => {
  it("formats numbers with commas", () => {
    expect(formatNumber(1234)).toBe("1,234");
  });

  it("formats 0", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats large numbers", () => {
    expect(formatNumber(1000000)).toBe("1,000,000");
  });
});

describe("formatPercent", () => {
  it("formats percentage with one decimal by default", () => {
    expect(formatPercent(45.2)).toBe("45.2%");
  });

  it("formats percentage with custom decimals", () => {
    expect(formatPercent(33.333, 2)).toBe("33.33%");
  });
});

describe("formatCost", () => {
  it("formats cost in dollars", () => {
    expect(formatCost(12.34)).toBe("$12.34");
  });

  it("returns $0.00 for tiny amounts", () => {
    expect(formatCost(0.005)).toBe("$0.00");
  });
});

describe("truncate", () => {
  it("does not truncate short strings", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings", () => {
    expect(truncate("hello world foo bar", 14)).toBe("hello world...");
  });
});

describe("barChart", () => {
  it("renders a bar chart", () => {
    const result = barChart([
      { label: "System", value: 50, color: "red" },
      { label: "Tools", value: 30, color: "yellow" },
      { label: "Code", value: 20, color: "green" },
    ]);
    expect(result).toContain("System");
    expect(result).toContain("50.0%");
    expect(result).toContain("Tools");
    expect(result).toContain("Code");
  });

  it("returns empty string for zero total", () => {
    expect(
      barChart([{ label: "X", value: 0, color: "red" }])
    ).toBe("");
  });
});

describe("pluralize", () => {
  it("singular for 1", () => {
    expect(pluralize(1, "file")).toBe("1 file");
  });

  it("plural for 0", () => {
    expect(pluralize(0, "file")).toBe("0 files");
  });

  it("plural for 2+", () => {
    expect(pluralize(5, "file")).toBe("5 files");
  });

  it("custom plural", () => {
    expect(pluralize(2, "index", "indices")).toBe("2 indices");
  });
});
