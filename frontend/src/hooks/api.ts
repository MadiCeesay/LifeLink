import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { send } from "../services/client";
export function useResource<T>(url: string, params?: object, enabled = true) {
  return useQuery({
    queryKey: [url, params],
    queryFn: async () => {
      const data = await send<T>("get", url, undefined, params);
      if (url === "/donors/me/location" && data && typeof data === "object")
        return { ...data, currentLocation: null };
      return data;
    },
    enabled,
    refetchInterval: url === "/notifications" ? 30000 : false,
  });
}
export function useAction<T = unknown>() {
  const client = useQueryClient();
  const inFlight = useRef<Promise<T> | null>(null);
  return useMutation({
    mutationFn: ({
      method,
      url,
      body,
    }: {
      method: string;
      url: string;
      body?: unknown;
    }) => {
      if (inFlight.current) return inFlight.current;
      inFlight.current = send<T>(method, url, body).finally(() => {
        inFlight.current = null;
      });
      return inFlight.current;
    },
    onSuccess: async () => {
      await client.invalidateQueries();
    },
  });
}
