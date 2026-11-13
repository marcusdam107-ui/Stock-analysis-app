"use client";
import { usePoll } from "@/lib/usePoll";
import { timeAgo } from "@/lib/format";
import { safeUrl } from "@/lib/safeUrl";
import type { NewsItem } from "@/lib/types";

export default function NewsList({ symbol }: { symbol: string }) {
  const { data, loading } = usePoll<{ items: NewsItem[]; demo: boolean }>(`/api/news?symbol=${symbol}`, 120_000);
  if (!data) return <div className="empty">{loading ? `Loading ${symbol} news…` : "No news."}</div>;
  return (
    <ul className="news">
      {data.demo && <li className="demo-tag demo-tag--inline">Demo headlines</li>}
      {data.items.map((n) => (
        <li key={n.id}>
          <a href={safeUrl(n.url)} target="_blank" rel="noopener noreferrer" className="news__item">
            <div className="news__text">
              <span className="news__meta">{n.publisher} · {timeAgo(n.publishedAt)}</span>
              <span className="news__title">{n.title}</span>
              {n.tickers && n.tickers.length > 0 && (
                <span className="news__tickers">{n.tickers.slice(0, 4).map((t) => <i key={t}>{t}</i>)}</span>
              )}
            </div>
            {safeUrl(n.image) && <img src={safeUrl(n.image)} alt="" className="news__img" loading="lazy" referrerPolicy="no-referrer" />}
          </a>
        </li>
      ))}
    </ul>
  );
}
