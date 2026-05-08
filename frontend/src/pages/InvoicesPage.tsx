import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, FileText, Trash2, Eye, Search, X, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import type { Invoice, InvoiceStatus } from '../types';

type SortKey = 'date_desc' | 'date_asc' | 'due_asc' | 'due_desc' | 'total_desc' | 'total_asc' | 'number_asc';

const STATUS_OPTS: { value: string; label: string; color: string }[] = [
  { value: '',        label: 'All',     color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'PENDING', label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'PAID',    label: 'Paid',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'OVERDUE', label: 'Overdue', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
];

const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: 'date_desc',   label: 'Issued (newest)' },
  { value: 'date_asc',    label: 'Issued (oldest)' },
  { value: 'due_asc',     label: 'Due (soonest)' },
  { value: 'due_desc',    label: 'Due (latest)' },
  { value: 'total_desc',  label: 'Amount (highest)' },
  { value: 'total_asc',   label: 'Amount (lowest)' },
  { value: 'number_asc',  label: 'Invoice #' },
];

function applySort(list: Invoice[], sort: SortKey): Invoice[] {
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'date_desc':  return new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime();
      case 'date_asc':   return new Date(a.dateIssued).getTime() - new Date(b.dateIssued).getTime();
      case 'due_asc':    return new Date(a.dueDate).getTime()    - new Date(b.dueDate).getTime();
      case 'due_desc':   return new Date(b.dueDate).getTime()    - new Date(a.dueDate).getTime();
      case 'total_desc': return parseFloat(b.total) - parseFloat(a.total);
      case 'total_asc':  return parseFloat(a.total) - parseFloat(b.total);
      case 'number_asc': return a.number.localeCompare(b.number);
    }
  });
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [minTotal, setMinTotal]       = useState('');
  const [maxTotal, setMaxTotal]       = useState('');
  const [sort, setSort]               = useState<SortKey>('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteId, setDeleteId]       = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });
  const all = data?.data.invoices ?? [];

  const filtered = useMemo(() => {
    let list = all as Invoice[];

    if (statusFilter) list = list.filter(i => i.status === statusFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        i.number.toLowerCase().includes(q) ||
        i.client.name.toLowerCase().includes(q) ||
        String(i.id).includes(q)
      );
    }

    if (dateFrom) list = list.filter(i => new Date(i.dateIssued) >= new Date(dateFrom));
    if (dateTo)   list = list.filter(i => new Date(i.dateIssued) <= new Date(dateTo + 'T23:59:59'));

    if (minTotal) list = list.filter(i => parseFloat(i.total) >= parseFloat(minTotal));
    if (maxTotal) list = list.filter(i => parseFloat(i.total) <= parseFloat(maxTotal));

    return applySort(list, sort);
  }, [all, search, statusFilter, dateFrom, dateTo, minTotal, maxTotal, sort]);

  const hasActiveFilters = !!(search || statusFilter || dateFrom || dateTo || minTotal || maxTotal);

  const clearAll = () => {
    setSearch(''); setStatusFilter(''); setDateFrom('');
    setDateTo(''); setMinTotal(''); setMaxTotal('');
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setDeleteId(null); },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('invoices.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {filtered.length} of {all.length} invoices
          </p>
        </div>
        <Link to="/invoices/new">
          <Button><Plus className="h-4 w-4" /> {t('invoices.new')}</Button>
        </Link>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'rounded-full px-3.5 py-1 text-xs font-semibold transition-all border',
              statusFilter === opt.value
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : `border-transparent ${opt.color} hover:opacity-80`
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by invoice #, client name or ID…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors h-9',
            showFilters || hasActiveFilters
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {[search, statusFilter, dateFrom, dateTo, minTotal, maxTotal].filter(Boolean).length}
            </span>
          )}
        </button>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Expanded filters panel */}
      {showFilters && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Issued from</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Issued to</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Min amount</label>
              <input type="number" min="0" step="0.01" value={minTotal} onChange={e => setMinTotal(e.target.value)} placeholder="0.00"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Max amount</label>
              <input type="number" min="0" step="0.01" value={maxTotal} onChange={e => setMaxTotal(e.target.value)} placeholder="∞"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearAll} className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
              <X className="h-3 w-3" /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400 dark:text-slate-500">
            <FileText className="h-8 w-8" />
            <p className="text-sm font-medium">{hasActiveFilters ? 'No invoices match your filters' : t('invoices.none')}</p>
            {hasActiveFilters && (
              <button onClick={clearAll} className="text-xs text-blue-500 hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice #</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Issued</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{inv.number}</span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{inv.client.name}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(inv.dateIssued)}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status as InvoiceStatus} /></td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(inv.total)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Link to={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(inv.id)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
