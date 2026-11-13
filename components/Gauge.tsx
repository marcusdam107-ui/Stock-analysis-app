// Semicircle buy/sell gauge in the style of TradingView's technical ratings. value: -1 (strong sell) .. +1 (strong buy).

export function ratingLabel(v: number | null | undefined) {
  if (v == null) return "No data";
  if (v >= 0.5) return "Strong Buy";
  if (v >= 0.1) return "Buy";
  if (v > -0.1) return "Neutral";
  if (v > -0.5) return "Sell";
  return "Strong Sell";
}

export const ratingTone = (v: number | null | undefined) => (v == null ? "muted" : v >= 0.1 ? "up" : v <= -0.1 ? "down" : "gold");

const SEGMENTS = [
  { from: -1, to: -0.5, color: "#F0435A" },
  { from: -0.5, to: -0.1, color: "rgba(240,67,90,0.55)" },
  { from: -0.1, to: 0.1, color: "rgba(201,168,106,0.55)" },
  { from: 0.1, to: 0.5, color: "rgba(22,199,132,0.55)" },
  { from: 0.5, to: 1, color: "#16C784" },
];

const R = 80;
const CX = 100;
const CY = 96;
const point = (v: number, r = R) => {
  const a = Math.PI * (1 - (v + 1) / 2); // -1 -> left (180deg), +1 -> right (0deg)
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
};

export default function Gauge({ title, value, counts, big = false }: {
  title: string;
  value: number | null;
  counts?: { buy: number; neutral: number; sell: number };
  big?: boolean;
}) {
  const v = value == null ? 0 : Math.max(-1, Math.min(1, value));
  const [nx, ny] = point(v, R - 14);
  return (
    <div className={`gauge ${big ? "gauge--big" : ""}`}>
      <span className="gauge__title">{title}</span>
      <svg viewBox="0 0 200 112" role="img" aria-label={`${title}: ${ratingLabel(value)}`}>
        {SEGMENTS.map((s) => {
          const [x1, y1] = point(s.from);
          const [x2, y2] = point(s.to);
          return <path key={s.from} d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`} stroke={s.color} strokeWidth="13" fill="none" />;
        })}
        <text x="16" y="110" className="gauge__tick">Strong sell</text>
        <text x="184" y="110" className="gauge__tick" textAnchor="end">Strong buy</text>
        {value != null && (
          <>
            <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="6" fill="var(--text)" />
          </>
        )}
      </svg>
      <span className={`gauge__label ${ratingTone(value)}`}>{ratingLabel(value)}</span>
      {counts && (
        <span className="gauge__counts">
          <i className="down">Sell {counts.sell}</i>
          <i className="muted">Neutral {counts.neutral}</i>
          <i className="up">Buy {counts.buy}</i>
        </span>
      )}
    </div>
  );
}
