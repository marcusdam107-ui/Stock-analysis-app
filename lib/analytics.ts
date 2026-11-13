import type { ChainRow, Expiry, OptionsInsight } from "./types";

const mid = (bid: number, ask: number, last: number) => (bid > 0 && ask > 0 ? (bid + ask) / 2 : last);
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function atmStrike(rows: ChainRow[], spot: number): number {
  let best = rows[0]?.strike ?? spot;
  for (const r of rows) if (Math.abs(r.strike - spot) < Math.abs(best - spot)) best = r.strike;
  return best;
}

/** Strike where option holders collectively lose the most (writers' "pain" is lowest). */
export function maxPain(rows: ChainRow[]): number {
  let best = rows[0]?.strike ?? 0;
  let bestPain = Infinity;
  for (const settle of rows) {
    let pain = 0;
    for (const r of rows) {
      pain += (r.call?.openInterest ?? 0) * Math.max(0, settle.strike - r.strike);
      pain += (r.put?.openInterest ?? 0) * Math.max(0, r.strike - settle.strike);
    }
    if (pain < bestPain) {
      bestPain = pain;
      best = settle.strike;
    }
  }
  return best;
}

export interface VolContext {
  ivRank?: number | null;
  ivRankSource?: string;
  atr?: number | null;
}

export function buildInsight(rows: ChainRow[], spot: number, expiry: Expiry, ctx: VolContext = {}): OptionsInsight | null {
  if (!rows.length || !(spot > 0)) return null;
  const atm = atmStrike(rows, spot);
  const row = rows.find((r) => r.strike === atm)!;
  const callMid = row.call ? mid(row.call.bid, row.call.ask, row.call.last) : 0;
  const putMid = row.put ? mid(row.put.bid, row.put.ask, row.put.last) : 0;
  const ivs = [row.call?.iv, row.put?.iv].filter((v): v is number => !!v && v > 0);
  const atmIv = ivs.length ? ivs.reduce((a, b) => a + b, 0) / ivs.length : 0;

  // ATM straddle is the market's priced-in move; fall back to IV if quotes are empty
  let move = callMid + putMid;
  if (!(move > 0) && atmIv > 0) move = spot * atmIv * Math.sqrt(Math.max(expiry.daysOut, 1) / 365);

  const sum = (f: (r: ChainRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const callOi = sum((r) => r.call?.openInterest ?? 0);
  const putOi = sum((r) => r.put?.openInterest ?? 0);
  const callVol = sum((r) => r.call?.volume ?? 0);
  const putVol = sum((r) => r.put?.volume ?? 0);
  const putCallOi = callOi ? putOi / callOi : 0;
  const putCallVolume = callVol ? putVol / callVol : 0;
  const pain = maxPain(rows);

  const when = new Date(expiry.date + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
  const pct = (move / spot) * 100;
  const summary: string[] = [
    `Options are pricing a move of about ±${money(move)} (${pct.toFixed(1)}%) by ${when}, a range of ${money(spot - move)} to ${money(spot + move)}.`,
  ];
  if (putCallOi > 1.2) summary.push(`Positioning leans defensive: ${putCallOi.toFixed(2)} puts open for every call.`);
  else if (putCallOi > 0 && putCallOi < 0.7) summary.push(`Positioning leans bullish: only ${putCallOi.toFixed(2)} puts open for every call.`);
  else if (putCallOi > 0) summary.push(`Positioning is balanced at ${putCallOi.toFixed(2)} puts per call.`);
  const painGap = ((pain - spot) / spot) * 100;
  summary.push(
    Math.abs(painGap) < 0.5
      ? `Max pain sits right at the money (${money(pain)}), which tends to pin price into expiry.`
      : `Max pain is ${money(pain)}, ${Math.abs(painGap).toFixed(1)}% ${painGap > 0 ? "above" : "below"} the current price.`,
  );
  const ivRank = ctx.ivRank ?? null;
  if (ivRank != null) {
    const r = ivRank.toFixed(0);
    summary.push(
      ivRank >= 60 ? `IV rank is high at ${r}: options are expensive versus the past year, which favours selling premium or spreads.`
      : ivRank <= 25 ? `IV rank is low at ${r}: options are cheap versus the past year, which favours buying calls or puts.`
      : `IV rank is ${r}, mid-range for the past year.`,
    );
  } else if (atmIv > 0) {
    summary.push(
      atmIv > 0.45 ? `Implied volatility is rich at ${(atmIv * 100).toFixed(0)}%: premium is expensive, sellers are paid well.`
      : atmIv < 0.15 ? `Implied volatility is low at ${(atmIv * 100).toFixed(0)}%: premium is cheap, favouring buyers.`
      : `Implied volatility is ${(atmIv * 100).toFixed(0)}%, within a normal range.`,
    );
  }

  const atrVal = ctx.atr ?? null;
  if (atrVal && atrVal > 0) {
    const days = Math.max(expiry.daysOut, 1) * (5 / 7);
    const typical = atrVal * Math.sqrt(days);
    const ratio = move / typical;
    summary.push(
      `Daily ATR is ${money(atrVal)}; a typical ${Math.max(1, Math.round(days))}-day swing is about ${money(typical)}, so the priced-in move looks ${
        ratio > 1.2 ? "generous (options rich)" : ratio < 0.8 ? "tight (options cheap)" : "fair"
      }.`,
    );
  }

  return {
    expectedMove: move,
    expectedMovePct: pct,
    rangeLow: spot - move,
    rangeHigh: spot + move,
    atmIv,
    putCallOi,
    putCallVolume,
    maxPain: pain,
    ivRank,
    ivRankSource: ctx.ivRankSource ?? "",
    atr: atrVal,
    summary,
  };
}
