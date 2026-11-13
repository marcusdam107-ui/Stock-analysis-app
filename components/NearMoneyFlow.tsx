"use client";
import { useMemo, useState } from "react";
import { usePoll } from "@/lib/usePoll";
import { fmtCompact, fmtInt, fmtPrice, fmtTimeNY } from "@/lib/format";
import type { FlowResponse } from "@/lib/types";

// How far a strike may sit from spot and still count as "near the money".
const BANDS = [
  { label: "±2%", pct: 2 },
  { label: "±5%", pct: 5 },
  { label: "±10%", pct: 10 },
] as const;

/** Compact option flow for the ticker page: only prints with strikes close to the current price. */
export default function NearMoneyFlow({ symbol, spot }: { symbol: string; spot?: number }) {
  const { data, loading } = usePoll<FlowResponse>(`/api/flow?symbol=${symbol}`, 15_000);
  const [band, setBand] = useState<number>(5);

  const { rows, callPrem, putPrem } = useMemo(() => {
    const all = data?.prints ?? [];
    const rows = all.filter((p) => {
      const ref = spot ?? p.spot;
      return ref > 0 && (Math.abs(p.strike - ref) / ref) * 100 <= band;
    });
    let callPrem = 0;
    let putPrem = 0;
    for (const p of rows) p.cp === "Call" ? (callPrem += p.premium) : (putPrem += p.premium);
    return { rows, callPrem, putPrem };
  }, [data, band, spot]);

  const bullPct = (callPrem / (callPrem + putPrem || 1)) * 100;

  return (
    <div className="nflow">
      <div className="nflow__head">
        <div>
          <span className="eyebrow">Near the money</span>
          <h3>Option flow</h3>
        </div>
        <div className="seg seg--small">
          {BANDS.map((b) => (
            <button key={b.pct} className={b.pct === band ? "is-on" : ""} onClick={() => setBand(b.pct)}>{b.label}</button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="empty">{loading ? `Loading ${symbol} flow…` : "No flow data."}</div>
      ) : (
        <>
          <div className="nflow__sentiment">
            <div className="flow__labels">
              <span className="up">Calls {fmtCompact(callPrem, "$")}</span>
              <span className="down">Puts {fmtCompact(putPrem, "$")}</span>
            </div>
            <div className="flow__meter"><i style={{ width: `${bullPct}%` }} /></div>
          </div>
          <div className="nflow__table-wrap">
            <table className="flow__table nflow__table">
              <thead>
                <tr><th>Time</th><th>Exp</th><th>Strike</th><th>C/P</th><th>B/S</th><th>Size</th><th>Prem</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="empty">No prints within {band}% of spot yet.</td></tr>
                )}
                {rows.map((p) => {
                  const tone = p.cp === "Call" ? "up" : "down";
                  const big = p.premium >= 1_000_000;
                  return (
                    <tr key={p.id} className={big ? "is-big" : ""} title={`${p.type} · ${p.side} · ${p.conds.join(" ")}`}>
                      <td className="muted num">{fmtTimeNY(p.time)}</td>
                      <td className="num">{p.expiry.slice(5).replace("-", "/")}</td>
                      <td className="num">{fmtPrice(p.strike, p.strike % 1 ? 1 : 0)}</td>
                      <td className={tone}>{p.cp === "Call" ? "C" : "P"}</td>
                      <td className={p.bs === "BUY" ? "up" : p.bs === "SELL" ? "down" : "muted"}>{p.bs}</td>
                      <td className={`num ${p.size >= 1000 ? "accent" : ""}`}>{fmtInt(p.size)}</td>
                      <td className={`num ${tone} ${big ? "strong" : ""}`}>{fmtCompact(p.premium, "$")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="flow__source">
            Source: <b>{data.source}</b>
            {data.source !== "Unusual Whales" && " · estimated from chain volume changes"}
          </p>
        </>
      )}
    </div>
  );
}
