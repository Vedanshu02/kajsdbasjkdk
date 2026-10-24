import { useMemo, type ReactNode } from 'react';
import { useMeta } from '@/api/queries';
import type { Mode, SelectionQuery } from '@/api/types';
import {
  Card,
  DateInput,
  EmptyState,
  ErrorState,
  Field,
  KpiTile,
  LoadingBlock,
  Segmented,
  Select,
} from '@/components/ui';
import { chart } from '@/lib/chartTheme';
import { clampDate } from '@/lib/dates';
import { mw, pct, ukDate } from '@/lib/format';
import { parse, useUrlState } from '@/lib/useUrlState';
import { ErrorHistogram, HorizonChart, HourChart, Legend, SeriesChart } from './charts';
import { DailyTable } from './DailyTable';
import { datePresets } from './presets';
import { deriveTakeaways } from './takeaways';
import { TakeawaysCard } from './TakeawaysCard';
import { useAccuracy, useHorizonCurve } from './useAccuracy';

const MODES: { value: Mode; label: string }[] = [
  { value: 'day_ahead', label: 'When bids were due' },
  { value: 'horizon', label: 'By hours of notice' },
];

const CUTOFFS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00'].map((v) => ({
  value: v,
  label: `${v} the day before`,
}));

const PARSERS = {
  start: parse.date('2026-01-02'),
  end: parse.date('2026-02-01'),
  mode: parse.oneOf(['day_ahead', 'horizon'] as const, 'day_ahead'),
  cutoff: parse.time('09:00'),
  h: parse.int(24, 1, 48),
};

/** Lead times a D-1 cutoff implies for delivery hours 00:00..23:00 on D. */
function dayAheadLeadRange(cutoff: string): [number, number] {
  const [hh = 9, mm = 0] = cutoff.split(':').map(Number);
  const c = hh + mm / 60;
  return [24 - c, 47 - c];
}

