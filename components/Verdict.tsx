"use client";
import { useEffect, useMemo } from "react";
import { fmtPrice } from "@/lib/format";

interface Trade { symbol: string; pnl: number; entry: number; exit: number; qty: number }

// {$} = dollar amount, {T} = ticker, {%} = percent, {E} = entry price, {X} = exit price
const ROASTS = [
  "You paid {$} to learn what theta is. Clown College tuition is NON-REFUNDABLE.",
  "Buffett buys low and sells high. You invented a THIRD thing.",
  "You turned ${E} into ${X}. That's alchemy, but BACKWARDS.",
  "A coin flip is 50/50. You found the side of the coin. 🪙",
  "Market makers are naming their new yacht after you. ⛵",
  "That wasn't a trade. That was a DONATION with extra steps.",
  "Your portfolio just filed for a restraining order.",
  "-{$}. Wendy's is hiring and the dental is fantastic. 🍔",
  "You didn't buy the dip. You ARE the dip.",
  "Sir, this is a casino and you are the free buffet.",
  "Strategy: buy high, sell low, cry in between. Flawless execution.",
  "{T} saw you coming from three expirations away. 👀",
  "Bold of you to fight theta with VIBES.",
  "Somewhere a hedge fund intern just got a bonus. Thanks to you.",
  "-{%}. Even your stop-loss gave up on you.",
  "Frame this trade. As a warning for future generations.",
  "Your P&L looks like a ski slope and you forgot the skis. ⛷️",
  "If losing money were an Olympic sport you'd lose that too.",
  "Simulated money. REAL embarrassment.",
  "Theta ate your lunch, your dinner and your dignity. 🍽️",
  "Your 'due diligence' was a vibe check and a prayer. 🙏",
  "The chart literally drew you a map and you still got lost.",
  "Your account isn't bleeding. It's hemorrhaging with STYLE. 🩸",
  "Even a goldfish with a Robinhood account beats this. 🐟",
  "Congrats, you're the liquidity. 💧",
  "This trade was so bad the SEC wants to study it.",
  "You had ONE job: sell higher than you bought.",
  "Your financial advisor is a Magic 8-Ball and it said 'outlook not so good'. 🎱",
];

const ROAST_HEADS = ["💀 REKT 💀", "🤡 CLOWN MARKET 🤡", "📉 GUH 📉", "🔥 ACCOUNT ON FIRE 🔥", "🚨 FINANCIAL CRIME 🚨", "😭 SIR THIS IS A WENDY'S 😭"];
const NUKED_HEADS = ["☢️ NUCLEAR REKT ☢️", "🤡🤡 MAXIMUM CLOWN 🤡🤡", "⚰️ R.I.P. ACCOUNT ⚰️"];

const WINS = [
  "+{$}! Lambo? No. A REALLY nice sandwich? Absolutely. 🥪",
  "Stonks only go up and so do you, king. 👑",
  "Wall Street HATES this one weird trader.",
  "Market makers are crying into their Bloomberg terminals. 😭",
  "Isaac Newton lost money in the markets. You didn't. Smarter than Newton, confirmed. 🍎",
  "Buy the dip, sell the rip, collect the drip. 💧",
  "Theta tried. Theta FAILED.",
  "Warren Buffett just sent you a LinkedIn request. 🤝",
  "This is the way. 🪐",
  "RING THE BELL 🔔 someone actually made money on options!",
  "Now quit while you're ahead. (You won't.) 😏",
  "+{%}! Your mom says she's proud of you. Finally. 🥹",
  "${E} in, ${X} out. Certified money printer. 🖨️💵",
  "Hedge funds HATE you. Venture capital wants your number.",
];

const WIN_HEADS = ["🚀 TO THE MOON 🚀", "💎🙌 DIAMOND HANDS 💎🙌", "📈 STONKS 📈", "🦍 APES STRONG 🦍", "🤑 PRINTER GO BRRR 🤑"];

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Full-screen roast (loss) or meme celebration (win) after closing a simulated trade. */
export default function Verdict({ trade, onDone }: { trade: Trade; onDone: () => void }) {
  const win = trade.pnl > 0;
  const flat = trade.pnl === 0;
  const cost = trade.entry * 100 * trade.qty || 1;
  const pct = Math.abs((trade.pnl / cost) * 100);

  const { head, line } = useMemo(() => {
    const fill = (s: string) =>
      s.replaceAll("{$}", `$${fmtPrice(Math.abs(trade.pnl))}`)
        .replaceAll("{T}", trade.symbol)
        .replaceAll("{%}", `${pct.toFixed(0)}%`)
        .replaceAll("{E}", fmtPrice(trade.entry))
        .replaceAll("{X}", fmtPrice(trade.exit));
    if (flat) return { head: "😐 BREAKEVEN 😐", line: "You traded and NOTHING happened. Peak efficiency at wasting time." };
    if (win) return { head: pick(WIN_HEADS), line: fill(pick(WINS)) };
    return { head: pick(pct >= 50 ? NUKED_HEADS : ROAST_HEADS), line: fill(pick(ROASTS)) };
    // a new line per closed trade, not per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onDone]);

  const rain = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({
      i,
      emoji: pick(win ? ["🚀", "💎", "🤑", "💵", "📈", "🦍", "🍾", "👑"] : flat ? ["😐", "🫠"] : ["💀", "🤡", "📉", "🔥", "🗑️", "😭", "🧻"]),
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      dur: 2.2 + Math.random() * 2.5,
      size: 26 + Math.random() * 34,
    })),
    [win, flat],
  );

  return (
    <div className={`verdict ${win ? "verdict--win" : flat ? "verdict--flat" : "verdict--loss"}`} onClick={onDone} role="dialog" aria-live="assertive">
      <div className="verdict__rain" aria-hidden>
        {rain.map((r) => (
          <span key={r.i} style={{ left: `${r.left}%`, animationDelay: `${r.delay}s`, animationDuration: `${r.dur}s`, fontSize: r.size }}>{r.emoji}</span>
        ))}
      </div>
      <div className="verdict__card" onClick={(e) => e.stopPropagation()}>
        <div className="verdict__head">{head}</div>
        <div className="verdict__amount">{win ? "+" : flat ? "" : "-"}${fmtPrice(Math.abs(trade.pnl))}</div>
        <blockquote className="verdict__quote">“{line}”</blockquote>
        <button className="verdict__btn" onClick={onDone}>{win ? "I AM A GENIUS 😎" : flat ? "ok 😐" : "I DESERVED THAT 😭"}</button>
      </div>
    </div>
  );
}
