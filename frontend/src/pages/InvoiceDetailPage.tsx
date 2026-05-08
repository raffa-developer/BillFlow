import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Trash2, Download, Send, Copy } from 'lucide-react';
import { invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate } from '../lib/utils';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import type { InvoiceStatus } from '../types';

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendMessage, setSendMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(parseInt(id!)),
    enabled: !!id,
  });
  const invoice = data?.data.invoice;

  const statusMutation = useMutation({
    mutationFn: (status: InvoiceStatus) => invoicesApi.update(parseInt(id!), { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => invoicesApi.remove(parseInt(id!)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); navigate('/invoices'); },
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
          ? `Email simulado para ${data.recipient} (SMTP não configurado)`
          : `Email enviado para ${data.recipient}`
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
  const discountAmount = invoice.discountType === 'PERCENT'
    ? Math.round(subtotal * discountValue) / 100
    : invoice.discountType === 'FIXED' ? discountValue : 0;

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
          {invoice.status !== 'PAID' && (
            <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('PAID')} loading={statusMutation.isPending}>
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
              <span>{t('common.subtotal')}</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('common.discount')}{invoice.discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('common.tax')} ({taxRate}%)</span><span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-800 pt-1 mt-1">
              <span>{t('common.total')}</span><span className="text-blue-600">{formatCurrency(invoice.total)}</span>
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
                  <td className="px-5 py-3.5 text-right text-slate-500 dark:text-slate-400">{formatCurrency(item.price)}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">{formatCurrency(parseFloat(item.price) * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
            placeholder={invoice.client.email ?? 'email@exemplo.com'}
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
    </div>
  );
}
