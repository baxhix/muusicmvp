/**
 * Concatenate class names, ignoring falsy values.
 * Lightweight replacement for `clsx` — keeps the project dep-free.
 */
export function cn(...parts: Array<unknown>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function pluralize(
  count: number,
  singular: string,
  plural: string = `${singular}s`
): string {
  return count === 1 ? singular : plural;
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
