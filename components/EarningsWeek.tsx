"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePoll } from "@/lib/usePoll";
import { fmtCompact } from "@/lib/format";
import type { EarningsEntry, EarningsWeek as Week, EconEvent } from "@/lib/providers/earnings";

const PER_SLOT = 10;

/** Monday (YYYY-MM-DD) of the board's week; flips to the coming week at Sunday 12am New York time. */
function currentWeekKey() {
  const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = new Date(Date.UTC(ny.getFullYear(), ny.getMonth(), ny.getDate()));
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? 1 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

function Logo({ e }: { e: EarningsEntry }) {
  const [failed, setFailed] = useState(false);
  const tip = [e.company, e.epsEst != null ? `EPS est. $${e.epsEst.toFixed(2)}` : "", e.revEst ? `Revenue est. ${fmtCompact(e.revEst, "$")}` : "", e.confirmed ? "Date confirmed" : "Date unconfirmed"]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={`/t/${encodeURIComponent(e.ticker)}`} className="ew__tile" title={tip}>
      <span className="ew__logo">
        {failed ? (
          <span className="ew__fallback">{e.company.replace(/,? (Inc|Corp|Corporation|Ltd|plc|Co)\.?$/i, "")}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://financialmodelingprep.com/image-stock/${encodeURIComponent(e.ticker)}.png`} alt={e.company} loading="lazy" onError={() => setFailed(true)} />
        )}
      </span>
      <span className="ew__ticker">{e.ticker}</span>
    </Link>
  );
}

const IMPACT_ORDER: Record<EconEvent["impact"], string> = { High: "High", Medium: "Medium", Holiday: "Holiday" };

export default function EarningsWeek() {
  const [week, setWeek] = useState(currentWeekKey);
  // re-check every minute so the board rolls over right at Sunday 12am ET
  useEffect(() => {
    const t = setInterval(() => setWeek(currentWeekKey()), 60_000);
    return () => clearInterval(t);
  }, []);
  const { data, loading } = usePoll<Week>(`/api/earnings-week?week=${week}`, 30 * 60_000);

  const weekOf = data
    ? new Date(data.weekOf + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";
  const events = data?.events ?? [];

  return (
    <section className="ew" id="earnings">
      <div className="card ew__board">
        <div className="ew__watermark" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" />
          <span>MALACHI WEALTH</span>
        </div>

        <header className="ew__head">
          <div className="ew__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" />
            <div>
              <div className="ew__brand-name">Malachi Wealth</div>
              <div className="ew__brand-tag">Earnings Desk</div>
            </div>
          </div>
          <div className="ew__title">
            <h2>Most Anticipated Earnings Releases</h2>
            <span className="ew__sub">for the week beginning</span>
            <span className="ew__date">{weekOf || "…"}</span>
            <span className="ew__note">Ranked by Earnings Whispers trader interest · refreshes Sunday 12am ET</span>
          </div>
          <div className="ew__legend">
            <span><i className="ew__dot ew__dot--bmo" /> Before open</span>
            <span><i className="ew__dot ew__dot--amc" /> After close</span>
          </div>
        </header>

        {!data ? (
          <div className="empty">{loading ? "Loading this week's earnings…" : "Earnings calendar unavailable."}</div>
        ) : (
          <div className="ew__days">
            {data.days.map((d) => (
              <div key={d.date} className="ew__day">
                <div className="ew__day-name">
                  {d.weekday}
                  <small>{new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</small>
                </div>
                <div className={`ew__slots ${d.amc.length ? "" : "ew__slots--one"}`}>
                  {[["Before Open", d.bmo, "bmo"], ["After Close", d.amc, "amc"]].map(([title, list, k]) =>
                    (list as EarningsEntry[]).length || k === "bmo" ? (
                      <div key={k as string} className={`ew__slot ew__slot--${k}`}>
                        <div className="ew__slot-title">{title as string}</div>
                        {(list as EarningsEntry[]).slice(0, PER_SLOT).map((e) => <Logo key={e.ticker} e={e} />)}
                        {(list as EarningsEntry[]).length === 0 && <div className="ew__none">—</div>}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <footer className="ew__foot">
          <span>Data: Earnings Whispers · Forex Factory</span>
          <span>© {new Date().getFullYear()} Malachi Wealth</span>
        </footer>
      </div>

      <div className="card ew__events">
        <header className="ew__events-head">
          <div>
            <span className="eyebrow">United States · high &amp; medium impact</span>
            <h3>Important events this week</h3>
          </div>
          <span className="ew__events-wm" aria-hidden>MALACHI WEALTH</span>
        </header>
        <div className="ew__events-wrap">
          <table className="flow__table ew__table">
            <thead>
              <tr><th>Day</th><th>Time (ET)</th><th>Event</th><th>Impact</th><th>Forecast</th><th>Previous</th></tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={6} className="empty">{data ? "No major US events listed for this week." : "Loading events…"}</td></tr>
              )}
              {events.map((e, i) => {
                const d = new Date(e.time);
                const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
                const prevDay = i > 0 ? new Date(events[i - 1].time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }) : "";
                return (
                  <tr key={`${e.title}-${e.time}`} className={`ew__ev ew__ev--${e.impact.toLowerCase()} ${day !== prevDay ? "ew__ev--first" : ""}`}>
                    <td className="muted">{day !== prevDay ? day : ""}</td>
                    <td className="num">{e.allDay ? "All day" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</td>
                    <td className="ew__ev-title">{e.title}</td>
                    <td><span className={`ew__impact ew__impact--${e.impact.toLowerCase()}`}>{IMPACT_ORDER[e.impact]}</span></td>
                    <td className="num">{e.forecast || "—"}</td>
                    <td className="num muted">{e.previous || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && data.errors.length > 0 && <p className="flow__source">Some data could not be loaded: {data.errors.join("; ")}</p>}
      </div>
    </section>
  );
}
