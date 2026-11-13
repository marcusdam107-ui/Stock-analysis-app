import type { Expiry } from "./types";

const DAY = 86_400_000;

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isThirdFriday(d: Date) {
  return d.getUTCDay() === 5 && d.getUTCDate() >= 15 && d.getUTCDate() <= 21;
}

/** Monday (UTC) of the week a date falls in, used to group expirations by trading week. */
function weekKey(d: Date) {
  const day = (d.getUTCDay() + 6) % 7;
  return ymd(new Date(d.getTime() - day * DAY));
}

/**
 * Keep only the expirations this desk trades:
 *  - Weekly: the end-of-week expiration of the current week
 *  - Bi-weekly: the end-of-week expiration of next week
 *  - Monthly: the standard third-Friday expirations (next two)
 * Daily (0DTE Mon-Thu) and LEAPS-style far dates are dropped.
 */
export function classifyExpiries(dates: Date[], now = new Date()): Expiry[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const future = dates
    .map((d) => new Date(d))
    .filter((d) => d.getTime() >= today)
    .sort((a, b) => a.getTime() - b.getTime());

  // last expiration of each week = that week's "weekly"
  const byWeek = new Map<string, Date>();
  for (const d of future) byWeek.set(weekKey(d), d);
  const weekEnds = [...byWeek.values()];

  const out: Expiry[] = [];
  const push = (d: Date, kind: Expiry["kind"]) => {
    if (out.some((e) => e.date === ymd(d))) {
      // a weekly that is also the monthly: call it monthly, it carries the most liquidity
      if (kind === "monthly") out.find((e) => e.date === ymd(d))!.kind = "monthly";
      return;
    }
    out.push({
      date: ymd(d),
      epoch: Math.floor(d.getTime() / 1000),
      kind,
      label: "",
      daysOut: Math.max(0, Math.round((d.getTime() - today) / DAY)),
    });
  };

  if (weekEnds[0]) push(weekEnds[0], weekEnds[0].getTime() - today <= 7 * DAY ? "weekly" : "biweekly");
  if (weekEnds[1] && weekEnds[1].getTime() - today <= 14 * DAY) push(weekEnds[1], "biweekly");
  future.filter(isThirdFriday).slice(0, 2).forEach((d) => push(d, "monthly"));

  const LABEL = { weekly: "Weekly", biweekly: "Bi-weekly", monthly: "Monthly" } as const;
  return out
    .sort((a, b) => a.epoch - b.epoch)
    .map((e) => ({ ...e, label: LABEL[e.kind] }));
}
