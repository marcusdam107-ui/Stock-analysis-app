// Company analysis for the ticker page: fundamentals and earnings (Yahoo Finance), technical ratings (TradingView).
import YahooFinance from "yahoo-finance2";
import { cached } from "../cache";
import { closes, ema, rsi, sma } from "../indicators";
import { toProvider } from "../symbols";
import { getCandles } from "./market";
import type { Candle } from "../types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"], versionCheck: false });
const RAW = { validateResult: false } as const;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any): number | null => (typeof v === "number" && isFinite(v) ? v : typeof v?.raw === "number" ? v.raw : null);

export interface Quarter {
  label: string;            // e.g. "Q3 FY2026"
  periodEnd: string;        // YYYY-MM-DD
  reported: number | null;  // epoch ms
  timing: "BMO" | "AMC" | null;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
  revenue: number | null;
  netIncome: number | null;
  grossMargin: number | null;
  reaction: number | null;  // % move of the stock on the first session after the report
}

export interface Analysis {
  symbol: string;
  name: string;
  profile: { sector: string; industry: string; employees: number | null; website: string; summary: string; country: string };
  stats: Record<string, number | null>;
  analyst: {
    key: string; mean: number | null; count: number | null;
    target: { low: number | null; mean: number | null; high: number | null };
    trend: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
    recent: { date: number; firm: string; to: string; from: string; action: string; target: number | null }[];
  };
  quarters: Quarter[];
  next: { date: number | null; epsAvg: number | null; revAvg: number | null; estimate: boolean };
  peers: string[];
  error?: string;
}

const QUARTER_TTL = 30 * 60_000;

