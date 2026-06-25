import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";
import { readFileSync } from "node:fs";

const encoder = new Tiktoken(o200k_base);

export function countTokens(text: string): number {
  if (!text) return 0;
  return encoder.encode(text).length;
}

export function countFileTokens(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    return countTokens(content);
  } catch {
    return 0;
  }
}

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}
