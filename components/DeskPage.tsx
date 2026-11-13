"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Header from "./Header";
import Analysis from "./Analysis";
import TradeSim from "./TradeSim";
import { fmtPct, fmtPrice, fmtSigned, tone } from "@/lib/format";
import { normalize } from "@/lib/symbols";
import { usePoll } from "@/lib/usePoll";
import type { Quote } from "@/lib/types";

type Mode = "analysis" | "simulator";
const TITLES: Record<Mode, string> = { analysis: "Analysis", simulator: "Trading Simulator" };

/** Full-window page for a ticker's Analysis or Trading Simulator, sized so the page itself never scrolls. */
export default function DeskPage({ mode }: { mode: Mode }) {
  const params = useParams<{ symbol: string }>();
  const symbol = normalize(decodeURIComponent(params.symbol ?? "")) || "SPY";
  const router = useRouter();
  const base = `/t/${encodeURIComponent(symbol)}`;

  const { data: quoteData } = usePoll<{ quotes: Quote[]; demo: boolean }>(`/api/quote?symbols=${symbol}`, 5_000);
  const quote = useMemo(() => quoteData?.quotes.find((q) => q.symbol === symbol), [quoteData, symbol]);

  useEffect(() => {
    document.title = `${symbol} ${TITLES[mode]} · Malachi Wealth`;
  }, [symbol, mode]);

  return (
    <div className="app app--wide app--fit">
      <Header onSearch={(s) => router.push(`/t/${encodeURIComponent(s)}/${mode}`)} />
      <div className="toolbar dp__bar">
        <div className="chips">
          <Link href={base} className="btn-ghost">← {symbol} chart</Link>
          <span className="dp__sym">{symbol}</span>
          {quote && (
            <span className="dp__px num">
              {fmtPrice(quote.price)} <span className={tone(quote.change)}>{fmtSigned(quote.change)} ({fmtPct(quote.changePercent)})</span>
            </span>
          )}
        </div>
        <nav className="dp__switch">
          {(Object.keys(TITLES) as Mode[]).map((m) => (
            <Link key={m} href={`${base}/${m}`} className={`desk-link ${m === mode ? "is-on" : ""}`}>{TITLES[m]}</Link>
          ))}
        </nav>
      </div>
      <section className={`card dp dp--${mode}`}>
        {mode === "analysis" ? <Analysis symbol={symbol} price={quote?.price} /> : <TradeSim symbol={symbol} />}
      </section>
    </div>
  );
}
