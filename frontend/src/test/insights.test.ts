import { describe, expect, it } from 'vitest';
import type { DayAhead, ErrorSummary, HorizonRow, HourRow } from '@/api/types';
import { datePresets } from '@/features/accuracy/presets';
import { deriveTakeaways, listHours } from '@/features/accuracy/takeaways';
import { summarizeDay } from '@/features/day-ahead/summary';
import { fixtures } from './server';

const base: ErrorSummary = {
  count: 100,
  missing: 0,
  mean_actual_mw: 10000,
  mean_forecast_mw: 11000,
  mae_mw: 2000,
  rmse_mw: 2500,
  bias_mw: 1500,
  nmae_pct: 20,
  mape_pct: 22,
  mape_excluded: 0,
  p50_abs_mw: 1600,
  p90_abs_mw: 4000,
  p95_abs_mw: 5000,
  max_abs_mw: 7000,
  p05_error_mw: -1000,
  p95_error_mw: 5000,
  correlation: 0.9,
};

describe('summarizeDay', () => {
  it('sums hourly MW into energy and brackets it with the band', () => {
    const data = fixtures.dayAhead as DayAhead;
    const s = summarizeDay(data);
    expect(s.energyMwh).toBeCloseTo(data.forecast.energy_mwh, 0);
    expect(s.lowMwh).toBeLessThan(s.energyMwh);
    expect(s.highMwh).toBeGreaterThan(s.energyMwh);
    expect(s.biased).toBe(true);
  });

  it('classifies trend relative to the daily mean', () => {
    const data = structuredClone(fixtures.dayAhead) as DayAhead;
    data.points.forEach((p) => (p.forecast_mw = 10000));
    expect(summarizeDay(data).trend).toBe('steady');
  });
});

describe('deriveTakeaways', () => {
  const horizon = [1, 24, 48].map(
    (h, i) => ({ ...base, horizon_h: h, mae_mw: 1700 + i * 300 }) as HorizonRow,
  );
  const hours = [0, 1, 2, 3, 4, 5].map(
    (h) => ({ ...base, hour: h, mae_mw: 1000 + h * 100 }) as HourRow,
  );

  it('flags a mostly systematic error and picks the worst hours in time order', () => {
    const t = deriveTakeaways(base, horizon, hours);
    expect(t.mostlySystematic).toBe(true);
    expect(t.worstHours).toEqual([3, 4, 5]);
    expect([t.nearH, t.nearMae, t.farH, t.farMae]).toEqual([1, 1700, 48, 2300]);
  });

  it('treats a small bias as random error', () => {
    expect(deriveTakeaways({ ...base, bias_mw: 200 }, [], []).mostlySystematic).toBe(false);
  });

  it('formats hour lists for sentences', () => {
    expect(listHours([3, 5, 6])).toBe('03:00, 05:00 and 06:00');
    expect(listHours([7])).toBe('07:00');
  });
});

describe('datePresets', () => {
  it('covers the whole window then 7-day blocks ending on the last day', () => {
    const p = datePresets('2026-01-02', '2026-02-01');
    expect(p[0]).toMatchObject({ label: 'Whole period', start: '2026-01-02', end: '2026-02-01' });
    expect(p[1]).toMatchObject({ start: '2026-01-02', end: '2026-01-08' });
    expect(p.at(-1)).toMatchObject({ start: '2026-01-30', end: '2026-02-01' });
  });
});
