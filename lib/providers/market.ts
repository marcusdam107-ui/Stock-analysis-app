// Market data provider. Yahoo Finance is the default (no API key, extended hours, option chains).
// To swap providers later (Polygon, Alpaca, IBKR), implement the same four functions.
import YahooFinance from "yahoo-finance2";
import { cached } from "../cache";
import { delta } from "../blackscholes";
import { classifyExpiries } from "../expirations";
import { atmStrike, buildInsight, type VolContext } from "../analytics";
import { atr, closes, rankIn, realizedVol } from "../indicators";
import { demoCandles, demoChain, demoQuote } from "../demo";
import { nyOffsetSeconds, sessionAt } from "../session";
import { toDisplay, toProvider } from "../symbols";
import type { Candle, ChainRow, OptionContract, OptionsResponse, Quote } from "../types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"], versionCheck: false });
const RAW = { validateResult: false } as const;

export const forceDemo = () => process.env.MALACHI_DEMO === "1";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapQuote(q: any): Quote {
  const session = sessionAt();
  const regular = q.regularMarketPrice ?? 0;
  const prev = q.regularMarketPreviousClose ?? regular;
  let extendedPrice: number | undefined;
  let extendedChangePercent: number | undefined;
  // Outside regular hours, show Yahoo's latest extended-hours trade: pre-market from 4:00am ET,
  // otherwise the most recent after-hours price (which also covers overnight and weekends).
  if (session === "pre" && q.preMarketPrice) {
    extendedPrice = q.preMarketPrice;
    extendedChangePercent = q.preMarketChangePercent;
  } else if (session !== "regular" && q.postMarketPrice) {
    extendedPrice = q.postMarketPrice;
    extendedChangePercent = q.postMarketChangePercent;
  }
  if (extendedPrice != null && extendedChangePercent == null && regular) {
    extendedChangePercent = ((extendedPrice - regular) / regular) * 100;
  }
  return {
    symbol: toDisplay(q.symbol),
    name: q.shortName ?? q.longName ?? q.symbol,
    price: extendedPrice ?? regular,
    change: q.regularMarketChange ?? regular - prev,
    changePercent: q.regularMarketChangePercent ?? (prev ? ((regular - prev) / prev) * 100 : 0),
    regularPrice: regular,
    previousClose: prev,
    session,
    extendedPrice,
    extendedChangePercent,
    dayHigh: q.regularMarketDayHigh,
    dayLow: q.regularMarketDayLow,
    volume: q.regularMarketVolume,
    marketCap: q.marketCap,
    updatedAt: Date.now(),
  };
}

