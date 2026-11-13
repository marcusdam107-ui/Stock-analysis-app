"use client";
import { useMemo, useState, type ReactNode } from "react";
import PriceChart, { type IndicatorId } from "./PriceChart";
import SymbolSearch from "./SymbolSearch";
import { usePoll } from "@/lib/usePoll";
import { fmtPct, fmtPrice, fmtSigned, tone } from "@/lib/format";
import { SESSION_LABEL } from "@/lib/session";
import type { Candle, Quote } from "@/lib/types";

const TFS = ["1D", "5D", "1M", "6M", "1Y", "5Y"] as const;
type Tf = (typeof TFS)[number];

// "Auto" keeps each range's default candle; the server builds 10m and 4h bars from smaller ones.
const CANDLES = ["Auto", "1m", "2m", "5m", "10m", "15m", "30m", "1h", "4h", "1D", "1W"] as const;
type CandleSize = (typeof CANDLES)[number];

interface ChartData { candles: Candle[]; dma200: (number | null)[]; focusFrom?: number; demo: boolean }

export default function ChartPanel({ symbol, quote, indicators, onSymbol, onClose, label, actions, line = false }: {
  symbol: string;
  quote?: Quote;
  indicators: IndicatorId[];
  onSymbol: (s: string) => void;
  onClose?: () => void;
  label: string;
  actions?: ReactNode; // optional buttons pinned to the header's top-right corner
  line?: boolean; // plain line chart for an overview: no candle-size picker
}) {
  const [tf, setTf] = useState<Tf>("1D");
  const [candle, setCandle] = useState<CandleSize>("Auto");
  const intraday = candle === "Auto" ? tf === "1D" || tf === "5D" || tf === "1M" : candle !== "1D" && candle !== "1W";
  const fast = candle === "1m" || candle === "2m";
  const { data, loading } = usePoll<ChartData>(
    `/api/chart?symbol=${symbol}&tf=${tf}${candle === "Auto" ? "" : `&candle=${candle}`}`,
    fast ? 10_000 : intraday ? 20_000 : 120_000,
  );
  const candles = useMemo(() => data?.candles ?? [], [data]);
  const dma = useMemo(() => data?.dma200 ?? [], [data]);

  return (
    <section className="card chart-panel">
      <header className="chart-panel__head">
        {actions && <div className="chart-panel__actions">{actions}</div>}
        <div className="chart-panel__title">
          <span className="eyebrow">{label}</span>
          <div className="chart-panel__sym">
            <h2>{symbol}</h2>
            {quote && (
              <div className="chart-panel__px">
                <span className="num big">{fmtPrice(quote.price)}</span>
                <span className={`num ${tone(quote.change)}`}>{fmtSigned(quote.change)} ({fmtPct(quote.changePercent)})</span>
                {quote.extendedPrice != null && (
                  <span className="pill pill--muted">
                    {SESSION_LABEL[quote.session]} {fmtPct(quote.extendedChangePercent)}
                  </span>
                )}
              </div>
            )}
          </div>
          {quote && <span className="chart-panel__name">{quote.name}</span>}
        </div>
        <div className="chart-panel__tools">
          <SymbolSearch onPick={onSymbol} placeholder="Change symbol" compact />
          {!line && <label className="candle-pick" title="Candle size">
            <span>Candles</span>
            <select value={candle} onChange={(e) => setCandle(e.target.value as CandleSize)}>
              {CANDLES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>}
          <div className="seg">
            {TFS.map((t) => (
              <button key={t} className={t === tf ? "is-on" : ""} onClick={() => setTf(t)}>{t}</button>
            ))}
          </div>
          {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close chart">×</button>}
        </div>
      </header>
      <div className="chart-panel__body">
        {loading && !candles.length && <div className="chart-panel__loading">Loading {symbol}…</div>}
        {data?.demo && <span className="demo-tag">Demo data</span>}
        <PriceChart
          candles={candles}
          dma200={dma}
          focusFrom={data?.focusFrom}
          indicators={indicators}
          // 1D/5D include pre-market and after-hours bars; longer charts are regular-session only
          livePrice={quote?.symbol === symbol ? (tf === "1D" || tf === "5D" ? quote.price : quote.regularPrice) : undefined}
          viewKey={`${symbol}:${tf}:${candle}:${candles.length > 0}`}
          intraday={intraday}
          line={line}
        />
      </div>
    </section>
  );
}
