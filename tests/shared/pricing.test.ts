import { describe, it, expect } from "vitest";
import {
  estimateCost,
  estimateMonthly,
  getPricing,
  PRICING,
} from "../../src/shared/pricing.js";

describe("getPricing", () => {
  it("returns sonnet pricing for sonnet", () => {
    const p = getPricing("sonnet");
    expect(p.inputPerMillion).toBe(3);
  });

  it("returns haiku pricing for haiku", () => {
    const p = getPricing("haiku");
    expect(p.inputPerMillion).toBe(0.8);
  });

  it("returns opus pricing for opus", () => {
    const p = getPricing("opus");
    expect(p.inputPerMillion).toBe(15);
  });

  it("falls back to sonnet for unknown model", () => {
    const p = getPricing("unknown-model");
    expect(p.inputPerMillion).toBe(PRICING.sonnet.inputPerMillion);
  });
});

describe("estimateCost", () => {
  it("calculates cost for tokens at sonnet pricing", () => {
    const result = estimateCost(
      { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 },
      "sonnet"
    );
    expect(result.inputCost).toBe(3);
    expect(result.outputCost).toBe(15);
    expect(result.totalCost).toBe(18);
  });

  it("calculates cost for cache reads at discounted rate", () => {
    const result = estimateCost(
      { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 0 },
      "sonnet"
    );
    expect(result.cacheReadCost).toBe(0.3);
  });

  it("returns 0 cost for 0 tokens", () => {
    const result = estimateCost(
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      "sonnet"
    );
    expect(result.totalCost).toBe(0);
  });
});

describe("estimateMonthly", () => {
  it("estimates monthly cost at 50 msgs/day, 22 days", () => {
    const result = estimateMonthly(0.10, 50, 22);
    expect(result).toBeCloseTo(110, 0);
  });

  it("uses default 50 msgs/day and 22 days", () => {
    const result = estimateMonthly(0.10);
    expect(result).toBeCloseTo(110, 0);
  });
});
