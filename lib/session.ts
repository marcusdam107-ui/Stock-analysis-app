import type { MarketSession } from "./types";

/** Wall-clock parts in New York time. */
export function nyParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { weekday: parts.weekday as string, hour: Number(parts.hour), minute: Number(parts.minute) };
}

/**
 * US equity sessions (holidays not modelled):
 * overnight Sun 8pm to Fri 4am, pre 4:00-9:30, regular 9:30-16:00, after-hours 16:00-20:00.
 */
export function sessionAt(d = new Date()): MarketSession {
  const { weekday, hour, minute } = nyParts(d);
  const m = hour * 60 + minute;
  const weekdayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  if (weekdayIdx === 6) return "closed";
  if (weekdayIdx === 0) return m >= 20 * 60 ? "overnight" : "closed";
  if (m < 4 * 60) return "overnight";
  if (m < 9 * 60 + 30) return "pre";
  if (m < 16 * 60) return "regular";
  if (m < 20 * 60) return "post";
  return weekdayIdx === 5 ? "closed" : "overnight";
}

export const SESSION_LABEL: Record<MarketSession, string> = {
  pre: "Pre-market",
  regular: "Market open",
  post: "After hours",
  overnight: "Overnight",
  closed: "Market closed",
};

/** Offset (seconds) to add to a UTC timestamp so the chart shows New York wall-clock time. */
export function nyOffsetSeconds(epochSec: number): number {
  const d = new Date(epochSec * 1000);
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((ny.getTime() - utc.getTime()) / 1000);
}
