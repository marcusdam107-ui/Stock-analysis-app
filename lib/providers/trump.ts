// Trump's posts. Order of preference:
//  1. X API (X_BEARER_TOKEN), the @realDonaldTrump timeline itself
//  2. Truth Social, via the public trumpstruth.org RSS mirror (he posts there first, and most)
//  3. Headlines about Trump and the markets (Google News) so the panel is never empty
import { cached } from "../cache";
import { demoTrump } from "../demo";
import { fetchRss } from "../rss";
import type { TrumpPost } from "../types";
import { forceDemo } from "./market";

const TRUMP_X_ID = "25073877"; // @realDonaldTrump

const TOPICS: [string, RegExp, number][] = [
  ["Tariffs", /tariff|trade deal|trade war|import tax|duties/i, 3],
  ["China", /china|chinese|xi jinping|beijing/i, 2],
  ["Fed / Rates", /\bfed\b|federal reserve|powell|interest rate|rate cut|\brates\b/i, 3],
  ["Oil & Energy", /\boil\b|opec|drill|gasoline|energy|natural gas/i, 2],
  ["Crypto", /crypto|bitcoin|\bbtc\b|stablecoin/i, 2],
  ["Tech", /apple|nvidia|microsoft|google|meta|amazon|tesla|chips?|semiconductor|\bai\b|tiktok/i, 2],
  ["Stocks", /stock market|dow|nasdaq|s&p|wall street|stocks/i, 2],
  ["Taxes", /\btax(es)?\b|irs/i, 1],
  ["Defense & War", /war|military|missile|iran|russia|ukraine|israel|nato|strike/i, 2],
  ["Pharma", /drug prices|pharma|medicare/i, 2],
  ["Jobs & Economy", /jobs|inflation|gdp|economy|recession/i, 1],
];

export function tag(text: string): Pick<TrumpPost, "tags" | "impact"> {
  let score = 0;
  const tags: string[] = [];
  for (const [name, re, weight] of TOPICS) {
    if (re.test(text)) {
      tags.push(name);
      score += weight;
    }
  }
  return { tags, impact: score >= 3 ? "high" : score >= 1 ? "medium" : "low" };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fromX(): Promise<TrumpPost[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return [];
  // X's paid tiers have tight monthly read caps, so cache for 5 minutes.
  return cached("trump:x", 300_000, async () => {
    const res = await fetch(
      `https://api.x.com/2/users/${TRUMP_X_ID}/tweets?max_results=20&exclude=replies&tweet.fields=created_at`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) {
      console.warn("[trump] X API", res.status, await res.text().catch(() => ""));
      return [];
    }
    const body: any = await res.json();
    return (body.data ?? []).map((t: any) => ({
      id: `x-${t.id}`,
      text: t.text,
      url: `https://x.com/realDonaldTrump/status/${t.id}`,
      publishedAt: Date.parse(t.created_at),
      source: "X" as const,
      ...tag(t.text),
    }));
  });
}

async function fromTruthSocial(): Promise<TrumpPost[]> {
  return cached("trump:truth", 60_000, async () => {
    const items = await fetchRss("https://trumpstruth.org/feed");
    return items
      .map((i) => ({ ...i, text: (i.description || i.title).trim() }))
      .filter((i) => i.text && !/^\[no title\]$/i.test(i.text))
      .slice(0, 25)
      .map((i) => ({
        id: `t-${i.guid}`,
        text: i.text,
        url: i.link,
        publishedAt: i.pubDate,
        source: "Truth Social" as const,
        ...tag(i.text),
      }));
  });
}

async function headlines(): Promise<TrumpPost[]> {
  return cached("trump:news", 300_000, async () => {
    const q = encodeURIComponent("Trump (tariffs OR stocks OR market OR Fed) when:2d");
    const items = await fetchRss(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
    return items.slice(0, 15).map((i) => ({
      id: `h-${i.guid}`,
      text: i.title.replace(/\s+-\s+[^-]+$/, ""),
      url: i.link,
      publishedAt: i.pubDate,
      source: "Headline" as const,
      ...tag(i.title),
    }));
  });
}

export async function getTrumpFeed(): Promise<{ posts: TrumpPost[]; sources: string[]; demo: boolean }> {
  if (forceDemo()) return { posts: demoTrump(), sources: ["Demo"], demo: true };
  const safe = (p: Promise<TrumpPost[]>) => p.catch((e) => (console.warn("[trump]", e.message), [] as TrumpPost[]));
  const [x, truth] = await Promise.all([safe(fromX()), safe(fromTruthSocial())]);
  let posts = [...x, ...truth];
  const sources = [x.length && "X", truth.length && "Truth Social"].filter(Boolean) as string[];
  if (posts.length < 5) {
    const h = await safe(headlines());
    if (h.length) sources.push("Headlines");
    posts = posts.concat(h);
  }
  if (!posts.length) return { posts: demoTrump(), sources: ["Demo"], demo: true };
  posts.sort((a, b) => b.publishedAt - a.publishedAt);
  return { posts: posts.slice(0, 30), sources, demo: false };
}
