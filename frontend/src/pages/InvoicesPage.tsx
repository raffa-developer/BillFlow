import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, FileText, Search, X, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLegacyTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table/legacy';
import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import type { ColumnFiltersState, RowSelectionState, SortingState, Updater } from '@tanstack/react-table';
import { invoicesApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/BadgeLegacy';
import { Modal } from '@/components/ui/ModalLegacy';
import { formatDate, cn } from '../lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';
import { useToast } from '../contexts/ToastContext';
import type { Invoice } from '../types';

type SortKey = 'date_desc' | 'date_asc' | 'due_asc' | 'due_desc' | 'total_desc' | 'total_asc' | 'number_asc';

const STATUS_COLORS: Record<string, string> = {
  '':        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  'PENDING': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'PAID':    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'OVERDUE': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const SORT_TO_STATE: Record<SortKey, SortingState> = {
  date_desc:  [{ id: 'issued', desc: true }],
  date_asc:   [{ id: 'issued', desc: false }],
  due_asc:    [{ id: 'issued', desc: false }],
  due_desc:   [{ id: 'issued', desc: true }],
  total_desc: [{ id: 'total', desc: true }],
  total_asc:  [{ id: 'total', desc: false }],
  number_asc: [{ id: 'number', desc: false }],
};

const PAGE_SIZE = 10;

export default function InvoicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const STATUS_OPTS = [
    { value: '',        label: t('invoices.filterAll') },
    { value: 'PENDING', label: t('common.pending') },
    { value: 'PAID',    label: t('common.paid') },
    { value: 'OVERDUE', label: t('common.overdue') },
  ];

  const SORT_OPTS: { value: SortKey; label: string }[] = [
    { value: 'date_desc',  label: t('invoices.sortNewest') },
    { value: 'date_asc',   label: t('invoices.sortOldest') },
    { value: 'due_asc',    label: t('invoices.sortDueSoonest') },
    { value: 'due_desc',   label: t('invoices.sortDueLatest') },
    { value: 'total_desc', label: t('invoices.sortAmountHigh') },
    { value: 'total_asc',  label: t('invoices.sortAmountLow') },
    { value: 'number_asc', label: t('invoices.sortNumber') },
  ];
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

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
  const [rowSelection, setRowSelection]   = useState<RowSelectionState>({});
  const [sorting, setSorting]             = useState<SortingState>(SORT_TO_STATE[sort] ?? SORT_TO_STATE.date_desc);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const filterKey = `${search}|${statusFilter}|${dateFrom}|${dateTo}|${minTotal}|${maxTotal}|${sort}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    // Reset pagination/selection/sorting when filters change (adjust-state-during-render pattern).
    setPrevFilterKey(filterKey);
    setPage(1);
    setRowSelection({});
    setSorting(SORT_TO_STATE[sort] ?? SORT_TO_STATE.date_desc);
  }

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
  const all = useMemo(() => data?.data.invoices ?? [], [data]);

  const columnFilters = useMemo<ColumnFiltersState>(() => [
    ...(statusFilter ? [{ id: 'status', value: statusFilter }] : []),
    ...(dateFrom || dateTo ? [{ id: 'issued', value: dateFrom || dateTo }] : []),
    ...(minTotal || maxTotal ? [{ id: 'total', value: minTotal || maxTotal }] : []),
  ], [statusFilter, dateFrom, dateTo, minTotal, maxTotal]);

  const columns = useMemo<LegacyColumnDef<Invoice>[]>(() => [
    { id: 'select', header: () => null, cell: () => null, enableSorting: false },
    { id: 'number', accessorFn: (i) => i.number, header: t('invoices.colNumber') },
    { id: 'client', accessorFn: (i) => i.client.name, header: t('invoices.colClient') },
    {
      id: 'issued',
      accessorFn: (i) => new Date(i.dateIssued).getTime(),
      header: t('invoices.colIssued'),
      enableGlobalFilter: false,
      filterFn: (row) => {
        const issued = row.getValue<number>('issued');
        if (dateFrom && issued < new Date(dateFrom).getTime()) return false;
        if (dateTo && issued > new Date(dateTo + 'T23:59:59').getTime()) return false;
        return true;
      },
    },
    {
      id: 'status',
      accessorFn: (i) => i.status,
      header: t('invoices.colStatus'),
      enableGlobalFilter: false,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      id: 'total',
      accessorFn: (i) => parseFloat(i.total),
      header: t('invoices.colTotal'),
      enableGlobalFilter: false,
      filterFn: (row) => {
        const total = row.getValue<number>('total');
        if (minTotal && total < parseFloat(minTotal)) return false;
        if (maxTotal && total > parseFloat(maxTotal)) return false;
        return true;
      },
    },
  ], [t, dateFrom, dateTo, minTotal, maxTotal]);

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    setSorting(next);
    const first = next[0];
    if (!first) return;
    const key = (Object.entries(SORT_TO_STATE).find(([, s]) => s[0]?.id === first.id && s[0]?.desc === first.desc)?.[0] ?? 'date_desc') as SortKey;
    setParam('sort', key);
  };

  const table = useLegacyTable({
    data: all,
    columns,
    state: {
      sorting,
      rowSelection,
      globalFilter: search,
      columnFilters,
    },
    onSortingChange: handleSortingChange,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: 'includesString',
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedIds = useMemo(() => new Set(Object.keys(rowSelection).map(Number)), [rowSelection]);
  const filteredRows = table.getSortedRowModel().rows;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.original.dateIssued.slice(0, 7); // yyyy-mm
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const hasActiveFilters = !!(search || statusFilter || dateFrom || dateTo || minTotal || maxTotal);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setDeleteId(null); },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('common.error')),
  });

  const bulkMarkPaidMutation = useMutation({
    mutationFn: () => invoicesApi.bulkMarkPaid(Array.from(selectedIds)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setRowSelection({}); },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('common.error')),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => invoicesApi.bulkDelete(Array.from(selectedIds)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setRowSelection({}); setBulkDeleteOpen(false); },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('common.error')),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('invoices.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('invoices.countFiltered', { filtered: filteredRows.length, total: all.length })}
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
                : `border-transparent ${STATUS_COLORS[opt.value]} hover:opacity-80`
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
            placeholder={t('invoices.searchPlaceholder')}
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
          {t('common.filters')}
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
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('invoices.filterIssuedFrom')}</label>
              <input type="date" value={dateFrom} onChange={e => setParam('from', e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('invoices.filterIssuedTo')}</label>
              <input type="date" value={dateTo} onChange={e => setParam('to', e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('invoices.filterMinAmount')}</label>
              <input type="number" min="0" step="0.01" value={minTotal} onChange={e => setParam('min', e.target.value)} placeholder="0.00"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('invoices.filterMaxAmount')}</label>
              <input type="number" min="0" step="0.01" value={maxTotal} onChange={e => setParam('max', e.target.value)} placeholder="∞"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearAll} className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
              <X className="h-3 w-3" /> {t('common.clearAllFilters')}
            </button>
          )}
        </div>
      )}

      {/* Ledger */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm font-medium">{hasActiveFilters ? t('invoices.noMatch') : t('invoices.none')}</p>
            {hasActiveFilters
              ? <button onClick={clearAll} className="text-xs text-primary hover:underline">{t('common.clearFilters')}</button>
              : <Link to="/invoices/new"><Button variant="secondary" size="sm"><Plus className="h-3.5 w-3.5" /> {t('invoices.new')}</Button></Link>
            }
          </div>
        ) : (
          <>
            {/* Desktop ledger */}
            <div className="hidden overflow-x-auto sm:block">
              {[...grouped.entries()].map(([month, monthRows]) => (
                <div key={month}>
                  <p
                    data-testid={`invoice-group-${month}`}
                    className="bg-muted/50 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    {new Date(`${month}-01T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </p>
                  {monthRows.map((row) => {
                    const inv = row.original;
                    const selected = row.getIsSelected();
                    return (
                      <div
                        key={inv.id}
                        data-testid={`invoice-row-${inv.id}`}
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className={cn(
                          'group flex cursor-pointer items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/40',
                          selected && 'bg-primary/5'
                        )}
                      >
                        <input
                          type="checkbox"
                          data-testid={`invoice-select-${inv.id}`}
                          checked={selected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={row.getToggleSelectedHandler()}
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                        />
                        <span className="w-24 font-mono text-xs font-bold text-foreground">{inv.number}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{inv.client.name}</span>
                        <StatusBadge status={inv.status} className="shrink-0" />
                        <span className="w-28 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                          {formatAmount(parseFloat(inv.total))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden">
              {rows.map((row) => {
                const inv = row.original;
                const selected = row.getIsSelected();
                return (
                  <div
                    key={inv.id}
                    data-testid={`invoice-card-${inv.id}`}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3.5 last:border-b-0',
                      selected && 'bg-primary/5'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={row.getToggleSelectedHandler()}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-muted-foreground">{inv.number}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <p className="truncate font-medium text-foreground">{inv.client.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t('invoices.colDue')}: {formatDate(inv.dueDate)}</p>
                    </div>
                    <span className="shrink-0 font-mono font-semibold tabular-nums text-foreground">{formatAmount(parseFloat(inv.total))}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!isLoading && filteredRows.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground">
              {t('invoices.paginationInfo', { page: safePage, total: totalPages, count: filteredRows.length })}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.min(Math.max(safePage - 2, 1), Math.max(totalPages - 4, 1));
                const pageNum = start + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'h-7 w-7 rounded text-xs font-medium transition-colors',
                      safePage === pageNum
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <Button variant="ghost" size="sm" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {selectedIds.size > 0 && (
        <div data-testid="bulk-bar" className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-sidebar-background px-4 py-2.5 text-xs font-semibold text-sidebar-foreground shadow-lg">
          <span>{t('invoices.selected', { count: selectedIds.size })}</span>
          <button className="text-accent" onClick={() => bulkMarkPaidMutation.mutate()}>{t('invoices.bulkMarkPaid')}</button>
          <button className="text-[#ef9a9a]" onClick={() => setBulkDeleteOpen(true)}>{t('common.delete')}</button>
        </div>
      )}

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title={t('invoices.deleteTitle')}>
        <p className="text-sm text-muted-foreground mb-5">{t('invoices.deleteConfirm')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title={t('invoices.bulkDeleteTitle')}>
        <p className="text-sm text-muted-foreground mb-5">
          {t('invoices.bulkDeleteConfirm', { count: selectedIds.size })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBulkDeleteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={bulkDeleteMutation.isPending} onClick={() => bulkDeleteMutation.mutate()}>
            {t('common.delete')} {selectedIds.size}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
