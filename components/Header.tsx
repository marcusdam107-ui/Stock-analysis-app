"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import SymbolSearch from "./SymbolSearch";
import { SESSION_LABEL, sessionAt } from "@/lib/session";
import type { MarketSession } from "@/lib/types";

export default function Header({ onSearch, actions }: { onSearch: (s: string) => void; actions?: ReactNode }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const session: MarketSession | null = now ? sessionAt(now) : null;

  return (
    <header className="topbar">
      <Link href="/" className="brand" title="Back to dashboard">
        <img src="/logo-mark.png" alt="" className="brand__logo" />
        <div>
          <div className="brand__name">Malachi Wealth</div>
          <div className="brand__tag">Private Options Desk</div>
        </div>
      </Link>
      <SymbolSearch onPick={onSearch} />
      <div className="topbar__right">
        {actions}
        {session && (
          <span className={`session session--${session}`}>
            <i />
            {SESSION_LABEL[session]}
          </span>
        )}
        <span className="clock num">
          {now?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" })}
          <small> ET</small>
        </span>
      </div>
    </header>
  );
}
