/**
 * apiFetch — a thin wrapper around fetch that automatically injects the
 * Authorization: Bearer <token> header from localStorage (crm_token).
 * Use this instead of raw fetch() for all API calls.
 */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let token = '';
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('crm_token') || '';
  }

  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // Preserve Content-Type if already set, otherwise don't override (important for file uploads)
  return fetch(input, { ...init, headers }).then(res => {
    if (res.status === 401) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        document.cookie = 'crm_token=; path=/; max-age=0';
        window.location.href = '/login';
      }
    }
    return res;
  });
}

/**
 * Error thrown by apiJson when the request fails. Carries the HTTP status so
 * callers can branch (e.g. 404 vs 500). Message is always human-readable —
 * never a JSON.parse SyntaxError.
 */
export class ApiError extends Error {
  status: number;
  url: string;
  constructor(status: number, message: string, url: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

/**
 * apiJson — apiFetch + safe JSON parsing. Use this instead of
 * `apiFetch(...).then(r => r.json())`.
 *
 * Why: when the backend (or the Next.js rewrite proxy in front of it) fails
 * hard, the response body is plain text like "Internal Server Error" — a bare
 * `res.json()` then throws `Unexpected token 'I'... is not valid JSON`, which
 * hides the real problem. This helper converts that into an ApiError with the
 * status and a readable message. Success payloads (including `{success:false}`
 * bodies on 200) resolve exactly as before, so existing branching is untouched.
 */
export async function apiJson<T = any>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const text = await res.text();
  if (!text) {
    if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`, url);
    return null as T;
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      res.status,
      res.ok
        ? 'Invalid response from server'
        : `Request failed (${res.status}): ${text.slice(0, 160)}`,
      url,
    );
  }
  if (!res.ok) {
    const raw = data?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, Array.isArray(raw) ? raw.join(', ') : String(raw), url);
  }
  return data as T;
}
