export const fmtPrice = (n: number | undefined | null, digits = 2) =>
  n == null || !isFinite(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPct = (n: number | undefined | null, digits = 2) =>
  n == null || !isFinite(n) ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;

export const fmtSigned = (n: number | undefined | null, digits = 2) =>
  n == null || !isFinite(n) ? "—" : `${n > 0 ? "+" : ""}${fmtPrice(n, digits)}`;

export function fmtCompact(n: number | undefined | null, prefix = "") {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  const s = a >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
    : a >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0);
  return prefix + s;
}

export const fmtInt = (n: number | undefined | null) => (n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US"));

export function timeAgo(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const fmtDate = (ymd: string) =>
  new Date(ymd + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const fmtTimeNY = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" });

export const tone = (n: number | undefined | null) => (n == null || n === 0 ? "flat" : n > 0 ? "up" : "down");
