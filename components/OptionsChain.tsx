"use client";
import { useEffect, useRef, useState } from "react";
import { usePoll } from "@/lib/usePoll";
import { fmtCompact, fmtDate, fmtInt, fmtPrice } from "@/lib/format";
import type { OptionContract, OptionsResponse } from "@/lib/types";

export default function OptionsChain({ symbol }: { symbol: string }) {
  const [expiry, setExpiry] = useState<number | null>(null);
  useEffect(() => setExpiry(null), [symbol]);
  const { data, loading } = usePoll<OptionsResponse>(
    `/api/options?symbol=${symbol}${expiry ? `&expiry=${expiry}` : ""}`,
    20_000,
  );
  const atmRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    atmRow.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [data?.selected?.epoch, symbol]);

  if (!data) return <div className="empty">{loading ? `Loading ${symbol} options…` : "No options data."}</div>;
  if (!data.expiries.length) return <div className="empty">{symbol} has no listed weekly or monthly options.</div>;

  const ins = data.insight;
  const maxOi = Math.max(1, ...data.rows.flatMap((r) => [r.call?.openInterest ?? 0, r.put?.openInterest ?? 0]));

  return (
    <div className="chain">
      <div className="chain__expiries">
        {data.expiries.map((e) => (
          <button
            key={e.epoch}
            className={`expiry ${data.selected?.epoch === e.epoch ? "is-on" : ""}`}
            onClick={() => setExpiry(e.epoch)}
          >
            <span className={`expiry__kind expiry__kind--${e.kind}`}>{e.label}</span>
            <span className="expiry__date">{fmtDate(e.date)}</span>
            <span className="expiry__dte">{e.daysOut === 0 ? "Today" : `${e.daysOut}d`}</span>
          </button>
        ))}
        {data.demo && <span className="demo-tag demo-tag--inline">Demo data</span>}
      </div>

      {ins && (
        <div className="insight">
          <div className="insight__stats">
            <Stat label="Expected move" value={`±$${fmtPrice(ins.expectedMove)}`} sub={`±${ins.expectedMovePct.toFixed(1)}%`} gold />
            <Stat label="Range" value={`${fmtPrice(ins.rangeLow)} – ${fmtPrice(ins.rangeHigh)}`} />
            <Stat label="ATM IV" value={`${(ins.atmIv * 100).toFixed(1)}%`} />
            <Stat
              label="IV rank"
              value={ins.ivRank != null ? ins.ivRank.toFixed(0) : "—"}
              sub={ins.ivRankSource === "est." ? "est. vs 1Y realized vol" : ins.ivRankSource ? `${ins.ivRankSource}, 1Y range` : undefined}
              tone={ins.ivRank == null ? undefined : ins.ivRank >= 60 ? "down" : ins.ivRank <= 25 ? "up" : undefined}
            />
            <Stat
              label="ATR (14D)"
              value={ins.atr ? `$${fmtPrice(ins.atr)}` : "—"}
              sub={ins.atr ? `${((ins.atr / data.spot) * 100).toFixed(1)}% a day` : undefined}
            />
            <Stat label="Put / Call (OI)" value={ins.putCallOi.toFixed(2)} sub={`Vol ${ins.putCallVolume.toFixed(2)}`} />
            <Stat label="Max pain" value={`$${fmtPrice(ins.maxPain)}`} />
          </div>
          <ul className="insight__read">
            {ins.summary.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      <div className="chain__table-wrap">
        <table className="chain__table">
          <thead>
            <tr className="chain__side-head">
              <th colSpan={6} className="calls">Calls</th>
              <th className="strike-h">{fmtPrice(data.spot)}</th>
              <th colSpan={6} className="puts">Puts</th>
            </tr>
            <tr>
              <th>OI</th><th>Vol</th><th>IV</th><th>Δ</th><th>Bid</th><th>Ask</th>
              <th className="strike-h">Strike</th>
              <th>Bid</th><th>Ask</th><th>Δ</th><th>IV</th><th>Vol</th><th>OI</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const atm = r.strike === data.atmStrike;
              return (
                <tr key={r.strike} ref={atm ? atmRow : undefined} className={atm ? "is-atm" : ""}>
                  <Side c={r.call} maxOi={maxOi} kind="call" />
                  <td className={`strike ${atm ? "strike--atm" : ""}`}>{fmtPrice(r.strike, r.strike % 1 ? 2 : 0)}</td>
                  <Side c={r.put} maxOi={maxOi} kind="put" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, gold, tone }: { label: string; value: string; sub?: string; gold?: boolean; tone?: "up" | "down" }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value num ${gold ? "gold" : ""} ${tone ?? ""}`}>{value}</span>
      {sub && <span className="stat__sub num">{sub}</span>}
    </div>
  );
}

function Side({ c, maxOi, kind }: { c?: OptionContract; maxOi: number; kind: "call" | "put" }) {
  if (!c) return <>{Array.from({ length: 6 }, (_, i) => <td key={i} className="muted">—</td>)}</>;
  const itm = c.inTheMoney ? "itm" : "";
  const oi = (
    <td key="oi" className={`oi ${itm}`}>
      <i className={`oi__bar oi__bar--${kind}`} style={{ width: `${(c.openInterest / maxOi) * 100}%` }} />
      <span>{fmtCompact(c.openInterest)}</span>
    </td>
  );
  const rest = [
    <td key="v" className={itm}>{fmtInt(c.volume)}</td>,
    <td key="iv" className={itm}>{c.iv ? `${(c.iv * 100).toFixed(1)}%` : "—"}</td>,
    <td key="d" className={itm}>{c.delta.toFixed(2)}</td>,
    <td key="b" className={`bid ${itm}`}>{fmtPrice(c.bid)}</td>,
    <td key="a" className={`ask ${itm}`}>{fmtPrice(c.ask)}</td>,
  ];
  // calls read outward-in (OI ... Ask | Strike), puts mirror it (Strike | Bid ... OI)
  return <>{kind === "call" ? [oi, ...rest] : [rest[3], rest[4], rest[2], rest[1], rest[0], oi]}</>;
}
