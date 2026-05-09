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
