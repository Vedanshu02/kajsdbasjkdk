import type { DayAhead } from '@/api/types';

export type Trend = 'rising' | 'falling' | 'steady';

export interface DaySummary {
  energyMwh: number;
  lowMwh: number;
  highMwh: number;
  meanMw: number | null;
  startMw: number | null;
  endMw: number | null;
  trend: Trend;
  /** True when the month's forecasts leaned clearly one way (|bias| > 25% of typical miss). */
  biased: boolean;
}

/** Plain-language facts behind the "bottom line" card. Hourly MW x 1 h = MWh. */
export function summarizeDay(data: DayAhead): DaySummary {
  const pts = data.points.filter((p) => p.forecast_mw != null);
  const sum = (f: (p: (typeof pts)[number]) => number | null | undefined) =>
    pts.reduce((acc, p) => acc + (f(p) ?? 0), 0);

  const startMw = pts[0]?.forecast_mw ?? null;
  const endMw = pts.at(-1)?.forecast_mw ?? null;
  const meanMw = data.forecast.mean_mw ?? null;
  let trend: Trend = 'steady';
  if (startMw != null && endMw != null && meanMw) {
    const change = endMw - startMw;
    if (Math.abs(change) > 0.15 * meanMw) trend = change > 0 ? 'rising' : 'falling';
  }
  const { bias_mw: bias, mae_mw: mae } = data.band;

  return {
    energyMwh: sum((p) => p.forecast_mw),
    lowMwh: sum((p) => p.band_low_mw),
    highMwh: sum((p) => p.band_high_mw),
    meanMw,
    startMw,
    endMw,
    trend,
    biased: bias != null && mae != null && mae > 0 && Math.abs(bias) > 0.25 * mae,
  };
}
