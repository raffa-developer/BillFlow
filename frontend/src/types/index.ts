export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE';
export type DiscountType = 'NONE' | 'PERCENT' | 'FIXED';

export interface User {
  id: number;
  email: string;
  createdAt: string;
  companyName?: string | null;
  companyAddress?: string | null;
  companyVat?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyLogoUrl?: string | null;
}

export interface Client {
  id: number;
  userId: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Product {
  id: number;
  userId: number;
  name: string;
  price: string;
  description?: string;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId?: number;
  description: string;
  quantity: number;
  price: string;
  product?: { id: number; name: string };
}

export interface Invoice {
  id: number;
  userId: number;
  clientId: number;
  number: string;
  subtotal: string;
  discountType: DiscountType;
  discountValue: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  status: InvoiceStatus;
  dateIssued: string;
  dueDate: string;
  notes?: string | null;
  publicToken?: string | null;
  sentAt?: string | null;
  client: { id: number; name: string; email?: string; phone?: string; address?: string };
  items: InvoiceItem[];
}

export interface CreateInvoiceItem {
  productId?: number;
  description: string;
  quantity: number;
  price: number;
}

export interface CreateInvoicePayload {
  clientId: number;
  dateIssued: string;
  dueDate: string;
  items: CreateInvoiceItem[];
  discountType?: DiscountType;
  discountValue?: number;
  taxRate?: number;
  notes?: string;
}

export interface UpdateInvoicePayload {
  status?: InvoiceStatus;
  dueDate?: string;
  items?: CreateInvoiceItem[];
  discountType?: DiscountType;
  discountValue?: number;
  taxRate?: number;
  notes?: string;
}
