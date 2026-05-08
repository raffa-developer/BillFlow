import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { clientsApi, productsApi, invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { formatCurrency } from '../lib/utils';
import type { CreateInvoiceItem, DiscountType } from '../types';

interface ItemRow extends CreateInvoiceItem {
  _key: number;
}

let keyCounter = 0;
const newRow = (): ItemRow => ({ _key: ++keyCounter, description: '', quantity: 1, price: 0, productId: undefined });

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function NewInvoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<ItemRow[]>([newRow()]);
  const [discountType, setDiscountType] = useState<DiscountType>('NONE');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });
  const { data: productsData } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.list() });
  const clients = clientsData?.data.clients ?? [];
  const products = productsData?.data.products ?? [];

  const totals = useMemo(() => {
    const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.price, 0));
    let discountAmount = 0;
    if (discountType === 'PERCENT') discountAmount = round2((subtotal * discountValue) / 100);
    else if (discountType === 'FIXED') discountAmount = round2(discountValue);
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const taxAmount = round2((afterDiscount * taxRate) / 100);
    const total = round2(afterDiscount + taxAmount);
    return { subtotal, discountAmount, taxAmount, total };
  }, [items, discountType, discountValue, taxRate]);

  const createMutation = useMutation({
    mutationFn: () =>
      invoicesApi.create({
        clientId: parseInt(clientId),
        dateIssued: new Date(dateIssued).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        items: items.map(({ _key, ...item }) => item),
        discountType,
        discountValue,
        taxRate,
        notes: notes || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/invoices/${res.data.invoice.id}`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err.response?.data?.message ?? t('newInvoice.errCreate'));
    },
  });

  const updateItem = (key: number, field: keyof CreateInvoiceItem, value: string | number) => {
    setItems((prev) => prev.map((it) => (it._key === key ? { ...it, [field]: value } : it)));
  };

  const selectProduct = (key: number, productId: string) => {
    const product = products.find((p) => p.id === parseInt(productId));
    if (product) {
      setItems((prev) =>
        prev.map((it) =>
          it._key === key
            ? { ...it, productId: product.id, description: product.name, price: parseFloat(product.price) }
            : it
        )
      );
    } else {
      setItems((prev) => prev.map((it) => (it._key === key ? { ...it, productId: undefined } : it)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!clientId) { setError(t('newInvoice.errNoClient')); return; }
    if (!dueDate) { setError(t('newInvoice.errNoDueDate')); return; }
    if (items.some((i) => !i.description || i.quantity <= 0 || i.price <= 0)) {
      setError(t('newInvoice.errInvalidItems'));
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('newInvoice.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('newInvoice.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('newInvoice.generalInfo')}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label={t('newInvoice.client')} value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">{t('newInvoice.selectClient')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input label={t('newInvoice.issueDate')} type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} required />
            <Input label={t('newInvoice.dueDate')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('newInvoice.items')}</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setItems((p) => [...p, newRow()])}>
              <Plus className="h-3.5 w-3.5" /> {t('newInvoice.addItem')}
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item._key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  <Select
                    label={items.indexOf(item) === 0 ? t('newInvoice.product') : undefined}
                    value={item.productId?.toString() ?? ''}
                    onChange={(e) => selectProduct(item._key, e.target.value)}
                  >
                    <option value="">{t('newInvoice.freeItem')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input
                    label={items.indexOf(item) === 0 ? t('common.description') : undefined}
                    value={item.description}
                    onChange={(e) => updateItem(item._key, 'description', e.target.value)}
                    placeholder={t('newInvoice.descPlaceholder')}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={items.indexOf(item) === 0 ? t('common.qty') : undefined}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item._key, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={items.indexOf(item) === 0 ? t('products.price') : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price || ''}
                    onChange={(e) => updateItem(item._key, 'price', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-1 flex justify-end pb-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setItems((p) => p.filter((i) => i._key !== item._key))}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('newInvoice.discountTax')}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label={t('newInvoice.discountType')} value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
              <option value="NONE">{t('newInvoice.noDiscount')}</option>
              <option value="PERCENT">{t('newInvoice.percentDiscount')}</option>
              <option value="FIXED">{t('newInvoice.fixedDiscount')}</option>
            </Select>
            <Input
              label={t('newInvoice.discountValue')}
              type="number"
              min="0"
              step="0.01"
              value={discountValue || ''}
              disabled={discountType === 'NONE'}
              onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
            />
            <Input
              label={t('newInvoice.taxRate')}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate || ''}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            />
          </div>
          <Input
            label={t('newInvoice.notesOptional')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('newInvoice.notesPlaceholder')}
          />
        </Card>

        <Card className="p-5">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">{t('common.subtotal')}</dt>
              <dd className="text-slate-700 dark:text-slate-300">{formatCurrency(totals.subtotal)}</dd>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">
                  {t('common.discount')}{discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}
                </dt>
                <dd className="text-slate-700 dark:text-slate-300">-{formatCurrency(totals.discountAmount)}</dd>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('common.tax')} ({taxRate}%)</dt>
                <dd className="text-slate-700 dark:text-slate-300">{formatCurrency(totals.taxAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
              <dt className="font-semibold text-slate-900 dark:text-slate-100">{t('common.total')}</dt>
              <dd className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totals.total)}</dd>
            </div>
          </dl>
        </Card>

        {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/invoices')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={createMutation.isPending}>
            {t('newInvoice.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
