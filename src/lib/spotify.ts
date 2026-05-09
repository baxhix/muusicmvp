/**
 * Spotify Web API integration via PKCE (Authorization Code with Proof Key for
 * Code Exchange). Sem backend, sem client_secret — funciona 100% client-side.
 *
 * Fluxo:
 *   1. startSpotifyLogin()    → gera verifier + challenge, redireciona
 *   2. (Spotify volta)        → handleSpotifyCallback(code) troca por tokens
 *   3. getCurrentlyPlaying()  → consulta API com Bearer token (refresh automático)
 */

const CLIENT_ID =
  process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '4eaf09d416904d3cb7f861312e4003d5';

const SCOPES = ['user-read-currently-playing', 'user-read-playback-state'].join(' ');

const TOKEN_KEYS = {
  access:    'spotify:access_token',
  refresh:   'spotify:refresh_token',
  expiresAt: 'spotify:expires_at',
  verifier:  'spotify:code_verifier',
} as const;

function redirectUri(): string {
  return `${window.location.origin}/auth/spotify-callback`;
}

// ─── PKCE helpers ───────────────────────────────────────────────────────────

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
}

/**
 * Gera um code_verifier compatível com PKCE.
 * Spec exige 43-128 chars do alfabeto [A-Z a-z 0-9 - . _ ~].
 * 32 bytes em hex = 64 caracteres → dentro do range, alta entropia.
 */
function randomString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ('0' + b.toString(16)).slice(-2)).join('');
}

// ─── OAuth flow ─────────────────────────────────────────────────────────────

export async function startSpotifyLogin(): Promise<void> {
  const verifier = randomString();
  const challenge = base64url(await sha256(verifier));
  localStorage.setItem(TOKEN_KEYS.verifier, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleSpotifyCallback(code: string): Promise<void> {
  const verifier = localStorage.getItem(TOKEN_KEYS.verifier);
  if (!verifier) throw new Error('Missing PKCE verifier');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed: ${errText}`);
  }

  const data = await res.json();
  storeTokens(data);
  localStorage.removeItem(TOKEN_KEYS.verifier);
}

function storeTokens(data: { access_token: string; refresh_token?: string; expires_in: number }) {
  localStorage.setItem(TOKEN_KEYS.access, data.access_token);
  if (data.refresh_token) localStorage.setItem(TOKEN_KEYS.refresh, data.refresh_token);
  localStorage.setItem(TOKEN_KEYS.expiresAt, String(Date.now() + data.expires_in * 1000 - 30_000));
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(TOKEN_KEYS.refresh);
  if (!refresh) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  storeTokens(data);
  return data.access_token;
}

async function getValidAccessToken(): Promise<string | null> {
  const access = localStorage.getItem(TOKEN_KEYS.access);
  const expiresAt = Number(localStorage.getItem(TOKEN_KEYS.expiresAt) || 0);
  if (access && Date.now() < expiresAt) return access;
  return refreshAccessToken();
}

export function isSpotifyConnected(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(TOKEN_KEYS.access);
}

export function disconnectSpotify(): void {
  Object.values(TOKEN_KEYS).forEach((k) => localStorage.removeItem(k));
}

// ─── API ────────────────────────────────────────────────────────────────────

export type SpotifyTrack = {
  title: string;
  artist: string;
  img: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
};

export async function getCurrentlyPlaying(): Promise<SpotifyTrack | null> {
  const token = await getValidAccessToken();
  if (!token) return null;

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });

  // 204 No Content = nada tocando
  if (res.status === 204) return null;
  if (!res.ok) {
    if (res.status === 401) {
      // Token inválido — força refresh na próxima
      localStorage.removeItem(TOKEN_KEYS.access);
    }
    return null;
  }

  const data = await res.json();
  if (!data?.item) return null;

  const item = data.item;
  const cover = item.album?.images?.[0]?.url ?? '/ana-castela-box.jpg';
  const artists = (item.artists || []).map((a: { name: string }) => a.name).join(', ');

  return {
    title: item.name,
    artist: artists,
    img: cover,
    isPlaying: !!data.is_playing,
    progressMs: data.progress_ms ?? 0,
    durationMs: item.duration_ms ?? 0,
  };
}
