import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { Histogram, HorizonRow, HourRow, Series } from '@/api/types';
import { dayTicks, gwAxis } from '@/lib/axis';
import { axisTick, chart } from '@/lib/chartTheme';
import { mw, signedMw, ukTime } from '@/lib/format';

const gwTick = (v: number) => `${(v / 1000).toFixed(0)} GW`;
const grid = <CartesianGrid stroke={chart.grid} vertical={false} />;
const yAxisProps = {
  tick: axisTick,
  tickLine: false,
  axisLine: false,
  width: 56,
} as const;
const xAxisProps = {
  tick: axisTick,
  tickLine: false,
  axisLine: { stroke: '#c3c2b7' },
} as const;

function Box({ title, lines }: { title: string; lines: [string, string, string?][] }) {
  return (
    <div className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-ink">{title}</div>
      {lines.map(([label, value, color]) => (
        <div key={label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-soft">
            {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
            {label}
          </span>
          <span className="tabular font-medium text-ink">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className="h-0 w-4 border-t-2"
            style={{ borderColor: i.color, borderStyle: i.dashed ? 'dashed' : 'solid' }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ horizon curve */

interface HorizonChartProps {
  rows: HorizonRow[];
  dayAheadRange?: [number, number] | null;
  selectedHorizon?: number | null;
}

export function HorizonChart({ rows, dayAheadRange, selectedHorizon }: HorizonChartProps) {
  const tooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const r = payload[0]?.payload as HorizonRow;
    return (
      <Box
        title={`Forecast issued ${r.horizon_h} h ahead`}
        lines={[
          ['Typical miss', mw(r.mae_mw), chart.actual],
          ['9 in 10 hours within', mw(r.p90_abs_mw), chart.forecast],
          ['Forecast − actual (avg)', signedMw(r.bias_mw)],
          ['Hours scored', String(r.count)],
        ]}
      />
    );
  };
  return (
    <div className="h-[280px]">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          {grid}
          {dayAheadRange && (
            <ReferenceArea
              x1={dayAheadRange[0]}
              x2={dayAheadRange[1]}
              fill="#0e7490"
              fillOpacity={0.06}
              label={{
                value: 'Notice you get with day-ahead bidding',
                position: 'insideTop',
                fill: chart.inkSoft,
                fontSize: 11,
              }}
            />
          )}
          {selectedHorizon != null && (
            <ReferenceLine x={selectedHorizon} stroke={chart.inkSoft} strokeDasharray="3 3" />
          )}
          <XAxis
            dataKey="horizon_h"
            type="number"
            domain={[1, 48]}
            ticks={[1, 6, 12, 18, 24, 30, 36, 42, 48]}
            tickFormatter={(h: number) => `${h}h`}
            {...xAxisProps}
          />
          <YAxis {...gwAxis(rows.map((r) => r.p90_abs_mw))} {...yAxisProps} />
          <Tooltip content={tooltip} cursor={{ stroke: chart.axis, strokeDasharray: '3 3' }} />
          <Line
            dataKey="mae_mw"
            stroke={chart.actual}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            name="Typical miss"
          />
          <Line
            dataKey="p90_abs_mw"
            stroke={chart.forecast}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
            name="9 in 10 hours within"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------- time series */

export function SeriesChart({ data }: { data: Series }) {
  const rows = new Map<number, { t: number; actual?: number | null; forecast?: number | null }>();
  for (const a of data.actuals) {
    const t = new Date(a.start_time).getTime();
    rows.set(t, { t, actual: a.actual_mw });
  }
  for (const p of data.points) {
    const t = new Date(p.start_time).getTime();
    rows.set(t, { ...(rows.get(t) ?? { t }), forecast: p.forecast_mw });
  }
  const sorted = [...rows.values()].sort((a, b) => a.t - b.t);
  const spanDays = sorted.length ? (sorted.at(-1)!.t - sorted[0]!.t) / 86_400_000 : 0;

  const tooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const r = payload[0]?.payload as (typeof sorted)[number];
    return (
      <Box
        title={ukTime(new Date(r.t).toISOString(), 'EEE d MMM HH:mm')}
        lines={[
          ['Actual', mw(r.actual), chart.actual],
          ['Forecast', mw(r.forecast), chart.forecast],
        ]}
      />
    );
  };
  return (
    <div className="h-[300px]">
      <ResponsiveContainer>
        <ComposedChart data={sorted} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          {grid}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={spanDays > 2 ? dayTicks(sorted.map((r) => r.t)) : undefined}
            tickFormatter={(t: number) =>
              ukTime(new Date(t).toISOString(), spanDays > 2 ? 'd MMM' : 'd MMM HH:mm')
            }
            minTickGap={24}
            {...xAxisProps}
          />
          <YAxis {...gwAxis(sorted.flatMap((r) => [r.actual, r.forecast]))} {...yAxisProps} />
          <Tooltip content={tooltip} cursor={{ stroke: chart.axis, strokeDasharray: '3 3' }} />
          <Line
            dataKey="actual"
            stroke={chart.actual}
            strokeWidth={1.75}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            dataKey="forecast"
            stroke={chart.forecast}
            strokeWidth={1.75}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------- hour of day */

interface HourChartProps {
  rows: HourRow[];
  /** Hours to emphasise (e.g. the hardest to forecast); the rest are muted. */
  highlight?: number[];
}

export function HourChart({ rows, highlight = [] }: HourChartProps) {
  const tooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const r = payload[0]?.payload as HourRow;
    return (
      <Box
        title={`${String(r.hour).padStart(2, '0')}:00 UK`}
        lines={[
          ['Typical miss', mw(r.mae_mw), chart.bar],
          ['Forecast − actual (avg)', signedMw(r.bias_mw)],
          ['9 in 10 hours within', mw(r.p90_abs_mw)],
        ]}
      />
    );
  };
  return (
    <div className="h-[240px]">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barCategoryGap={2}>
          {grid}
          <XAxis
            dataKey="hour"
            tickFormatter={(h: number) => String(h).padStart(2, '0')}
            interval={2}
            {...xAxisProps}
          />
          <YAxis {...gwAxis(rows.map((r) => r.mae_mw))} {...yAxisProps} />
          <Tooltip content={tooltip} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
          <Bar dataKey="mae_mw" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell
                key={r.hour}
                fill={highlight.length && !highlight.includes(r.hour) ? chart.barMuted : chart.bar}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------- histogram */

export function ErrorHistogram({ hist }: { hist: Histogram }) {
  const rows = hist.counts.map((count, i) => {
    const lo = hist.edges[i] ?? 0;
    const hi = hist.edges[i + 1] ?? lo;
    return { mid: (lo + hi) / 2, lo, hi, count };
  });
  const tooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const r = payload[0]?.payload as (typeof rows)[number];
    return (
      <Box
        title={`${signedMw(r.lo)} to ${signedMw(r.hi)}`}
        lines={[
          ['Hours', String(r.count)],
          [
            'Meaning',
            r.mid > 0 ? 'less wind than forecast (short)' : 'more wind than forecast (long)',
          ],
        ]}
      />
    );
  };
  return (
    <div className="h-[240px]">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barCategoryGap={1}>
          {grid}
          <XAxis
            dataKey="mid"
            type="number"
            domain={[hist.edges[0] ?? 0, hist.edges.at(-1) ?? 0]}
            tickFormatter={gwTick}
            {...xAxisProps}
          />
          <YAxis allowDecimals={false} {...yAxisProps} width={36} />
          <ReferenceLine x={0} stroke={chart.inkSoft} />
          <Tooltip content={tooltip} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.mid} fill={r.mid > 0 ? chart.over : chart.under} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
