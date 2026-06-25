export interface UniversalTokenBreakdown {
  totalInput: number;
  totalOutput: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  messageCount: number;
  cacheHitRate: number;
  cost: number;
  systemPromptEstimate: number;
  toolOutputEstimate: number;
  historyEstimate: number;
  codeReadEstimate: number;
}

export interface UniversalSessionInfo {
  id: string;
  title: string;
  model: string;
  cost: number;
  timeCreated: number;
  agentName: string;
}

export type AgentName =
  | "claude-code"
  | "opencode"
  | "aider"
  | "cline"
  | "codex-cli"
  | "goose"
  | "continue"
  | "augment";

export const AGENT_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  aider: "Aider",
  cline: "Cline",
  "codex-cli": "Codex CLI",
  goose: "Goose",
  continue: "Continue.dev",
  augment: "Augment",
};
