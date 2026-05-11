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

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateInvoiceTotals(input: InvoiceMathInput): InvoiceMathResult {
  const subtotal = round2(
    input.items.reduce((sum, it) => sum + it.quantity * it.price, 0)
  );

  let discountAmount = 0;
  if (input.discountType === "PERCENT") {
    discountAmount = round2((subtotal * input.discountValue) / 100);
  } else if (input.discountType === "FIXED") {
    discountAmount = round2(input.discountValue);
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = round2((afterDiscount * input.taxRate) / 100);
  const total = round2(afterDiscount + taxAmount);

  return { subtotal, discountAmount, taxAmount, total };
}

export function formatInvoiceNumber(counter: number, prefix = "INV"): string {
  return `${prefix}-${String(counter).padStart(4, "0")}`;
}
