/**
 * VM3 API Client — fetch ke backend AC (default http://localhost:3010).
 * Session auth via cookie HttpOnly (otomatis dikirim browser).
 * - Mode mock: bila NEXT_PUBLIC_MOCK=1, semua request dilayani data demo
 *   (lihat lib/mock-api.ts) — tidak ada fetch ke backend.
 */
import { MOCK_ENABLED, mockRequest } from "./mock-api";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** gunakan header kustom per endpoint (mis. idregist) */
  extraHeaders?: Record<string, string>;
  /** batalkan request (mis. saat pencarian baru menggantikan yang lama) */
  signal?: AbortSignal;
}

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, headers, extraHeaders, signal }: ApiOptions = {},
): Promise<T> {
  // Mode mock — semua fitur dilayani data demo tanpa menyentuh backend
  if (MOCK_ENABLED) {
    const mergedHeaders = { ...extraHeaders, ...headers };
    const mocked = mockRequest(path, method, body, mergedHeaders);
    if (mocked !== undefined) return mocked as T;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      message = data?.error ?? data?.message ?? message;
    } catch {
      /* body bukan JSON */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string, opts?: ApiOptions) => api<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    api<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    api<T>(path, { ...opts, method: "PUT", body }),
  del: <T>(path: string, opts?: ApiOptions) => api<T>(path, { ...opts, method: "DELETE" }),
};