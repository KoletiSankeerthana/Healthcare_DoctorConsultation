/**
 * Centralized API Client for MediVerse Healthcare Platform
 * Connects frontend components to FastAPI backend services with standardized error handling.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8000");

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
  ok: boolean;
}

export class ApiConnectionError extends Error {
  constructor(message: string = "Unable to connect to the healthcare service. Please check your connection and try again.") {
    super(message);
    this.name = "ApiConnectionError";
  }
}

/**
 * Standardized fetch wrapper with timeout and connection error handling
 */
export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<ApiResponse<T>> {
  const { timeoutMs = 12000, ...fetchOptions } = options;

  // Resolve absolute or relative URL
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(fetchOptions.headers || {})
      }
    });

    clearTimeout(timeoutId);

    let data: any = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const errorMessage =
        (data && (data.error || data.detail || data.message)) ||
        `Request failed with status ${res.status}`;
      return {
        data: null,
        error: typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage),
        status: res.status,
        ok: false
      };
    }

    return {
      data: data as T,
      error: null,
      status: res.status,
      ok: true
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      return {
        data: null,
        error: "Connection timed out. The healthcare service is taking longer than expected to respond.",
        status: 408,
        ok: false
      };
    }

    return {
      data: null,
      error: "Unable to connect to the healthcare service. Please check your connection and try again.",
      status: 0,
      ok: false
    };
  }
}

export const api = {
  get: <T = any>(url: string, opts?: RequestInit) => apiClient<T>(url, { ...opts, method: "GET" }),
  post: <T = any>(url: string, body?: any, opts?: RequestInit) =>
    apiClient<T>(url, {
      ...opts,
      method: "POST",
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined
    }),
  put: <T = any>(url: string, body?: any, opts?: RequestInit) =>
    apiClient<T>(url, {
      ...opts,
      method: "PUT",
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined
    }),
  delete: <T = any>(url: string, opts?: RequestInit) => apiClient<T>(url, { ...opts, method: "DELETE" })
};

export default api;