export async function getQuotes(symbols: string[]): Promise<{ quotes: Quote[]; demo: boolean }> {
  if (forceDemo()) return { quotes: symbols.map(demoQuote), demo: true };
  try {
    const provider = symbols.map(toProvider);
    const raw = await cached(`q:${provider.join(",")}`, 3_000, () => yf.quote(provider, {}, RAW));
    const list = (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(mapQuote);
    return { quotes: list, demo: false };
  } catch (e) {
    console.warn("[quotes] live feed failed, using demo:", (e as Error).message);
    return { quotes: symbols.map(demoQuote), demo: true };
  }
}

export const TIMEFRAMES = {
  // days = history fetched (extra history warms up the indicators), view = days shown on open
  "1D": { interval: "2m", days: 4, view: 0, prePost: true, seconds: 120 },
  "5D": { interval: "15m", days: 12, view: 7, prePost: true, seconds: 900 },
  "1M": { interval: "60m", days: 50, view: 31, prePost: false, seconds: 3600 },
  "6M": { interval: "1d", days: 280, view: 183, prePost: false, seconds: 86400 },
  "1Y": { interval: "1d", days: 460, view: 366, prePost: false, seconds: 86400 },
  "5Y": { interval: "1wk", days: 1900, view: 1830, prePost: false, seconds: 604800 },
} as const;
export type Timeframe = keyof typeof TIMEFRAMES;

// Candle sizes the user can pick. Yahoo has no 10m or 4h bars, so those are built from 5m / 1h ones.
// maxDays is Yahoo's history limit per interval; minDays keeps enough bars to warm up the indicators.
export const CANDLES = {
  "1m": { interval: "1m", bucket: 0, minDays: 2, maxDays: 7 },
  "2m": { interval: "2m", bucket: 0, minDays: 4, maxDays: 59 },
  "5m": { interval: "5m", bucket: 0, minDays: 5, maxDays: 59 },
  "10m": { interval: "5m", bucket: 600, minDays: 8, maxDays: 59 },
  "15m": { interval: "15m", bucket: 0, minDays: 12, maxDays: 59 },
  "30m": { interval: "30m", bucket: 0, minDays: 20, maxDays: 59 },
  "1h": { interval: "60m", bucket: 0, minDays: 50, maxDays: 729 },
  "4h": { interval: "60m", bucket: 14_400, minDays: 180, maxDays: 729 },
  "1D": { interval: "1d", bucket: 0, minDays: 460, maxDays: 20_000 },
  "1W": { interval: "1wk", bucket: 0, minDays: 1900, maxDays: 20_000 },
} as const;
export type CandleSize = keyof typeof CANDLES;

/** Merge bars into `bucket`-second candles on the New York clock (so 4h bars split at 8am, noon, 4pm). */
function regroup(bars: Candle[], bucket: number): Candle[] {
  const out: Candle[] = [];
  let key = NaN;
  for (const b of bars) {
    const k = Math.floor((b.time + nyOffsetSeconds(b.time)) / bucket);
    const cur = out[out.length - 1];
    if (k !== key || !cur) {
      key = k;
      out.push({ ...b });
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
    }
  }
  return out;
}

const nyDate = (t: number) => new Date(t * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/** Start of the most recent session, so the 1D view opens on today while earlier days warm up the indicators. */
function lastSessionStart(candles: Candle[]): number | undefined {
  if (!candles.length) return undefined;
  const last = nyDate(candles[candles.length - 1].time);
  return candles.find((c) => nyDate(c.time) === last)?.time;
}

async function fetchCandles(symbol: string, interval: string, days: number, prePost: boolean, ttl: number): Promise<Candle[]> {
  const raw: any = await cached(`c:${symbol}:${interval}:${days}`, ttl, () =>
    yf.chart(toProvider(symbol), { period1: new Date(Date.now() - days * 86_400_000), interval: interval as any, includePrePost: prePost }, RAW),
  );
  return (raw?.quotes ?? [])
    .filter((q: any) => q.open != null && q.close != null)
    .map((q: any) => ({
      time: Math.floor(new Date(q.date).getTime() / 1000),
      open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume ?? 0,
    }));
}

/**
 * The 200-day moving average aligned to each candle by New York date, so "200 DMA" means the
 * same daily line on a 2-minute chart as on a daily one.
 */
function align200Dma(candles: Candle[], daily: Candle[]): (number | null)[] {
  const byDate = new Map<string, number>();
  let sum = 0;
  daily.forEach((d, i) => {
    sum += d.close;
    if (i >= 200) sum -= daily[i - 200].close;
    if (i >= 199) byDate.set(nyDate(d.time), sum / 200);
  });
  const dates = [...byDate.keys()].sort();
  return candles.map((c) => {
    const day = nyDate(c.time);
    if (byDate.has(day)) return byDate.get(day)!;
    // weekly bars / today's bar before the daily closes: use the latest value on or before that date
    let lo = 0, hi = dates.length - 1, hit = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (dates[mid] <= day) { hit = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return hit >= 0 ? byDate.get(dates[hit])! : null;
  });
}

export interface CandleResponse { candles: Candle[]; dma200: (number | null)[]; focusFrom?: number; demo: boolean }

function demoCandleResponse(symbol: string, tf: Timeframe): CandleResponse {
  const cfg = TIMEFRAMES[tf];
  const candles = demoCandles(symbol, cfg.seconds, 400);
  const daily = demoCandles(symbol, 86400, 600);
  return { candles, dma200: align200Dma(candles, daily), focusFrom: candles[100].time, demo: true };
}

export async function getCandles(symbol: string, tf: Timeframe, size?: CandleSize): Promise<CandleResponse> {
  const cfg = TIMEFRAMES[tf];
  if (forceDemo()) return demoCandleResponse(symbol, tf);
  try {
    const pick = size ? CANDLES[size] : null;
    const interval = pick?.interval ?? cfg.interval;
    const days = pick ? Math.min(Math.max(cfg.days, pick.minDays), pick.maxDays) : cfg.days;
    const intraday = !["1d", "1wk"].includes(interval);
    const ttl = interval === "1m" || interval === "2m" || tf === "1D" ? 10_000 : 60_000;
    const [raw, daily] = await Promise.all([
      fetchCandles(symbol, interval, days, cfg.prePost && intraday, ttl),
      fetchCandles(symbol, "1d", tf === "5Y" || size === "1W" ? 2200 : 700, false, 600_000),
    ]);
    const candles = pick?.bucket ? regroup(raw, pick.bucket) : raw;
    if (!candles.length) throw new Error("no candles");
    return {
      candles,
      dma200: align200Dma(candles, daily),
      // daily/weekly candles on a short range would show only a bar or two, so widen the view for them
      focusFrom: tf === "1D" && intraday
        ? lastSessionStart(candles)
        : Math.floor(Date.now() / 1000) - Math.max(cfg.view, interval === "1wk" ? 730 : intraday ? 0 : 120) * 86400,
      demo: false,
    };
  } catch (e) {
    console.warn("[chart] live feed failed, using demo:", (e as Error).message);
    return demoCandleResponse(symbol, tf);
  }
}

function mapContract(c: any, kind: "call" | "put", spot: number, years: number): OptionContract {
  const iv = c.impliedVolatility ?? 0;
  return {
    strike: c.strike,
    bid: c.bid ?? 0,
    ask: c.ask ?? 0,
    last: c.lastPrice ?? 0,
    volume: c.volume ?? 0,
    openInterest: c.openInterest ?? 0,
    iv,
    delta: delta(kind, spot, c.strike, years, iv),
    inTheMoney: !!c.inTheMoney,
  };
}

const STRIKES_EACH_SIDE = 12;

function trim(rows: ChainRow[], spot: number) {
  const atm = atmStrike(rows, spot);
  const i = rows.findIndex((r) => r.strike === atm);
  return rows.slice(Math.max(0, i - STRIKES_EACH_SIDE), i + STRIKES_EACH_SIDE + 1);
}

// Index products have a published volatility index, which gives a true IV rank.
const VOL_INDEX: Record<string, string> = { SPY: "^VIX", SPX: "^VIX", QQQ: "^VXN", NDX: "^VXN", IWM: "^RVX", RUT: "^RVX" }; // ^RVX is not on Yahoo today; kept in case it returns
const YEAR_BARS = 252;

/** IV rank and daily ATR. Stocks without a volatility index rank ATM IV against a year of 20-day realized vol. */
async function volContext(symbol: string, atmIv: number): Promise<VolContext> {
  try {
    const index = VOL_INDEX[symbol];
    const [daily, vix] = await Promise.all([
      fetchCandles(symbol, "1d", 700, false, 600_000),
      // a missing volatility index falls back to the realized-vol estimate below
      index ? fetchCandles(index, "1d", 400, false, 600_000).catch(() => []) : Promise.resolve([]),
    ]);
    const a = atr(daily, 14);
    const ctx: VolContext = { atr: a[a.length - 1] ?? null };
    if (vix.length > 20) {
      const year = closes(vix).slice(-YEAR_BARS);
      ctx.ivRank = rankIn(year[year.length - 1], year);
      ctx.ivRankSource = index.replace("^", "");
    } else if (atmIv > 0 && daily.length > 60) {
      const hv = realizedVol(closes(daily), 20).slice(-YEAR_BARS).filter((v): v is number => v != null);
      ctx.ivRank = rankIn(atmIv, hv);
      ctx.ivRankSource = "est.";
    }
    return ctx;
  } catch (e) {
    console.warn("[options] vol context failed:", (e as Error).message);
    return {};
  }
}

const atmIvOf = (rows: ChainRow[], spot: number) => {
  const row = rows.find((r) => r.strike === atmStrike(rows, spot));
  const ivs = [row?.call?.iv, row?.put?.iv].filter((v): v is number => !!v && v > 0);
  return ivs.length ? ivs.reduce((x, y) => x + y, 0) / ivs.length : 0;
};

export async function getOptions(symbol: string, expiryEpoch?: number): Promise<OptionsResponse> {
  const demoResponse = (): OptionsResponse => {
    const spot = demoQuote(symbol).price;
    const fridays: Date[] = [];
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    while (fridays.length < 10) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (d.getUTCDay() === 5) fridays.push(new Date(d));
    }
    const expiries = classifyExpiries(fridays);
    const selected = expiries.find((e) => e.epoch === expiryEpoch) ?? expiries[0];
    const rows = demoChain(symbol, spot, selected.daysOut);
    return { symbol, spot, expiries, selected, rows, atmStrike: atmStrike(rows, spot), insight: buildInsight(rows, spot, selected), demo: true };
  };
  if (forceDemo()) return demoResponse();

  try {
    const provider = toProvider(symbol);
    const base: any = await cached(`o:${provider}`, 60_000, () => yf.options(provider, {}, RAW));
    const expiries = classifyExpiries((base.expirationDates ?? []).map((d: any) => new Date(d)));
    if (!expiries.length) {
      return { symbol, spot: base.quote?.regularMarketPrice ?? 0, expiries, selected: null, rows: [], atmStrike: 0, insight: null };
    }
    const selected = expiries.find((e) => e.epoch === expiryEpoch) ?? expiries[0];
    const chain: any = await cached(`o:${provider}:${selected.epoch}`, 15_000, () =>
      yf.options(provider, { date: selected.epoch }, RAW),
    );
    const q = chain.quote ?? base.quote ?? {};
    const spot = mapQuote(q).price || q.regularMarketPrice || 0;
    const years = Math.max(selected.daysOut, 0.5) / 365;
    const set = chain.options?.[0] ?? { calls: [], puts: [] };
    const byStrike = new Map<number, ChainRow>();
    for (const c of set.calls ?? []) byStrike.set(c.strike, { strike: c.strike, call: mapContract(c, "call", spot, years) });
    for (const p of set.puts ?? []) {
      const row: ChainRow = byStrike.get(p.strike) ?? { strike: p.strike };
      row.put = mapContract(p, "put", spot, years);
      byStrike.set(p.strike, row);
    }
    const all = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
    const rows = trim(all, spot);
    const ctx = await volContext(symbol, atmIvOf(all, spot));
    return {
      symbol, spot, expiries, selected, rows,
      atmStrike: atmStrike(rows, spot),
      // insight uses the full chain so max pain and put/call see every strike
      insight: buildInsight(all, spot, selected, ctx),
    };
  } catch (e) {
    console.warn("[options] live feed failed, using demo:", (e as Error).message);
    return demoResponse();
  }
}

export interface ContractMark {
  symbol: string; expiry: number; strike: number; cp: "C" | "P";
  spot: number; bid: number; ask: number; last: number; mark: number; iv: number;
  expired: boolean; found: boolean; demo?: boolean;
}

/** Live mark for one contract (mid of bid/ask, else last). After expiry it settles at intrinsic value. */
export async function getContract(symbol: string, expiry: number, strike: number, cp: "C" | "P"): Promise<ContractMark> {
  const base = { symbol, expiry, strike, cp };
  const intrinsic = (spot: number) => Math.max(0, cp === "C" ? spot - strike : strike - spot);
  // options stop trading at 4pm New York on expiry day
  const expired = Date.now() / 1000 > expiry + 20 * 3600;
  try {
    const spot = (await getQuotes([symbol])).quotes[0]?.price ?? 0;
    if (expired) {
      const v = intrinsic(spot);
      return { ...base, spot, bid: v, ask: v, last: v, mark: v, iv: 0, expired, found: true };
    }
    const provider = toProvider(symbol);
    const chain: any = await cached(`o:${provider}:${expiry}`, 15_000, () => yf.options(provider, { date: expiry }, RAW));
    const set = chain.options?.[0] ?? {};
    const c = (cp === "C" ? set.calls : set.puts)?.find((x: any) => x.strike === strike);
    if (!c) return { ...base, spot, bid: 0, ask: 0, last: 0, mark: intrinsic(spot), iv: 0, expired, found: false };
    const bid = c.bid ?? 0, ask = c.ask ?? 0, last = c.lastPrice ?? 0;
    const mark = bid > 0 && ask > 0 ? (bid + ask) / 2 : last || intrinsic(spot);
    return { ...base, spot, bid, ask, last, mark, iv: c.impliedVolatility ?? 0, expired, found: true };
  } catch (e) {
    console.warn("[contract] live feed failed:", (e as Error).message);
    return { ...base, spot: 0, bid: 0, ask: 0, last: 0, mark: 0, iv: 0, expired, found: false, demo: true };
  }
}

export interface SearchHit { symbol: string; name: string; type: string; exchange: string }

const PINNED: { match: RegExp; hit: SearchHit }[] = [
  { match: /crude|oil|wti|^cl(=f)?$/i, hit: { symbol: "CRUDE", name: "Crude Oil WTI (front-month futures)", type: "FUTURE", exchange: "NYMEX" } },
  { match: /btc|bitcoin/i, hit: { symbol: "BTC-USD", name: "Bitcoin USD", type: "CRYPTOCURRENCY", exchange: "CCC" } },
];

export async function searchSymbols(query: string): Promise<SearchHit[]> {
  if (forceDemo()) return [];
  try {
    const raw: any = await cached(`s:${query.toLowerCase()}`, 300_000, () =>
      yf.search(query, { quotesCount: 10, newsCount: 0 }, RAW),
    );
    const US = new Set(["NYQ", "NMS", "NGM", "NCM", "PCX", "ASE", "BTS", "NAS", "NYS", "NIM", "SNP"]);
    const hits: SearchHit[] = (raw.quotes ?? [])
      .filter((q: any) =>
        (["EQUITY", "ETF", "INDEX"].includes(q.quoteType) && (US.has(q.exchange) || q.quoteType === "INDEX")) ||
        // futures (CL=F) and USD crypto pairs (BTC-USD)
        (q.quoteType === "FUTURE" && String(q.symbol).endsWith("=F")) ||
        (q.quoteType === "CRYPTOCURRENCY" && String(q.symbol).endsWith("-USD")),
      )
      .map((q: any) => ({
        symbol: toDisplay(q.symbol),
        name: q.shortname ?? q.longname ?? q.symbol,
        type: q.quoteType,
        exchange: q.exchDisp ?? q.exchange,
      }));
    // pin crude oil and bitcoin to the top when the query is about them
    const pins = PINNED.filter((p) => p.match.test(query)).map((p) => p.hit);
    return [...pins, ...hits.filter((h) => !pins.some((p) => p.symbol === h.symbol))].slice(0, 8);
  } catch {
    return [];
  }
}

export async function yahooNews(symbol: string): Promise<any[]> {
  const raw: any = await cached(`n:${symbol}`, 120_000, () =>
    yf.search(toProvider(symbol), { quotesCount: 0, newsCount: 15 }, RAW),
  );
  return raw.news ?? [];
}
