import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { publicInvoiceApi } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { StatusBadge } from '../components/ui/Badge';

export default function PublicInvoicePage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-invoice', token],
    queryFn: () => publicInvoiceApi.get(token!),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <p className="text-slate-700 font-semibold">{t('publicInvoice.notFound')}</p>
          <p className="text-sm text-slate-400">{t('publicInvoice.invalidLink')}</p>
        </div>
      </div>
    );
  }

  const invoice = data.data.invoice;
  const company = invoice.user;
  const client = invoice.client as { name: string; email?: string; address?: string; phone?: string };

  const subtotal = parseFloat(invoice.subtotal);
  const discountValue = parseFloat(invoice.discountValue);
  const taxRate = parseFloat(invoice.taxRate);
  const taxAmount = parseFloat(invoice.taxAmount);
  const total = parseFloat(invoice.total);
  const discountAmount =
    invoice.discountType === 'PERCENT'
      ? Math.round(subtotal * discountValue) / 100
      : invoice.discountType === 'FIXED'
      ? discountValue
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            {company.companyLogoUrl ? (
              <img src={company.companyLogoUrl} alt="Logo" className="h-10 object-contain" />
            ) : (
              <span className="text-xl font-bold text-slate-800">{company.companyName ?? 'BillFlow'}</span>
            )}
          </div>
          <a
            href={publicInvoiceApi.pdfUrl(token!)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            {t('publicInvoice.downloadPdf')}
          </a>
        </div>

        {/* Invoice card */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-200 uppercase tracking-wider mb-1">{t('publicInvoice.invoice')}</p>
              <p className="text-2xl font-bold text-white">{invoice.number}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          {/* From / To */}
          <div className="grid gap-6 p-6 sm:grid-cols-2 border-b border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('publicInvoice.from')}</p>
              <p className="font-semibold text-slate-800">{company.companyName ?? 'BillFlow'}</p>
              {company.companyAddress && <p className="text-sm text-slate-500 mt-0.5">{company.companyAddress}</p>}
              {company.companyVat && <p className="text-sm text-slate-500">{t('publicInvoice.vatId')}: {company.companyVat}</p>}
              {company.companyEmail && <p className="text-sm text-slate-500">{company.companyEmail}</p>}
              {company.companyPhone && <p className="text-sm text-slate-500">{company.companyPhone}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('publicInvoice.to')}</p>
              <p className="font-semibold text-slate-800">{client.name}</p>
              {client.email && <p className="text-sm text-slate-500 mt-0.5">{client.email}</p>}
              {client.address && <p className="text-sm text-slate-500">{client.address}</p>}
              {client.phone && <p className="text-sm text-slate-500">{client.phone}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 border-b border-slate-100 bg-slate-50/50">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('publicInvoice.issueDate')}</p>
              <p className="text-sm font-medium text-slate-700 mt-1">{formatDate(invoice.dateIssued)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('publicInvoice.dueDate')}</p>
              <p className="text-sm font-medium text-slate-700 mt-1">{formatDate(invoice.dueDate)}</p>
            </div>
          </div>

          {/* Items */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('common.description')}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('common.qty')}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('common.unitPrice')}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-3.5 text-slate-700">{item.description}</td>
                    <td className="px-6 py-3.5 text-right text-slate-500">{item.quantity}</td>
                    <td className="px-6 py-3.5 text-right text-slate-500">{formatCurrency(item.price)}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-slate-700">
                      {formatCurrency(parseFloat(item.price) * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-slate-100 px-6 py-5">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>{t('common.subtotal')}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>{t('common.discount')}{invoice.discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>{t('common.tax')} ({taxRate}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                <span>{t('common.total')}</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('common.notes')}</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          {t('publicInvoice.poweredBy')} <span className="font-medium text-slate-500">BillFlow</span>
        </p>
      </div>
    </div>
  );
}
