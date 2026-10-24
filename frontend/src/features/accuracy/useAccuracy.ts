import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { SelectionQuery } from '@/api/types';

/** All selection-dependent accuracy queries, fetched in parallel. */
export function useAccuracy(sel: SelectionQuery) {
  const key = [sel.start, sel.end, sel.mode, sel.cutoff_time, sel.horizon_h] as const;
  const common = { placeholderData: keepPreviousData } as const;

  const summary = useQuery({
    queryKey: ['metrics', ...key],
    queryFn: ({ signal }) => apiGet('/api/v1/metrics', sel, { signal }),
    ...common,
  });
  const byHour = useQuery({
    queryKey: ['metrics-by-hour', ...key],
    queryFn: ({ signal }) => apiGet('/api/v1/metrics/by-hour', sel, { signal }),
    ...common,
  });
  const daily = useQuery({
    queryKey: ['metrics-daily', ...key],
    queryFn: ({ signal }) => apiGet('/api/v1/metrics/daily', sel, { signal }),
    ...common,
  });
  const distribution = useQuery({
    queryKey: ['metrics-distribution', ...key],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/metrics/distribution', { ...sel, bins: 30 }, { signal }),
    ...common,
  });
  const series = useQuery({
    queryKey: ['series', ...key],
    queryFn: ({ signal }) => apiGet('/api/v1/series', sel, { signal }),
    ...common,
  });

  return { summary, byHour, daily, distribution, series };
}

/** Error-vs-lead-time curve: independent of mode/cutoff, depends only on the date range. */
export function useHorizonCurve(start: string, end: string) {
  return useQuery({
    queryKey: ['metrics-by-horizon', start, end],
    queryFn: ({ signal }) => apiGet('/api/v1/metrics/by-horizon', { start, end }, { signal }),
    placeholderData: keepPreviousData,
  });
}
