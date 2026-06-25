export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheReadPerMillion: number;
  cacheWritePerMillion: number;
}

export const PRICING: Record<string, ModelPricing> = {
  sonnet: {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheWritePerMillion: 3.75,
  },
  haiku: {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.08,
    cacheWritePerMillion: 1,
  },
  opus: {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadPerMillion: 1.5,
    cacheWritePerMillion: 18.75,
  },
  "gpt-4o": {
    inputPerMillion: 2.5,
    outputPerMillion: 10,
    cacheReadPerMillion: 1.25,
    cacheWritePerMillion: 2.5,
  },
  "gpt-4.1": {
    inputPerMillion: 2,
    outputPerMillion: 8,
    cacheReadPerMillion: 0.5,
    cacheWritePerMillion: 2,
  },
  o3: {
    inputPerMillion: 10,
    outputPerMillion: 40,
    cacheReadPerMillion: 2.5,
    cacheWritePerMillion: 10,
  },
  "o4-mini": {
    inputPerMillion: 1.5,
    outputPerMillion: 6,
    cacheReadPerMillion: 0.375,
    cacheWritePerMillion: 1.5,
  },
};

export function getPricing(model: string): ModelPricing {
  const key = model.toLowerCase();
  if (PRICING[key]) return PRICING[key];
  return PRICING["sonnet"];
}

export interface TokenBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
}

export function estimateCost(
  tokens: TokenBreakdown,
  model: string
): CostEstimate {
  const p = getPricing(model);
  const inputCost = (tokens.input * p.inputPerMillion) / 1_000_000;
  const outputCost = (tokens.output * p.outputPerMillion) / 1_000_000;
  const cacheReadCost = (tokens.cacheRead * p.cacheReadPerMillion) / 1_000_000;
  const cacheWriteCost =
    (tokens.cacheWrite * p.cacheWritePerMillion) / 1_000_000;
  return {
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    totalCost: inputCost + outputCost + cacheReadCost + cacheWriteCost,
  };
}

export function estimateMonthly(
  perMessageCost: number,
  messagesPerDay: number = 50,
  workingDays: number = 22
): number {
  return perMessageCost * messagesPerDay * workingDays;
}

export function estimateMessageCost(
  systemPromptTokens: number,
  model: string
): number {
  const p = getPricing(model);
  return (systemPromptTokens * p.inputPerMillion) / 1_000_000;
}
