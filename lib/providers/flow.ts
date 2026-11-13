// Option flow.
//  - With UNUSUAL_WHALES_API_KEY: the real tape (sweeps, blocks, splits) from Unusual Whales flow alerts.
//  - Without a key: an estimate built from chain snapshots. Every refresh compares each contract's
//    volume with the last snapshot; the difference is shown as a print, and where its last price sat
//    against the bid/ask tells us whether it was likely bought or sold. Snapshot flow cannot tell a
//    sweep from a block, so those rows are typed "Print" or "Day total".
import YahooFinance from "yahoo-finance2";
import { cached } from "../cache";
import { classifyExpiries } from "../expirations";
import { toProvider } from "../symbols";
import { demoChain, demoQuote } from "../demo";
import type { FlowPrint, FlowResponse } from "../types";
import { forceDemo } from "./market";

/* eslint-disable @typescript-eslint/no-explicit-any */
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"], versionCheck: false });
const RAW = { validateResult: false } as const;
const MIN_PREMIUM = 25_000; // ignore prints smaller than this; flow is about size

function sideOf(price: number, bid: number, ask: number): Pick<FlowPrint, "side" | "bs"> {
  if (!(bid > 0) || !(ask > 0)) return { side: "Mid", bs: "—" };
  if (price > ask) return { side: "Above", bs: "BUY" };
  if (price >= ask - (ask - bid) * 0.15) return { side: "Ask", bs: "BUY" };
  if (price < bid) return { side: "Below", bs: "SELL" };
  if (price <= bid + (ask - bid) * 0.15) return { side: "Bid", bs: "SELL" };
  return { side: "Mid", bs: "—" };
}

function totals(prints: FlowPrint[]) {
  let callPremium = 0;
  let putPremium = 0;
  for (const p of prints) {
    // money buying calls or selling puts reads bullish, and vice versa
    const bullish = (p.cp === "Call" && p.bs !== "SELL") || (p.cp === "Put" && p.bs === "SELL");
    if (bullish) callPremium += p.premium;
    else putPremium += p.premium;
  }
  return { callPremium, putPremium };
}

