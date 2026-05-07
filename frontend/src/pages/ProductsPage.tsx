import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import { productsApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { formatCurrency } from '../lib/utils';
import type { Product } from '../types';

interface ProductForm {
  name: string;
  price: string;
  description: string;
}

const emptyForm: ProductForm = { name: '', price: '', description: '' };

export default function ProductsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.list() });
  const products = data?.data.products ?? [];
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        price: parseFloat(form.price),
        ...(form.description && { description: form.description }),
      };
      return modal.product
        ? productsApi.update(modal.product.id, payload)
        : productsApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setDeleteId(null); },
  });

  const openCreate = () => { setForm(emptyForm); setModal({ open: true, product: null }); };
  const openEdit = (p: Product) => { setForm({ name: p.name, price: p.price, description: p.description ?? '' }); setModal({ open: true, product: p }); };
  const closeModal = () => setModal({ open: false, product: null });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('products.title')}</h1>
          <p className="text-sm text-slate-500">{t('products.count', { count: products.length })}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> {t('products.new')}</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('products.search')}
          className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <Package className="h-8 w-8" />
            <p className="text-sm">{search ? t('common.noResults') : t('products.none')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{p.name}</p>
                  <p className="text-sm text-slate-400">{p.description || t('products.noDescription')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(p.price)}</span>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modal.open} onClose={closeModal} title={modal.product ? t('products.editTitle') : t('products.newTitle')}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label={t('products.price')} type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} required />
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saveMutation.isPending}>{t('products.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title={t('products.deleteTitle')}>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">{t('products.deleteConfirm')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>{t('common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}
