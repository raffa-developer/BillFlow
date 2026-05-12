import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, Package, X, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { productsApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { cn } from '../lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';
import type { Product } from '../types';

interface ProductForm { name: string; price: string; description: string; }
const emptyForm: ProductForm = { name: '', price: '', description: '' };

type SortKey = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest';

function applySort(list: Product[], sort: SortKey): Product[] {
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'newest':     return b.id - a.id;
      case 'name_asc':   return a.name.localeCompare(b.name);
      case 'name_desc':  return b.name.localeCompare(a.name);
      case 'price_asc':  return parseFloat(a.price) - parseFloat(b.price);
      case 'price_desc': return parseFloat(b.price) - parseFloat(a.price);
    }
  });
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const SORT_OPTS: { value: SortKey; label: string }[] = [
    { value: 'newest',     label: t('products.sortNewest') },
    { value: 'name_asc',   label: t('products.sortNameAZ') },
    { value: 'name_desc',  label: t('products.sortNameZA') },
    { value: 'price_asc',  label: t('products.sortPriceLow') },
    { value: 'price_desc', label: t('products.sortPriceHigh') },
  ];
  const { formatAmount } = useCurrency();

  const [search, setSearch]           = useState('');
  const [sort, setSort]               = useState<SortKey>('newest');
  const [minPrice, setMinPrice]       = useState('');
  const [maxPrice, setMaxPrice]       = useState('');
  const [hasDesc, setHasDesc]         = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal]             = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [form, setForm]               = useState<ProductForm>(emptyForm);
  const [deleteId, setDeleteId]       = useState<number | null>(null);
  const [page, setPage]               = useState(1);

  const { data, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.list() });
  const all = data?.data.products ?? [];

  const filtered = useMemo(() => {
    let list = all as Product[];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }

    if (minPrice) list = list.filter(p => parseFloat(p.price) >= parseFloat(minPrice));
    if (maxPrice) list = list.filter(p => parseFloat(p.price) <= parseFloat(maxPrice));
    if (hasDesc)  list = list.filter(p => !!p.description);

    return applySort(list, sort);
  }, [all, search, sort, minPrice, maxPrice, hasDesc]);

  const hasActiveFilters = !!(search || minPrice || maxPrice || hasDesc);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, sort, minPrice, maxPrice, hasDesc]);

  const clearAll = () => {
    setSearch(''); setMinPrice(''); setMaxPrice(''); setHasDesc(false);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        price: parseFloat(form.price),
        ...(form.description && { description: form.description }),
      };
      return modal.product ? productsApi.update(modal.product.id, payload) : productsApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setDeleteId(null); },
  });

  const openCreate = () => { setForm(emptyForm); setModal({ open: true, product: null }); };
  const openEdit   = (p: Product) => {
    setForm({ name: p.name, price: p.price, description: p.description ?? '' });
    setModal({ open: true, product: p });
  };
  const closeModal = () => setModal({ open: false, product: null });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('products.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('products.countFiltered', { filtered: filtered.length, total: all.length })}
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> {t('products.new')}</Button>
      </div>

      {/* Search + controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('products.search')}
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
            'flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium h-9 transition-colors',
            showFilters || hasActiveFilters
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('common.filters')}
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {[search, minPrice, maxPrice, hasDesc].filter(Boolean).length}
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

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('products.filterMinPrice')}</label>
              <input type="number" min="0" step="0.01" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="0.00"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('products.filterMaxPrice')}</label>
              <input type="number" min="0" step="0.01" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="∞"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="flex flex-col justify-end gap-1">
              <button
                onClick={() => setHasDesc(v => !v)}
                className={cn(
                  'h-8 rounded-lg border px-3 text-xs font-medium transition-colors',
                  hasDesc
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {t('products.filterHasDesc')}
              </button>
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearAll} className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
              <X className="h-3 w-3" /> {t('common.clearAllFilters')}
            </button>
          )}
        </div>
      )}

      {/* List */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400 dark:text-slate-500">
            <Package className="h-8 w-8" />
            <p className="text-sm font-medium">{hasActiveFilters ? t('products.noMatch') : t('products.none')}</p>
            {hasActiveFilters
              ? <button onClick={clearAll} className="text-xs text-blue-500 hover:underline">{t('common.clearFilters')}</button>
              : <Button variant="secondary" size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> {t('products.new')}</Button>
            }
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{p.name}</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 truncate">
                    {p.description || <span className="italic">{t('products.noDescription')}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {(p.invoiceCount ?? 0) > 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      {t('products.usedIn', { count: p.invoiceCount })}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                    {formatAmount(p.price)}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-5 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('products.paginationInfo', { page, total: totalPages, count: filtered.length })}
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
      </Card>

      <Modal open={modal.open} onClose={closeModal} title={modal.product ? t('products.editTitle') : t('products.newTitle')}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label={t('products.price')} type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          <Input label={t('common.description')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saveMutation.isPending}>{t('products.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title={t('products.deleteTitle')}>
        {(() => {
          const prod = all.find(p => p.id === deleteId);
          const count = prod?.invoiceCount ?? 0;
          return (
            <>
              {count > 0 && (
                <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-700 dark:text-amber-400 mb-3">
                  {t('products.usedInWarning', { count })}
                </p>
              )}
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">{t('products.deleteConfirm')}</p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
                <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>
                  {t('common.delete')}
                </Button>
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
