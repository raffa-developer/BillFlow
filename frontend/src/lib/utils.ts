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
