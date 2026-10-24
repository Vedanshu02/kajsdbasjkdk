import type { DayAhead } from '@/api/types';

export interface DayAheadRow {
  t: number;
  forecast?: number | null;
  band?: [number, number] | null;
  actual?: number | null;
  publishTime?: string | null;
  horizonH?: number | null;
}

/** Merge hourly forecast points and half-hourly actuals into one time-keyed row set. */
export function buildChartRows(data: DayAhead): DayAheadRow[] {
  const rows = new Map<number, DayAheadRow>();
  const at = (iso: string) => {
    const t = new Date(iso).getTime();
    let row = rows.get(t);
    if (!row) {
      row = { t };
      rows.set(t, row);
    }
    return row;
  };
  for (const p of data.points) {
    const row = at(p.start_time);
    row.forecast = p.forecast_mw;
    row.publishTime = p.publish_time;
    row.horizonH = p.horizon_h;
    row.band =
      p.band_low_mw != null && p.band_high_mw != null ? [p.band_low_mw, p.band_high_mw] : null;
  }
  for (const a of data.actuals) at(a.start_time).actual = a.actual_mw;
  return [...rows.values()].sort((a, b) => a.t - b.t);
}
