import type { DayAhead } from '@/api/types';
import { mw, signedMw, ukTime } from '@/lib/format';

/** Table view of the chart: one row per delivery hour. */
export function HourlyTable({ data, showActuals }: { data: DayAhead; showActuals: boolean }) {
  return (
    <div className="max-h-[340px] overflow-auto rounded-lg border border-slate-200">
      <table className="tabular w-full text-sm">
        <caption className="sr-only">Hourly wind forecast with likely range</caption>
        <thead className="sticky top-0 bg-slate-50 text-left text-xs text-ink-soft">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Hour (UK)
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Forecast
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Likely range
            </th>
            {showActuals && (
              <>
                <th scope="col" className="px-3 py-2 font-medium">
                  Actual
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Forecast − actual
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.points.map((p) => (
            <tr key={p.start_time} className="hover:bg-slate-50">
              <td className="px-3 py-1.5">{ukTime(p.start_time)}</td>
              <td className="px-3 py-1.5 font-medium text-ink">{mw(p.forecast_mw)}</td>
              <td className="px-3 py-1.5 text-ink-soft">
                {p.band_low_mw != null && p.band_high_mw != null
                  ? `${mw(p.band_low_mw)} – ${mw(p.band_high_mw)}`
                  : '—'}
              </td>
              {showActuals && (
                <>
                  <td className="px-3 py-1.5">{mw(p.actual_mw)}</td>
                  <td
                    className={`px-3 py-1.5 ${(p.error_mw ?? 0) > 0 ? 'text-red-700' : 'text-ink-soft'}`}
                  >
                    {signedMw(p.error_mw)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
