import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';

/** Window, defaults and provenance; effectively static, so cache forever. */
export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => apiGet('/api/v1/meta', undefined, { signal }),
    staleTime: Infinity,
  });
}