function reactionAround(daily: Candle[], reported: number, timing: "BMO" | "AMC" | null): number | null {
  if (!daily.length) return null;
  const day = new Date(reported).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const idx = daily.findIndex((c) => new Date(c.time * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) >= day);
  if (idx < 1) return null;
  const sameDay = new Date(daily[idx].time * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === day;
  // after the close: the next session reacts; before the open: the report day itself reacts
  const react = timing === "AMC" && sameDay ? idx + 1 : idx;
  if (react >= daily.length) return null;
  const before = daily[react - 1].close;
  return before ? ((daily[react].close - before) / before) * 100 : null;
}

export async function getAnalysis(symbol: string): Promise<Analysis> {
  const provider = toProvider(symbol);
  return cached(`an:${provider}`, QUARTER_TTL, async () => {
    const [s, fts, peers, chart]: any[] = await Promise.all([
      yf.quoteSummary(provider, {
        modules: ["price", "financialData", "defaultKeyStatistics", "summaryDetail", "recommendationTrend", "earnings",
          "earningsHistory", "calendarEvents", "assetProfile", "upgradeDowngradeHistory"],
      }, RAW).catch(() => ({})),
      yf.fundamentalsTimeSeries(provider, {
        period1: new Date(Date.now() - 500 * 86_400_000), type: "quarterly", module: "financials",
      }, RAW).catch(() => []),
      yf.recommendationsBySymbol(provider, {}, RAW).catch(() => null),
      getCandles(symbol, "1Y", "1D").catch(() => null),
    ]);
    const fd = s.financialData ?? {};
    const ks = s.defaultKeyStatistics ?? {};
    const sd = s.summaryDetail ?? {};
    const ap = s.assetProfile ?? {};
    const pr = s.price ?? {};
    const daily: Candle[] = chart && !chart.demo ? chart.candles : [];

    const stats: Record<string, number | null> = {
      marketCap: num(pr.marketCap) ?? num(sd.marketCap),
      enterpriseValue: num(ks.enterpriseValue),
      trailingPE: num(sd.trailingPE),
      forwardPE: num(sd.forwardPE) ?? num(ks.forwardPE),
      pegRatio: num(ks.pegRatio) ?? num(ks.trailingPegRatio),
      priceToSales: num(sd.priceToSalesTrailing12Months),
      priceToBook: num(ks.priceToBook),
      evToEbitda: num(ks.enterpriseToEbitda),
      revenue: num(fd.totalRevenue),
      revenueGrowth: num(fd.revenueGrowth),
      earningsGrowth: num(fd.earningsGrowth),
      grossMargin: num(fd.grossMargins),
      operatingMargin: num(fd.operatingMargins),
      profitMargin: num(fd.profitMargins),
      roe: num(fd.returnOnEquity),
      roa: num(fd.returnOnAssets),
      freeCashflow: num(fd.freeCashflow),
      operatingCashflow: num(fd.operatingCashflow),
      totalCash: num(fd.totalCash),
      totalDebt: num(fd.totalDebt),
      debtToEquity: num(fd.debtToEquity),
      currentRatio: num(fd.currentRatio),
      eps: num(ks.trailingEps),
      forwardEps: num(ks.forwardEps),
      dividendYield: num(sd.dividendYield),
      beta: num(sd.beta) ?? num(ks.beta),
      shortFloat: num(ks.shortPercentOfFloat),
      insiders: num(ks.heldPercentInsiders),
      institutions: num(ks.heldPercentInstitutions),
      high52: num(sd.fiftyTwoWeekHigh),
      low52: num(sd.fiftyTwoWeekLow),
    };

    // quarterly statements, keyed by period end
    const byEnd = new Map<string, any>();
    for (const q of Array.isArray(fts) ? fts : []) byEnd.set(new Date(q.date).toISOString().slice(0, 10), q);
    const closest = (end: string) => {
      // fiscal period ends from the two feeds can differ by a few days
      const t = new Date(end).getTime();
      let best: any = null, gap = 12 * 86_400_000;
      for (const [k, v] of byEnd) {
        const g = Math.abs(new Date(k).getTime() - t);
        if (g < gap) { gap = g; best = v; }
      }
      return best;
    };

    const chartQ: any[] = s.earnings?.earningsChart?.quarterly ?? [];
    const hist: any[] = s.earningsHistory?.history ?? [];
    const quarters: Quarter[] = (chartQ.length ? chartQ : hist).slice(-4).map((q: any) => {
      const end = new Date(q.periodEndDate ?? q.quarter).toISOString().slice(0, 10);
      const h = hist.find((x) => new Date(x.quarter).toISOString().slice(0, 10) === end);
      const reported = q.reportedDate ? new Date(q.reportedDate).getTime() : null;
      const nyHour = reported ? Number(new Date(reported).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" })) : null;
      const timing = nyHour == null ? null : nyHour >= 16 ? "AMC" : nyHour < 10 ? "BMO" : null;
      const f = closest(end);
      const rev = num(f?.totalRevenue);
      const gross = num(f?.grossProfit);
      const actual = num(q.actual) ?? num(h?.epsActual);
      const est = num(q.estimate) ?? num(h?.epsEstimate);
      return {
        label: q.fiscalQuarter ? `Q${q.fiscalQuarter[0]} FY${q.fiscalQuarter.slice(2)}` : q.date ?? end,
        periodEnd: end,
        reported,
        timing,
        epsActual: actual,
        epsEstimate: est,
        surprisePct: actual != null && est ? ((actual - est) / Math.abs(est)) * 100 : num(h?.surprisePercent) != null ? num(h?.surprisePercent)! * 100 : null,
        revenue: rev,
        netIncome: num(f?.netIncome) ?? num(f?.netIncomeCommonStockholders),
        grossMargin: rev && gross != null ? gross / rev : null,
        reaction: reported ? reactionAround(daily, reported, timing) : null,
      };
    });

    const cal = s.calendarEvents?.earnings ?? {};
    const rt = s.recommendationTrend?.trend?.[0];
    const ud: any[] = s.upgradeDowngradeHistory?.history ?? [];
    return {
      symbol,
      name: pr.longName ?? pr.shortName ?? symbol,
      profile: {
        sector: ap.sectorDisp ?? ap.sector ?? "", industry: ap.industryDisp ?? ap.industry ?? "",
        employees: num(ap.fullTimeEmployees), website: ap.website ?? "", summary: ap.longBusinessSummary ?? "", country: ap.country ?? "",
      },
      stats,
      analyst: {
        key: fd.recommendationKey ?? "", mean: num(fd.recommendationMean), count: num(fd.numberOfAnalystOpinions),
        target: { low: num(fd.targetLowPrice), mean: num(fd.targetMeanPrice), high: num(fd.targetHighPrice) },
        trend: rt ? { strongBuy: rt.strongBuy, buy: rt.buy, hold: rt.hold, sell: rt.sell, strongSell: rt.strongSell } : null,
        recent: ud.slice(0, 8).map((u) => ({
          date: new Date(u.epochGradeDate).getTime(), firm: u.firm, to: u.toGrade, from: u.fromGrade, action: u.action, target: num(u.currentPriceTarget),
        })),
      },
      quarters,
      next: {
        date: cal.earningsDate?.[0] ? new Date(cal.earningsDate[0]).getTime() : null,
        epsAvg: num(cal.earningsAverage), revAvg: num(cal.revenueAverage), estimate: !!cal.isEarningsDateEstimate,
      },
      peers: (peers?.recommendedSymbols ?? []).map((p: any) => String(p.symbol)).filter((p: string) => p !== provider).slice(0, 6),
      ...(Object.keys(s).length ? {} : { error: "Yahoo returned no fundamentals for this symbol." }),
    };
  });
}

/* ---------------- technicals ---------------- */

export const TECH_TFS = { "5m": "|5", "15m": "|15", "1h": "|60", "4h": "|240", "1D": "", "1W": "|1W", "1M": "|1M" } as const;
export type TechTf = keyof typeof TECH_TFS;

export type Action = "Buy" | "Sell" | "Neutral";
export interface TechRow { name: string; value: number | null; action: Action }
export interface Technicals {
  symbol: string;
  tvSymbol: string | null;
  tf: TechTf;
  source: "TradingView" | "Computed";
  summary: number | null;   // -1 (strong sell) .. +1 (strong buy)
  ma: number | null;
  osc: number | null;
  byTf: Partial<Record<TechTf, number | null>>;
  oscillators: TechRow[];
  movingAverages: TechRow[];
}

async function tvScan(body: object): Promise<any> {
  const res = await fetch("https://scanner.tradingview.com/america/scan", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TradingView ${res.status}`);
  return res.json();
}

/** "NVDA" -> "NASDAQ:NVDA", preferring the primary listing. */
async function tvSymbol(symbol: string): Promise<string | null> {
  return cached(`tvsym:${symbol}`, 24 * 3600_000, async () => {
    const r = await tvScan({
      filter: [{ left: "name", operation: "equal", right: symbol.replace(".", "-") }],
      columns: ["is_primary"], range: [0, 10],
    });
    const rows: any[] = r.data ?? [];
    return (rows.find((x) => x.d?.[0]) ?? rows[0])?.s ?? null;
  });
}

const MA_LENGTHS = [10, 20, 30, 50, 100, 200];
const OSC = [
  "RSI", "RSI[1]", "Stoch.K", "Stoch.D", "Stoch.K[1]", "Stoch.D[1]", "CCI20", "CCI20[1]", "ADX", "ADX+DI", "ADX-DI", "ADX+DI[1]", "ADX-DI[1]",
  "AO", "AO[1]", "AO[2]", "Mom", "Mom[1]", "MACD.macd", "MACD.signal", "Rec.Stoch.RSI", "Stoch.RSI.K", "Rec.WR", "W.R", "Rec.BBPower", "BBPower", "Rec.UO", "UO",
];
const MAS = [...MA_LENGTHS.flatMap((n) => [`EMA${n}`, `SMA${n}`]), "Ichimoku.BLine", "Rec.Ichimoku", "VWMA", "Rec.VWMA", "HullMA9", "Rec.HullMA9", "close"];

const rec = (v: number | null | undefined): Action => (v == null ? "Neutral" : v > 0 ? "Buy" : v < 0 ? "Sell" : "Neutral");

async function fromTradingView(symbol: string, tv: string, tf: TechTf): Promise<Technicals> {
  const sfx = TECH_TFS[tf];
  const tfCols = (Object.keys(TECH_TFS) as TechTf[]).map((t) => `Recommend.All${TECH_TFS[t]}`);
  const cols = [`Recommend.All${sfx}`, `Recommend.MA${sfx}`, `Recommend.Other${sfx}`, ...tfCols, ...OSC.map((c) => c + sfx), ...MAS.map((c) => c + sfx)];
  const r = await cached(`tv:${tv}:${tf}`, 60_000, () => tvScan({ symbols: { tickers: [tv] }, columns: cols }));
  const d: any[] = r.data?.[0]?.d;
  if (!d) throw new Error("TradingView returned no data");
  const v: Record<string, number | null> = {};
  cols.forEach((c, i) => (v[c] = typeof d[i] === "number" ? d[i] : null));
  const g = (c: string) => v[c + sfx] ?? null;

  // the same buy/sell rules TradingView documents for its Technical Ratings
  const rsiV = g("RSI"), rsiP = g("RSI[1]");
  const k = g("Stoch.K"), dd = g("Stoch.D"), kp = g("Stoch.K[1]"), dp = g("Stoch.D[1]");
  const cci = g("CCI20"), ccip = g("CCI20[1]");
  const adx = g("ADX"), pdi = g("ADX+DI"), mdi = g("ADX-DI"), pdip = g("ADX+DI[1]"), mdip = g("ADX-DI[1]");
  const ao = g("AO"), ao1 = g("AO[1]"), ao2 = g("AO[2]");
  const mom = g("Mom"), momp = g("Mom[1]");
  const macd = g("MACD.macd"), sig = g("MACD.signal");
  const has = (...xs: (number | null)[]) => xs.every((x) => x != null);
  const oscillators: TechRow[] = [
    { name: "RSI (14)", value: rsiV, action: has(rsiV, rsiP) ? (rsiV! < 30 && rsiP! < rsiV! ? "Buy" : rsiV! > 70 && rsiP! > rsiV! ? "Sell" : "Neutral") : "Neutral" },
    { name: "Stochastic %K (14, 3, 3)", value: k, action: has(k, dd, kp, dp) ? (k! < 20 && dd! < 20 && k! > dd! && kp! < dp! ? "Buy" : k! > 80 && dd! > 80 && k! < dd! && kp! > dp! ? "Sell" : "Neutral") : "Neutral" },
    { name: "CCI (20)", value: cci, action: has(cci, ccip) ? (cci! < -100 && cci! > ccip! ? "Buy" : cci! > 100 && cci! < ccip! ? "Sell" : "Neutral") : "Neutral" },
    { name: "ADX (14)", value: adx, action: has(adx, pdi, mdi, pdip, mdip) ? (adx! > 20 && pdip! < mdip! && pdi! > mdi! ? "Buy" : adx! > 20 && pdip! > mdip! && pdi! < mdi! ? "Sell" : "Neutral") : "Neutral" },
    { name: "Awesome Oscillator", value: ao, action: has(ao, ao1, ao2) ? ((ao! > 0 && ao1! < 0) || (ao! > 0 && ao1! > 0 && ao! > ao1! && ao2! > ao1!) ? "Buy" : (ao! < 0 && ao1! > 0) || (ao! < 0 && ao1! < 0 && ao! < ao1! && ao2! < ao1!) ? "Sell" : "Neutral") : "Neutral" },
    { name: "Momentum (10)", value: mom, action: has(mom, momp) ? (mom! > momp! ? "Buy" : mom! < momp! ? "Sell" : "Neutral") : "Neutral" },
    { name: "MACD (12, 26)", value: macd, action: has(macd, sig) ? (macd! > sig! ? "Buy" : macd! < sig! ? "Sell" : "Neutral") : "Neutral" },
    { name: "Stochastic RSI Fast", value: g("Stoch.RSI.K"), action: rec(g("Rec.Stoch.RSI")) },
    { name: "Williams %R (14)", value: g("W.R"), action: rec(g("Rec.WR")) },
    { name: "Bull Bear Power", value: g("BBPower"), action: rec(g("Rec.BBPower")) },
    { name: "Ultimate Oscillator", value: g("UO"), action: rec(g("Rec.UO")) },
  ];
  const close = g("close");
  const vsPrice = (x: number | null): Action => (x == null || close == null ? "Neutral" : close > x ? "Buy" : close < x ? "Sell" : "Neutral");
  const movingAverages: TechRow[] = [
    ...MA_LENGTHS.flatMap((n) => [
      { name: `EMA (${n})`, value: g(`EMA${n}`), action: vsPrice(g(`EMA${n}`)) },
      { name: `SMA (${n})`, value: g(`SMA${n}`), action: vsPrice(g(`SMA${n}`)) },
    ]),
    { name: "Ichimoku Base Line", value: g("Ichimoku.BLine"), action: rec(g("Rec.Ichimoku")) },
    { name: "VWMA (20)", value: g("VWMA"), action: rec(g("Rec.VWMA")) },
    { name: "Hull MA (9)", value: g("HullMA9"), action: rec(g("Rec.HullMA9")) },
  ];
  const byTf: Partial<Record<TechTf, number | null>> = {};
  (Object.keys(TECH_TFS) as TechTf[]).forEach((t) => (byTf[t] = v[`Recommend.All${TECH_TFS[t]}`]));
  return {
    symbol, tvSymbol: tv, tf, source: "TradingView",
    summary: v[`Recommend.All${sfx}`], ma: v[`Recommend.MA${sfx}`], osc: v[`Recommend.Other${sfx}`],
    byTf, oscillators, movingAverages,
  };
}

/* fallback for symbols TradingView's stock scanner doesn't cover (e.g. NDX): a simplified rating from our own candles */
const FALLBACK_CANDLE: Partial<Record<TechTf, ["1M" | "1Y" | "5Y", "5m" | "15m" | "1h" | "4h" | "1D" | "1W"]>> = {
  "5m": ["1M", "5m"], "15m": ["1M", "15m"], "1h": ["1M", "1h"], "4h": ["1Y", "4h"], "1D": ["1Y", "1D"], "1W": ["5Y", "1W"],
};

async function computed(symbol: string, tf: TechTf): Promise<Technicals> {
  const pick = FALLBACK_CANDLE[tf] ?? FALLBACK_CANDLE["1D"]!;
  const { candles, demo } = await getCandles(symbol, pick[0], pick[1]);
  if (demo || candles.length < 30) throw new Error("not enough price history");
  const cl = closes(candles);
  const last = (s: (number | null)[]) => s[s.length - 1] ?? null;
  const prev = (s: (number | null)[]) => s[s.length - 2] ?? null;
  const close = cl[cl.length - 1];
  const r = rsi(cl, 14);
  const e12 = ema(cl, 12), e26 = ema(cl, 26);
  const macdLine = cl.map((_, i) => (e12[i] != null && e26[i] != null ? e12[i]! - e26[i]! : 0));
  const signal = ema(macdLine, 9);
  const mom = cl.map((c, i) => (i >= 10 ? c - cl[i - 10] : 0));
  const hi = candles.slice(-14).reduce((a, c) => Math.max(a, c.high), -Infinity);
  const lo = candles.slice(-14).reduce((a, c) => Math.min(a, c.low), Infinity);
  const stochK = hi > lo ? ((close - lo) / (hi - lo)) * 100 : 50;
  const rv = last(r), rp = prev(r);
  const oscillators: TechRow[] = [
    { name: "RSI (14)", value: rv, action: rv != null && rp != null ? (rv < 30 && rv > rp ? "Buy" : rv > 70 && rv < rp ? "Sell" : "Neutral") : "Neutral" },
    { name: "Stochastic %K (14)", value: stochK, action: stochK < 20 ? "Buy" : stochK > 80 ? "Sell" : "Neutral" },
    { name: "Momentum (10)", value: last(mom), action: last(mom)! > prev(mom)! ? "Buy" : "Sell" },
    { name: "MACD (12, 26)", value: last(macdLine), action: last(macdLine)! > (last(signal) ?? 0) ? "Buy" : "Sell" },
  ];
  const movingAverages: TechRow[] = MA_LENGTHS.flatMap((n) => {
    const e = last(ema(cl, n)), s = last(sma(cl, n));
    const act = (x: number | null): Action => (x == null ? "Neutral" : close > x ? "Buy" : "Sell");
    return [{ name: `EMA (${n})`, value: e, action: act(e) }, { name: `SMA (${n})`, value: s, action: act(s) }];
  });
  const score = (rows: TechRow[]) => {
    const used = rows.filter((x) => x.value != null);
    return used.length ? used.reduce((a, x) => a + (x.action === "Buy" ? 1 : x.action === "Sell" ? -1 : 0), 0) / used.length : null;
  };
  const ma = score(movingAverages), osc = score(oscillators);
  const summary = ma != null && osc != null ? (ma + osc) / 2 : ma ?? osc;
  return { symbol, tvSymbol: null, tf, source: "Computed", summary, ma, osc, byTf: { [tf]: summary }, oscillators, movingAverages };
}

export async function getTechnicals(symbol: string, tf: TechTf): Promise<Technicals> {
  const tv = await tvSymbol(symbol).catch(() => null);
  if (tv) {
    try {
      return await fromTradingView(symbol, tv, tf);
    } catch (e) {
      console.warn("[technicals] TradingView failed, computing locally:", (e as Error).message);
    }
  }
  return computed(symbol, tf);
}
