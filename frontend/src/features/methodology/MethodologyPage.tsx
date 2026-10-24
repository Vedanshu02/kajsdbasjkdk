import type { ReactNode } from 'react';
import { useMeta } from '@/api/queries';
import { Card } from '@/components/ui';
import { ukTime } from '@/lib/format';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <div className="space-y-3 text-sm leading-relaxed text-ink-soft [&_strong]:text-ink">
        {children}
      </div>
    </Card>
  );
}

export function MethodologyPage() {
  const meta = useMeta();
  const data = meta.data?.data as
    | {
        source?: string;
        fetched_at?: string;
        quality?: Record<string, unknown>;
        files?: Record<string, { rows: number }>;
      }
    | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Methodology</h1>
        <p className="mt-1 text-sm text-ink-soft">
          How the numbers in this portal are produced, and the assumptions behind them.
        </p>
      </div>

      <Section title="Data">
        <p>
          <strong>Actual generation:</strong> Elexon BMRS <code>FUELHH</code>, fuel type{' '}
          <code>WIND</code>. Half-hourly metered (transmission-connected) wind output in MW.
        </p>
        <p>
          <strong>Forecasts:</strong> Elexon BMRS <code>WINDFOR</code>. National wind forecasts at
          hourly resolution, re-issued roughly 8 times a day, each looking up to ~3 days ahead.
          Every forecast row carries the time it was <em>published</em> and the time it is{' '}
          <em>for</em>.
        </p>
        <p>
          <strong>Scope:</strong> purchase decisions made in January 2026, i.e. delivery days 2
          January to 1 February 2026. January is GMT, so UK time equals UTC throughout.
        </p>
      </Section>

      <Section title="Which forecast is used">
        <p>
          For each delivery hour, the portal uses the{' '}
          <strong>most recent forecast published at or before the decision cutoff</strong>, by
          default 09:00 UK time on the day before delivery. Forecasts published later are never
          used, so the numbers reflect exactly what the desk could have known when bidding.
        </p>
        <p>
          The <strong>fixed lead time</strong> mode instead uses the latest forecast published at
          least N hours before each delivery hour. This isolates how accuracy changes with lead
          time.
        </p>
        <p>
          Rows published <em>after</em> the hour they describe are backfill, not forecasts, and are
          excluded.
        </p>
      </Section>

      <Section title="How error is measured">
        <p>
          <strong>Error = forecast − actual</strong>, in MW. Positive error means less wind arrived
          than forecast: the desk is short and must buy more.
        </p>
        <p>
          Forecasts are hourly and actuals half-hourly, so comparisons use on-the-hour periods only.
          No values are interpolated or invented.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>MAE</strong>: average size of the miss. <strong>RMSE</strong> weights large
            misses more.
          </li>
          <li>
            <strong>Bias</strong>: average signed error, the systematic part that can be corrected.
          </li>
          <li>
            <strong>P90 |error|</strong>: 90% of hours miss by less than this.
          </li>
          <li>
            <strong>P5 / P95 signed error</strong>: the asymmetric range used for the planning band.
          </li>
          <li>
            <strong>MAPE</strong> is not headlined. It becomes meaningless when wind output is low.
          </li>
        </ul>
      </Section>

      <Section title="Planning band">
        <p>
          The shaded range on the day-ahead chart is the forecast shifted by the 5th and 95th
          percentiles of historical day-ahead error. In v1 these percentiles are computed over the
          same January window (in-sample). A production version would use a rolling, out-of-sample
          window.
        </p>
      </Section>

      <Section title="Known limitations">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            FUELHH reports metered output after any curtailment (constraint actions), while the
            forecast estimates available wind. Part of the positive bias is likely curtailment, not
            weather forecast error.
          </li>
          <li>Embedded (distribution-connected) wind is outside both datasets.</li>
          <li>One month of winter data: seasonal patterns are not yet captured.</li>
        </ul>
      </Section>

      {data && (
        <Section title="Data provenance">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt>Source</dt>
            <dd className="text-ink">{data.source}</dd>
            {data.fetched_at && (
              <>
                <dt>Fetched</dt>
                <dd className="text-ink">{ukTime(data.fetched_at, 'd MMM yyyy HH:mm')} UK time</dd>
              </>
            )}
            {data.files &&
              Object.entries(data.files).map(([name, f]) => (
                <div key={name} className="contents">
                  <dt>{name}</dt>
                  <dd className="text-ink">{f.rows.toLocaleString('en-GB')} rows</dd>
                </div>
              ))}
          </dl>
        </Section>
      )}
    </div>
  );
}
