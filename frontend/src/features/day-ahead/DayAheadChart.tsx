import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { gwAxis, hourTicks } from '@/lib/axis';
import { axisTick, chart } from '@/lib/chartTheme';
import { hours, mw, ukTime } from '@/lib/format';
import type { DayAheadRow } from './buildChartRows';

interface Props {
  rows: DayAheadRow[];
  showActuals: boolean;
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as DayAheadRow;
  return (
    <div className="min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1.5 font-semibold text-ink">{ukTime(new Date(row.t).toISOString())}</div>
      {row.forecast != null && (
        <Item color={chart.forecast} label="Forecast" value={mw(row.forecast)} />
      )}
      {row.band && (
        <Item
          color={chart.band}
          faded
          label="Likely range"
          value={`${mw(row.band[0])} – ${mw(row.band[1])}`}
        />
      )}
      {row.actual != null && <Item color={chart.actual} label="Actual" value={mw(row.actual)} />}
      {row.publishTime && (
        <div className="mt-1.5 border-t border-slate-100 pt-1.5 text-ink-soft">
          Run {ukTime(row.publishTime, 'd MMM HH:mm')} · lead {hours(row.horizonH)}
        </div>
      )}
    </div>
  );
}

function Item({
  color,
  label,
  value,
  faded = false,
}: {
  color: string;
  label: string;
  value: string;
  faded?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-ink-soft">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: color, opacity: faded ? 0.35 : 1 }}
        />
        {label}
      </span>
      <span className="tabular font-medium text-ink">{value}</span>
    </div>
  );
}

export function DayAheadChart({ rows, showActuals }: Props) {
  const y = gwAxis(rows.flatMap((r) => [r.band?.[1], r.forecast, showActuals ? r.actual : null]));
  const xTicks = hourTicks(rows.map((r) => r.t));
  return (
    <div className="h-[340px] w-full" data-testid="day-ahead-chart">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={(t: number) => ukTime(new Date(t).toISOString())}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: '#c3c2b7' }}
          />
          <YAxis {...y} tick={axisTick} tickLine={false} axisLine={false} width={56} />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: chart.axis, strokeDasharray: '3 3' }}
          />
          <Area
            dataKey="band"
            stroke="none"
            fill={chart.band}
            fillOpacity={chart.bandOpacity}
            connectNulls
            isAnimationActive={false}
            name="Likely range"
          />
          <Line
            dataKey="forecast"
            stroke={chart.forecast}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            connectNulls
            isAnimationActive={false}
            name="Forecast"
          />
          {showActuals && (
            <Line
              dataKey="actual"
              stroke={chart.actual}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              connectNulls
              isAnimationActive={false}
              name="Actual"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DayAheadLegend({ showActuals }: { showActuals: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft" aria-label="Legend">
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded" style={{ background: chart.forecast }} />
        Forecast
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="h-3 w-4 rounded-sm"
          style={{ background: chart.band, opacity: chart.bandOpacity * 2.5 }}
        />
        Likely range (9 in 10 hours)
      </li>
      {showActuals && (
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: chart.actual }} />
          What actually happened
        </li>
      )}
    </ul>
  );
}
