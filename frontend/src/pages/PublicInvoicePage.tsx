import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { publicInvoiceApi } from '../lib/api';
import { formatDate } from '../lib/utils';
import { discountAmountFor } from '../lib/invoiceMath';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '../components/ui/BadgeLegacy';
import { Spinner } from '@/components/common/Spinner';

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="h-8 w-8 border-4" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="space-y-1 text-center">
          <p className="font-semibold text-destructive">{t('publicInvoice.notFound')}</p>
          <p className="text-sm text-muted-foreground">{t('publicInvoice.invalidLink')}</p>
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
  const discountAmount = discountAmountFor(subtotal, invoice.discountType, discountValue);

  // Public API returns the invoice's own currency; never use the visitor's preference.
  const currency = (company as { currency?: string }).currency ?? 'EUR';
  const formatAmount = (value: string | number) => {
    const numeric = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numeric)) return '';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(numeric);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto mb-4 flex w-full max-w-3xl justify-end">
        <Button asChild>
          <a href={publicInvoiceApi.pdfUrl(token!)} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" />
            {t('publicInvoice.downloadPdf')}
          </a>
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-3xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 bg-sidebar-background px-6 py-5 text-sidebar-foreground">
          <div className="min-w-0">
            {company.companyLogoUrl ? (
              <img src={company.companyLogoUrl} alt="Logo" className="h-10 object-contain" />
            ) : (
              <p className="font-display text-lg font-bold tracking-tight">{company.companyName ?? 'BillFlow'}</p>
            )}
            <p className="mt-1 text-xs text-sidebar-foreground/70">
              {t('publicInvoice.invoice')} <span className="font-mono">{invoice.number}</span>
            </p>
          </div>
          <StatusBadge status={invoice.status} className="shrink-0" />
        </div>

        <div className="grid gap-6 border-b border-border px-6 py-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('publicInvoice.from')}</p>
            <p className="font-semibold text-card-foreground">{company.companyName ?? 'BillFlow'}</p>
            {company.companyAddress && <p className="mt-0.5 text-sm text-muted-foreground">{company.companyAddress}</p>}
            {company.companyVat && <p className="text-sm text-muted-foreground">{t('publicInvoice.vatId')}: {company.companyVat}</p>}
            {company.companyEmail && <p className="text-sm text-muted-foreground">{company.companyEmail}</p>}
            {company.companyPhone && <p className="text-sm text-muted-foreground">{company.companyPhone}</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('publicInvoice.to')}</p>
            <p className="font-semibold text-card-foreground">{client.name}</p>
            {client.email && <p className="mt-0.5 text-sm text-muted-foreground">{client.email}</p>}
            {client.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
            {client.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
          </div>
        </div>

        <div className="grid gap-4 border-b border-border bg-muted/40 px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('publicInvoice.issueDate')}</p>
            <p className="mt-1 text-sm font-medium text-card-foreground">{formatDate(invoice.dateIssued)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('publicInvoice.dueDate')}</p>
            <p className="mt-1 text-sm font-medium text-card-foreground">{formatDate(invoice.dueDate)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.description')}</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.qty')}</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.unitPrice')}</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-b-0">
                  <td className="px-6 py-3.5 text-card-foreground">{item.description}</td>
                  <td className="px-6 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{item.quantity}</td>
                  <td className="px-6 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{formatAmount(item.price)}</td>
                  <td className="px-6 py-3.5 text-right font-mono font-medium tabular-nums text-card-foreground">
                    {formatAmount(parseFloat(item.price) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border px-6 py-5">
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('common.subtotal')}</span>
              <span className="font-mono tabular-nums">{formatAmount(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t('common.discount')}{invoice.discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}</span>
                <span className="font-mono tabular-nums">-{formatAmount(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t('common.tax')} ({taxRate}%)</span>
                <span className="font-mono tabular-nums">{formatAmount(taxAmount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-border pt-3 font-display text-xl font-bold text-foreground">
              <span>{t('common.total')}</span>
              <span className="font-mono tabular-nums">{formatAmount(total)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-border bg-muted/40 px-6 py-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.notes')}</p>
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{invoice.notes}</p>
          </div>
        )}

        {invoice.status === 'OVERDUE' && (
          <div className="flex items-start gap-3 border-t border-destructive/20 bg-destructive/10 px-6 py-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">{t('publicInvoice.overdueTitle')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('publicInvoice.overdueBody')}</p>
            </div>
          </div>
        )}

        {invoice.status === 'PAID' && (
          <div className="flex items-start gap-3 border-t border-accent/30 bg-accent/10 px-6 py-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground dark:text-accent" />
            <p className="text-sm font-semibold text-foreground">{t('publicInvoice.paidConfirm')}</p>
          </div>
        )}
      </Card>

      <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-center gap-2">
        {company.companyEmail && (
          <a
            href={`mailto:${company.companyEmail}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <Mail className="h-3.5 w-3.5" />
            {t('publicInvoice.contactUs')}
          </a>
        )}
        <p className="text-xs text-muted-foreground">
          {t('publicInvoice.poweredBy')} <span className="font-medium text-foreground">BillFlow</span>
        </p>
      </div>
    </div>
  );
}
