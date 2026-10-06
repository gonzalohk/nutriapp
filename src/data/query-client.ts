import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // The cache is also persisted for offline reading (see query-persist.ts).
      gcTime: 1000 * 60 * 60 * 24 * 7,
    },
  },
})
