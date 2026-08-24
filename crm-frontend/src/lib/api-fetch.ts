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
        window.location.href = '/login';
      }
    }
    return res;
  });
}
