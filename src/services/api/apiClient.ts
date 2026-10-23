import { logApiRequest } from './apiLogger';

export const BASE_API_URL = 'https://api.deadlock-api.com/v1';

export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
  };
  try {
    const customKey =
      localStorage.getItem('deadlock_api_key') ||
      (import.meta as any).env?.VITE_DEADLOCK_API_KEY;
    if (customKey && typeof customKey === 'string' && customKey.trim()) {
      headers['X-API-KEY'] = customKey.trim();
    }
  } catch {
    // Ignore storage errors
  }
  return headers;
}

export async function apiFetch(
  url: string,
  init?: RequestInit,
  customSummary?: string
): Promise<Response> {
  const start = performance.now();
  const method = init?.method || 'GET';
  const endpoint = url.startsWith(BASE_API_URL) ? url.slice(BASE_API_URL.length) : url;

  try {
    const res = await fetch(url, init);
    const durationMs = Math.round(performance.now() - start);

    let summary = customSummary || `HTTP ${res.status}`;
    if (res.status === 200) {
      summary = customSummary || 'OK (200)';
    } else if (res.status === 429) {
      summary = 'Rate Limited (429)';
    } else if (res.status === 404) {
      summary = 'Not Found (404)';
    } else if (res.status === 503) {
      summary = 'Steam Unavailable (503)';
    }

    logApiRequest({
      method,
      url,
      endpoint,
      status: res.status,
      statusText: res.statusText || String(res.status),
      durationMs,
      success: res.ok,
      summary,
      error: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
    });

    return res;
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    logApiRequest({
      method,
      url,
      endpoint,
      status: 0,
      statusText: 'Network Error',
      durationMs,
      success: false,
      summary: 'Connection Error',
      error: err?.message || String(err),
    });
    throw err;
  }
}
