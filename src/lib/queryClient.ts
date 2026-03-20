import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance with production-grade defaults.
 *
 * Strategy:
 *  - staleTime  5 min  → data is considered fresh for 5 minutes; no refetch.
 *  - gcTime    10 min  → unused queries stay in memory for 10 minutes.
 *  - retry      2      → retry failed requests twice with exponential back-off.
 *  - refetchOnWindowFocus → keeps dashboards up-to-date when the user returns.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: "always",
    },
    mutations: {
      retry: 1,
    },
  },
});
