import { Em, Insight, InsightPanel } from '@/components/ui';
import { gw, pct } from '@/lib/format';
import { listHours, type Takeaways } from './takeaways';

/** The accuracy numbers in plain sentences, so nobody has to decode a metric to act on it. */
export function TakeawaysCard({ t, scope }: { t: Takeaways; scope: string }) {
  const high = (t.biasMw ?? 0) > 0;
  return (
    <InsightPanel id="takeaways" title={`What this means · ${scope}`}>
      <Insight>
        In a typical hour the forecast is off by <Em>{gw(t.typicalMissMw)}</Em> (
        {pct(t.typicalMissPct)} of average wind output). In 9 hours out of 10 it is off by less than{' '}
        <Em>{gw(t.p90Mw)}</Em>.
      </Insight>
      {t.biasMw != null &&
        (t.mostlySystematic ? (
          <Insight tone="warn">
            Most of that miss runs one way: the forecast was{' '}
            <Em>
              {gw(Math.abs(t.biasMw))} too {high ? 'high' : 'low'}
            </Em>{' '}
            on average, so buyers relying on it would usually have been {high ? 'short' : 'long'}.
            Adjusting for this before bidding removes a large part of the error.
          </Insight>
        ) : (
          <Insight>
            The forecast leans slightly {high ? 'high' : 'low'} (<Em>{gw(Math.abs(t.biasMw))}</Em>{' '}
            on average). Most of the miss is random, not systematic.
          </Insight>
        ))}
      {t.shortMw != null && (
        <Insight>
          To be covered in 19 hours out of 20, hold up to <Em>{gw(t.shortMw)}</Em> of extra supply
          in case wind falls short of the forecast.
        </Insight>
      )}
      {t.nearMae != null && t.farMae != null && (
        <Insight>
          {t.farMae > t.nearMae * 1.05
            ? 'More notice means less accuracy: the typical miss grows from '
            : 'In this period, notice made little difference: the typical miss was '}
          <Em>{gw(t.nearMae)}</Em> with {t.nearH} h notice{' '}
          {t.farMae > t.nearMae * 1.05 ? 'to' : 'versus'} <Em>{gw(t.farMae)}</Em> with {t.farH} h
          notice.
        </Insight>
      )}
      {t.worstHours.length > 0 && (
        <Insight>
          The hardest hours to forecast were <Em>{listHours(t.worstHours)}</Em> UK time.
        </Insight>
      )}
    </InsightPanel>
  );
}
