/**
 * Admin auth helper. The admin app and the muusic API share a session
 * cookie scoped to `.muusic.live` (set via COOKIE_DOMAIN on the muusic
 * server), so a cross-origin fetch with `credentials: 'include'` carries
 * the cookie automatically.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export interface MuusicUser {
  id: string;
  email: string;
  name: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
}

export interface AuthCheckResult {
  user: MuusicUser | null;
  status: 'authenticated' | 'unauthenticated' | 'forbidden' | 'unreachable';
}

/**
 * Calls the muusic /api/auth/me endpoint. Returns:
 *   - { user, status: 'authenticated' }   when role === 'admin'
 *   - { user, status: 'forbidden' }       when authed but not admin
 *   - { user: null, status: 'unauthenticated' }   no/expired cookie
 *   - { user: null, status: 'unreachable' }       network error
 */
export async function checkAdminAuth(): Promise<AuthCheckResult> {
  if (!API_BASE) {
    // Mock mode (no real API configured) — pretend admin so the UI works
    // for designers running the admin standalone.
    return {
      user: {
        id: 'mock',
        email: 'mock@muusic.live',
        name: 'Mock Admin',
        city: null,
        country: null,
        countryCode: null,
        lat: null,
        lng: null,
        avatarUrl: null,
        role: 'admin',
      },
      status: 'authenticated',
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
    });
    if (res.status === 401) return { user: null, status: 'unauthenticated' };
    if (!res.ok) return { user: null, status: 'unreachable' };

    const data = (await res.json()) as { user: MuusicUser };
    if (data.user.role !== 'admin') return { user: data.user, status: 'forbidden' };
    return { user: data.user, status: 'authenticated' };
  } catch {
    return { user: null, status: 'unreachable' };
  }
}

export const muusicAppUrl = (path = '/') => {
  const base = API_BASE || '';
  return `${base}${path}`;
};

/**
 * POST /api/auth/logout — destroys the session cookie on the muusic
 * backend. The cookie is scoped to `.muusic.live` so this drops auth
 * across every subdomain at once.
 *
 * Resolves with `true` on success, `false` on transport failure — the
 * caller decides whether to retry or fall back to a local-only sign-out
 * (e.g. force-reload to surface the AdminAuthGate sign-in card).
 */
export async function logout(): Promise<boolean> {
  if (!API_BASE) {
    // Mock mode — nothing to invalidate on the server. Pretend success
    // so the UI can still re-render the sign-in card.
    return true;
  }
  try {
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}
