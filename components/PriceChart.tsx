"use client";
import { useEffect, useRef } from "react";
import {
  AreaSeries, CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, createChart,
  type IChartApi, type ISeriesApi, type SeriesType, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { BandFill } from "./bandFill";
import { RIPSTER_CLOUDS, atr, bollinger, closes, ema, rsi, vwap, type Series } from "@/lib/indicators";
import { nyOffsetSeconds } from "@/lib/session";
import type { Candle } from "@/lib/types";

export type IndicatorId = "ripster-5-12" | "ripster-34-50" | "dma200" | "vwap" | "bollinger" | "rsi" | "atr" | "volume";

export const INDICATORS: { id: IndicatorId; label: string }[] = [
  ...RIPSTER_CLOUDS.map((c) => ({ id: c.id as IndicatorId, label: c.label })),
  { id: "dma200", label: "200 DMA" },
  { id: "vwap", label: "VWAP" },
  { id: "bollinger", label: "Bollinger" },
  { id: "rsi", label: "RSI" },
  { id: "atr", label: "ATR" },
  { id: "volume", label: "Volume" },
];

const C = {
  bg: "#0B1122",
  grid: "rgba(255,255,255,0.035)",
  text: "#8D96AB",
  up: "#16C784",
  down: "#F0435A",
  gold: "#C9A86A",
  bb: "#7FA6D8",
  vwap: "#E8E2D0",
};

interface Props {
  candles: Candle[];
  dma200: (number | null)[];
  focusFrom?: number;
  indicators: IndicatorId[];
  livePrice?: number;
  viewKey: string; // changes when symbol/timeframe changes, to re-fit the view
  intraday: boolean;
  line?: boolean;          // overview mode: a close-price line instead of candles
}

const shift = (t: number) => (t + nyOffsetSeconds(t)) as UTCTimestamp;

function line(values: Series, times: Time[]) {
  return values.flatMap((v, i) => (v == null ? [] : [{ time: times[i], value: v }]));
}

export default function PriceChart({ candles, dma200, focusFrom, indicators, livePrice, viewKey, intraday, line: asLine = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const main = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const area = useRef<ISeriesApi<"Area"> | null>(null);
  const extras = useRef<ISeriesApi<SeriesType>[]>([]);
  const bands = useRef<BandFill[]>([]);
  const fittedKey = useRef<string>("");
  const lastBar = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null);

  // create the chart once
  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor: C.text,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
        panes: { separatorColor: "rgba(201,168,106,0.15)", separatorHoverColor: "rgba(201,168,106,0.3)" },
        attributionLogo: false,
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(201,168,106,0.45)", labelBackgroundColor: "#2A2416" },
        horzLine: { color: "rgba(201,168,106,0.45)", labelBackgroundColor: "#2A2416" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      timeScale: { borderColor: "rgba(255,255,255,0.06)", rightOffset: 6, timeVisible: true, secondsVisible: false },
    });
    main.current = c.addSeries(CandlestickSeries, {
      upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down,
      wickUpColor: C.up, wickDownColor: C.down, priceLineColor: C.gold, visible: !asLine,
    });
    if (asLine) {
      area.current = c.addSeries(AreaSeries, { lineWidth: 2, priceLineColor: C.gold, crosshairMarkerRadius: 4 });
      // the hidden candle series still drives indicators and the time scale; keep its price label off the axis
      main.current.applyOptions({ lastValueVisible: false, priceLineVisible: false });
    }
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
      main.current = null;
      area.current = null;
      extras.current = [];
      bands.current = [];
    };
  }, []);

  // data + indicators
  useEffect(() => {
    const c = chart.current;
    const m = main.current;
    if (!c || !m) return;

    for (const b of bands.current) m.detachPrimitive(b);
    bands.current = [];
    for (const s of extras.current) c.removeSeries(s);
    extras.current = [];
    while (c.panes().length > 1) c.removePane(c.panes().length - 1);

    c.applyOptions({ timeScale: { timeVisible: intraday } });
    const times = candles.map((k) => shift(k.time));
    const bars = candles.map((k, i) => ({ time: times[i], open: k.open, high: k.high, low: k.low, close: k.close }));
    m.setData(bars);
    lastBar.current = bars[bars.length - 1] ?? null;
    if (area.current) {
      // green when the visible period is up, red when it is down
      const start = focusFrom ? Math.max(0, bars.findIndex((b) => (b.time as number) >= shift(focusFrom))) : 0;
      const upPeriod = bars.length < 2 || bars[bars.length - 1].close >= bars[start].close;
      const col = upPeriod ? C.up : C.down;
      area.current.applyOptions({
        lineColor: col,
        topColor: upPeriod ? "rgba(22,199,132,0.28)" : "rgba(240,67,90,0.28)",
        bottomColor: upPeriod ? "rgba(22,199,132,0.02)" : "rgba(240,67,90,0.02)",
      });
      area.current.setData(bars.map((b) => ({ time: b.time, value: b.close })));
    }
    const cl = closes(candles);
    const on = (id: IndicatorId) => indicators.includes(id);
    const add = <T extends SeriesType>(s: ISeriesApi<T>) => (extras.current.push(s as ISeriesApi<SeriesType>), s);
    const thin = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };

    if (on("volume")) {
      const v = add(c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false }));
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      v.setData(candles.map((k, i) => ({ time: times[i], value: k.volume, color: k.close >= k.open ? "rgba(22,199,132,0.28)" : "rgba(240,67,90,0.28)" })));
    }

    for (const cloud of RIPSTER_CLOUDS) {
      if (!on(cloud.id)) continue;
      const fast = ema(cl, cloud.fast);
      const slow = ema(cl, cloud.slow);
      const strong = cloud.fast === 5;
      const up = strong ? "rgba(38,230,155,0.36)" : "rgba(96,160,255,0.32)";
      const down = strong ? "rgba(255,85,110,0.36)" : "rgba(255,170,40,0.32)";
      const pts = times.flatMap((t, i) => (fast[i] != null && slow[i] != null ? [{ time: t, a: fast[i]!, b: slow[i]! }] : []));
      const band = new BandFill(pts, up, down);
      m.attachPrimitive(band);
      bands.current.push(band);
      add(c.addSeries(LineSeries, { ...thin, color: strong ? "rgba(38,230,155,1)" : "rgba(96,160,255,0.95)" })).setData(line(fast, times));
      add(c.addSeries(LineSeries, { ...thin, color: strong ? "rgba(255,85,110,0.95)" : "rgba(255,170,40,0.9)" })).setData(line(slow, times));
    }

    if (on("bollinger")) {
      const bb = bollinger(cl, 20, 2);
      const pts = times.flatMap((t, i) => (bb.upper[i] != null ? [{ time: t, a: bb.upper[i]!, b: bb.lower[i]! }] : []));
      const band = new BandFill(pts, "rgba(127,166,216,0.07)", "rgba(127,166,216,0.07)");
      m.attachPrimitive(band);
      bands.current.push(band);
      add(c.addSeries(LineSeries, { ...thin, color: C.bb })).setData(line(bb.upper, times));
      add(c.addSeries(LineSeries, { ...thin, color: C.bb })).setData(line(bb.lower, times));
      add(c.addSeries(LineSeries, { ...thin, color: "rgba(127,166,216,0.6)", lineStyle: LineStyle.Dashed })).setData(line(bb.mid, times));
    }

    if (on("dma200")) {
      // on intraday charts the 200 DMA is often far from price; don't let it squash the candles
      add(c.addSeries(LineSeries, {
        lineWidth: 2, color: C.gold, priceLineVisible: false, lastValueVisible: true, title: "200D", crosshairMarkerVisible: false,
        ...(intraday ? { autoscaleInfoProvider: () => null } : {}),
      })).setData(line(dma200, times));
    }

    // VWAP resets each session, so it only means something on intraday bars
    if (on("vwap") && intraday) {
      add(c.addSeries(LineSeries, {
        lineWidth: 2, color: C.vwap, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: true, title: "VWAP", crosshairMarkerVisible: false,
      })).setData(line(vwap(candles), times));
    }

    let pane = 1;
    if (on("rsi")) {
      const r = add(c.addSeries(LineSeries, { lineWidth: 1, color: "#B39DDB", priceLineVisible: false, lastValueVisible: true, title: "RSI" }, pane));
      r.setData(line(rsi(cl, 14), times));
      r.createPriceLine({ price: 70, color: "rgba(240,67,90,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      r.createPriceLine({ price: 30, color: "rgba(22,199,132,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      r.priceScale().applyOptions({ autoScale: false, scaleMargins: { top: 0.1, bottom: 0.1 } });
      r.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
      c.panes()[pane]?.setStretchFactor(0.28);
      pane++;
    }

    if (on("atr")) {
      const a = add(c.addSeries(LineSeries, { lineWidth: 1, color: "#E0A458", priceLineVisible: false, lastValueVisible: true, title: "ATR 14" }, pane));
      a.setData(line(atr(candles, 14), times));
      c.panes()[pane]?.setStretchFactor(0.22);
    }

    if (fittedKey.current !== viewKey && bars.length) {
      fittedKey.current = viewKey;
      const from = focusFrom ? bars.findIndex((b) => (b.time as number) >= shift(focusFrom)) : -1;
      if (from > 0) c.timeScale().setVisibleLogicalRange({ from, to: bars.length + 5 });
      else c.timeScale().fitContent();
    }
  }, [candles, dma200, focusFrom, indicators, viewKey, intraday]);

  // live price: nudge the last candle between chart refreshes
  useEffect(() => {
    const m = main.current;
    const b = lastBar.current;
    if (!m || !b || !livePrice) return;
    const next = { ...b, close: livePrice, high: Math.max(b.high, livePrice), low: Math.min(b.low, livePrice) };
    lastBar.current = next;
    m.update(next);
    area.current?.update({ time: next.time, value: next.close });
  }, [livePrice]);

  return <div ref={box} className="chart-canvas" />;
}
