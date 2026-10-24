import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { router } from './router';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Historical data is immutable, so cached results never go stale.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        // Client errors (4xx) won't succeed on retry.
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
