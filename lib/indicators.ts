// Pure indicator math. Inputs are closes (or candles); outputs are aligned arrays with null during warm-up.
import { nyOffsetSeconds } from "./session";
import type { Candle } from "./types";

export type Series = (number | null)[];

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seedSum = 0;
  values.forEach((v, i) => {
    if (prev === null) {
      seedSum += v;
      if (i === period - 1) prev = seedSum / period;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out[i] = prev;
  });
  return out;
}

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  values.forEach((v, i) => {
    sum += v;
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  });
  return out;
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: Series = [];
  const lower: Series = [];
  values.forEach((_, i) => {
    const m = mid[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
      return;
    }
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - m) ** 2;
    const sd = Math.sqrt(sq / period);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  });
  return { mid, upper, lower };
}

/** Wilder's RSI. */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        gain /= period;
        loss /= period;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

/** Session VWAP: resets at the start of each New York trading day (pre-market included when present). */
export function vwap(candles: Candle[]): Series {
  const out: Series = [];
  let day = -1;
  let pv = 0;
  let vol = 0;
  for (const c of candles) {
    const d = Math.floor((c.time + nyOffsetSeconds(c.time)) / 86400);
    if (d !== day) {
      day = d;
      pv = 0;
      vol = 0;
    }
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
    out.push(vol > 0 ? pv / vol : typical);
  }
  return out;
}

/** Wilder's Average True Range. */
export function atr(candles: Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null);
  let prev: number | null = null;
  let seed = 0;
  candles.forEach((c, i) => {
    const pc = i > 0 ? candles[i - 1].close : c.close;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
    if (i < period) {
      seed += tr;
      if (i === period - 1) prev = seed / period;
    } else {
      prev = (prev! * (period - 1) + tr) / period;
    }
    out[i] = prev;
  });
  return out;
}

/** Annualised close-to-close volatility over a rolling window (0.25 = 25%). */
export function realizedVol(values: number[], window = 20): Series {
  const out: Series = new Array(values.length).fill(null);
  const rets = values.map((v, i) => (i > 0 && values[i - 1] > 0 ? Math.log(v / values[i - 1]) : 0));
  for (let i = window; i < values.length; i++) {
    const slice = rets.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (window - 1);
    out[i] = Math.sqrt(variance * 252);
  }
  return out;
}

/** Where `current` sits between the low (0) and high (100) of `history`. */
export function rankIn(current: number, history: number[]): number | null {
  if (!history.length || !(current > 0)) return null;
  const lo = Math.min(...history);
  const hi = Math.max(...history);
  if (hi <= lo) return null;
  return Math.min(100, Math.max(0, ((current - lo) / (hi - lo)) * 100));
}

/** Ripster EMA Clouds: the fast/slow EMA pairs traders use for trend (5/12 short-term, 34/50 trend). */
export const RIPSTER_CLOUDS = [
  { id: "ripster-5-12", fast: 5, slow: 12, label: "EMA Cloud 5/12" },
  { id: "ripster-34-50", fast: 34, slow: 50, label: "EMA Cloud 34/50" },
] as const;

export function closes(candles: Candle[]) {
  return candles.map((c) => c.close);
}
