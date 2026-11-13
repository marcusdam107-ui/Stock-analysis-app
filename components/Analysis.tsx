"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePoll } from "@/lib/usePoll";
import { fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { getTopology, type Link as SupplyLink } from "@/lib/supplychain";
import type { Analysis as AnalysisData, Quarter, TechRow, TechTf, Technicals } from "@/lib/providers/analysis";
import Gauge, { ratingLabel, ratingTone } from "./Gauge";
import { safeUrl } from "@/lib/safeUrl";

const TABS = ["Financials", "Technicals", "Earnings", "Supply chain"] as const;
type Tab = (typeof TABS)[number];

export default function Analysis({ symbol, price }: { symbol: string; price?: number }) {
  const [tab, setTab] = useState<Tab>("Technicals");
  const { data, loading } = usePoll<AnalysisData & { error?: string }>(`/api/analysis?symbol=${symbol}`, 15 * 60_000);

  return (
    <div className="an">
      <nav className="tabs an__tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "is-on" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === "Technicals" && <TechnicalsTab symbol={symbol} />}
      {tab !== "Technicals" && !data && <div className="empty">{loading ? `Loading ${symbol} analysis…` : "No analysis data."}</div>}
      {data && tab === "Financials" && <FinancialsTab a={data} price={price} />}
      {data && tab === "Earnings" && <EarningsTab a={data} />}
      {data && tab === "Supply chain" && <SupplyTab a={data} symbol={symbol} />}
    </div>
  );
}

/* ---------------- financials ---------------- */

const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const x = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v.toFixed(d)}×`);
const usd = (v: number | null | undefined) => (v == null ? "—" : fmtCompact(v, "$"));

function FinancialsTab({ a, price }: { a: AnalysisData; price?: number }) {
  const s = a.stats;
  const groups: [string, [string, string, string?][]][] = [
    ["Valuation", [["Market cap", usd(s.marketCap)], ["Enterprise value", usd(s.enterpriseValue)], ["P/E (TTM)", x(s.trailingPE)], ["Forward P/E", x(s.forwardPE)], ["PEG", x(s.pegRatio, 2)], ["Price / sales", x(s.priceToSales)], ["Price / book", x(s.priceToBook)], ["EV / EBITDA", x(s.evToEbitda)]]],
    ["Profitability", [["Revenue (TTM)", usd(s.revenue)], ["Gross margin", pct(s.grossMargin)], ["Operating margin", pct(s.operatingMargin)], ["Net margin", pct(s.profitMargin)], ["Return on equity", pct(s.roe)], ["Return on assets", pct(s.roa)]]],
    ["Growth", [["Revenue growth (YoY)", pct(s.revenueGrowth), tone(s.revenueGrowth)], ["Earnings growth (YoY)", pct(s.earningsGrowth), tone(s.earningsGrowth)], ["EPS (TTM)", s.eps == null ? "—" : `$${fmtPrice(s.eps)}`], ["Forward EPS", s.forwardEps == null ? "—" : `$${fmtPrice(s.forwardEps)}`]]],
    ["Balance sheet & cash", [["Cash", usd(s.totalCash)], ["Debt", usd(s.totalDebt)], ["Debt / equity", s.debtToEquity == null ? "—" : `${s.debtToEquity.toFixed(0)}%`], ["Current ratio", x(s.currentRatio, 2)], ["Free cash flow", usd(s.freeCashflow)], ["Operating cash flow", usd(s.operatingCashflow)]]],
    ["Shares & risk", [["Beta", s.beta == null ? "—" : s.beta.toFixed(2)], ["Short % of float", pct(s.shortFloat)], ["Insiders", pct(s.insiders)], ["Institutions", pct(s.institutions)], ["Dividend yield", pct(s.dividendYield)], ["52-week range", s.low52 != null && s.high52 != null ? `${fmtPrice(s.low52)} – ${fmtPrice(s.high52)}` : "—"]]],
  ];

  const an = a.analyst;
  // Yahoo's mean is 1 (strong buy) .. 5 (strong sell); map onto the gauge's -1..+1
  const gaugeVal = an.mean != null ? Math.max(-1, Math.min(1, (3 - an.mean) / 2)) : null;
  const tr = an.trend;
  const total = tr ? tr.strongBuy + tr.buy + tr.hold + tr.sell + tr.strongSell : 0;
  const t = an.target;
  const span = t.low != null && t.high != null && t.high > t.low ? t.high - t.low : 0;
  const at = (v: number | null | undefined) => (v == null || !span ? 50 : Math.max(0, Math.min(100, ((v - t.low!) / span) * 100)));

  return (
    <div className="an__body">
      <div className="an__profile">
        <h3>{a.name}</h3>
        <div className="an__tags">
          {a.profile.sector && <span>{a.profile.sector}</span>}
          {a.profile.industry && <span>{a.profile.industry}</span>}
          {a.profile.country && <span>{a.profile.country}</span>}
          {a.profile.employees != null && <span>{a.profile.employees.toLocaleString("en-US")} employees</span>}
          {safeUrl(a.profile.website) && <a href={safeUrl(a.profile.website)} target="_blank" rel="noopener noreferrer">{a.profile.website.replace(/^https?:\/\//, "")}</a>}
        </div>
        {a.profile.summary && <p className="an__summary">{a.profile.summary}</p>}
      </div>

      <div className="an__fin">
        <div className="an__stats">
          {groups.map(([g, rows]) => (
            <div key={g} className="an__group">
              <h4>{g}</h4>
              {rows.map(([k, v, tn]) => (
                <div key={k} className="an__row"><span>{k}</span><b className={`num ${tn ?? ""}`}>{v}</b></div>
              ))}
            </div>
          ))}
        </div>

        <div className="an__analyst">
          <h4>Wall Street analysts{an.count ? ` · ${an.count} ratings` : ""}</h4>
          <Gauge title="Consensus" value={gaugeVal} big />
          {tr && total > 0 && (
            <div className="an__dist">
              {([["Strong buy", tr.strongBuy, "#16C784"], ["Buy", tr.buy, "rgba(22,199,132,0.6)"], ["Hold", tr.hold, "rgba(201,168,106,0.7)"], ["Sell", tr.sell, "rgba(240,67,90,0.6)"], ["Strong sell", tr.strongSell, "#F0435A"]] as const).map(([k, n, c]) => (
                <div key={k} className="an__dist-row">
                  <span>{k}</span>
                  <i><b style={{ width: `${(n / total) * 100}%`, background: c }} /></i>
                  <em className="num">{n}</em>
                </div>
              ))}
            </div>
          )}
          {t.mean != null && (
            <div className="an__target">
              <div className="an__target-head">
                <span>12-month price target</span>
                <b className="num gold">${fmtPrice(t.mean)}</b>
                {price ? <em className={`num ${t.mean > price ? "up" : "down"}`}>{fmtPct(((t.mean - price) / price) * 100)}</em> : null}
              </div>
              <div className="an__target-bar">
                <i className="an__target-mean" style={{ left: `${at(t.mean)}%` }} title="Average target" />
                {price ? <i className="an__target-now" style={{ left: `${at(price)}%` }} title="Current price" /> : null}
              </div>
              <div className="an__target-ends num"><span>Low ${fmtPrice(t.low)}</span>{price ? <span className="muted">Now ${fmtPrice(price)}</span> : null}<span>High ${fmtPrice(t.high)}</span></div>
            </div>
          )}
          {an.recent.length > 0 && (
            <ul className="an__recent">
              {an.recent.map((r) => (
                <li key={`${r.firm}-${r.date}`}>
                  <span className="muted num">{new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <b>{r.firm}</b>
                  <span className={r.action === "up" ? "up" : r.action === "down" ? "down" : ""}>
                    {r.action === "up" ? "Upgrade" : r.action === "down" ? "Downgrade" : r.action === "init" ? "Initiated" : "Reiterated"} · {r.to}
                  </span>
                  {r.target != null && <span className="num gold">${fmtPrice(r.target, 0)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="flow__source">Source: Yahoo Finance (fundamentals, analyst consensus, rating changes).</p>
    </div>
  );
}

const tone = (v: number | null | undefined) => (v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : "");

/* ---------------- technicals ---------------- */

const TECH_TFS: TechTf[] = ["5m", "15m", "1h", "4h", "1D", "1W", "1M"];

function count(rows: TechRow[]) {
  return {
    buy: rows.filter((r) => r.action === "Buy" && r.value != null).length,
    neutral: rows.filter((r) => r.action === "Neutral" && r.value != null).length,
    sell: rows.filter((r) => r.action === "Sell" && r.value != null).length,
  };
}

function TechnicalsTab({ symbol }: { symbol: string }) {
  const [tf, setTf] = useState<TechTf>("1D");
  const { data, loading } = usePoll<Technicals & { error?: string }>(`/api/technicals?symbol=${symbol}&tf=${tf}`, 60_000);
  const ok = data && !data.error;

  return (
    <div className="an__body">
      <div className="an__tech-head">
        <div className="seg">
          {TECH_TFS.map((t) => (
            <button key={t} className={t === tf ? "is-on" : ""} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>
        {ok && (
          <div className="an__tfs">
            {TECH_TFS.filter((t) => data.byTf[t] !== undefined).map((t) => (
              <span key={t} className={`an__tf-chip ${ratingTone(data.byTf[t])}`} title={`${t}: ${ratingLabel(data.byTf[t])}`}>
                {t} <b>{ratingLabel(data.byTf[t])}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {!ok ? (
        <div className="empty">{loading ? "Loading technical ratings…" : data?.error ?? "No technical data."}</div>
      ) : (
        <>
          <div className="an__gauges">
            <Gauge title="Oscillators" value={data.osc} counts={count(data.oscillators)} />
            <Gauge title="Summary" value={data.summary} counts={count([...data.oscillators, ...data.movingAverages])} big />
            <Gauge title="Moving averages" value={data.ma} counts={count(data.movingAverages)} />
          </div>
          <div className="an__tables">
            <TechTable title="Oscillators" rows={data.oscillators} />
            <TechTable title="Moving averages" rows={data.movingAverages} />
          </div>
          <p className="flow__source">
            Source: <b>{data.source === "TradingView" ? `TradingView technical ratings (${data.tvSymbol})` : "computed from Malachi chart data (TradingView doesn't cover this symbol)"}</b>
            {" · "}a rating of the trend and momentum, not a forecast.
          </p>
        </>
      )}
    </div>
  );
}

function TechTable({ title, rows }: { title: string; rows: TechRow[] }) {
  return (
    <div className="an__tech-table">
      <h4>{title}</h4>
      <table className="flow__table">
        <thead><tr><th>Name</th><th>Value</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="num">{r.value == null ? "—" : fmtPrice(r.value)}</td>
              <td className={r.value == null ? "muted" : r.action === "Buy" ? "up" : r.action === "Sell" ? "down" : "muted"}>{r.value == null ? "—" : r.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- earnings ---------------- */

function EarningsTab({ a }: { a: AnalysisData }) {
  const qs = a.quarters;
  const maxRev = Math.max(1, ...qs.map((q) => q.revenue ?? 0));
  const maxEps = Math.max(0.01, ...qs.flatMap((q) => [Math.abs(q.epsActual ?? 0), Math.abs(q.epsEstimate ?? 0)]));
  const next = a.next;

  return (
    <div className="an__body">
      {next.date && (
        <div className="an__next">
          <span className="eyebrow">Next report</span>
          <b>{new Date(next.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })}</b>
          {next.estimate && <span className="pill pill--muted">estimated date</span>}
          {next.epsAvg != null && <span>EPS est. <b className="num">${fmtPrice(next.epsAvg)}</b></span>}
          {next.revAvg != null && <span>Revenue est. <b className="num">{fmtCompact(next.revAvg, "$")}</b></span>}
        </div>
      )}

      {qs.length === 0 ? (
        <div className="empty">No quarterly earnings history for {a.symbol}.</div>
      ) : (
        <>
          <div className="an__quarters">
            {qs.map((q) => <QuarterCard key={q.periodEnd} q={q} />)}
          </div>
          <div className="an__charts">
            <div className="an__chart">
              <h4>Revenue by quarter</h4>
              <div className="an__bars">
                {qs.map((q) => (
                  <div key={q.periodEnd} className="an__bar-col">
                    <span className="num">{q.revenue ? fmtCompact(q.revenue, "$") : "—"}</span>
                    <i style={{ height: `${((q.revenue ?? 0) / maxRev) * 100}%` }} className="an__bar an__bar--rev" />
                    <em>{q.label}</em>
                  </div>
                ))}
              </div>
            </div>
            <div className="an__chart">
              <h4>EPS: actual vs estimate</h4>
              <div className="an__bars">
                {qs.map((q) => (
                  <div key={q.periodEnd} className="an__bar-col">
                    <span className="num">{q.epsActual != null ? `$${fmtPrice(q.epsActual)}` : "—"}</span>
                    <div className="an__pair">
                      <i style={{ height: `${(Math.abs(q.epsEstimate ?? 0) / maxEps) * 100}%` }} className="an__bar an__bar--est" title={`Estimate $${fmtPrice(q.epsEstimate)}`} />
                      <i style={{ height: `${(Math.abs(q.epsActual ?? 0) / maxEps) * 100}%` }} className={`an__bar ${(q.epsActual ?? 0) >= (q.epsEstimate ?? 0) ? "an__bar--beat" : "an__bar--miss"}`} title={`Actual $${fmtPrice(q.epsActual)}`} />
                    </div>
                    <em>{q.label}</em>
                  </div>
                ))}
              </div>
              <div className="an__key"><span><i className="an__bar--est" /> Estimate</span><span><i className="an__bar--beat" /> Beat</span><span><i className="an__bar--miss" /> Miss</span></div>
            </div>
          </div>
        </>
      )}
      <p className="flow__source">Source: Yahoo Finance (EPS vs consensus, quarterly statements). Stock reaction = first session after the report.</p>
    </div>
  );
}

function QuarterCard({ q }: { q: Quarter }) {
  const beat = q.epsActual != null && q.epsEstimate != null ? q.epsActual >= q.epsEstimate : null;
  return (
    <div className={`an__q ${beat === true ? "an__q--beat" : beat === false ? "an__q--miss" : ""}`}>
      <div className="an__q-head">
        <b>{q.label}</b>
        {beat != null && <span className={`an__badge ${beat ? "up" : "down"}`}>{beat ? "BEAT" : "MISS"}</span>}
      </div>
      <span className="an__q-date muted">
        {q.reported ? `Reported ${new Date(q.reported).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}` : `Quarter ended ${q.periodEnd}`}
        {q.timing && ` · ${q.timing === "AMC" ? "after close" : "before open"}`}
      </span>
      <div className="an__row"><span>EPS</span><b className="num">{q.epsActual != null ? `$${fmtPrice(q.epsActual)}` : "—"}</b></div>
      <div className="an__row"><span>Estimate</span><b className="num muted">{q.epsEstimate != null ? `$${fmtPrice(q.epsEstimate)}` : "—"}</b></div>
      <div className="an__row"><span>Surprise</span><b className={`num ${tone(q.surprisePct)}`}>{fmtPct(q.surprisePct)}</b></div>
      <div className="an__row"><span>Revenue</span><b className="num">{usd(q.revenue)}</b></div>
      <div className="an__row"><span>Net income</span><b className={`num ${tone(q.netIncome)}`}>{usd(q.netIncome)}</b></div>
      <div className="an__row"><span>Gross margin</span><b className="num">{pct(q.grossMargin)}</b></div>
      <div className="an__row an__row--hl"><span>Stock reaction</span><b className={`num ${tone(q.reaction)}`}>{fmtPct(q.reaction)}</b></div>
    </div>
  );
}

/* ---------------- supply chain ---------------- */

const W = 1000;
const NODE_W = 200;
const NODE_H = 54;

function SupplyTab({ a, symbol }: { a: AnalysisData; symbol: string }) {
  const router = useRouter();
  const topo = getTopology(symbol);
  const curatedTickers = new Set(topo ? [...topo.suppliers, ...topo.customers, ...topo.competitors].map((l) => l[0]) : []);
  const related: SupplyLink[] = a.peers.filter((p) => !curatedTickers.has(p)).map((p) => [p, p, "Related (Yahoo)"]);
  const suppliers = topo?.suppliers ?? [];
  const customers = topo?.customers ?? [];
  const rivals = [...(topo?.competitors ?? []), ...related].slice(0, 8);

  const sideRows = Math.max(suppliers.length, customers.length, 3);
  const top = 46;
  const gap = 66;
  const sideH = sideRows * gap;
  const centerY = top + sideH / 2 - NODE_H / 2;
  const rivalsY = top + sideH + 70;
  const H = rivalsY + NODE_H + 30;
  const colY = (i: number, n: number) => top + (sideH - n * gap) / 2 + i * gap + (gap - NODE_H) / 2;
  const rivalX = (i: number, n: number) => {
    const w = Math.min(W - 40, n * (NODE_W * 0.62 + 14));
    return (W - w) / 2 + i * (w / n);
  };
  const cx = W / 2 - NODE_W / 2;

  const node = (l: SupplyLink, x0: number, y0: number, kind: string, w = NODE_W) => {
    const [t, name, role] = l;
    const go = t ? () => router.push(`/t/${encodeURIComponent(t)}`) : undefined;
    return (
      <g key={`${kind}-${name}`} transform={`translate(${x0} ${y0})`} className={`sc__node sc__node--${kind} ${t ? "is-link" : ""}`} onClick={go}>
        <title>{`${name}${t ? ` (${t})` : ""} · ${role}${t ? " · click to open" : ""}`}</title>
        <rect width={w} height={NODE_H} rx="10" />
        <text x="12" y="22" className="sc__t">{t ?? name}</text>
        {t && <text x={w - 10} y="22" className="sc__name" textAnchor="end">{name.length > 16 ? name.slice(0, 15) + "…" : name}</text>}
        <text x="12" y="41" className="sc__role">{role.length > (w > 150 ? 30 : 18) ? role.slice(0, w > 150 ? 29 : 17) + "…" : role}</text>
      </g>
    );
  };

  return (
    <div className="an__body">
      {!topo && (
        <p className="an__note">
          No curated supply-chain map for {symbol} yet, so this shows related companies from Yahoo Finance.
          {a.profile.industry && ` ${a.name} is in ${a.profile.industry}.`}
        </p>
      )}
      <div className="sc">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${symbol} supply chain`}>
          <text x="110" y="24" className="sc__col">SUPPLIERS</text>
          <text x={W - 110} y="24" className="sc__col" textAnchor="middle">CUSTOMERS</text>
          <text x={W / 2} y={rivalsY - 18} className="sc__col" textAnchor="middle">COMPETITORS &amp; RELATED</text>
          {suppliers.map((_, i) => {
            const y = colY(i, suppliers.length) + NODE_H / 2;
            return <path key={`ls${i}`} d={`M ${10 + NODE_W} ${y} C ${W / 2 - 160} ${y}, ${W / 2 - 200} ${centerY + NODE_H / 2}, ${cx} ${centerY + NODE_H / 2}`} className="sc__edge sc__edge--in" />;
          })}
          {customers.map((_, i) => {
            const y = colY(i, customers.length) + NODE_H / 2;
            return <path key={`lc${i}`} d={`M ${cx + NODE_W} ${centerY + NODE_H / 2} C ${W / 2 + 200} ${centerY + NODE_H / 2}, ${W / 2 + 160} ${y}, ${W - 10 - NODE_W} ${y}`} className="sc__edge sc__edge--out" />;
          })}
          {rivals.map((_, i) => {
            const x0 = rivalX(i, rivals.length) + (NODE_W * 0.62) / 2;
            return <path key={`lr${i}`} d={`M ${W / 2} ${centerY + NODE_H} C ${W / 2} ${rivalsY - 30}, ${x0} ${centerY + NODE_H + 40}, ${x0} ${rivalsY}`} className="sc__edge sc__edge--rival" />;
          })}
          {suppliers.map((l, i) => node(l, 10, colY(i, suppliers.length), "sup"))}
          {customers.map((l, i) => node(l, W - 10 - NODE_W, colY(i, customers.length), "cus"))}
          {rivals.map((l, i) => node(l, rivalX(i, rivals.length), rivalsY, l[2] === "Related (Yahoo)" ? "rel" : "riv", NODE_W * 0.62))}
          <g transform={`translate(${cx} ${centerY - 8})`} className="sc__center">
            <rect width={NODE_W} height={NODE_H + 16} rx="14" />
            <text x={NODE_W / 2} y="32" textAnchor="middle" className="sc__center-t">{symbol}</text>
            <text x={NODE_W / 2} y="54" textAnchor="middle" className="sc__center-n">{a.name.length > 26 ? a.name.slice(0, 25) + "…" : a.name}</text>
          </g>
          {!topo && suppliers.length === 0 && (
            <text x={W / 2} y={centerY - 40} textAnchor="middle" className="sc__role">Supplier / customer links not mapped for this company</text>
          )}
        </svg>
      </div>
      <div className="an__key sc__key">
        <span><i className="sc__k sc__k--sup" /> Supplier</span>
        <span><i className="sc__k sc__k--cus" /> Customer</span>
        <span><i className="sc__k sc__k--riv" /> Competitor</span>
        <span><i className="sc__k sc__k--rel" /> Related (Yahoo, live)</span>
        <span className="muted">Click a company to open its page</span>
      </div>
      <p className="flow__source">
        Supplier / customer / competitor links: curated from company filings and public reporting (2026); there is no free live supply-chain feed.
        Related companies: Yahoo Finance, live.
      </p>
    </div>
  );
}
