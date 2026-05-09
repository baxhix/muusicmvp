/* Brazilian locale formatters used across the admin. */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat('pt-BR');

const COMPACT = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const DATE_SHORT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DATE_LONG = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const DATETIME_SHORT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatBRL = (value: number) => BRL.format(value);
export const formatNumber = (value: number) => NUMBER.format(value);
export const formatCompact = (value: number) => COMPACT.format(value);
export const formatPercent = (value: number) => PERCENT.format(value);
export const formatDate = (date: Date | string) =>
  DATE_SHORT.format(typeof date === 'string' ? new Date(date) : date);
export const formatDateLong = (date: Date | string) =>
  DATE_LONG.format(typeof date === 'string' ? new Date(date) : date);
export const formatDateTime = (date: Date | string) =>
  DATETIME_SHORT.format(typeof date === 'string' ? new Date(date) : date);

const RELATIVE = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

const RELATIVE_DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

export function formatRelative(date: Date | string): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  let duration = (target.getTime() - Date.now()) / 1000;
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return DATE_SHORT.format(target);
}
