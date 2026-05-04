import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton React Query client.
 *
 * Lives in its own module so non-React code (cross-page integration
 * helpers, window-event handlers) can call `queryClient.invalidateQueries`
 * directly. Without this, invalidation would have to flow through a
 * mounted component via `useQueryClient()`, which doesn't work for fire-
 * and-forget side-doors triggered from arbitrary pages.
 *
 * Defaults match the previous inline config at `App.tsx`:
 *   - retry: 1 on queries, 0 on mutations
 *   - staleTime: 30s
 *   - refetchOnWindowFocus: true
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
