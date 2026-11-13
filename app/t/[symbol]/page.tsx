"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import ChartPanel from "@/components/ChartPanel";
import NewsList from "@/components/NewsList";
import NearMoneyFlow from "@/components/NearMoneyFlow";
import { INDICATORS, type IndicatorId } from "@/components/PriceChart";
import { fmtCompact, fmtPct, fmtPrice, fmtSigned, tone } from "@/lib/format";
import { SESSION_LABEL } from "@/lib/session";
import { normalize } from "@/lib/symbols";
import { usePoll } from "@/lib/usePoll";
import type { OptionsResponse, Quote } from "@/lib/types";

const DEFAULT_INDICATORS: IndicatorId[] = ["ripster-5-12", "ripster-34-50", "dma200", "vwap", "volume"];

/** Ticker page: big chart on the left, news and near-the-money flow on the right. */
export default function TickerPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = normalize(decodeURIComponent(params.symbol ?? "")) || "SPY";
  const router = useRouter();
  const go = (s: string) => router.push(`/t/${encodeURIComponent(s)}`);

  // Shares the dashboard's indicator choice.
  const [indicators, setIndicators] = useState<IndicatorId[]>(DEFAULT_INDICATORS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mw.indicators");
      if (raw) setIndicators(JSON.parse(raw));
    } catch {}
  }, []);
  const toggle = (id: IndicatorId) => {
    const next = indicators.includes(id) ? indicators.filter((i) => i !== id) : [...indicators, id];
    setIndicators(next);
    try {
      localStorage.setItem("mw.indicators", JSON.stringify(next));
    } catch {}
  };

  const { data: quoteData } = usePoll<{ quotes: Quote[]; demo: boolean }>(`/api/quote?symbols=${symbol}`, 5_000);
  const quote = useMemo(() => quoteData?.quotes.find((q) => q.symbol === symbol), [quoteData, symbol]);
  const { data: opt } = usePoll<OptionsResponse>(`/api/options?symbol=${symbol}`, 60_000);
  const ins = opt?.insight;

  useEffect(() => {
    document.title = `${symbol} · Malachi Wealth`;
  }, [symbol]);

  return (
    <div className="app app--wide">
      <Header onSearch={go} />
      {quoteData?.demo && (
        <div className="banner">
          Showing demo prices: the live market feed could not be reached. Check your internet connection; nothing else is needed.
        </div>
      )}

      <div className="toolbar">
        <div className="chips">
          <Link href="/" className="btn-ghost">← Dashboard</Link>
          <span className="toolbar__label">Indicators</span>
          {INDICATORS.map((i) => (
            <button key={i.id} className={`chip ${indicators.includes(i.id) ? "is-on" : ""}`} onClick={() => toggle(i.id)}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ticker">
        <div className="ticker__chart">
          <ChartPanel
            label={quote?.name ?? "Chart"} symbol={symbol} quote={quote} indicators={indicators} onSymbol={go}
            actions={
              <>
                <Link href={`/t/${encodeURIComponent(symbol)}/analysis`} className="desk-link">Analysis</Link>
                <Link href={`/t/${encodeURIComponent(symbol)}/simulator`} className="desk-link">Trading Simulator</Link>
              </>
            }
          />
        </div>

        <aside className="ticker__side">
          <section className="card ticker__news">
            <header className="ticker__box-head">
              <span className="eyebrow">Latest</span>
              <h3>{symbol} News</h3>
            </header>
            <div className="ticker__scroll">
              <NewsList symbol={symbol} />
            </div>
          </section>

          <section className="card ticker__flow">
            <div className="qbox">
              <div className="qbox__sym">
                <h2>{symbol}</h2>
                {quote && <span className="qbox__name">{quote.name}</span>}
              </div>
              <div className="qbox__px">
                <span className="num qbox__big">{fmtPrice(quote?.price)}</span>
                <span className={`num ${tone(quote?.change)}`}>
                  {fmtSigned(quote?.change)} ({fmtPct(quote?.changePercent)})
                </span>
              </div>
              {ins && (
                <div className="qbox__vol">
                  <span>
                    IV rank{" "}
                    <b className={ins.ivRank == null ? "" : ins.ivRank >= 60 ? "down" : ins.ivRank <= 25 ? "up" : ""}>
                      {ins.ivRank != null ? ins.ivRank.toFixed(0) : "—"}
                    </b>
                    {ins.ivRankSource && <small> {ins.ivRankSource === "est." ? "est." : ins.ivRankSource}</small>}
                  </span>
                  <span>ATM IV <b>{(ins.atmIv * 100).toFixed(1)}%</b></span>
                  <span>ATR <b>{ins.atr ? `$${fmtPrice(ins.atr)}` : "—"}</b></span>
                  <span>Exp. move <b className="gold">±{fmtPrice(ins.expectedMove)}</b></span>
                </div>
              )}
              {quote && (
                <div className="qbox__meta">
                  <span>{SESSION_LABEL[quote.session]}</span>
                  {quote.volume != null && <span>Vol {fmtCompact(quote.volume)}</span>}
                  {quote.dayLow != null && quote.dayHigh != null && (
                    <span className="num">Range {fmtPrice(quote.dayLow)} – {fmtPrice(quote.dayHigh)}</span>
                  )}
                </div>
              )}
            </div>
            <NearMoneyFlow symbol={symbol} spot={quote?.price} />
          </section>
        </aside>
      </div>


      <footer className="foot">
        Malachi Wealth · for personal research, not investment advice · quotes may be delayed by the data source
      </footer>
    </div>
  );
}
