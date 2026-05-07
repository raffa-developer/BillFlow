import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, FileText, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate } from '../lib/utils';
import type { InvoiceStatus } from '../types';

export default function InvoicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const statusOptions = [
    { value: '', label: t('invoices.filterAll') },
    { value: 'PENDING', label: t('invoices.filterPending') },
    { value: 'PAID', label: t('invoices.filterPaid') },
    { value: 'OVERDUE', label: t('invoices.filterOverdue') },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => invoicesApi.list(statusFilter || undefined),
  });
  const invoices = data?.data.invoices ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setDeleteId(null); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('invoices.title')}</h1>
          <p className="text-sm text-slate-500">{t('invoices.count', { count: invoices.length })}</p>
        </div>
        <Link to="/invoices/new">
          <Button><Plus className="h-4 w-4" /> {t('invoices.new')}</Button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statusOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${statusFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <FileText className="h-8 w-8" />
            <p className="text-sm">{t('invoices.none')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('invoices.colClient')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('invoices.colIssued')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('invoices.colDue')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.status')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.total')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-slate-700 font-mono text-xs">{inv.number}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{inv.client.name}</td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(inv.dateIssued)}</td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status as InvoiceStatus} /></td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(inv.total)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Link to={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(inv.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title={t('invoices.deleteTitle')}>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">{t('invoices.deleteConfirm')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>{t('common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}
