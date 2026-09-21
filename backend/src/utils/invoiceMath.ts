export type InvoiceLineInput = {
  quantity: number;
  price: number;
};

export type InvoiceMathInput = {
  items: InvoiceLineInput[];
  discountType: "NONE" | "PERCENT" | "FIXED";
  discountValue: number;
  taxRate: number;
};

export type InvoiceMathResult = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
};

const round2 = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

export function discountAmountFor(
  subtotal: number,
  discountType: "NONE" | "PERCENT" | "FIXED",
  discountValue: number
): number {
  if (discountType === "PERCENT") return round2((subtotal * discountValue) / 100);
  if (discountType === "FIXED") return round2(Math.min(discountValue, subtotal));
  return 0;
}

export function calculateInvoiceTotals(input: InvoiceMathInput): InvoiceMathResult {
  const subtotal = round2(
    input.items.reduce((sum, it) => sum + it.quantity * it.price, 0)
  );

  const discountAmount = discountAmountFor(subtotal, input.discountType, input.discountValue);

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = round2((afterDiscount * input.taxRate) / 100);
  const total = round2(afterDiscount + taxAmount);

  return { subtotal, discountAmount, taxAmount, total };
}

export function formatInvoiceNumber(counter: number, prefix = "INV"): string {
  return `${prefix}-${String(counter).padStart(4, "0")}`;
}
