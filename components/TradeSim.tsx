"use client";
import { useEffect, useMemo, useState } from "react";
import { usePoll } from "@/lib/usePoll";
import { fmtDate, fmtPct, fmtPrice, fmtSigned, fmtTimeNY, tone } from "@/lib/format";
import type { OptionsResponse } from "@/lib/types";
import Verdict from "./Verdict";

// Paper trading only: positions live in this browser (localStorage), nothing is sent to a broker.

type Cp = "C" | "P";
type Side = "BUY" | "SELL";
type Fill = "mid" | "market"; // market = buy at the ask / sell at the bid

interface Position {
  id: string;
  symbol: string;
  expiry: number;          // epoch seconds (00:00 UTC on expiry day)
  expiryDate: string;      // YYYY-MM-DD
  strike: number;
  cp: Cp;
  side: Side;
  qty: number;
  entry: number;           // per-share option price
  fill: Fill;
  openedAt: number;
}

interface Closed extends Position { exit: number; closedAt: number; pnl: number }

interface Mark { spot: number; bid: number; ask: number; last: number; mark: number; iv: number; expired: boolean; found: boolean }

const KEY = "mw.sim";
const MULT = 100;

const label = (p: { symbol: string; expiryDate: string; strike: number; cp: Cp }) =>
  `${p.symbol} ${p.expiryDate.slice(5).replace("-", "/")} ${fmtPrice(p.strike, p.strike % 1 ? 1 : 0)}${p.cp}`;

const pnlOf = (p: Position, exit: number) => (exit - p.entry) * MULT * p.qty * (p.side === "BUY" ? 1 : -1);

/** Price you would actually get: mid, or the far side of the spread for a market order. */
function fillPrice(m: { bid: number; ask: number; mark: number }, side: Side, fill: Fill) {
  if (fill === "mid" || !(m.bid > 0 && m.ask > 0)) return m.mark;
  return side === "BUY" ? m.ask : m.bid;
}

function useSimStore() {
  const [state, setState] = useState<{ open: Position[]; closed: Closed[] }>({ open: [], closed: [] });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
  }, []);
  const save = (next: { open: Position[]; closed: Closed[] }) => {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };
  return [state, save] as const;
}

