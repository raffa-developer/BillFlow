import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Trash2, Download, Send, Copy, CopyPlus, Bell, FileText } from 'lucide-react';
import { invoicesApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '../components/ui/BadgeLegacy';
import { Modal } from '@/components/common/Modal';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState, Spinner } from '@/components/common/Spinner';
import { formatDate, todayLocal, dateOnlyToIso } from '../lib/utils';
import { discountAmountFor } from '../lib/invoiceMath';
import { useCurrency } from '../contexts/CurrencyContext';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import type { InvoiceStatus } from '../types';

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindTo, setRemindTo] = useState('');
  const [remindLoading, setRemindLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(parseInt(id!)),
    enabled: !!id,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['invoice-payments', id],
    queryFn: () => invoicesApi.getPayments(parseInt(id!)),
    enabled: !!id,
    retry: false,
  });
  const invoice = data?.data.invoice;
  const payments = paymentsData?.data.payments ?? [];

  const statusMutation = useMutation({
    mutationFn: (status: InvoiceStatus) => invoicesApi.update(parseInt(id!), { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('common.error')),
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      invoicesApi.recordPayment(parseInt(id!), {
        amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        paidAt: paymentDate ? dateOnlyToIso(paymentDate) : undefined,
        method: paymentMethod,
        reference: paymentRef || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoice-payments', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setPaymentOpen(false);
      setPaymentAmount('');
      setPaymentDate('');
      setPaymentMethod('bank_transfer');
      setPaymentRef('');
      toast.success(t('invoiceDetail.paymentRecorded'));
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('invoiceDetail.paymentFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => invoicesApi.remove(parseInt(id!)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); navigate('/invoices'); },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('common.error')),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      invoicesApi.send(parseInt(id!), {
        to: sendTo || undefined,
        message: sendMessage || undefined,
      }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setSendOpen(false);
      toast.success(
        data.mocked
          ? t('invoiceDetail.emailMocked', { recipient: data.recipient })
          : t('invoiceDetail.emailSent', { recipient: data.recipient })
      );
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('invoiceDetail.errorSend')),
  });

  const downloadPdf = async () => {
    try {
      const res = await invoicesApi.downloadPdf(parseInt(id!));
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.number ?? 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('invoiceDetail.errorPdf'));
    }
  };

  const copyPublicLink = async () => {
    if (!invoice?.publicToken) {
      toast.info(t('invoiceDetail.generateLinkFirst'));
      return;
    }
    const url = `${window.location.origin}/pay/${invoice.publicToken}`;
    await navigator.clipboard.writeText(url);
    toast.success(t('common.linkCopied'));
  };

  const cloneInvoice = () => {
    if (!invoice) return;
    navigate('/invoices/new', {
      state: {
        template: {
          clientId: invoice.clientId,
          items: invoice.items.map(i => ({
            description: i.description,
            quantity: i.quantity,
            price: parseFloat(i.price),
            productId: i.productId ?? undefined,
          })),
          discountType: invoice.discountType,
          discountValue: parseFloat(invoice.discountValue),
          taxRate: parseFloat(invoice.taxRate),
          notes: invoice.notes ?? '',
        },
      },
    });
  };

  const sendReminder = async () => {
    if (!invoice) return;
    setRemindLoading(true);
    try {
      const { data } = await invoicesApi.send(parseInt(id!), {
        to: remindTo || undefined,
        message: `Reminder: Invoice ${invoice.number} is due on ${formatDate(invoice.dueDate)}.`,
      });
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setRemindOpen(false);
      toast.success(data.mocked ? t('invoiceDetail.reminderMocked', { recipient: data.recipient }) : t('invoiceDetail.reminderSent', { recipient: data.recipient }));
    } catch {
      toast.error(t('invoiceDetail.errorSend'));
    } finally {
      setRemindLoading(false);
    }
  };

  if (isLoading) return <LoadingState />;

  if (!invoice) return <EmptyState icon={FileText} title={t('invoiceDetail.notFound')} />;

  const subtotal = parseFloat(invoice.subtotal);
  const discountValue = parseFloat(invoice.discountValue);
  const taxRate = parseFloat(invoice.taxRate);
  const taxAmount = parseFloat(invoice.taxAmount);
  const discountAmount = discountAmountFor(subtotal, invoice.discountType, discountValue);
  const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const outstanding = Math.max(0, Math.round((parseFloat(invoice.total) - paidAmount) * 100) / 100);

  return (
    <div className="space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/invoices"><ArrowLeft className="h-4 w-4" /> {t('invoiceDetail.back')}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">{invoice.number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('invoiceDetail.issuedOn')} {formatDate(invoice.dateIssued)} · {t('invoiceDetail.dueOn')} {formatDate(invoice.dueDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {invoice.status !== 'PAID' && outstanding > 0 && (
            <Button variant="outline" size="sm" onClick={() => { setPaymentAmount(String(outstanding)); setPaymentDate(todayLocal()); setPaymentOpen(true); }}>
              <CheckCircle className="h-4 w-4" /> {t('invoiceDetail.markPaid')}
            </Button>
          )}
          {invoice.status !== 'PENDING' && (
            <Button variant="outline" size="sm" onClick={() => statusMutation.mutate('PENDING')} disabled={statusMutation.isPending}>
              {statusMutation.isPending && <Spinner className="h-4 w-4 border-current border-t-transparent" />}
              <Clock className="h-4 w-4" /> {t('invoiceDetail.markPending')}
            </Button>
          )}
          {invoice.status !== 'OVERDUE' && (
            <Button variant="outline" size="sm" onClick={() => statusMutation.mutate('OVERDUE')} disabled={statusMutation.isPending}>
              {statusMutation.isPending && <Spinner className="h-4 w-4 border-current border-t-transparent" />}
              <AlertCircle className="h-4 w-4" /> {t('invoiceDetail.markOverdue')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="h-4 w-4" /> {t('invoiceDetail.pdf')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> {t('invoiceDetail.send')}
          </Button>
          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
            <Button variant="outline" size="sm" onClick={() => { setRemindTo(invoice.client.email ?? ''); setRemindOpen(true); }}>
              <Bell className="h-4 w-4" /> {t('invoiceDetail.remind')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={cloneInvoice}>
            <CopyPlus className="h-4 w-4" /> {t('invoiceDetail.clone')}
          </Button>
          <Button variant="ghost" size="sm" aria-label={t('invoiceDetail.copyPublicLink')} onClick={copyPublicLink}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" aria-label={t('common.delete')} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('invoiceDetail.client')}</p>
          <p className="mt-2 font-semibold text-card-foreground">{invoice.client.name}</p>
          {invoice.client.email && <p className="mt-0.5 text-sm text-muted-foreground">{invoice.client.email}</p>}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('invoiceDetail.summary')}</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-6 text-muted-foreground">
              <dt>{t('common.subtotal')}</dt>
              <dd className="font-mono tabular-nums">{formatAmount(subtotal)}</dd>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between gap-6 text-muted-foreground">
                <dt>{t('common.discount')}{invoice.discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}</dt>
                <dd className="font-mono tabular-nums">-{formatAmount(discountAmount)}</dd>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex items-center justify-between gap-6 text-muted-foreground">
                <dt>{t('common.tax')} ({taxRate}%)</dt>
                <dd className="font-mono tabular-nums">{formatAmount(taxAmount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-6 border-t border-border pt-2 font-display text-xl font-bold text-foreground">
              <dt>{t('common.total')}</dt>
              <dd className="font-mono tabular-nums">{formatAmount(invoice.total)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {invoice.notes && (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.notes')}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-card-foreground">{invoice.notes}</p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('invoiceDetail.items')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.description')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.qty')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.unitPrice')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3.5 text-card-foreground">{item.description}</td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{item.quantity}</td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{formatAmount(item.price)}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-medium tabular-nums text-card-foreground">
                    {formatAmount(parseFloat(item.price) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {payments.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('invoiceDetail.paymentHistory')}</h2>
          </div>
          <div>
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize text-card-foreground">{p.method.replace('_', ' ')}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(p.paidAt)}{p.reference && ` · ${p.reference}`}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-accent-foreground dark:text-accent">
                  {formatAmount(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('invoiceDetail.deleteTitle')}
        description={t('invoiceDetail.deleteConfirm')}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            {deleteMutation.isPending && <Spinner className="h-4 w-4 border-current border-t-transparent" />}
            {t('common.delete')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title={t('invoiceDetail.sendTitle')}
        description={t('invoiceDetail.sendDescription')}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-send-to">{t('invoiceDetail.recipientEmail')}</Label>
            <Input
              id="invoice-send-to"
              type="email"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder={invoice.client.email ?? 'email@example.com'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-send-message">{t('invoiceDetail.messageOptional')}</Label>
            <Textarea
              id="invoice-send-message"
              value={sendMessage}
              onChange={(e) => setSendMessage(e.target.value)}
              placeholder={t('invoiceDetail.messagePlaceholder')}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSendOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              {sendMutation.isPending && <Spinner className="h-4 w-4 border-current border-t-transparent" />}
              <Send className="h-4 w-4" /> {t('invoiceDetail.sendEmail')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title={t('invoiceDetail.recordPaymentTitle')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-payment-amount">{t('invoiceDetail.paymentAmount')}</Label>
              <Input
                id="invoice-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-payment-date">{t('invoiceDetail.paymentDate')}</Label>
              <Input
                id="invoice-payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-payment-method">{t('invoiceDetail.paymentMethod')}</Label>
            <select
              id="invoice-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={selectClass}
            >
              <option value="bank_transfer">{t('invoiceDetail.paymentMethodBankTransfer')}</option>
              <option value="cash">{t('invoiceDetail.paymentMethodCash')}</option>
              <option value="card">{t('invoiceDetail.paymentMethodCard')}</option>
              <option value="check">{t('invoiceDetail.paymentMethodCheck')}</option>
              <option value="other">{t('invoiceDetail.paymentMethodOther')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-payment-ref">{t('invoiceDetail.paymentRef')}</Label>
            <Input
              id="invoice-payment-ref"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder={t('invoiceDetail.paymentRefPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={paymentMutation.isPending} onClick={() => paymentMutation.mutate()}>
              {paymentMutation.isPending && <Spinner className="h-4 w-4 border-current border-t-transparent" />}
              <CheckCircle className="h-4 w-4" /> {t('invoiceDetail.recordPayment')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={remindOpen}
        onClose={() => setRemindOpen(false)}
        title={t('invoiceDetail.remindTitle')}
        description={t('invoiceDetail.remindDescription')}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-remind-to">{t('invoiceDetail.recipientEmail')}</Label>
            <Input
              id="invoice-remind-to"
              type="email"
              value={remindTo}
              onChange={(e) => setRemindTo(e.target.value)}
              placeholder={invoice.client.email ?? 'email@example.com'}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemindOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={remindLoading} onClick={sendReminder}>
              {remindLoading && <Spinner className="h-4 w-4 border-current border-t-transparent" />}
              <Bell className="h-4 w-4" /> {t('invoiceDetail.sendReminder')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
