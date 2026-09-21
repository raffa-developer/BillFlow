import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { clientsApi, productsApi, invoicesApi, meApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/common/PageHeader';
import { Spinner } from '@/components/common/Spinner';
import { useCurrency } from '../contexts/CurrencyContext';
import { calculateInvoiceTotals } from '../lib/invoiceMath';
import { todayLocal, dateOnlyToIso } from '../lib/utils';
import type { CreateInvoiceItem, DiscountType } from '../types';

const DRAFT_KEY = 'billflow_new_invoice_draft';

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

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
    <div className="space-y-5">
      <PageHeader
        title={t('newInvoice.title')}
        subtitle={t('newInvoice.subtitle')}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="new-invoice-form" disabled={createMutation.isPending}>
              {createMutation.isPending && <Spinner className="h-4 w-4 border-current border-t-transparent" />}
              {t('newInvoice.create')}
            </Button>
          </>
        }
      />

      {template && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t('newInvoice.clonedFrom')}
        </p>
      )}
      {hasDraft && !template && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
          <p className="text-sm text-muted-foreground">{t('newInvoice.draftRestored')}</p>
          <button type="button" onClick={discardDraft} className="ml-3 text-xs font-medium text-primary hover:underline">
            {t('newInvoice.discardDraft')}
          </button>
        </div>
      )}

      <form id="new-invoice-form" onSubmit={handleSubmit} className="space-y-5">
        <Card className="space-y-4 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('newInvoice.generalInfo')}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-client">{t('newInvoice.client')}</Label>
              <select
                id="invoice-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className={selectClass}
              >
                <option value="">{t('newInvoice.selectClient')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-date-issued">{t('newInvoice.issueDate')}</Label>
              <Input id="invoice-date-issued" type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-due-date">{t('newInvoice.dueDate')}</Label>
              <Input id="invoice-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('newInvoice.items')}</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setItems((p) => [...p, newRow()])}>
              <Plus className="h-3.5 w-3.5" /> {t('newInvoice.addItem')}
            </Button>
          </div>

          <div>
            {items.map((item) => (
              <div key={item._key} className="border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-12 sm:items-end">
                  <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-3">
                    <Label htmlFor={`invoice-item-product-${item._key}`}>{t('newInvoice.product')}</Label>
                    <select
                      id={`invoice-item-product-${item._key}`}
                      value={item.productId?.toString() ?? ''}
                      onChange={(e) => selectProduct(item._key, e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{t('newInvoice.freeItem')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-4">
                    <Label htmlFor={`invoice-item-description-${item._key}`}>{t('common.description')}</Label>
                    <Input
                      id={`invoice-item-description-${item._key}`}
                      value={item.description}
                      onChange={(e) => updateItem(item._key, 'description', e.target.value)}
                      placeholder={t('newInvoice.descPlaceholder')}
                      required
                    />
                  </div>
                  <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-1">
                    <Label htmlFor={`invoice-item-quantity-${item._key}`}>{t('common.qty')}</Label>
                    <Input
                      id={`invoice-item-quantity-${item._key}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item._key, 'quantity', parseInt(e.target.value) || 1)}
                      className="font-mono tabular-nums"
                    />
                  </div>
                  <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor={`invoice-item-price-${item._key}`}>{t('products.price')}</Label>
                    <Input
                      id={`invoice-item-price-${item._key}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price || ''}
                      onChange={(e) => updateItem(item._key, 'price', parseFloat(e.target.value) || 0)}
                      className="font-mono tabular-nums"
                    />
                  </div>
                  <div className="col-span-1 flex h-9 items-center justify-end font-mono text-sm tabular-nums text-foreground sm:col-span-1">
                    {formatAmount(item.quantity * item.price)}
                  </div>
                  <div className="col-span-1 flex items-center justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t('common.delete')}
                      onClick={() => setItems((p) => p.filter((i) => i._key !== item._key))}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('newInvoice.discountTax')}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-discount-type">{t('newInvoice.discountType')}</Label>
              <select
                id="invoice-discount-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className={selectClass}
              >
                <option value="NONE">{t('newInvoice.noDiscount')}</option>
                <option value="PERCENT">{t('newInvoice.percentDiscount')}</option>
                <option value="FIXED">{t('newInvoice.fixedDiscount')}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-discount-value">{t('newInvoice.discountValue')}</Label>
              <Input
                id="invoice-discount-value"
                type="number"
                min="0"
                step="0.01"
                value={discountValue || ''}
                disabled={discountType === 'NONE'}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-tax-rate">{t('newInvoice.taxRate')}</Label>
              <Input
                id="invoice-tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate || ''}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-notes">{t('newInvoice.notesOptional')}</Label>
            <Textarea
              id="invoice-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('newInvoice.notesPlaceholder')}
              rows={3}
            />
          </div>
        </Card>

        <Card className="p-5">
          <dl className="ml-auto max-w-sm space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-6">
              <dt className="text-muted-foreground">{t('common.subtotal')}</dt>
              <dd className="font-mono tabular-nums text-foreground">{formatAmount(totals.subtotal)}</dd>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex items-center justify-between gap-6">
                <dt className="text-muted-foreground">
                  {t('common.discount')}{discountType === 'PERCENT' ? ` (${discountValue}%)` : ''}
                </dt>
                <dd className="font-mono tabular-nums text-foreground">-{formatAmount(totals.discountAmount)}</dd>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex items-center justify-between gap-6">
                <dt className="text-muted-foreground">{t('common.tax')} ({taxRate}%)</dt>
                <dd className="font-mono tabular-nums text-foreground">{formatAmount(totals.taxAmount)}</dd>
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between gap-6 border-t border-border pt-2">
              <dt className="font-semibold text-foreground">{t('common.total')}</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-foreground">{formatAmount(totals.total)}</dd>
            </div>
          </dl>
        </Card>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
      </form>
    </div>
  );
}
