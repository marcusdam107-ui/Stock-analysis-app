"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import EtfStrip from "@/components/EtfStrip";
import ChartPanel from "@/components/ChartPanel";
import OptionsChain from "@/components/OptionsChain";
import NewsList from "@/components/NewsList";
import TrumpFeed from "@/components/TrumpFeed";
import Link from "next/link";
import { CORE_ETFS } from "@/lib/symbols";
import { usePoll } from "@/lib/usePoll";
import type { Quote } from "@/lib/types";

const TABS = ["Options chain", "News"] as const;
type Tab = (typeof TABS)[number];

function useStored<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setV(JSON.parse(raw));
    } catch {}
  }, [key]);
  const set = (next: T) => {
    setV(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  return [v, set] as const;
}

export default function Home() {
  const [primary, setPrimary] = useStored("mw.primary", "SPY");
  const [second, setSecond] = useStored<string | null>("mw.second", "QQQ");
  const [storedTab, setTab] = useStored<Tab>("mw.tab", "Options chain");
  const tab: Tab = TABS.includes(storedTab) ? storedTab : "Options chain";
  const router = useRouter();

  const watch = useMemo(() => [...new Set([...CORE_ETFS, primary, ...(second ? [second] : [])])], [primary, second]);
  const { data: quoteData } = usePoll<{ quotes: Quote[]; demo: boolean }>(`/api/quote?symbols=${watch.join(",")}`, 5_000);
  const quotes = useMemo(() => Object.fromEntries((quoteData?.quotes ?? []).map((q) => [q.symbol, q])), [quoteData]);

  return (
    <div className="app">
      <Header
        onSearch={(s) => router.push(`/t/${encodeURIComponent(s)}`)}
        actions={<Link href="/earnings" className="desk-link">Anticipated Earnings &amp; Events</Link>}
      />
      {quoteData?.demo && (
        <div className="banner">
          Showing demo prices: the live market feed could not be reached. Check your internet connection; nothing else is needed.
        </div>
      )}

      <EtfStrip quotes={quotes} active={primary} onPick={setPrimary} />

      {!second && (
        <div className="toolbar toolbar--end">
          <button className="btn-ghost" onClick={() => setSecond(primary === "QQQ" ? "SPY" : "QQQ")}>+ Compare side by side</button>
        </div>
      )}

      <div className={`charts ${second ? "charts--two" : ""}`}>
        <ChartPanel label="Chart 1" symbol={primary} quote={quotes[primary]} indicators={[]} onSymbol={setPrimary} line />
        {second && (
          <ChartPanel label="Chart 2" symbol={second} quote={quotes[second]} indicators={[]} onSymbol={setSecond} onClose={() => setSecond(null)} line />
        )}
      </div>

      <div className="lower">
        <section className="card desk">
          <header className="desk__head">
            <div>
              <span className="eyebrow">Weekly · Bi-weekly · Monthly</span>
              <h3>{primary} Desk</h3>
            </div>
            <nav className="tabs">
              {TABS.map((t) => (
                <button key={t} className={t === tab ? "is-on" : ""} onClick={() => setTab(t)}>{t}</button>
              ))}
            </nav>
          </header>
          {tab === "Options chain" && <OptionsChain symbol={primary} />}
          {tab === "News" && <NewsList symbol={primary} />}
        </section>
        <TrumpFeed />
      </div>

      <footer className="foot">
        Malachi Wealth · for personal research, not investment advice · quotes may be delayed by the data source
      </footer>
    </div>
  );
}
