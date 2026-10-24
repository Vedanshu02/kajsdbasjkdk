import type { DayAhead } from '@/api/types';
import { Em, Insight, InsightPanel } from '@/components/ui';
import { gw, gwh, gwhRange, ukDate, ukTime } from '@/lib/format';
import type { DaySummary } from './summary';

const TREND_TEXT = { rising: 'rising', falling: 'falling', steady: 'holding steady' } as const;

/** The decision in plain sentences: what the forecast says and how much to trust it. */
export function BottomLine({ data, summary }: { data: DayAhead; summary: DaySummary }) {
  const run = data.forecast.runs_used.at(-1);
  const bias = data.band.bias_mw ?? 0;
  return (
    <InsightPanel
      id="bottom-line"
      title={`Bottom line for ${ukDate(data.delivery_date, 'EEEE d MMMM')}`}
    >
      <Insight>
        The forecast issued <Em>{ukTime(run, 'EEE HH:mm')}</Em> expects{' '}
        <Em>{gwh(summary.energyMwh)}</Em> of wind, averaging <Em>{gw(summary.meanMw)}</Em> and{' '}
        {TREND_TEXT[summary.trend]} through the day ({gw(summary.startMw)} at{' '}
        {ukTime(data.points[0]?.start_time)}, {gw(summary.endMw)} by{' '}
        {ukTime(data.points.at(-1)?.start_time)}).
      </Insight>
      <Insight>
        Going by how January’s forecasts performed, the actual total will most likely land in{' '}
        <Em>{gwhRange(summary.lowMwh, summary.highMwh)}</Em>.
      </Insight>
      {summary.biased && (
        <Insight tone="warn">
          Forecasts have run <Em>{gw(Math.abs(bias))}</Em> too {bias > 0 ? 'high' : 'low'} on
          average this month, so expect {bias > 0 ? 'less' : 'more'} wind than shown here.
        </Insight>
      )}
      <Insight>
        To be covered in 19 hours out of 20, hold up to <Em>{gw(data.band.p95_error_mw)}</Em> of
        extra supply in case wind falls short of the forecast.
      </Insight>
    </InsightPanel>
  );
}
