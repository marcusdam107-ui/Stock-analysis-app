// Company news: Yahoo Finance always, Finnhub too when FINNHUB_API_KEY is set,
// Google News headlines as a fallback. Results are merged and de-duplicated by headline.
import { cached } from "../cache";
import { demoNews } from "../demo";
import { fetchRss } from "../rss";
import type { NewsItem } from "../types";
import { forceDemo, yahooNews } from "./market";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fromYahoo(symbol: string): Promise<NewsItem[]> {
  const items = await yahooNews(symbol);
  return items.map((n: any) => ({
    id: `y-${n.uuid}`,
    title: n.title,
    publisher: n.publisher,
    url: n.link,
    publishedAt: new Date(n.providerPublishTime).getTime(),
    image: n.thumbnail?.resolutions?.find((r: any) => r.width >= 140 && r.width <= 400)?.url ?? n.thumbnail?.resolutions?.[0]?.url,
    tickers: n.relatedTickers,
  }));
}

async function fromFinnhub(symbol: string): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  return cached(`fh:${symbol}`, 300_000, async () => {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${key}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.slice(0, 20).map((n) => ({
      id: `f-${n.id}`, title: n.headline, publisher: n.source, url: n.url,
      publishedAt: n.datetime * 1000, image: n.image || undefined, tickers: [symbol],
    }));
  });
}

async function fromGoogle(symbol: string): Promise<NewsItem[]> {
  return cached(`gn:${symbol}`, 300_000, async () => {
    const q = encodeURIComponent(`${symbol} stock`);
    const items = await fetchRss(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
    return items.slice(0, 15).map((n) => ({
      id: `g-${n.guid}`,
      title: n.title.replace(/\s+-\s+[^-]+$/, ""),
      publisher: n.source ?? "Google News",
      url: n.link,
      publishedAt: n.pubDate,
    }));
  });
}

const settle = async (p: Promise<NewsItem[]>) => p.catch(() => [] as NewsItem[]);

export async function getNews(symbol: string): Promise<{ items: NewsItem[]; demo: boolean }> {
  if (forceDemo()) return { items: demoNews(symbol), demo: true };
  const [y, f] = await Promise.all([settle(fromYahoo(symbol)), settle(fromFinnhub(symbol))]);
  let all = [...y, ...f];
  if (all.length < 5) all = all.concat(await settle(fromGoogle(symbol)));
  if (!all.length) return { items: demoNews(symbol), demo: true };
  const seen = new Set<string>();
  const items = all
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .filter((n) => {
      const k = n.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 20);
  return { items, demo: false };
}
