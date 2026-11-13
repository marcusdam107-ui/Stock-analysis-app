export type MarketSession = "pre" | "regular" | "post" | "overnight" | "closed";

export interface Quote {
  symbol: string;          // display symbol, e.g. "NDX"
  name: string;
  price: number;           // best live price for the current session
  change: number;
  changePercent: number;
  regularPrice: number;
  previousClose: number;
  session: MarketSession;
  extendedPrice?: number;
  extendedChangePercent?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  marketCap?: number;
  updatedAt: number;       // epoch ms
}

export interface Candle {
  time: number;            // epoch seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ExpiryKind = "weekly" | "biweekly" | "monthly";

export interface Expiry {
  date: string;            // YYYY-MM-DD
  epoch: number;           // epoch seconds Yahoo expects
  kind: ExpiryKind;
  label: string;           // "Weekly", "Bi-weekly", "Monthly"
  daysOut: number;
}

export interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  iv: number;              // decimal, 0.24 = 24%
  delta: number;
  inTheMoney: boolean;
}

export interface ChainRow {
  strike: number;
  call?: OptionContract;
  put?: OptionContract;
}

export interface OptionsInsight {
  expectedMove: number;
  expectedMovePct: number;
  rangeLow: number;
  rangeHigh: number;
  atmIv: number;
  putCallOi: number;
  putCallVolume: number;
  maxPain: number;
  ivRank: number | null;   // 0-100 over the past year
  ivRankSource: string;    // "VIX", "VXN", "RVX", or "est." when ranked against realized vol
  atr: number | null;      // 14-day ATR on daily bars, in dollars
  summary: string[];       // plain-English read
}

export interface OptionsResponse {
  symbol: string;
  spot: number;
  expiries: Expiry[];
  selected: Expiry | null;
  rows: ChainRow[];
  atmStrike: number;
  insight: OptionsInsight | null;
  demo?: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: number;     // epoch ms
  image?: string;
  tickers?: string[];
}

export interface TrumpPost {
  id: string;
  text: string;
  url: string;
  publishedAt: number;
  source: "X" | "Truth Social" | "Headline";
  tags: string[];
  impact: "high" | "medium" | "low";
}

export interface FlowPrint {
  id: string;
  time: number;            // epoch ms
  symbol: string;
  expiry: string;          // YYYY-MM-DD
  strike: number;
  cp: "Call" | "Put";
  side: "Above" | "Ask" | "Mid" | "Bid" | "Below";
  bs: "BUY" | "SELL" | "—";
  spot: number;
  size: number;
  price: number;
  premium: number;
  type: string;            // Sweep, Block, Split... or "Print"/"Day total" when estimated
  volume: number;
  openInterest: number;
  conds: string[];
}

export interface FlowResponse {
  symbol: string;
  source: "Unusual Whales" | "Snapshot estimate" | "Demo";
  prints: FlowPrint[];
  callPremium: number;
  putPremium: number;
  demo?: boolean;
}
