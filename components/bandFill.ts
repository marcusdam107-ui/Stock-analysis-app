// A lightweight-charts series primitive that shades the area between two lines,
// green where the first is above the second and red where it is below (EMA clouds, Bollinger).
import type {
  IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive,
  SeriesAttachedParameter, SeriesType, Time,
} from "lightweight-charts";

export interface BandPoint { time: Time; a: number; b: number }
type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];

export class BandFill implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly view: IPrimitivePaneView;

  constructor(private points: BandPoint[], private upColor: string, private downColor: string) {
    this.view = { zOrder: () => "bottom", renderer: () => ({ draw: (t) => this.draw(t) }) };
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.series = p.series;
    this.requestUpdate = p.requestUpdate;
  }

  detached() {
    this.chart = this.series = this.requestUpdate = null;
  }

  setPoints(points: BandPoint[]) {
    this.points = points;
    this.requestUpdate?.();
  }

  paneViews() {
    return [this.view];
  }

  private draw(target: Target) {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series || this.points.length < 2) return;
    const ts = chart.timeScale();
    const xy = this.points
      .map((p) => ({
        x: ts.timeToCoordinate(p.time),
        ya: series.priceToCoordinate(p.a),
        yb: series.priceToCoordinate(p.b),
        up: p.a >= p.b,
      }))
      .filter((p) => p.x !== null && p.ya !== null && p.yb !== null) as { x: number; ya: number; yb: number; up: boolean }[];
    if (xy.length < 2) return;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      let start = 0;
      for (let i = 1; i <= xy.length; i++) {
        if (i < xy.length && xy[i].up === xy[start].up) continue;
        // run [start, i) has one colour; include the next point so runs meet without gaps
        const run = xy.slice(start, Math.min(i + 1, xy.length));
        ctx.beginPath();
        run.forEach((p, k) => (k ? ctx.lineTo(p.x * hr, p.ya * vr) : ctx.moveTo(p.x * hr, p.ya * vr)));
        for (let k = run.length - 1; k >= 0; k--) ctx.lineTo(run[k].x * hr, run[k].yb * vr);
        ctx.closePath();
        ctx.fillStyle = xy[start].up ? this.upColor : this.downColor;
        ctx.fill();
        start = i;
      }
    });
  }
}
