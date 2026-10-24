import { useMemo } from 'react';
import { useMeta } from '@/api/queries';
import {
  Card,
  DateInput,
  ErrorState,
  Field,
  KpiTile,
  LoadingBlock,
  Segmented,
  Select,
  Toggle,
} from '@/components/ui';
import { addDays, clampDate } from '@/lib/dates';
import { gw, gwh, gwhRange, hours, mw, ukDate, ukTime } from '@/lib/format';
import { parse, useUrlState } from '@/lib/useUrlState';
import { BottomLine } from './BottomLine';
import { buildChartRows } from './buildChartRows';
import { DayAheadChart, DayAheadLegend } from './DayAheadChart';
import { HourlyTable } from './HourlyTable';
import { summarizeDay } from './summary';
import { useDayAhead } from './useDayAhead';

const CUTOFF_OPTIONS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00'].map((v) => ({
  value: v,
  label: `${v} the day before`,
}));

const VIEWS = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
] as const;

const PARSERS = {
  date: parse.date('2026-01-15'),
  cutoff: parse.time('09:00'),
  actuals: parse.bool(false),
  view: parse.oneOf(['chart', 'table'] as const, 'chart'),
};

export function DayAheadPage() {
  const meta = useMeta();
  const [state, setState] = useUrlState(PARSERS);
  const min = meta.data?.delivery_start ?? '2026-01-02';
  const max = meta.data?.delivery_end ?? '2026-02-01';
  const date = clampDate(state.date, min, max);
  const query = useDayAhead(date, state.cutoff);
  const data = query.data;
  const rows = useMemo(() => (data ? buildChartRows(data) : []), [data]);
  const summary = useMemo(() => (data ? summarizeDay(data) : null), [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">How much wind can we count on?</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Pick the day you are buying power for. We show the wind forecast you would have had when
            bids were due, and how far off it is likely to be.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Day you're buying for">
            <div className="flex items-center gap-1">
              <StepButton
                label="Previous day"
                disabled={date <= min}
                onClick={() => setState({ date: addDays(date, -1) })}
              >
                ‹
              </StepButton>
              <DateInput
                aria-label="Delivery day"
                value={date}
                min={min}
                max={max}
                onChange={(v) => setState({ date: clampDate(v, min, max) })}
              />
              <StepButton
                label="Next day"
                disabled={date >= max}
                onClick={() => setState({ date: addDays(date, 1) })}
              >
                ›
              </StepButton>
            </div>
          </Field>
          <Field label="Bids due by (UK time)">
            <Select
              aria-label="Decision cutoff"
              value={state.cutoff}
              options={CUTOFF_OPTIONS}
              onChange={(v) => setState({ cutoff: v })}
            />
          </Field>
        </div>
      </div>

      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {!data && query.isPending && (
        <>
          <LoadingBlock className="h-[150px]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <LoadingBlock key={i} className="h-[104px]" />
            ))}
          </div>
        </>
      )}

      {data && summary && (
        <>
          <BottomLine data={data} summary={summary} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label="Expected wind energy"
              value={gwh(summary.energyMwh)}
              hint={`averaging ${gw(summary.meanMw)}`}
              info="Total of the hourly forecast for the delivery day (MW × 1 h)."
            />
            <KpiTile
              label="Likely range"
              value={gwhRange(summary.lowMwh, summary.highMwh)}
              hint="based on January’s forecast misses"
              info="Each hour's forecast adjusted by the 5th and 95th percentiles of January's day-ahead forecast errors, then added up over the day."
            />
            <KpiTile
              tone="accent"
              label="Shortfall cover"
              value={mw(data.band.p95_error_mw)}
              hint="covers 19 in 20 hours"
              info="95th percentile of (forecast − actual) for day-ahead forecasts in January. In 95% of hours, wind fell short of the forecast by no more than this."
            />
            <KpiTile
              label="Forecast issued"
              value={run(data)}
              hint={`${hours(data.forecast.min_horizon_h)}–${hours(data.forecast.max_horizon_h)} before delivery`}
              info="The most recent Elexon WINDFOR forecast published before your bidding cutoff. Forecasts published later are never used."
            />
          </div>

          <Card
            title={`Hour by hour: ${ukDate(data.delivery_date, 'EEE d MMM')}`}
            subtitle={
              <>
                Orange line is the forecast. Actual wind lands inside the shaded band 9 times in 10.
                Bids due {ukTime(data.cutoff_utc, 'EEE d MMM HH:mm')}.
              </>
            }
            actions={
              <div className="flex flex-wrap items-center gap-4">
                <Toggle
                  checked={state.actuals}
                  onChange={(v) => setState({ actuals: v })}
                  label="Compare with what happened"
                />
                <Segmented
                  label="View as"
                  value={state.view}
                  options={[...VIEWS]}
                  onChange={(v) => setState({ view: v })}
                />
              </div>
            }
          >
            <div className={`transition-opacity ${query.isFetching ? 'opacity-60' : ''}`}>
              {state.view === 'chart' ? (
                <>
                  <DayAheadLegend showActuals={state.actuals} />
                  <div className="mt-3">
                    <DayAheadChart rows={rows} showActuals={state.actuals} />
                  </div>
                </>
              ) : (
                <HourlyTable data={data} showActuals={state.actuals} />
              )}
            </div>
          </Card>

          {state.actuals && <Hindsight data={data} />}
        </>
      )}
    </div>
  );
}

function run(data: { forecast: { runs_used: string[] } }) {
  const last = data.forecast.runs_used.at(-1);
  return last ? ukTime(last, 'EEE HH:mm') : '—';
}

function Hindsight({ data }: { data: NonNullable<ReturnType<typeof useDayAhead>['data']> }) {
  const h = data.hindsight;
  const bias = h.bias_mw ?? 0;
  return (
    <Card
      title="How the forecast did on this day"
      subtitle="Hindsight: the forecast above compared with metered wind output"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Typical miss"
          value={mw(h.mae_mw)}
          info="Mean absolute error: the average gap between forecast and actual, in either direction."
        />
        <KpiTile
          label={bias > 0 ? 'Forecast too high by' : 'Forecast too low by'}
          value={mw(Math.abs(bias))}
          hint={
            bias > 0
              ? 'on average: you would have been short'
              : 'on average: you would have been long'
          }
          info="Bias: average of forecast − actual."
        />
        <KpiTile label="Worst hour" value={mw(h.max_abs_mw)} hint="largest single miss" />
        <KpiTile
          label="Average wind"
          value={`${gw(h.mean_actual_mw)} actual`}
          hint={`vs ${gw(h.mean_forecast_mw)} forecast`}
        />
      </div>
    </Card>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-9 w-8 rounded-lg border border-slate-300 bg-white text-lg leading-none text-ink-soft shadow-sm hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}
