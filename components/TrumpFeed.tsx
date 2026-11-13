"use client";
import { useState } from "react";
import { usePoll } from "@/lib/usePoll";
import { safeUrl } from "@/lib/safeUrl";
import { timeAgo } from "@/lib/format";
import type { TrumpPost } from "@/lib/types";

export default function TrumpFeed() {
  const { data, loading } = usePoll<{ posts: TrumpPost[]; sources: string[]; demo: boolean }>("/api/trump", 60_000);
  const [onlyMovers, setOnlyMovers] = useState(false);
  const posts = (data?.posts ?? []).filter((p) => !onlyMovers || p.impact !== "low");

  return (
    <aside className="card trump">
      <header className="trump__head">
        <div>
          <span className="eyebrow">Market-moving posts</span>
          <h3>Trump Watch</h3>
          <span className="trump__src">{data ? `Live from ${data.sources.join(" + ")}` : " "}</span>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={onlyMovers} onChange={(e) => setOnlyMovers(e.target.checked)} />
          <span>Market movers</span>
        </label>
      </header>
      {!data && <div className="empty">{loading ? "Loading posts…" : "Feed unavailable."}</div>}
      <ol className="trump__list">
        {posts.map((p) => (
          <li key={p.id} className={`post post--${p.impact}`}>
            <div className="post__meta">
              <span className={`post__src post__src--${p.source.replace(/\s/g, "").toLowerCase()}`}>{p.source}</span>
              <span>{timeAgo(p.publishedAt)}</span>
              {p.impact === "high" && <span className="post__impact">High impact</span>}
            </div>
            <a href={safeUrl(p.url)} target="_blank" rel="noopener noreferrer" className="post__text">{p.text}</a>
            {p.tags.length > 0 && (
              <div className="post__tags">{p.tags.map((t) => <span key={t}>{t}</span>)}</div>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
