"use client";
import { useMemo, useState } from "react";
import { usePoll } from "@/lib/usePoll";
import { fmtCompact, fmtInt, fmtPrice, fmtTimeNY } from "@/lib/format";
import type { FlowResponse } from "@/lib/types";

const FILTERS = ["All", "Calls", "Puts", "Unusual", "$100K+"] as const;

export default function OptionFlow({ symbol }: { symbol: string }) {
  const { data, loading } = usePoll<FlowResponse>(`/api/flow?symbol=${symbol}`, 15_000);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows = useMemo(() => {
    const all = data?.prints ?? [];
    switch (filter) {
      case "Calls": return all.filter((p) => p.cp === "Call");
      case "Puts": return all.filter((p) => p.cp === "Put");
      case "Unusual": return all.filter((p) => p.conds.includes("UNUSUAL"));
      case "$100K+": return all.filter((p) => p.premium >= 100_000);
      default: return all;
    }
  }, [data, filter]);

  if (!data) return <div className="empty">{loading ? `Loading ${symbol} flow…` : "No flow data."}</div>;

  const total = data.callPremium + data.putPremium || 1;
  const bullPct = (data.callPremium / total) * 100;

  return (
    <div className="flow">
      <div className="flow__top">
        <div className="flow__sentiment">
          <div className="flow__labels">
            <span className="up">Bullish {fmtCompact(data.callPremium, "$")}</span>
            <span className="down">Bearish {fmtCompact(data.putPremium, "$")}</span>
          </div>
          <div className="flow__meter"><i style={{ width: `${bullPct}%` }} /></div>
        </div>
        <div className="seg seg--small">
          {FILTERS.map((f) => (
            <button key={f} className={f === filter ? "is-on" : ""} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>
      <p className="flow__source">
        Source: <b>{data.source}</b>
        {data.source !== "Unusual Whales" &&
          " · estimated from chain volume changes every 15s. Add an Unusual Whales key for true sweeps and blocks."}
      </p>
      <div className="flow__table-wrap">
        <table className="flow__table">
          <thead>
            <tr>
              <th>Time</th><th>Tick</th><th>Expiry</th><th>Strike</th><th>C/P</th><th>Side</th><th>B/S</th>
              <th>Spot</th><th>Size</th><th>Price</th><th>Prem</th><th>Type</th><th>Vol</th><th>OI</th><th>Conds</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={15} className="empty">No prints yet. New activity appears here as it trades.</td></tr>
            )}
            {rows.map((p) => {
              const tone = p.cp === "Call" ? "up" : "down";
              const big = p.premium >= 1_000_000;
              return (
                <tr key={p.id} className={big ? "is-big" : ""}>
                  <td className="muted num">{fmtTimeNY(p.time)}</td>
                  <td className={tone}>{p.symbol}</td>
                  <td className="num">{p.expiry.slice(5).replace("-", "/")}/{p.expiry.slice(2, 4)}</td>
                  <td className="num">{fmtPrice(p.strike, p.strike % 1 ? 2 : 0)}</td>
                  <td className={tone}>{p.cp}</td>
                  <td className={p.bs === "BUY" ? "up" : p.bs === "SELL" ? "down" : "muted"}>{p.side}</td>
                  <td>{p.bs}</td>
                  <td className="num">{fmtPrice(p.spot)}</td>
                  <td className={`num ${p.size >= 1000 ? "accent" : ""}`}>{fmtInt(p.size)}</td>
                  <td className="num">${fmtPrice(p.price)}</td>
                  <td className={`num ${tone} ${big ? "strong" : ""}`}>{fmtCompact(p.premium, "$")}</td>
                  <td className="gold">{p.type}</td>
                  <td className="num">{fmtInt(p.volume)}</td>
                  <td className="num">{fmtInt(p.openInterest)}</td>
                  <td>{p.conds.map((c) => <span key={c} className="cond">{c}</span>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
