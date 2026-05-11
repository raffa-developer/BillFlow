import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, FileText, Trash2, Eye, Search, X, SlidersHorizontal, ChevronLeft, ChevronRight, CheckCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatDate, cn } from '../lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';
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

const PAGE_SIZE = 10;

export default function InvoicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatAmount } = useCurrency();

  // Filter state lives in URL so it survives navigation
  const search       = searchParams.get('q') ?? '';
  const statusFilter = searchParams.get('status') ?? '';
  const dateFrom     = searchParams.get('from') ?? '';
  const dateTo       = searchParams.get('to') ?? '';
  const minTotal     = searchParams.get('min') ?? '';
  const maxTotal     = searchParams.get('max') ?? '';
  const sort         = (searchParams.get('sort') as SortKey) ?? 'date_desc';

  const [showFilters, setShowFilters]     = useState(false);
  const [deleteId, setDeleteId]           = useState<number | null>(null);
  const [page, setPage]                   = useState(1);
  const [selected, setSelected]           = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, statusFilter, dateFrom, dateTo, minTotal, maxTotal, sort]);

  const setParam = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  };

  const clearAll = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      ['q', 'status', 'from', 'to', 'min', 'max'].forEach(k => next.delete(k));
      return next;
    }, { replace: true });
  };

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasActiveFilters = !!(search || statusFilter || dateFrom || dateTo || minTotal || maxTotal);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setDeleteId(null); },
  });

  const bulkMarkPaidMutation = useMutation({
    mutationFn: () => invoicesApi.bulkMarkPaid(Array.from(selected)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setSelected(new Set()); },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => invoicesApi.bulkDelete(Array.from(selected)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setSelected(new Set()); setBulkDeleteOpen(false); },
  });

  const pageIds = paginated.map(i => i.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const somePageSelected = pageIds.some(id => selected.has(id));

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected(prev => { const n = new Set(prev); pageIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); pageIds.forEach(id => n.add(id)); return n; });
    }
  };

  const toggleOne = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

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
            onClick={() => setParam('status', opt.value)}
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
            onChange={e => setParam('q', e.target.value)}
            placeholder="Search by invoice #, client name or ID…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {search && (
            <button onClick={() => setParam('q', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
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
          onChange={e => setParam('sort', e.target.value)}
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
              <input type="date" value={dateFrom} onChange={e => setParam('from', e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Issued to</label>
              <input type="date" value={dateTo} onChange={e => setParam('to', e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Min amount</label>
              <input type="number" min="0" step="0.01" value={minTotal} onChange={e => setParam('min', e.target.value)} placeholder="0.00"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Max amount</label>
              <input type="number" min="0" step="0.01" value={maxTotal} onChange={e => setParam('max', e.target.value)} placeholder="∞"
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selected.size} invoice{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkMarkPaidMutation.mutate()}
              loading={bulkMarkPaidMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark as paid
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-1 text-blue-500 hover:text-blue-700 dark:text-blue-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
            {hasActiveFilters
              ? <button onClick={clearAll} className="text-xs text-blue-500 hover:underline">Clear filters</button>
              : <Link to="/invoices/new"><Button variant="secondary" size="sm"><Plus className="h-3.5 w-3.5" /> {t('invoices.new')}</Button></Link>
            }
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
              {paginated.map((inv) => (
                <div key={inv.id} className="flex items-start gap-3 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(inv.id)}
                    onChange={() => toggleOne(inv.id)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
                  />
                  <Link to={`/invoices/${inv.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400">{inv.number}</span>
                      <StatusBadge status={inv.status as InvoiceStatus} />
                    </div>
                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{inv.client.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Due {formatDate(inv.dueDate)}</p>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{formatAmount(inv.total)}</span>
                    <div className="flex gap-1">
                      <Link to={`/invoices/${inv.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(inv.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      />
                    </th>
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
                  {paginated.map((inv) => (
                    <tr key={inv.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors', selected.has(inv.id) && 'bg-blue-50/50 dark:bg-blue-950/20')}>
                      <td className="w-10 px-3 py-3.5">
                        <input
                          type="checkbox"
                          checked={selected.has(inv.id)}
                          onChange={() => toggleOne(inv.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{inv.number}</span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{inv.client.name}</td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(inv.dateIssued)}</td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(inv.dueDate)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={inv.status as InvoiceStatus} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatAmount(inv.total)}</span>
                        {(parseFloat(inv.taxRate) > 0 || inv.discountType !== 'NONE') && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
                            {inv.discountType !== 'NONE' && `-${inv.discountType === 'PERCENT' ? inv.discountValue + '%' : formatAmount(inv.discountValue)}`}
                            {inv.discountType !== 'NONE' && parseFloat(inv.taxRate) > 0 && ' · '}
                            {parseFloat(inv.taxRate) > 0 && `VAT ${inv.taxRate}%`}
                          </p>
                        )}
                      </td>
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-5 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Page {page} of {totalPages} · {filtered.length} invoices
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.min(Math.max(page - 2, 1), Math.max(totalPages - 4, 1));
                    const pageNum = start + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          'h-7 w-7 rounded text-xs font-medium transition-colors',
                          page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
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

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete invoices">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
          Delete {selected.size} invoice{selected.size !== 1 ? 's' : ''}? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBulkDeleteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={bulkDeleteMutation.isPending} onClick={() => bulkDeleteMutation.mutate()}>
            {t('common.delete')} {selected.size}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
