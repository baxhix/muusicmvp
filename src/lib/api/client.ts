/**
 * Browser-side API client for muusic. Sends cookies on every request so the
 * session set by /api/auth/verify is automatically attached.
 *
 * Same-origin in production (the Next app + API live at the same host), so
 * the default `credentials: 'include'` is enough — no CORS gymnastics.
 */

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : `HTTP ${status}`);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (res.status === 204) return undefined as T;

  let data: unknown;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const api = {
  get:    <T>(path: string)              => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)              => request<T>('DELETE', path),
};
