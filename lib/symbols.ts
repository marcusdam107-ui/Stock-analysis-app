// Index symbols need a Yahoo prefix; everything else passes through.
const TO_PROVIDER: Record<string, string> = {
  NDX: "^NDX",
  SPX: "^SPX",
  VIX: "^VIX",
  RUT: "^RUT",
  DJI: "^DJI",
  // WTI crude oil front-month futures; shown as CRUDE because "CL" is Colgate's ticker
  CRUDE: "CL=F",
};

// Extra names people type for the same instruments. BTC-USD keeps its Yahoo name
// because plain "BTC" is a listed ETF (Grayscale Bitcoin Mini Trust).
const ALIASES: Record<string, string> = {
  "CL=F": "CRUDE",
  CRUDEOIL: "CRUDE",
  BITCOIN: "BTC-USD",
  BTCUSD: "BTC-USD",
};

export const CORE_ETFS = ["SPY", "IWM", "QQQ", "NDX"] as const;

export const CORE_NAMES: Record<string, string> = {
  SPY: "S&P 500",
  IWM: "Russell 2000",
  QQQ: "Nasdaq 100 ETF",
  NDX: "Nasdaq 100 Index",
};

export function normalize(input: string): string {
  const s = input.trim().toUpperCase().replace(/^\$/, "").replace(/[^A-Z0-9.^=\-]/g, "");
  return ALIASES[s] ?? s;
}

export function toProvider(display: string): string {
  const s = normalize(display);
  return TO_PROVIDER[s] ?? s;
}

export function toDisplay(provider: string): string {
  const hit = Object.entries(TO_PROVIDER).find(([, v]) => v === provider);
  return hit ? hit[0] : provider.replace(/^\^/, "");
}
