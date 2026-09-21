import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, Users, Mail, Phone, Eye, X, SlidersHorizontal } from 'lucide-react';
import { clientsApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { LoadingState } from '@/components/common/Spinner';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../lib/utils';
import type { Client } from '../types';

interface ClientForm { name: string; email: string; phone: string; address: string; }
const emptyForm: ClientForm = { name: '', email: '', phone: '', address: '' };

type SortKey = 'name_asc' | 'name_desc' | 'newest' | 'oldest';

function applySort(list: Client[], sort: SortKey): Client[] {
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'name_asc':  return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'newest':    return b.id - a.id;
      case 'oldest':    return a.id - b.id;
    }
  });
}

export default function ClientsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const SORT_OPTS: { value: SortKey; label: string }[] = [
    { value: 'name_asc',  label: t('clients.sortNameAZ') },
    { value: 'name_desc', label: t('clients.sortNameZA') },
    { value: 'newest',    label: t('clients.sortNewest') },
    { value: 'oldest',    label: t('clients.sortOldest') },
  ];
  const { toast } = useToast();

  const [search, setSearch]           = useState('');
  const [sort, setSort]               = useState<SortKey>('newest');
  const [hasEmail, setHasEmail]       = useState(false);
  const [hasPhone, setHasPhone]       = useState(false);
  const [hasAddress, setHasAddress]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal]             = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });
  const [form, setForm]               = useState<ClientForm>(emptyForm);
  const [deleteId, setDeleteId]       = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [page, setPage]               = useState(1);

  const { data, isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });
  const all = useMemo(() => data?.data.clients ?? [], [data]);

  const filtered = useMemo(() => {
    let list = all as Client[];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
      );
    }

    if (hasEmail)   list = list.filter(c => !!c.email);
    if (hasPhone)   list = list.filter(c => !!c.phone);
    if (hasAddress) list = list.filter(c => !!c.address);

    return applySort(list, sort);
  }, [all, search, sort, hasEmail, hasPhone, hasAddress]);

  const hasActiveFilters = !!(search || hasEmail || hasPhone || hasAddress);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filterKey = `${search}|${sort}|${hasEmail}|${hasPhone}|${hasAddress}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    // Reset to page 1 when filters change (documented adjust-state-during-render pattern).
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const clearAll = () => {
    setSearch(''); setHasEmail(false); setHasPhone(false); setHasAddress(false);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      };
      return modal.client ? clientsApi.update(modal.client.id, payload) : clientsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(modal.client ? t('clients.updated') : t('clients.saved'));
      closeModal();
    },
    onError: () => toast.error(t('clients.errorSave')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => clientsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(t('clients.deleted'));
      setDeleteId(null);
      setDeleteError('');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setDeleteError(err.response?.data?.message ?? t('clients.errorDelete'));
    },
  });

  const openCreate = () => { setForm(emptyForm); setModal({ open: true, client: null }); };
  const openEdit   = (c: Client) => {
    setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '' });
    setModal({ open: true, client: c });
  };
  const closeModal = () => setModal({ open: false, client: null });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('clients.title')}
        subtitle={t('clients.countFiltered', { filtered: filtered.length, total: all.length })}
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> {t('clients.new')}</Button>}
      />

      {/* Search + controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('clients.search')}
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
              {[search, hasEmail, hasPhone, hasAddress].filter(Boolean).length}
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('clients.filterOnlyWith')}</p>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'hasEmail',   label: t('common.email'),   value: hasEmail,   set: setHasEmail },
              { key: 'hasPhone',   label: t('common.phone'),   value: hasPhone,   set: setHasPhone },
              { key: 'hasAddress', label: t('common.address'), value: hasAddress, set: setHasAddress },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => f.set(v => !v)}
                aria-pressed={f.value}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  f.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                )}
              >
                {f.label}
              </button>
            ))}
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
            icon={Users}
            title={hasActiveFilters ? t('clients.noMatch') : t('clients.none')}
            action={hasActiveFilters
              ? <button onClick={clearAll} className="text-xs text-primary hover:underline">{t('common.clearFilters')}</button>
              : <Button variant="secondary" size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> {t('clients.addClient')}</Button>
            }
          />
        ) : (
          paginated.map(c => (
            <div key={c.id} className="group flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-muted/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {c.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/clients/${c.id}`} className="rounded font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
                  {c.name}
                </Link>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {c.email   && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{c.email}</span>}
                  {c.phone   && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.address && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{c.address}</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <Link to={`/clients/${c.id}`}>
                  <Button variant="ghost" size="sm" title={t('clients.viewDetails')} aria-label={t('clients.viewDetails')}><Eye className="h-3.5 w-3.5" /></Button>
                </Link>
                <Button variant="ghost" size="sm" title={t('common.edit')} aria-label={t('common.edit')} onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" title={t('common.delete')} aria-label={t('common.delete')} onClick={() => setDeleteId(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))
        )}

        <Pagination
          page={safePage}
          totalPages={totalPages}
          label={t('clients.paginationInfo', { page: safePage, total: totalPages, count: filtered.length })}
          onPageChange={setPage}
          prevLabel={t('invoices.prevPage')}
          nextLabel={t('invoices.nextPage')}
        />
      </Card>

      <Modal open={modal.open} onClose={closeModal} title={modal.client ? t('clients.editTitle') : t('clients.newTitle')}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-name">{`${t('common.name')} *`}</Label>
            <Input id="client-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('clients.namePlaceholder')} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-email">{t('common.email')}</Label>
            <Input id="client-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('clients.emailPlaceholder')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-phone">{t('common.phone')}</Label>
            <Input id="client-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('clients.phonePlaceholder')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-address">{t('common.address')}</Label>
            <Input id="client-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t('clients.addressPlaceholder')} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saveMutation.isPending}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => { setDeleteId(null); setDeleteError(''); }} title={t('clients.deleteTitle')} description={t('clients.deleteConfirm')}>
        {deleteError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">{deleteError}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setDeleteId(null); setDeleteError(''); }}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>{t('common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}
