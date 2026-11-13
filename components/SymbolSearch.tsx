"use client";
import { useEffect, useRef, useState } from "react";
import { normalize } from "@/lib/symbols";

interface Hit { symbol: string; name: string; type: string; exchange: string }

export default function SymbolSearch({ onPick, placeholder = "Search a company or ticker", compact = false }: {
  onPick: (symbol: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) return setHits([]);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setHits(json.results ?? []);
        setActive(0);
      } catch {
        setHits([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (s: string) => {
    const sym = normalize(s);
    if (!sym) return;
    onPick(sym);
    setQ("");
    setHits([]);
    setOpen(false);
  };

  return (
    <div ref={wrap} className={`search ${compact ? "search--compact" : ""}`}>
      <svg viewBox="0 0 24 24" className="search__icon" aria-hidden>
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, hits.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          else if (e.key === "Enter") pick(hits[active]?.symbol ?? q);
          else if (e.key === "Escape") setOpen(false);
        }}
        spellCheck={false}
        aria-label="Search ticker"
      />
      {open && hits.length > 0 && (
        <ul className="search__menu" role="listbox">
          {hits.map((h, i) => (
            <li
              key={h.symbol + i}
              className={i === active ? "is-active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => (e.preventDefault(), pick(h.symbol))}
            >
              <span className="search__sym">{h.symbol}</span>
              <span className="search__name">{h.name}</span>
              <span className="search__ex">{h.exchange}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
