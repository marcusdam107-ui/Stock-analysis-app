export interface RssItem { title: string; link: string; pubDate: number; description: string; guid: string; source?: string }

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, "’").replace(/&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, " ");

const stripTags = (s: string) => decode(decode(s).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}

export function parseRss(xml: string): RssItem[] {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(([block]) => ({
    title: stripTags(tag(block, "title")),
    link: stripTags(tag(block, "link")),
    pubDate: Date.parse(stripTags(tag(block, "pubDate"))) || Date.now(),
    description: stripTags(tag(block, "description")),
    guid: stripTags(tag(block, "guid")) || stripTags(tag(block, "link")),
    source: stripTags(tag(block, "source")) || undefined,
  }));
}

export async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh) MalachiWealth/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return parseRss(await res.text());
}
