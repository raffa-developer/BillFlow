import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const localeMap: Record<string, string> = {
  EUR: 'pt-PT',
  BRL: 'pt-BR',
  USD: 'en-US',
  GBP: 'en-GB',
};

export function formatCurrency(value: string | number, currency = 'EUR'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat(localeMap[currency] ?? 'pt-PT', {
    style: 'currency',
    currency,
  }).format(num);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function toISOLocal(dateStr: string): string {
  return new Date(dateStr).toISOString();
}

/** Local calendar date as YYYY-MM-DD (never shifts with timezone). */
export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Date-only form value (YYYY-MM-DD) -> ISO at noon UTC.
 * Noon UTC keeps the calendar day stable in every timezone (UTC-12..UTC+12).
 */
export function dateOnlyToIso(value: string): string {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}
