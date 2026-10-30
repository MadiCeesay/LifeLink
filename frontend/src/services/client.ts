import { create, isAxiosError } from "axios";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
  ) {
    super(message);
  }
}
let token: string | null = null;
let unauthorized: () => void = () => {};
export const setToken = (value: string | null) => {
  token = value;
};
export const onUnauthorized = (handler: () => void) => {
  unauthorized = handler;
};
export const api = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use((config) => {
  if (!process.env.EXPO_PUBLIC_API_URL)
    throw new ApiError(
      "Set EXPO_PUBLIC_API_URL in frontend/.env, then restart Expo.",
    );
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});
export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const body = error.response?.data?.error;
    const messages: Record<number, string> = {
      401: "Your session has expired. Please sign in again.",
      403: "Your account or facility does not have permission for this action.",
      429: "Too many attempts. Please wait before trying again.",
      503: "The service is temporarily unavailable. Please try again shortly.",
    };
    return new ApiError(
      messages[status] ??
        (status === 400 || status === 409 || status === 404
          ? body?.message
          : undefined) ??
        (error.code === "ECONNABORTED"
          ? "The request timed out. Check your connection and retry."
          : "We could not reach LifeLink. Check your connection and retry."),
      status,
      body?.code,
    );
  }
  return new ApiError("Something went wrong. Please try again.");
}
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const safe = normalizeError(error);
    if (safe.status === 401 && token) {
      token = null;
      unauthorized();
    }
    return Promise.reject(safe);
  },
);
export async function send<T>(
  method: string,
  url: string,
  data?: unknown,
  params?: object,
): Promise<T> {
  const response = await api.request<{ success: true; data: T }>({
    method,
    url,
    data,
    params,
  });
  return response.data.data;
}
