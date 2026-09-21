import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, Package, X, SlidersHorizontal } from 'lucide-react';
import { productsApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { LoadingState } from '@/components/common/Spinner';
import { cn } from '../lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';
import { useToast } from '../contexts/ToastContext';
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
  const { toast } = useToast();

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
  const all = useMemo(() => data?.data.products ?? [], [data]);

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
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filterKey = `${search}|${sort}|${minPrice}|${maxPrice}|${hasDesc}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    // Reset to page 1 when filters change (documented adjust-state-during-render pattern).
    setPrevFilterKey(filterKey);
    setPage(1);
  }

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
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('common.error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setDeleteId(null); },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('common.error')),
  });

  const openCreate = () => { setForm(emptyForm); setModal({ open: true, product: null }); };
  const openEdit   = (p: Product) => {
    setForm({ name: p.name, price: p.price, description: p.description ?? '' });
    setModal({ open: true, product: p });
  };
  const closeModal = () => setModal({ open: false, product: null });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.countFiltered', { filtered: filtered.length, total: all.length })}
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> {t('products.new')}</Button>}
      />

      {/* Search + controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('products.search')}
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              aria-label={t('common.clearFilters')}
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(v => !v)}
          aria-expanded={showFilters}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors h-9',
            showFilters || hasActiveFilters
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-foreground hover:bg-muted'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('common.filters')}
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {[search, minPrice, maxPrice, hasDesc].filter(Boolean).length}
            </span>
          )}
        </button>

        <select
          value={sort}
          aria-label={t('invoices.sort')}
          onChange={e => setSort(e.target.value as SortKey)}
          className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="product-filter-min-price" className="text-xs font-medium text-muted-foreground">{t('products.filterMinPrice')}</label>
              <input id="product-filter-min-price" type="number" min="0" step="0.01" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="0.00"
                className="h-8 rounded-lg border border-border bg-card px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="product-filter-max-price" className="text-xs font-medium text-muted-foreground">{t('products.filterMaxPrice')}</label>
              <input id="product-filter-max-price" type="number" min="0" step="0.01" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="∞"
                className="h-8 rounded-lg border border-border bg-card px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="flex flex-col justify-end gap-1">
              <button
                onClick={() => setHasDesc(v => !v)}
                aria-pressed={hasDesc}
                className={cn(
                  'h-8 rounded-lg border px-3 text-xs font-medium transition-colors',
                  hasDesc
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                )}
              >
                {t('products.filterHasDesc')}
              </button>
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearAll} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-3 w-3" /> {t('common.clearAllFilters')}
            </button>
          )}
        </div>
      )}

      {/* List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={hasActiveFilters ? t('products.noMatch') : t('products.none')}
            action={hasActiveFilters
              ? <button onClick={clearAll} className="text-xs text-primary hover:underline">{t('common.clearFilters')}</button>
              : <Button variant="secondary" size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> {t('products.new')}</Button>
            }
          />
        ) : (
          paginated.map(p => (
            <div key={p.id} className="group flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{p.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {p.description || <span className="italic">{t('products.noDescription')}</span>}
                </p>
              </div>
              {(p.invoiceCount ?? 0) > 0 && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                  {t('products.usedIn', { count: p.invoiceCount })}
                </span>
              )}
              <span className="w-28 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                {formatAmount(p.price)}
              </span>
              <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" aria-label={t('common.edit')} onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" aria-label={t('common.delete')} onClick={() => setDeleteId(p.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}

        <Pagination
          page={safePage}
          totalPages={totalPages}
          label={t('products.paginationInfo', { page: safePage, total: totalPages, count: filtered.length })}
          onPageChange={setPage}
          prevLabel={t('invoices.prevPage')}
          nextLabel={t('invoices.nextPage')}
        />
      </Card>

      <Modal open={modal.open} onClose={closeModal} title={modal.product ? t('products.editTitle') : t('products.newTitle')}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-name">{t('common.name')}</Label>
            <Input id="product-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-price">{t('products.price')}</Label>
            <Input id="product-price" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-description">{t('common.description')}</Label>
            <Input id="product-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saveMutation.isPending}>{t('products.save')}</Button>
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
                <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {t('products.usedInWarning', { count })}
                </p>
              )}
              <p className="mb-5 text-sm text-muted-foreground">{t('products.deleteConfirm')}</p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
                <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>
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
