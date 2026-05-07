import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, Users, Mail, Phone, Eye } from 'lucide-react';
import { clientsApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../contexts/ToastContext';
import type { Client } from '../types';

interface ClientForm { name: string; email: string; phone: string; address: string; }
const emptyForm: ClientForm = { name: '', email: '', phone: '', address: '' };

export default function ClientsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });
  const clients = data?.data.clients ?? [];
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        ...(form.email && { email: form.email }),
        ...(form.phone && { phone: form.phone }),
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
      toast.success(t('clients.deleted'));
      setDeleteId(null);
    },
    onError: () => toast.error(t('clients.errorDelete')),
  });

  const openCreate = () => { setForm(emptyForm); setModal({ open: true, client: null }); };
  const openEdit = (c: Client) => {
    setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '' });
    setModal({ open: true, client: c });
  };
  const closeModal = () => setModal({ open: false, client: null });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('clients.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('clients.count', { count: clients.length })}</p>
        </div>
        <Button onClick={openCreate} className="shrink-0"><Plus className="h-4 w-4" /> {t('clients.new')}</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('clients.search')}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">{search ? t('common.noResults') : t('clients.none')}</p>
            {!search && (
              <Button variant="secondary" size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> {t('clients.addClient')}</Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/clients/${c.id}`} className="font-medium text-slate-800 hover:text-blue-600 transition-colors">{c.name}</Link>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {c.email && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail className="h-3 w-3" />{c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3 w-3" />{c.phone}</span>}
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
          <Input label={`${t('common.name')} *`} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('clients.namePlaceholder')} required />
          <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('clients.emailPlaceholder')} />
          <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('clients.phonePlaceholder')} />
          <Input label={t('common.address')} value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t('clients.addressPlaceholder')} />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saveMutation.isPending}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title={t('clients.deleteTitle')}>
        <p className="text-sm text-slate-600 mb-5">{t('clients.deleteConfirm')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>{t('common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}
