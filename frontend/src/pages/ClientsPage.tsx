import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, Users, Mail, Phone, Eye, X, SlidersHorizontal } from 'lucide-react';
import { clientsApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../lib/utils';
import type { Client } from '../types';

interface ClientForm { name: string; email: string; phone: string; address: string; }
const emptyForm: ClientForm = { name: '', email: '', phone: '', address: '' };

type SortKey = 'name_asc' | 'name_desc' | 'newest' | 'oldest';
const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: 'name_asc',  label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'newest',    label: 'Newest first' },
  { value: 'oldest',    label: 'Oldest first' },
];

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

  const { data, isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });
  const all = data?.data.clients ?? [];

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

  const clearAll = () => {
    setSearch(''); setHasEmail(false); setHasPhone(false); setHasAddress(false);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        ...(form.email   && { email: form.email }),
        ...(form.phone   && { phone: form.phone }),
        ...(form.address && { address: form.address }),
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
    },
    onError: () => toast.error(t('clients.errorDelete')),
  });

  const openCreate = () => { setForm(emptyForm); setModal({ open: true, client: null }); };
  const openEdit   = (c: Client) => {
    setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '' });
    setModal({ open: true, client: c });
  };
  const closeModal = () => setModal({ open: false, client: null });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('clients.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {filtered.length} of {all.length} clients
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0"><Plus className="h-4 w-4" /> {t('clients.new')}</Button>
      </div>

      {/* Search + controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone or address…"
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
          Filters
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {[search, hasEmail, hasPhone, hasAddress].filter(Boolean).length}
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
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">Only show clients with</p>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'hasEmail',   label: 'Email', value: hasEmail,   set: setHasEmail },
              { key: 'hasPhone',   label: 'Phone', value: hasPhone,   set: setHasPhone },
              { key: 'hasAddress', label: 'Address', value: hasAddress, set: setHasAddress },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => f.set(v => !v)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  f.value
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button onClick={clearAll} className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
              <X className="h-3 w-3" /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* List */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400 dark:text-slate-500">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">{hasActiveFilters ? 'No clients match your filters' : t('clients.none')}</p>
            {hasActiveFilters
              ? <button onClick={clearAll} className="text-xs text-blue-500 hover:underline">Clear filters</button>
              : <Button variant="secondary" size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> {t('clients.addClient')}</Button>
            }
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {filtered.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 text-sm font-semibold">
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/clients/${c.id}`} className="font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors">
                    {c.name}
                  </Link>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {c.email   && <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"><Mail className="h-3 w-3" />{c.email}</span>}
                    {c.phone   && <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"><Phone className="h-3 w-3" />{c.phone}</span>}
                    {c.address && <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{c.address}</span>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/clients/${c.id}`}>
                    <Button variant="ghost" size="sm" title={t('clients.viewDetails')}><Eye className="h-3.5 w-3.5" /></Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title={t('common.edit')}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(c.id)} className="text-red-400 hover:text-red-600" title={t('common.delete')}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modal.open} onClose={closeModal} title={modal.client ? t('clients.editTitle') : t('clients.newTitle')}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <Input label={`${t('common.name')} *`} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('clients.namePlaceholder')} required />
          <Input label={t('common.email')} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('clients.emailPlaceholder')} />
          <Input label={t('common.phone')} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('clients.phonePlaceholder')} />
          <Input label={t('common.address')} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t('clients.addressPlaceholder')} />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saveMutation.isPending}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title={t('clients.deleteTitle')}>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">{t('clients.deleteConfirm')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>{t('common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}