/* ---------- Unusual Whales ---------- */
async function fromUnusualWhales(symbol: string): Promise<FlowPrint[] | null> {
  const key = process.env.UNUSUAL_WHALES_API_KEY;
  if (!key) return null;
  return cached(`uw:${symbol}`, 10_000, async () => {
    const res = await fetch(
      `https://api.unusualwhales.com/api/option-trades/flow-alerts?ticker_symbol=${encodeURIComponent(symbol)}&limit=100`,
      { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`Unusual Whales ${res.status}`);
    const body: any = await res.json();
    return (body.data ?? []).map((a: any, i: number): FlowPrint => {
      const price = Number(a.price ?? 0);
      const bid = Number(a.bid ?? 0);
      const ask = Number(a.ask ?? 0);
      const askPrem = Number(a.total_ask_side_prem ?? 0);
      const bidPrem = Number(a.total_bid_side_prem ?? 0);
      const s = askPrem || bidPrem
        ? askPrem >= bidPrem ? { side: "Ask" as const, bs: "BUY" as const } : { side: "Bid" as const, bs: "SELL" as const }
        : sideOf(price, bid, ask);
      const conds: string[] = [];
      if (a.alert_rule) conds.push(String(a.alert_rule).replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase());
      if (Number(a.volume) > Number(a.open_interest)) conds.push("OPENING");
      return {
        id: a.id ?? `uw-${i}`,
        time: Date.parse(a.created_at ?? a.start_time) || Date.now(),
        symbol,
        expiry: String(a.expiry ?? "").slice(0, 10),
        strike: Number(a.strike),
        cp: String(a.type).toLowerCase().startsWith("c") ? "Call" : "Put",
        ...s,
        spot: Number(a.underlying_price ?? 0),
        size: Number(a.total_size ?? a.size ?? 0),
        price,
        premium: Number(a.total_premium ?? 0),
        type: a.has_sweep ? "Sweep" : a.has_floor ? "Floor" : a.has_multileg ? "Multi-leg" : "Block",
        volume: Number(a.volume ?? 0),
        openInterest: Number(a.open_interest ?? 0),
        conds,
      };
    });
  });
}

/* ---------- Snapshot estimate ---------- */
type Snap = { volume: number };
const state = new Map<string, { snaps: Map<string, Snap>; prints: FlowPrint[]; primed: boolean }>();

async function snapshotChains(symbol: string) {
  const provider = toProvider(symbol);
  const base: any = await cached(`o:${provider}`, 60_000, () => yf.options(provider, {}, RAW));
  const expiries = classifyExpiries((base.expirationDates ?? []).map((d: any) => new Date(d)));
  const chains = await Promise.all(
    expiries.map((e) => cached(`o:${provider}:${e.epoch}`, 15_000, () => yf.options(provider, { date: e.epoch }, RAW))),
  );
  return chains.map((c: any, i) => ({ expiry: expiries[i].date, quote: c.quote ?? base.quote, set: c.options?.[0] ?? {} }));
}

function demoChains(symbol: string) {
  const spot = demoQuote(symbol).price;
  const jitter = Math.floor(Date.now() / 15_000);
  return [5, 12, 26].map((days) => {
    const d = new Date(Date.now() + days * 86_400_000);
    const rows = demoChain(symbol, spot, days);
    const contracts = (kind: "call" | "put") =>
      rows.map((r) => {
        const c = r[kind]!;
        const bump = ((jitter * 7919 + r.strike * 13) % 9) === 0 ? 300 + ((jitter * r.strike) % 900) : 0;
        return { strike: r.strike, bid: c.bid, ask: c.ask, lastPrice: ((jitter + r.strike) % 3 === 0 ? c.ask : c.bid),
          volume: c.volume + bump * (jitter % 50), openInterest: c.openInterest };
      });
    return { expiry: d.toISOString().slice(0, 10), quote: { regularMarketPrice: spot }, set: { calls: contracts("call"), puts: contracts("put") } };
  });
}

async function fromSnapshots(symbol: string, demo: boolean): Promise<FlowPrint[]> {
  const chains = demo ? demoChains(symbol) : await snapshotChains(symbol);
  const stateKey = demo ? `demo:${symbol}` : symbol;
  const st = state.get(stateKey) ?? { snaps: new Map(), prints: [], primed: false };
  state.set(stateKey, st);
  const now = Date.now();
  const fresh: FlowPrint[] = [];

  for (const { expiry, quote, set } of chains) {
    const spot = quote?.postMarketPrice || quote?.preMarketPrice || quote?.regularMarketPrice || 0;
    for (const [kind, list] of [["Call", set.calls ?? []], ["Put", set.puts ?? []]] as const) {
      for (const c of list as any[]) {
        const key = `${expiry}|${kind}|${c.strike}`;
        const volume = c.volume ?? 0;
        const oi = c.openInterest ?? 0;
        const prev = st.snaps.get(key);
        st.snaps.set(key, { volume });
        const price = c.lastPrice ?? 0;
        // first look: one "day total" row per contract with meaningful activity
        const size = st.primed ? volume - (prev?.volume ?? volume) : volume;
        const premium = size * price * 100;
        if (size <= 0 || premium < MIN_PREMIUM) continue;
        const conds: string[] = [];
        if (volume > oi) conds.push("UNUSUAL", "OPENING");
        else if (volume > oi * 0.5 && volume > 500) conds.push("UNUSUAL");
        if ((kind === "Call" && c.strike > spot) || (kind === "Put" && c.strike < spot)) conds.push("OTM");
        fresh.push({
          id: `${key}|${now}`,
          time: st.primed ? now : c.lastTradeDate ? new Date(c.lastTradeDate).getTime() : now,
          symbol,
          expiry,
          strike: c.strike,
          cp: kind,
          ...sideOf(price, c.bid ?? 0, c.ask ?? 0),
          spot,
          size,
          price,
          premium,
          type: st.primed ? "Print" : "Day total",
          volume,
          openInterest: oi,
          conds,
        });
      }
    }
  }
  st.primed = true;
  st.prints = [...fresh, ...st.prints].sort((a, b) => b.time - a.time).slice(0, 300);
  return st.prints;
}

export async function getFlow(symbol: string): Promise<FlowResponse> {
  if (!forceDemo()) {
    try {
      const uw = await fromUnusualWhales(symbol);
      if (uw) return { symbol, source: "Unusual Whales", prints: uw, ...totals(uw) };
    } catch (e) {
      console.warn("[flow]", (e as Error).message);
    }
    try {
      const prints = await fromSnapshots(symbol, false);
      return { symbol, source: "Snapshot estimate", prints, ...totals(prints) };
    } catch (e) {
      console.warn("[flow] live chains failed, using demo:", (e as Error).message);
    }
  }
  const prints = await fromSnapshots(symbol, true);
  return { symbol, source: "Demo", prints, ...totals(prints), demo: true };
}
