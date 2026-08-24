/**
 * VM3 API Client — fetch ke backend AC (default http://localhost:3010).
 * - accessToken di memory (module singleton)
 * - refresh otomatis saat 401 (refreshToken dari localStorage)
 * - error terstruktur
 * - mode mock: bila NEXT_PUBLIC_MOCK=1, semua request dilayani data demo
 *   (lihat lib/mock-api.ts) — tidak ada fetch ke backend.
 */
import { MOCK_ENABLED, mockRefresh, mockRequest } from "./mock-api";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;

const REFRESH_KEY = "vm3-refresh-token";

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access: string | null, refresh: string | null) {
  setAccessToken(access);
  if (typeof window === "undefined") return;
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  else window.localStorage.removeItem(REFRESH_KEY);
}
export function clearTokens() {
  setAccessToken(null);
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REFRESH_KEY);
}

export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  if (MOCK_ENABLED) return mockRefresh(refresh);
  const res = await fetch(`${API_URL}/login/refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.accessToken) {
    setAccessToken(data.accessToken);
    return data.accessToken;
  }
  return null;
}

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
  auth?: boolean;
  /** batalkan request (mis. saat pencarian baru menggantikan yang lama) */
  signal?: AbortSignal;
}

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, headers, extraHeaders, auth = true, signal }: ApiOptions = {},
): Promise<T> {
  // Mode mock — semua fitur dilayani data demo tanpa menyentuh backend
  if (MOCK_ENABLED) {
    const mergedHeaders = { ...extraHeaders, ...headers };
    const mocked = mockRequest(path, method, body, mergedHeaders);
    if (mocked !== undefined) return mocked as T;
  }

  const doFetch = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal,
    });

  const token = auth ? getAccessToken() : null;
  let res = await doFetch(token);

  // 401 → coba refresh sekali
  if (res.status === 401 && auth && !path.startsWith("/login")) {
    if (!refreshing) refreshing = refreshAccessToken().finally(() => { refreshing = null; });
    const newToken = await refreshing;
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

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
