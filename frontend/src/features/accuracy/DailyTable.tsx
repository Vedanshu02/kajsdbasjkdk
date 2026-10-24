import { useMemo, useState } from 'react';
import type { DailyRow } from '@/api/types';
import { mw, signedMw, ukDate } from '@/lib/format';
import { toCsv, downloadText } from './csv';

type SortKey = 'date' | 'mae_mw' | 'bias_mw' | 'p90_abs_mw' | 'max_abs_mw' | 'mean_actual_mw';

const COLUMNS: { key: SortKey; label: string; fmt: (r: DailyRow) => string }[] = [
  { key: 'date', label: 'Delivery day', fmt: (r) => ukDate(r.date, 'EEE d MMM') },
  { key: 'mean_actual_mw', label: 'Average wind', fmt: (r) => mw(r.mean_actual_mw) },
  { key: 'mae_mw', label: 'Typical miss', fmt: (r) => mw(r.mae_mw) },
  { key: 'bias_mw', label: 'Too high (+) / low (−)', fmt: (r) => signedMw(r.bias_mw) },
  { key: 'p90_abs_mw', label: '9 in 10 hours within', fmt: (r) => mw(r.p90_abs_mw) },
  { key: 'max_abs_mw', label: 'Worst hour', fmt: (r) => mw(r.max_abs_mw) },
];

export function DailyTable({ rows }: { rows: DailyRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: 1 });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort.key] ?? -Infinity;
      const bv = b[sort.key] ?? -Infinity;
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
    return copy;
  }, [rows, sort]);

  const exportCsv = () =>
    downloadText(
      'daily-forecast-accuracy.csv',
      toCsv(rows, [
        'date',
        'count',
        'mean_actual_mw',
        'mean_forecast_mw',
        'mae_mw',
        'rmse_mw',
        'bias_mw',
        'p90_abs_mw',
        'max_abs_mw',
      ]),
    );

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm hover:bg-slate-50"
        >
          Export CSV
        </button>
      </div>
      <div className="max-h-[380px] overflow-auto rounded-lg border border-slate-200">
        <table className="tabular w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-ink-soft">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="px-3 py-2 font-medium"
                  aria-sort={
                    sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-ink"
                    onClick={() =>
                      setSort((s) => ({
                        key: c.key,
                        dir: s.key === c.key ? (-s.dir as 1 | -1) : 1,
                      }))
                    }
                  >
                    {c.label}
                    <span aria-hidden className="text-[10px]">
                      {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r) => (
              <tr key={r.date} className="hover:bg-slate-50">
                {COLUMNS.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-3 py-1.5">
                    {c.fmt(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
