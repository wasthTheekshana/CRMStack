/**
 * API client — uses relative paths so requests go through the nginx proxy (production)
 * or the Vite dev proxy (development). Cookies are sent automatically via credentials: 'include'.
 */

// Empty string = relative paths. Vite proxy / nginx proxy handles routing to backend.
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class TrialExpiredError extends Error {
  constructor() {
    super('TRIAL_EXPIRED')
    this.name = 'TrialExpiredError'
  }
}

/**
 * Central fetch wrapper — sends httpOnly cookie automatically (M7).
 * No Authorization header needed; the cookie is set by the server on login.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // M7: send httpOnly cookie on every request
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 402) {
    throw new TrialExpiredError()
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
