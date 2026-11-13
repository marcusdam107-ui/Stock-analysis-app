// Synthetic data used only when live providers are unreachable (or MALACHI_DEMO=1).
// Everything returned from here is flagged demo so the UI can say so.
import { price as bsPrice, delta } from "./blackscholes";
import type { Candle, ChainRow, NewsItem, Quote, TrumpPost } from "./types";
import { sessionAt } from "./session";

const BASE: Record<string, number> = {
  SPY: 742.6, IWM: 262.4, QQQ: 706.1, NDX: 28890, AAPL: 262.1, NVDA: 186.4, TSLA: 438.7, MSFT: 521.3,
  AMZN: 224.6, META: 731.9, GOOGL: 253.1, AMD: 238.5,
};

function seed(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const base = (s: string) => BASE[s] ?? 50 + seed(s)() * 300;

export function demoCandles(symbol: string, intervalSec: number, count: number): Candle[] {
  const rnd = seed(symbol + intervalSec);
  const now = Math.floor(Date.now() / 1000 / intervalSec) * intervalSec;
  const vol = 0.0025 * Math.sqrt(intervalSec / 300);
  let p = base(symbol) * (0.92 + rnd() * 0.06);
  const out: Candle[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const open = p;
    const close = open * (1 + (rnd() - 0.5) * vol * 2 + (base(symbol) / open - 1) * 0.01);
    const high = Math.max(open, close) * (1 + rnd() * vol);
    const low = Math.min(open, close) * (1 - rnd() * vol);
    out.push({ time: now - i * intervalSec, open, high, low, close, volume: Math.round(2e5 + rnd() * 1e6) });
    p = close;
  }
  // land on the demo quote price
  const k = base(symbol) / out[out.length - 1].close;
  return out.map((c) => ({ ...c, open: c.open * k, high: c.high * k, low: c.low * k, close: c.close * k }));
}

export function demoQuote(symbol: string): Quote {
  const rnd = seed(symbol + Math.floor(Date.now() / 5000));
  const prev = base(symbol) / (1 + (seed(symbol)() - 0.5) * 0.03);
  const px = base(symbol) * (1 + (rnd() - 0.5) * 0.0008);
  return {
    symbol, name: `${symbol} (demo)`, price: px, change: px - prev, changePercent: ((px - prev) / prev) * 100,
    regularPrice: px, previousClose: prev, session: sessionAt(), dayHigh: px * 1.006, dayLow: px * 0.993,
    volume: 48_000_000, updatedAt: Date.now(),
  };
}

export function demoChain(symbol: string, spot: number, daysOut: number): ChainRow[] {
  const step = spot > 5000 ? 25 : spot > 400 ? 5 : spot > 100 ? 2.5 : 1;
  const center = Math.round(spot / step) * step;
  const years = Math.max(daysOut, 0.5) / 365;
  const rnd = seed(symbol + daysOut);
  const rows: ChainRow[] = [];
  for (let i = -15; i <= 15; i++) {
    const k = center + i * step;
    const iv = 0.18 + Math.abs(i) * 0.004 + (i < 0 ? 0.03 : 0);
    const mk = (kind: "call" | "put") => {
      const fair = bsPrice(kind, spot, k, years, iv);
      const spread = Math.max(0.01, fair * 0.03);
      return {
        strike: k, bid: Math.max(0, fair - spread), ask: fair + spread, last: fair,
        volume: Math.round(rnd() * 8000 / (1 + Math.abs(i) / 3)),
        openInterest: Math.round((kind === "put" ? 1.25 : 1) * rnd() * 30000 / (1 + Math.abs(i) / 4)),
        iv, delta: delta(kind, spot, k, years, iv),
        inTheMoney: kind === "call" ? k < spot : k > spot,
      };
    };
    rows.push({ strike: k, call: mk("call"), put: mk("put") });
  }
  return rows;
}

export function demoNews(symbol: string): NewsItem[] {
  const t = Date.now();
  return [
    `${symbol} options activity picks up ahead of Friday expiration`,
    `Analysts weigh in on ${symbol} after latest guidance`,
    `What the Fed's next move could mean for ${symbol}`,
    `${symbol}: institutional flows and the week ahead`,
    `Market wrap: indices drift as traders eye earnings season`,
  ].map((title, i) => ({
    id: `demo-${symbol}-${i}`, title, publisher: "Demo wire", url: "#", publishedAt: t - (i + 1) * 47 * 60_000, tickers: [symbol],
  }));
}

export function demoTrump(): TrumpPost[] {
  const t = Date.now();
  return [
    { text: "Demo post: Tariffs on foreign steel will protect American workers. Big announcement next week!", tags: ["Tariffs", "Steel"], impact: "high" as const },
    { text: "Demo post: The Fed should cut rates NOW. Our economy is the strongest in history!", tags: ["Fed / Rates"], impact: "high" as const },
    { text: "Demo post: Great meeting with business leaders at the White House today.", tags: [], impact: "low" as const },
  ].map((p, i) => ({ ...p, id: `demo-${i}`, url: "#", publishedAt: t - (i + 1) * 95 * 60_000, source: "Truth Social" as const }));
}
