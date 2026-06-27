export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatPercent(n: number, decimals: number = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatCost(n: number): string {
  if (n < 0.005) return "$0.00";
  return `$${n.toFixed(2)}`;
}

export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}

export interface BarSegment {
  label: string;
  value: number;
  color: string;
}

export function barChart(segments: BarSegment[], width: number = 30): string {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return "";
  const lines: string[] = [];
  for (const seg of segments) {
    const pct = seg.value / total;
    const filled = Math.round(pct * width);
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
    lines.push(
      `${seg.label.padEnd(18)} ${bar} ${formatPercent(pct * 100)}`
    );
  }
  return lines.join("\n");
}

export function pluralize(n: number, singular: string, plural?: string): string {
  if (n === 1) return `${n} ${singular}`;
  return `${n} ${plural || singular + "s"}`;
}
