// Weekly earnings board (Earnings Whispers' anticipation ranking) and US economic events (Forex Factory).
// Neither needs a key. The week rolls over at Sunday 12:00am New York time.
import { cached } from "../cache";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export type ReleaseTime = "BMO" | "AMC" | "TBD";

export interface EarningsEntry {
  ticker: string;
  company: string;
  time: ReleaseTime;
  score: number;           // Earnings Whispers trader-interest score; higher = more anticipated
  epsEst: number | null;
  revEst: number | null;
  confirmed: boolean;
}

export interface EarningsDay { date: string; weekday: string; bmo: EarningsEntry[]; amc: EarningsEntry[] }

export interface EconEvent {
  title: string;
  time: number;            // epoch ms
  allDay: boolean;
  impact: "High" | "Medium" | "Holiday";
  forecast: string;
  previous: string;
}

export interface EarningsWeek { weekOf: string; days: EarningsDay[]; events: EconEvent[]; sources: string[]; errors: string[] }

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Monday of the week to show: from Sunday 12am ET the board switches to the coming week. */
export function weekStart(now = new Date()): Date {
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = new Date(Date.UTC(ny.getFullYear(), ny.getMonth(), ny.getDate()));
  const dow = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() + (dow === 0 ? 1 : 1 - dow));
  return day;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function ewDay(date: string): Promise<EarningsEntry[]> {
  const rows: any[] = await cached(`ew:${date}`, 30 * 60_000, async () => {
    const res = await fetch(`https://www.earningswhispers.com/api/caldata/${date.replaceAll("-", "")}`, {
      headers: { "User-Agent": UA, Referer: "https://www.earningswhispers.com/calendar", Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Earnings Whispers ${res.status}`);
    return res.json();
  });
  return (rows ?? [])
    .map((r) => ({
      ticker: String(r.ticker ?? "").toUpperCase(),
      company: r.company ?? r.ticker,
      // 1 = before the open, 3 = after the close
      time: (r.releaseTime === 1 ? "BMO" : r.releaseTime === 3 ? "AMC" : "TBD") as ReleaseTime,
      score: Number(r.total) || 0,
      epsEst: r.q1EstEPS != null && r.q1EstEPS !== 999 ? Number(r.q1EstEPS) : null,
      revEst: r.q1RevEst != null ? Number(r.q1RevEst) : null,
      confirmed: !!r.confirmDate,
    }))
    .filter((r) => r.ticker)
    .sort((a, b) => b.score - a.score)
    // one tile per company: drop extra share classes (GOOG next to GOOGL)
    .filter((r, i, all) => all.findIndex((x) => x.company === r.company) === i);
}

async function ffWeek(): Promise<EconEvent[]> {
  // Forex Factory asks that this feed is polled sparingly; an hour is plenty for a weekly calendar.
  const rows: any[] = await cached("ff:thisweek", 60 * 60_000, async () => {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!res.ok) throw new Error(`Forex Factory ${res.status}`);
    return res.json();
  });
  return (rows ?? [])
    .filter((r) => r.country === "USD" && ["High", "Medium", "Holiday"].includes(r.impact))
    .map((r) => {
      const t = new Date(r.date).getTime();
      const ny = new Date(t).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      return { title: r.title, time: t, allDay: ny === "00:00", impact: r.impact, forecast: r.forecast ?? "", previous: r.previous ?? "" };
    })
    .sort((a, b) => a.time - b.time);
}

export async function getEarningsWeek(): Promise<EarningsWeek> {
  const start = weekStart();
  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
  const errors: string[] = [];
  const [days, events] = await Promise.all([
    Promise.all(
      dates.map(async (d) => {
        const date = ymd(d);
        const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
        try {
          const all = await ewDay(date);
          return { date, weekday, bmo: all.filter((e) => e.time === "BMO"), amc: all.filter((e) => e.time !== "BMO") };
        } catch (e) {
          errors.push(`${weekday}: ${(e as Error).message}`);
          return { date, weekday, bmo: [], amc: [] };
        }
      }),
    ),
    ffWeek().catch((e) => {
      errors.push(`Events: ${(e as Error).message}`);
      return [] as EconEvent[];
    }),
  ]);
  // Forex Factory's week runs Sunday to Saturday; keep only events in the board's Mon-Fri window
  const from = start.getTime() - 86_400_000;
  const to = start.getTime() + 6 * 86_400_000;
  return {
    weekOf: ymd(start),
    days,
    events: events.filter((e) => e.time >= from && e.time < to),
    sources: ["Earnings Whispers", "Forex Factory"],
    errors,
  };
}
