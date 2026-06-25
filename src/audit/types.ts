export type Severity = "low" | "medium" | "high" | "critical";

export interface AuditFlag {
  id: string;
  severity: Severity;
  message: string;
  line?: number;
  savings?: number;
}

export interface FileAuditResult {
  path: string;
  relPath: string;
  tokens: number;
  lines: number;
  flags: AuditFlag[];
  reducibleTokens: number;
  loadFrequency: "every_message" | "conditional" | "on_demand";
  content: string;
  severityScore: Severity;
  quickWin: boolean;
}

export interface AuditResult {
  files: FileAuditResult[];
  totalTokens: number;
  reducibleTokens: number;
  reduciblePercent: number;
  monthlyCostEstimate: number;
  monthlySavingsEstimate: number;
  model: string;
  quickWin: { file: string; message: string; savings: number } | null;
}

export interface ScannerFile {
  path: string;
  relPath: string;
  tokens: number;
  lines: number;
  exists: boolean;
  loadFrequency: "every_message" | "conditional" | "on_demand";
  content: string;
  frontmatter: Record<string, unknown> | null;
}
