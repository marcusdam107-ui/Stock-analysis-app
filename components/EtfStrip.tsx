"use client";
import { CORE_ETFS, CORE_NAMES } from "@/lib/symbols";
import { fmtPct, fmtPrice, fmtSigned, tone } from "@/lib/format";
import { SESSION_LABEL } from "@/lib/session";
import type { Quote } from "@/lib/types";

export default function EtfStrip({ quotes, active, onPick }: { quotes: Record<string, Quote>; active: string; onPick: (s: string) => void }) {
  return (
    <div className="etf-strip">
      {CORE_ETFS.map((s) => {
        const q = quotes[s];
        const range = q?.dayHigh && q?.dayLow ? q.dayHigh - q.dayLow : 0;
        const pos = range ? ((q!.regularPrice - q!.dayLow!) / range) * 100 : 50;
        return (
          <button key={s} className={`etf card ${active === s ? "is-active" : ""}`} onClick={() => onPick(s)}>
            <div className="etf__top">
              <span className="etf__sym">{s}</span>
              <span className="etf__name">{CORE_NAMES[s]}</span>
            </div>
            <div className="etf__px num">{q ? fmtPrice(q.price) : "—"}</div>
            <div className={`etf__chg num ${tone(q?.change)}`}>
              {q ? `${fmtSigned(q.change)}  ${fmtPct(q.changePercent)}` : " "}
            </div>
            {q?.extendedPrice != null && (
              <div className="etf__ext num">
                {SESSION_LABEL[q.session]} <span className={tone(q.extendedChangePercent)}>{fmtPct(q.extendedChangePercent)}</span>
                <span className="muted"> · close {fmtPrice(q.regularPrice)}</span>
              </div>
            )}
            <div className="etf__range" title="Today's range">
              <span className="num">{fmtPrice(q?.dayLow)}</span>
              <div className="etf__bar"><i style={{ left: `${Math.min(100, Math.max(0, pos))}%` }} /></div>
              <span className="num">{fmtPrice(q?.dayHigh)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
