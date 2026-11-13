const RISK_FREE = 0.04;

function normCdf(x: number): number {
  // Abramowitz-Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function d1(spot: number, strike: number, years: number, iv: number) {
  return (Math.log(spot / strike) + (RISK_FREE + (iv * iv) / 2) * years) / (iv * Math.sqrt(years));
}

export function delta(kind: "call" | "put", spot: number, strike: number, years: number, iv: number): number {
  if (!(iv > 0) || !(years > 0) || !(spot > 0)) {
    const itm = kind === "call" ? spot > strike : spot < strike;
    return kind === "call" ? (itm ? 1 : 0) : itm ? -1 : 0;
  }
  const n = normCdf(d1(spot, strike, years, iv));
  return kind === "call" ? n : n - 1;
}

export function price(kind: "call" | "put", spot: number, strike: number, years: number, iv: number): number {
  if (!(years > 0) || !(iv > 0)) return Math.max(0, kind === "call" ? spot - strike : strike - spot);
  const a = d1(spot, strike, years, iv);
  const b = a - iv * Math.sqrt(years);
  const disc = Math.exp(-RISK_FREE * years);
  return kind === "call"
    ? spot * normCdf(a) - strike * disc * normCdf(b)
    : strike * disc * normCdf(-b) - spot * normCdf(-a);
}
