export interface AuditFlag {
  id: string;
  severity: "high" | "medium" | "low";
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
}

export interface AuditResult {
  files: FileAuditResult[];
  totalTokens: number;
  reducibleTokens: number;
  reduciblePercent: number;
  monthlyCostEstimate: number;
  monthlySavingsEstimate: number;
  model: string;
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
