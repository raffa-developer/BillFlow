import type { DiscountType } from '../types';

export const round2 = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

export function discountAmountFor(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (discountType === 'PERCENT') return round2((subtotal * discountValue) / 100);
  if (discountType === 'FIXED') return round2(Math.min(discountValue, subtotal));
  return 0;
}

export interface InvoiceTotalsInput {
  items: { quantity: number; price: number }[];
  discountType: DiscountType;
  discountValue: number;
  taxRate: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export function calculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = round2(input.items.reduce((sum, it) => sum + it.quantity * it.price, 0));
  const discountAmount = discountAmountFor(subtotal, input.discountType, input.discountValue);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = round2((afterDiscount * input.taxRate) / 100);
  const total = round2(afterDiscount + taxAmount);
  return { subtotal, discountAmount, taxAmount, total };
}
