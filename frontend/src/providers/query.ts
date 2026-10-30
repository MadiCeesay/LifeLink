import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../services/client";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000,
      gcTime: 300000,
      retry: (count, error) =>
        !(
          error instanceof ApiError &&
          [400, 401, 403, 404].includes(error.status)
        ) && count < 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false, gcTime: 0 },
  },
});
