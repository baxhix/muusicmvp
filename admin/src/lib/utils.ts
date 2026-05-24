/**
 * Concatena class names, ignorando valores falsy. Substituição
 * leve do `clsx` — mantém o projeto sem dep externa.
 */
export function cn(...parts: Array<unknown>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}

/** Gera um ID curto. Usado em chaves locais (queue keys, etc.). */
export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Resolve a relative `/api/...` path to the absolute URL the main
 * muusic app serves it from.
 *
 * Why this exists: uploaded feed images come back from the server
 * as relative URLs (`/api/feed/images/<file>`), which the PUBLIC
 * site resolves against its own origin just fine. The admin runs
 * on a different origin (its own subdomain in prod), so
 * `<img src="/api/...">` would hit the admin's own server and
 * 404. Calling `resolveAssetUrl(url)` at render time prepends
 * NEXT_PUBLIC_API_BASE_URL so the request lands on the main app.
 *
 * Already-absolute URLs (http / https / data / blob) pass through.
 */
export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  return url.startsWith('/') ? `${base}${url}` : url;
}
