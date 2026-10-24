import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export function useDayAhead(deliveryDate: string, cutoffTime: string) {
  return useQuery({
    queryKey: ['day-ahead', deliveryDate, cutoffTime],
    queryFn: ({ signal }) =>
      apiGet(
        '/api/v1/day-ahead',
        { delivery_date: deliveryDate, cutoff_time: cutoffTime },
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}