export function AccuracyPage() {
  const meta = useMeta();
  const [state, setState] = useUrlState(PARSERS);
  const min = meta.data?.delivery_start ?? '2026-01-02';
  const max = meta.data?.delivery_end ?? '2026-02-01';
  const start = clampDate(state.start, min, max);
  const end = clampDate(state.end < start ? start : state.end, min, max);
  const presets = useMemo(() => datePresets(min, max), [min, max]);

  const sel: SelectionQuery = {
    start,
    end,
    mode: state.mode,
    cutoff_time: state.cutoff,
    horizon_h: state.h,
  };
  const { summary, byHour, daily, distribution, series } = useAccuracy(sel);
  const horizon = useHorizonCurve(start, end);
  const s = summary.data;
  const takeaways = useMemo(
    () => (s ? deriveTakeaways(s, horizon.data, byHour.data) : null),
    [s, horizon.data, byHour.data],
  );

  const modeSentence =
    state.mode === 'day_ahead' ? (
      <>
        Scoring the forecast you would have had at <strong>{state.cutoff} the day before</strong>{' '}
        each delivery day: exactly what the desk bid on.
      </>
    ) : (
      <>
        Scoring the latest forecast issued <strong>at least {state.h} hours</strong> before each
        hour, to see how accuracy depends on notice.
      </>
    );
  const scope = `${ukDate(start, 'd MMM')} – ${ukDate(end, 'd MMM yyyy')}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          How reliable is the wind forecast?
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          We compare each forecast with the wind that was actually generated, so you can size your
          buffer from the forecast’s real track record.
        </p>
      </div>

      {/* Filters: one panel, above everything they control. */}
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date presets">
          {presets.map((p) => {
            const active = p.start === start && p.end === end;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => setState({ start: p.start, end: p.end })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 bg-white text-ink-soft hover:border-slate-400 hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <DateInput
              aria-label="From"
              value={start}
              min={min}
              max={max}
              onChange={(v) => setState({ start: v })}
            />
          </Field>
          <Field label="To">
            <DateInput
              aria-label="To"
              value={end}
              min={start}
              max={max}
              onChange={(v) => setState({ end: v })}
            />
          </Field>
          <Field label="Which forecast to score">
            <Segmented
              label="Forecast selection mode"
              value={state.mode}
              options={MODES}
              onChange={(v) => setState({ mode: v })}
            />
          </Field>
          {state.mode === 'day_ahead' ? (
            <Field label="Bids due by (UK time)">
              <Select
                aria-label="Decision cutoff"
                value={state.cutoff}
                options={CUTOFFS}
                onChange={(v) => setState({ cutoff: v })}
              />
            </Field>
          ) : (
            <Field label={`Hours of notice: ${state.h} h`}>
              <input
                type="range"
                aria-label="Hours of notice"
                min={1}
                max={48}
                value={state.h}
                onChange={(e) => setState({ h: Number(e.target.value) })}
                className="h-9 w-48 accent-brand-600"
              />
            </Field>
          )}
        </div>
        <p className="text-xs text-ink-soft">{modeSentence}</p>
      </div>

      {summary.isError && <ErrorState error={summary.error} onRetry={() => summary.refetch()} />}

      {takeaways ? (
        <TakeawaysCard t={takeaways} scope={scope} />
      ) : (
        !summary.isError && <LoadingBlock className="h-[180px]" />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {s ? (
          <>
            <KpiTile
              tone="accent"
              label="Typical miss"
              value={mw(s.mae_mw)}
              hint={`${pct(s.nmae_pct)} of average wind output`}
              info={`Mean absolute error (MAE): the average gap between forecast and actual, in either direction. RMSE, which weights big misses more: ${mw(s.rmse_mw)}.`}
            />
            <KpiTile
              label="9 in 10 hours within"
              value={mw(s.p90_abs_mw)}
              hint="either direction"
              info="90th percentile of |forecast − actual|. Only 1 hour in 10 misses by more than this."
            />
            <KpiTile
              label={(s.bias_mw ?? 0) > 0 ? 'Forecast runs high by' : 'Forecast runs low by'}
              value={mw(Math.abs(s.bias_mw ?? 0))}
              hint={
                (s.bias_mw ?? 0) > 0
                  ? 'on average: buyers end up short'
                  : 'on average: buyers end up long'
              }
              info="Bias: the average of forecast − actual. A consistent bias is systematic and can be corrected before bidding."
            />
            <KpiTile
              label="Shortfall cover"
              value={mw(s.p95_error_mw)}
              hint={`covers 19 in 20 hours · ${s.count} hours scored`}
              info="95th percentile of (forecast − actual). In 95% of hours, wind fell short of the forecast by no more than this."
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <LoadingBlock key={i} className="h-[104px]" />)
        )}
      </div>

      <Card
        title="The further ahead, the bigger the miss"
        subtitle="How far off forecasts were, depending on how many hours before delivery they were issued."
      >
        <Legend
          items={[
            { label: 'Typical miss', color: chart.actual },
            { label: '9 in 10 hours within', color: chart.forecast, dashed: true },
          ]}
        />
        <Async q={horizon} className="h-[280px]">
          {(rows) => (
            <HorizonChart
              rows={rows}
              dayAheadRange={state.mode === 'day_ahead' ? dayAheadLeadRange(state.cutoff) : null}
              selectedHorizon={state.mode === 'horizon' ? state.h : null}
            />
          )}
        </Async>
      </Card>

      <Card
        title="Forecast vs actual wind"
        subtitle="Where the orange line sits above the blue one, the forecast promised more wind than arrived."
      >
        <Legend
          items={[
            { label: 'Actual wind', color: chart.actual },
            { label: 'Forecast', color: chart.forecast },
          ]}
        />
        <Async q={series} className="h-[300px]">
          {(data) => <SeriesChart data={data} />}
        </Async>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Which hours are hardest to forecast"
          subtitle="Typical miss by hour of day (UK time). The three worst hours are highlighted."
        >
          <Async q={byHour} className="h-[240px]">
            {(rows) => <HourChart rows={rows} highlight={takeaways?.worstHours} />}
          </Async>
        </Card>
        <Card
          title="Which way the forecast misses"
          subtitle={
            <>
              Number of hours by size of miss. <span style={{ color: chart.over }}>■</span> Right of
              the line: less wind than forecast (you’re short).{' '}
              <span style={{ color: chart.under }}>■</span> Left: more wind than forecast (you’re
              long).
            </>
          }
        >
          <Async q={distribution} className="h-[240px]">
            {(hist) =>
              hist.counts.length ? <ErrorHistogram hist={hist} /> : <EmptyState message="No data" />
            }
          </Async>
        </Card>
      </div>

      <Card
        title="Day by day"
        subtitle="Click a column to sort, e.g. to find the days the forecast missed most."
      >
        <Async q={daily} className="h-[300px]">
          {(rows) => <DailyTable rows={rows} />}
        </Async>
      </Card>
    </div>
  );
}

interface AsyncProps<T> {
  q: {
    data: T | undefined;
    isError: boolean;
    error: unknown;
    isFetching: boolean;
    refetch: () => unknown;
  };
  className: string;
  children: (data: T) => ReactNode;
}

/** Loading / error / data switch for one query, with a fade while refetching. */
function Async<T>({ q, className, children }: AsyncProps<T>) {
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data === undefined) return <LoadingBlock className={className} />;
  return (
    <div className={`mt-3 transition-opacity ${q.isFetching ? 'opacity-60' : ''}`}>
      {children(q.data)}
    </div>
  );
}
