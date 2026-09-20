import axios from 'axios';
import type {
  User,
  Client,
  Product,
  Invoice,
  Payment,
  CreateInvoicePayload,
  UpdateInvoicePayload,
} from '../types';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Don't redirect from auth pages — let the form show the error.
      const onAuthPage = ['/login', '/register', '/forgot', '/reset', '/pay'].some((p) =>
        window.location.pathname.startsWith(p)
      );
      if (!onAuthPage) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  register: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),
  me: () => api.get<{ user: User }>('/auth/me'),
  forgot: (email: string) => api.post<{ ok: true }>('/auth/forgot', { email }),
  reset: (token: string, newPassword: string) =>
    api.post<{ ok: true }>('/auth/reset', { token, newPassword }),
};

// Current user / company / account
type CompanyInput = {
  companyName?: string | null;
  companyAddress?: string | null;
  companyVat?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyLogoUrl?: string | null;
  defaultTaxRate?: number;
  defaultPaymentDays?: number;
  invoicePrefix?: string;
};

export const meApi = {
  get: () => api.get<{ user: User }>('/me'),
  updateCompany: (data: CompanyInput) =>
    api.put<{ user: User }>('/me/company', data),
  updateEmail: (email: string, currentPassword: string) =>
    api.put<{ user: User; token: string }>('/me/email', { email, currentPassword }),
  updatePassword: (currentPassword: string, newPassword: string) =>
    api.put<{ ok: true }>('/me/password', { currentPassword, newPassword }),
  updateCurrency: (currency: string, rate: number) =>
    api.put<{ user: User }>('/me/currency', { currency, rate }),
};

// Clients
export type ClientInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export const clientsApi = {
  list: () => api.get<{ clients: Client[] }>('/clients'),
  create: (data: ClientInput & { name: string }) =>
    api.post<{ client: Client }>('/clients', data),
  update: (id: number, data: ClientInput) =>
    api.put<{ client: Client }>(`/clients/${id}`, data),
  remove: (id: number) => api.delete(`/clients/${id}`),
};

type ProductInput = { name: string; price: number; description?: string };

// Products
export const productsApi = {
  list: () => api.get<{ products: Product[] }>('/products'),
  create: (data: ProductInput) =>
    api.post<{ product: Product }>('/products', data),
  update: (id: number, data: Partial<ProductInput>) =>
    api.put<{ product: Product }>(`/products/${id}`, data),
  remove: (id: number) => api.delete(`/products/${id}`),
};

// Invoices
export const invoicesApi = {
  list: (status?: string) =>
    api.get<{ invoices: Invoice[] }>('/invoices', { params: status ? { status } : {} }),
  get: (id: number) => api.get<{ invoice: Invoice }>(`/invoices/${id}`),
  create: (data: CreateInvoicePayload) =>
    api.post<{ invoice: Invoice }>('/invoices', data),
  update: (id: number, data: UpdateInvoicePayload) =>
    api.put<{ invoice: Invoice }>(`/invoices/${id}`, data),
  remove: (id: number) => api.delete(`/invoices/${id}`),
  bulkMarkPaid: (ids: number[]) =>
    api.post<{ updated: number }>('/invoices/bulk/mark-paid', { ids }),
  bulkDelete: (ids: number[]) =>
    api.post<{ deleted: number }>('/invoices/bulk/delete', { ids }),
  send: (id: number, data: { to?: string; message?: string }) =>
    api.post<{ ok: true; mocked: boolean; recipient: string; publicUrl: string }>(
      `/invoices/${id}/send`,
      data
    ),
  downloadPdf: (id: number) =>
    api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  getPayments: (id: number) =>
    api.get<{ payments: Payment[] }>(`/invoices/${id}/payments`),
  recordPayment: (id: number, data: { amount?: number; paidAt?: string; method: string; reference?: string }) =>
    api.post<{ payment: Payment }>(`/invoices/${id}/payments`, data),
};

// Public invoice (no auth)
export const publicInvoiceApi = {
  get: (token: string) =>
    axios.get<{ invoice: Invoice & { user: { companyName?: string; companyAddress?: string; companyVat?: string; companyEmail?: string; companyPhone?: string; companyLogoUrl?: string; currency?: string } } }>(
      `/api/public/invoices/${token}`
    ),
  pdfUrl: (token: string) => `/api/public/invoices/${token}/pdf`,
};
