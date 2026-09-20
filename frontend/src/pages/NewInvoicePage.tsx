import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { clientsApi, productsApi, invoicesApi, meApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useCurrency } from '../contexts/CurrencyContext';
import { calculateInvoiceTotals } from '../lib/invoiceMath';
import { todayLocal, dateOnlyToIso } from '../lib/utils';
import type { CreateInvoiceItem, DiscountType } from '../types';

const DRAFT_KEY = 'billflow_new_invoice_draft';

interface ItemRow extends CreateInvoiceItem {
  _key: number;
}

let keyCounter = 0;
const newRow = (): ItemRow => ({ _key: ++keyCounter, description: '', quantity: 1, price: 0, productId: undefined });

const dateFromDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

interface InvoiceTemplate {
  clientId: number;
  items: CreateInvoiceItem[];
  discountType: DiscountType;
  discountValue: number;
  taxRate: number;
  notes: string;
}

export default function NewInvoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { formatAmount } = useCurrency();

  const template = (location.state as { template?: InvoiceTemplate } | null)?.template;

  const { data: meData, isFetched: meFetched } = useQuery({ queryKey: ['me'], queryFn: () => meApi.get() });
  const userDefaults = meData?.data.user;

  const loadDraft = () => {
    if (template) return null;
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'); } catch { return null; }
  };
  const draft = loadDraft();
  const hadDraft = useRef(!!draft);
  const defaultsApplied = useRef(false);

  const today = todayLocal();

  const [clientId, setClientId] = useState<string>(draft?.clientId ?? (template ? String(template.clientId) : ''));
  const [dateIssued, setDateIssued] = useState<string>(draft?.dateIssued ?? today);
  const [dueDate, setDueDate] = useState<string>(draft?.dueDate ?? '');
  const [items, setItems] = useState<ItemRow[]>(
    draft?.items
      ? draft.items.map((i: CreateInvoiceItem) => ({ ...i, _key: ++keyCounter }))
      : template
      ? template.items.map(i => ({ ...i, _key: ++keyCounter }))
      : [newRow()]
  );
  const [discountType, setDiscountType] = useState<DiscountType>(draft?.discountType ?? template?.discountType ?? 'NONE');
  const [discountValue, setDiscountValue] = useState<number>(draft?.discountValue ?? template?.discountValue ?? 0);
  const [taxRate, setTaxRate] = useState<number>(draft?.taxRate ?? template?.taxRate ?? 0);
  const [notes, setNotes] = useState<string>(draft?.notes ?? template?.notes ?? '');
  const [error, setError] = useState('');
  const [hasDraft, setHasDraft] = useState(!!draft);

  // Apply account defaults once they arrive (avoids the cold-load race where
  // useState initializers run before the ['me'] query resolves).
  useEffect(() => {
    if (!meFetched || defaultsApplied.current) return;
    defaultsApplied.current = true;
    if (hadDraft.current) return;
    baselineRef.current = null; // re-baseline the draft snapshot after applying defaults
    setDueDate((prev) => prev || dateFromDays(userDefaults?.defaultPaymentDays ?? 30));
    setTaxRate((prev) => (prev === 0 ? userDefaults?.defaultTaxRate ?? 0 : prev));
  }, [meFetched, userDefaults]);

  const draftSnapshot = useMemo(
    () =>
      JSON.stringify({
        clientId, dateIssued, dueDate,
        items: items.map((i) => ({ productId: i.productId, description: i.description, quantity: i.quantity, price: i.price })),
        discountType, discountValue, taxRate, notes,
      }),
    [clientId, dateIssued, dueDate, items, discountType, discountValue, taxRate, notes]
  );

  const baselineRef = useRef<string | null>(null);

  // Only persist a draft once the form differs from its baseline — opening and
  // leaving an untouched form must not create a "Draft restored" banner.
  useEffect(() => {
    if (template) return;
    if (baselineRef.current === null) {
      // eslint-disable-next-line react-hooks/immutability -- draft bookkeeping ref, never rendered
      baselineRef.current = draftSnapshot;
      return;
    }
    if (draftSnapshot === baselineRef.current) {
      localStorage.removeItem(DRAFT_KEY);
    } else {
      localStorage.setItem(DRAFT_KEY, draftSnapshot);
    }
  }, [draftSnapshot, template]);

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    // eslint-disable-next-line react-hooks/immutability -- draft bookkeeping ref, never rendered
    baselineRef.current = null;
    setHasDraft(false);
    setClientId('');
    setDateIssued(today);
    setDueDate(dateFromDays(userDefaults?.defaultPaymentDays ?? 30));
    setItems([newRow()]);
    setDiscountType('NONE');
    setDiscountValue(0);
    setTaxRate(userDefaults?.defaultTaxRate ?? 0);
    setNotes('');
  };

  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });
  const { data: productsData } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.list() });
  const clients = clientsData?.data.clients ?? [];
  const products = productsData?.data.products ?? [];

  const totals = useMemo(
    () => calculateInvoiceTotals({ items, discountType, discountValue, taxRate }),
    [items, discountType, discountValue, taxRate]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      invoicesApi.create({
        clientId: parseInt(clientId),
        dateIssued: dateOnlyToIso(dateIssued),
        dueDate: dateOnlyToIso(dueDate),
        items: items.map((i) => ({
          productId: i.productId ?? undefined,
          description: i.description,
          quantity: i.quantity,
          price: i.price,
        })),
        discountType,
        discountValue,
        taxRate,
        notes: notes || undefined,
      }),
    onSuccess: (res) => {
      localStorage.removeItem(DRAFT_KEY);
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['products'] });
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
    if (new Date(dueDate) < new Date(dateIssued)) { setError(t('newInvoice.errDueDateBeforeIssued')); return; }
    if (items.some((i) => !i.description || i.quantity <= 0 || i.price < 0)) {
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
      {template && (
        <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-sm text-blue-700 dark:text-blue-400">
          {t('newInvoice.clonedFrom')}
        </p>
      )}
      {hasDraft && !template && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
          <p className="text-sm text-amber-700 dark:text-amber-400">{t('newInvoice.draftRestored')}</p>
          <button onClick={discardDraft} className="ml-3 text-xs text-amber-600 hover:underline dark:text-amber-400">
            {t('newInvoice.discardDraft')}
          </button>
        </div>
      )}

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

          <div className="space-y-4">
            {items.map((item) => (
              <div key={item._key} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3 sm:border-0 sm:p-0">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-12 sm:items-end">
                  <div className="col-span-2 sm:col-span-3">
                    <Select
                      label={t('newInvoice.product')}
                      value={item.productId?.toString() ?? ''}
                      onChange={(e) => selectProduct(item._key, e.target.value)}
                    >
                      <option value="">{t('newInvoice.freeItem')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <Input
                      label={t('common.description')}
                      value={item.description}
                      onChange={(e) => updateItem(item._key, 'description', e.target.value)}
                      placeholder={t('newInvoice.descPlaceholder')}
                      required
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <Input
                      label={t('common.qty')}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item._key, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <Input
                      label={t('products.price')}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price || ''}
                      onChange={(e) => updateItem(item._key, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2 flex justify-end sm:col-span-1 pb-0.5">
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
              <dd className="text-slate-700 dark:text-slate-300">{formatAmount(totals.subtotal)}</dd>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">
                  {t('common.discount')}{discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}
                </dt>
                <dd className="text-slate-700 dark:text-slate-300">-{formatAmount(totals.discountAmount)}</dd>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">{t('common.tax')} ({taxRate}%)</dt>
                <dd className="text-slate-700 dark:text-slate-300">{formatAmount(totals.taxAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
              <dt className="font-semibold text-slate-900 dark:text-slate-100">{t('common.total')}</dt>
              <dd className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatAmount(totals.total)}</dd>
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
