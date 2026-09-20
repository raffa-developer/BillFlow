import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Trash2, Download, Send, Copy, CopyPlus, Bell } from 'lucide-react';
import { invoicesApi } from '../lib/api';
import { Card } from '../components/ui/CardLegacy';
import { Button } from '../components/ui/ButtonLegacy';
import { Input } from '../components/ui/InputLegacy';
import { StatusBadge } from '../components/ui/BadgeLegacy';
import { Modal } from '../components/ui/ModalLegacy';
import { formatDate, todayLocal, dateOnlyToIso } from '../lib/utils';
import { discountAmountFor } from '../lib/invoiceMath';
import { useCurrency } from '../contexts/CurrencyContext';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import type { InvoiceStatus } from '../types';

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!invoice) return <div className="text-center py-20 text-slate-400 dark:text-slate-500">{t('invoiceDetail.notFound')}</div>;

  const subtotal = parseFloat(invoice.subtotal);
  const discountValue = parseFloat(invoice.discountValue);
  const taxRate = parseFloat(invoice.taxRate);
  const taxAmount = parseFloat(invoice.taxAmount);
  const discountAmount = discountAmountFor(subtotal, invoice.discountType, discountValue);
  const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const outstanding = Math.max(0, Math.round((parseFloat(invoice.total) - paidAmount) * 100) / 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/invoices">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('invoiceDetail.back')}</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{invoice.number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('invoiceDetail.issuedOn')} {formatDate(invoice.dateIssued)} · {t('invoiceDetail.dueOn')} {formatDate(invoice.dueDate)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {invoice.status !== 'PAID' && outstanding > 0 && (
            <Button variant="secondary" size="sm" onClick={() => { setPaymentAmount(String(outstanding)); setPaymentDate(todayLocal()); setPaymentOpen(true); }}>
              <CheckCircle className="h-4 w-4 text-green-600" /> {t('invoiceDetail.markPaid')}
            </Button>
          )}
          {invoice.status !== 'PENDING' && (
            <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('PENDING')} loading={statusMutation.isPending}>
              <Clock className="h-4 w-4 text-yellow-500" /> {t('invoiceDetail.markPending')}
            </Button>
          )}
          {invoice.status !== 'OVERDUE' && (
            <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('OVERDUE')} loading={statusMutation.isPending}>
              <AlertCircle className="h-4 w-4 text-red-500" /> {t('invoiceDetail.markOverdue')}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={downloadPdf}>
            <Download className="h-4 w-4" /> {t('invoiceDetail.pdf')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> {t('invoiceDetail.send')}
          </Button>
          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
            <Button variant="secondary" size="sm" onClick={() => { setRemindTo(invoice.client.email ?? ''); setRemindOpen(true); }}>
              <Bell className="h-4 w-4" /> {t('invoiceDetail.remind')}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={cloneInvoice}>
            <CopyPlus className="h-4 w-4" /> {t('invoiceDetail.clone')}
          </Button>
          <Button variant="ghost" size="sm" onClick={copyPublicLink}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('invoiceDetail.client')}</p>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{invoice.client.name}</p>
          {invoice.client.email && <p className="text-sm text-slate-400 dark:text-slate-500">{invoice.client.email}</p>}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('invoiceDetail.summary')}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t('common.subtotal')}</span><span>{formatAmount(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('common.discount')}{invoice.discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}</span>
                <span>-{formatAmount(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('common.tax')} ({taxRate}%)</span><span>{formatAmount(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-800 pt-1 mt-1">
              <span>{t('common.total')}</span><span className="text-blue-600">{formatAmount(invoice.total)}</span>
            </div>
          </div>
        </Card>
      </div>

      {invoice.notes && (
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('common.notes')}</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{invoice.notes}</p>
        </Card>
      )}

      <Card>
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('invoiceDetail.items')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.description')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.qty')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.unitPrice')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200">{item.description}</td>
                  <td className="px-5 py-3.5 text-right text-slate-500 dark:text-slate-400">{item.quantity}</td>
                  <td className="px-5 py-3.5 text-right text-slate-500 dark:text-slate-400">{formatAmount(item.price)}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">{formatAmount(parseFloat(item.price) * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {payments.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('invoiceDetail.paymentHistory')}</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{p.method.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatDate(p.paidAt)}{p.reference && ` · ${p.reference}`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatAmount(p.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('invoiceDetail.deleteTitle')}>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">{t('invoiceDetail.deleteConfirm')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>{t('common.delete')}</Button>
        </div>
      </Modal>

      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t('invoiceDetail.sendTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('invoiceDetail.sendDescription')}</p>
          <Input
            label={t('invoiceDetail.recipientEmail')}
            type="email"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder={invoice.client.email ?? 'email@example.com'}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('invoiceDetail.messageOptional')}
            </label>
            <textarea
              value={sendMessage}
              onChange={(e) => setSendMessage(e.target.value)}
              placeholder={t('invoiceDetail.messagePlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSendOpen(false)}>{t('common.cancel')}</Button>
            <Button loading={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              <Send className="h-4 w-4" /> {t('invoiceDetail.sendEmail')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title={t('invoiceDetail.recordPaymentTitle')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('invoiceDetail.paymentAmount')}
              type="number"
              min="0.01"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <Input
              label={t('invoiceDetail.paymentDate')}
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('invoiceDetail.paymentMethod')}</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="bank_transfer">{t('invoiceDetail.paymentMethodBankTransfer')}</option>
              <option value="cash">{t('invoiceDetail.paymentMethodCash')}</option>
              <option value="card">{t('invoiceDetail.paymentMethodCard')}</option>
              <option value="check">{t('invoiceDetail.paymentMethodCheck')}</option>
              <option value="other">{t('invoiceDetail.paymentMethodOther')}</option>
            </select>
          </div>
          <Input
            label={t('invoiceDetail.paymentRef')}
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder={t('invoiceDetail.paymentRefPlaceholder')}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>{t('common.cancel')}</Button>
            <Button loading={paymentMutation.isPending} onClick={() => paymentMutation.mutate()}>
              <CheckCircle className="h-4 w-4" /> {t('invoiceDetail.recordPayment')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={remindOpen} onClose={() => setRemindOpen(false)} title={t('invoiceDetail.remindTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('invoiceDetail.remindDescription')}</p>
          <Input
            label={t('invoiceDetail.recipientEmail')}
            type="email"
            value={remindTo}
            onChange={(e) => setRemindTo(e.target.value)}
            placeholder={invoice.client.email ?? 'email@example.com'}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemindOpen(false)}>{t('common.cancel')}</Button>
            <Button loading={remindLoading} onClick={sendReminder}>
              <Bell className="h-4 w-4" /> {t('invoiceDetail.sendReminder')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