export default function TradeSim({ symbol }: { symbol: string }) {
  const [store, save] = useSimStore();
  const [expiry, setExpiry] = useState<number | null>(null);
  const [cp, setCp] = useState<Cp>("C");
  const [side, setSide] = useState<Side>("BUY");
  const [strike, setStrike] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [fill, setFill] = useState<Fill>("mid");
  const [verdict, setVerdict] = useState<Closed | null>(null);

  useEffect(() => {
    setExpiry(null);
    setStrike(null);
  }, [symbol]);

  const { data } = usePoll<OptionsResponse>(`/api/options?symbol=${symbol}${expiry ? `&expiry=${expiry}` : ""}`, 10_000);
  const selected = data?.selected ?? null;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const activeStrike = strike != null && rows.some((r) => r.strike === strike) ? strike : data?.atmStrike ?? null;
  const contract = rows.find((r) => r.strike === activeStrike)?.[cp === "C" ? "call" : "put"];
  const mark = contract ? (contract.bid > 0 && contract.ask > 0 ? (contract.bid + contract.ask) / 2 : contract.last) : 0;
  const price = contract ? fillPrice({ bid: contract.bid, ask: contract.ask, mark }, side, fill) : 0;
  const cost = price * MULT * qty;

  const place = () => {
    if (!selected || activeStrike == null || !(price > 0) || qty < 1) return;
    const p: Position = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbol, expiry: selected.epoch, expiryDate: selected.date, strike: activeStrike, cp, side, qty, entry: price, fill,
      openedAt: Date.now(),
    };
    save({ ...store, open: [p, ...store.open] });
  };

  const close = (p: Position, m: Mark) => {
    const exit = m.expired ? m.mark : fillPrice(m, p.side === "BUY" ? "SELL" : "BUY", p.fill);
    const done: Closed = { ...p, exit, closedAt: Date.now(), pnl: pnlOf(p, exit) };
    save({ open: store.open.filter((x) => x.id !== p.id), closed: [done, ...store.closed].slice(0, 100) });
    setVerdict(done);
  };

  const realized = store.closed.reduce((a, c) => a + c.pnl, 0);
  const wins = store.closed.filter((c) => c.pnl > 0).length;

  return (
    <section className="card sim">
      <header className="sim__head">
        <div>
          <span className="eyebrow">Paper trading · no real money</span>
          <h3>Option trade simulator</h3>
        </div>
        <div className="sim__score">
          <span>Realized <b className={`num ${tone(realized)}`}>{fmtSigned(realized)}</b></span>
          <span>Win rate <b className="num">{store.closed.length ? `${Math.round((wins / store.closed.length) * 100)}%` : "—"}</b></span>
          <span>Trades <b className="num">{store.closed.length}</b></span>
        </div>
      </header>

      <div className="sim__ticket">
        <div className="sim__field sim__field--wide">
          <span className="sim__label">Expiry</span>
          <div className="sim__expiries">
            {(data?.expiries ?? []).map((e) => (
              <button key={e.epoch} className={`expiry ${selected?.epoch === e.epoch ? "is-on" : ""}`} onClick={() => setExpiry(e.epoch)}>
                <span className={`expiry__kind expiry__kind--${e.kind}`}>{e.label}</span>
                <span className="expiry__date">{fmtDate(e.date)}</span>
                <span className="expiry__dte">{e.daysOut === 0 ? "Today" : `${e.daysOut}d`}</span>
              </button>
            ))}
            {!data && <span className="muted">Loading expiries…</span>}
          </div>
        </div>

        <div className="sim__field">
          <span className="sim__label">Side</span>
          <div className="seg">
            <button className={side === "BUY" ? "is-on sim__buy" : ""} onClick={() => setSide("BUY")}>Buy</button>
            <button className={side === "SELL" ? "is-on sim__sell" : ""} onClick={() => setSide("SELL")}>Sell</button>
          </div>
        </div>

        <div className="sim__field">
          <span className="sim__label">Type</span>
          <div className="seg">
            <button className={cp === "C" ? "is-on" : ""} onClick={() => setCp("C")}>Call</button>
            <button className={cp === "P" ? "is-on" : ""} onClick={() => setCp("P")}>Put</button>
          </div>
        </div>

        <label className="sim__field">
          <span className="sim__label">Strike</span>
          <select className="sim__input" value={activeStrike ?? ""} onChange={(e) => setStrike(Number(e.target.value))}>
            {rows.map((r) => (
              <option key={r.strike} value={r.strike}>
                {fmtPrice(r.strike, r.strike % 1 ? 1 : 0)}{r.strike === data?.atmStrike ? "  (ATM)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="sim__field">
          <span className="sim__label">Contracts</span>
          <input
            className="sim__input num" type="number" min={1} max={500} value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(500, Math.floor(Number(e.target.value) || 1))))}
          />
        </label>

        <div className="sim__field">
          <span className="sim__label">Fill at</span>
          <div className="seg">
            <button className={fill === "mid" ? "is-on" : ""} onClick={() => setFill("mid")} title="Fill at the midpoint of bid and ask">Mid</button>
            <button className={fill === "market" ? "is-on" : ""} onClick={() => setFill("market")} title="Buy at the ask, sell at the bid">Market</button>
          </div>
        </div>

        <div className="sim__quote">
          {contract ? (
            <>
              <span className="sim__contract">{label({ symbol, expiryDate: selected?.date ?? "", strike: activeStrike ?? 0, cp })}</span>
              <span className="num">Bid <b className="down">{fmtPrice(contract.bid)}</b></span>
              <span className="num">Ask <b className="up">{fmtPrice(contract.ask)}</b></span>
              <span className="num">IV <b>{contract.iv ? `${(contract.iv * 100).toFixed(1)}%` : "—"}</b></span>
              <span className="num">Δ <b>{contract.delta.toFixed(2)}</b></span>
              <span className="num sim__cost">
                {side === "BUY" ? "Cost" : "Credit"} <b className="gold">${fmtPrice(cost)}</b>
                <small> ({qty} × ${fmtPrice(price)} × 100)</small>
              </span>
            </>
          ) : (
            <span className="muted">{data ? "No quote for this contract." : "Loading chain…"}</span>
          )}
          <button className={`sim__go ${side === "BUY" ? "sim__go--buy" : "sim__go--sell"}`} disabled={!(price > 0)} onClick={place}>
            {side === "BUY" ? "Buy to open" : "Sell to open"}
          </button>
        </div>
      </div>

      <div className="sim__section">
        <h4>Open positions</h4>
        <div className="sim__table-wrap">
          <table className="flow__table sim__table">
            <thead>
              <tr>
                <th>Contract</th><th>Side</th><th>Qty</th><th>Entry</th><th>Bid / Ask</th><th>Live</th>
                <th>Value</th><th>P&amp;L</th><th>Spot</th><th>Opened</th><th />
              </tr>
            </thead>
            <tbody>
              {store.open.length === 0 && (
                <tr><td colSpan={11} className="empty">No open positions. Pick a contract above and place a trade.</td></tr>
              )}
              {store.open.map((p) => <PositionRow key={p.id} p={p} onClose={close} />)}
            </tbody>
          </table>
        </div>
      </div>

      {store.closed.length > 0 && (
        <div className="sim__section">
          <div className="sim__section-head">
            <h4>Closed trades</h4>
            <button className="btn-ghost" onClick={() => save({ ...store, closed: [] })}>Clear history</button>
          </div>
          <div className="sim__table-wrap sim__table-wrap--short">
            <table className="flow__table sim__table">
              <thead>
                <tr><th>Contract</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th>Closed</th></tr>
              </thead>
              <tbody>
                {store.closed.map((c) => (
                  <tr key={c.id}>
                    <td>{label(c)}</td>
                    <td className={c.side === "BUY" ? "up" : "down"}>{c.side}</td>
                    <td className="num">{c.qty}</td>
                    <td className="num">${fmtPrice(c.entry)}</td>
                    <td className="num">${fmtPrice(c.exit)}</td>
                    <td className={`num strong ${tone(c.pnl)}`}>{fmtSigned(c.pnl)}</td>
                    <td className="muted num">{fmtTimeNY(c.closedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {verdict && <Verdict trade={verdict} onDone={() => setVerdict(null)} />}
    </section>
  );
}

function PositionRow({ p, onClose }: { p: Position; onClose: (p: Position, m: Mark) => void }) {
  const { data: m } = usePoll<Mark>(`/api/contract?symbol=${p.symbol}&expiry=${p.expiry}&strike=${p.strike}&cp=${p.cp}`, 5_000);
  const live = m?.mark ?? null;
  const exit = m ? (m.expired ? m.mark : fillPrice(m, p.side === "BUY" ? "SELL" : "BUY", p.fill)) : null;
  const pnl = exit != null ? pnlOf(p, exit) : null;
  const pct = pnl != null ? (pnl / (p.entry * MULT * p.qty)) * 100 : null;

  return (
    <tr>
      <td>
        {label(p)}
        {m?.expired && <span className="cond">EXPIRED</span>}
      </td>
      <td className={p.side === "BUY" ? "up" : "down"}>{p.side}</td>
      <td className="num">{p.qty}</td>
      <td className="num">${fmtPrice(p.entry)}</td>
      <td className="num muted">{m ? `${fmtPrice(m.bid)} / ${fmtPrice(m.ask)}` : "…"}</td>
      <td className="num strong">{live != null ? `$${fmtPrice(live)}` : "…"}</td>
      <td className="num">{live != null ? `$${fmtPrice(live * MULT * p.qty)}` : "…"}</td>
      <td className={`num strong ${tone(pnl)}`}>
        {pnl != null ? `${fmtSigned(pnl)} (${fmtPct(pct)})` : "…"}
      </td>
      <td className="num muted">{m?.spot ? fmtPrice(m.spot) : "…"}</td>
      <td className="num muted">{fmtTimeNY(p.openedAt)}</td>
      <td>
        <button className="sim__close" disabled={!m || !(m.mark >= 0)} onClick={() => m && onClose(p, m)}>Close</button>
      </td>
    </tr>
  );
}
