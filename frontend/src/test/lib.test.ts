import { describe, expect, it } from 'vitest';
import { buildChartRows } from '@/features/day-ahead/buildChartRows';
import { toCsv } from '@/features/accuracy/csv';
import { dayTicks, gwAxis, hourTicks, niceTicks } from '@/lib/axis';
import { addDays, clampDate } from '@/lib/dates';
import { gw, gwhRange, mw, signedMw, ukDate, ukTime } from '@/lib/format';
import { parse } from '@/lib/useUrlState';
import { fixtures } from './server';

describe('format', () => {
  it('formats compact energy ranges', () => {
    expect(gwhRange(152_200, 303_600)).toBe('152–304 GWh');
    expect(gwhRange(null, 1)).toBe('—');
  });
  it('formats MW values and missing values', () => {
    expect(mw(12345.6)).toBe('12,346 MW');
    expect(mw(null)).toBe('—');
    expect(gw(15482)).toBe('15.5 GW');
    expect(signedMw(250)).toBe('+250 MW');
    expect(signedMw(-250)).toBe('-250 MW');
  });

  it('formats in UK market time, including BST', () => {
    expect(ukTime('2026-01-15T09:00:00Z')).toBe('09:00');
    expect(ukTime('2026-07-15T09:00:00Z')).toBe('10:00');
    expect(ukDate('2026-01-15')).toBe('Thu 15 Jan 2026');
  });
});

describe('dates', () => {
  it('adds days across month boundaries and clamps', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(clampDate('2025-12-01', '2026-01-02', '2026-02-01')).toBe('2026-01-02');
  });
});

describe('url parsers', () => {
  it('fall back on invalid input and clamp ints', () => {
    expect(parse.date('2026-01-15')('garbage')).toBe('2026-01-15');
    expect(parse.time('09:00')('9am')).toBe('09:00');
    expect(parse.int(24, 1, 48)('500')).toBe(48);
    expect(parse.oneOf(['a', 'b'] as const, 'a')('c')).toBe('a');
    expect(parse.bool(false)('1')).toBe(true);
  });
});

describe('buildChartRows', () => {
  it('merges hourly forecasts with half-hourly actuals', () => {
    const rows = buildChartRows(fixtures.dayAhead);
    expect(rows).toHaveLength(48);
    const withForecast = rows.filter((r) => r.forecast != null);
    expect(withForecast).toHaveLength(24);
    expect(rows.every((r, i) => i === 0 || r.t > rows[i - 1]!.t)).toBe(true);
    expect(withForecast[0]!.band![0]).toBeLessThanOrEqual(withForecast[0]!.band![1]);
  });
});

describe('toCsv', () => {
  it('escapes values', () => {
    expect(toCsv([{ a: 'x,y', b: 1 }], ['a', 'b'])).toBe('a,b\n"x,y",1');
  });
});

describe('axis', () => {
  it('produces round tick steps covering the max', () => {
    expect(niceTicks(17805)).toEqual([0, 5000, 10000, 15000, 20000]);
    expect(niceTicks(2700)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(1800)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(niceTicks(0)).toEqual([0]);
  });

  it('formats GW with decimals only for sub-GW steps', () => {
    expect(gwAxis([1800]).tickFormatter(500)).toBe('0.5 GW');
    expect(gwAxis([17805]).tickFormatter(5000)).toBe('5 GW');
  });

  it('picks whole-hour ticks at the requested interval in UK time', () => {
    const t = (iso: string) => new Date(iso).getTime();
    const times = [
      '2026-01-15T00:00Z',
      '2026-01-15T00:30Z',
      '2026-01-15T01:00Z',
      '2026-01-15T03:00Z',
    ].map(t);
    expect(hourTicks(times, 3)).toEqual([t('2026-01-15T00:00Z'), t('2026-01-15T03:00Z')]);
  });
});

describe('dayTicks', () => {
  it('keeps one tick per UK day, thinned to the max', () => {
    const start = new Date('2026-01-02T00:00Z').getTime();
    const times = Array.from({ length: 31 * 48 }, (_, i) => start + i * 1_800_000);
    const ticks = dayTicks(times, 10);
    expect(ticks.length).toBeLessThanOrEqual(10);
    expect(new Set(ticks.map((t) => new Date(t).toISOString().slice(0, 10))).size).toBe(
      ticks.length,
    );
  });
});
