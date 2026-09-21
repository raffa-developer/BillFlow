import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/BadgeLegacy';
import { cn } from '@/lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Invoice } from '../types';

type Period = 'day' | 'week' | 'month' | 'year';

function buildRevenueData(invoices: Invoice[], period: Period) {
  const paid = invoices.filter(i => i.status === 'PAID');
  const now = new Date();

  if (period === 'day') {
    return Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`,
      total: paid
        .filter(inv => {
          const d = new Date(inv.dateIssued);
          return d.toDateString() === now.toDateString() && d.getHours() === h;
        })
        .reduce((s, inv) => s + parseFloat(inv.total), 0),
    }));
  }

  if (period === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return {
        label: d.toLocaleDateString('default', { weekday: 'short' }),
        total: paid
          .filter(inv => {
            const id = new Date(inv.dateIssued);
            id.setHours(0, 0, 0, 0);
            return id.getTime() === d.getTime();
          })
          .reduce((s, inv) => s + parseFloat(inv.total), 0),
      };
    });
  }

  if (period === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => ({
      label: `${i + 1}`,
      total: paid
        .filter(inv => {
          const d = new Date(inv.dateIssued);
          return d.getFullYear() === now.getFullYear()
            && d.getMonth() === now.getMonth()
            && d.getDate() === i + 1;
        })
        .reduce((s, inv) => s + parseFloat(inv.total), 0),
    }));
  }

  return Array.from({ length: 12 }, (_, i) => ({
    label: new Date(now.getFullYear(), i, 1).toLocaleDateString('default', { month: 'short' }),
    total: paid
      .filter(inv => {
        const d = new Date(inv.dateIssued);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === i;
      })
      .reduce((s, inv) => s + parseFloat(inv.total), 0),
  }));
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const [period, setPeriod] = useState<Period>('month');

  const { data: invoicesData } = useQuery({ queryKey: ['invoices'], queryFn: () => invoicesApi.list() });

  const invoices = invoicesData?.data.invoices ?? [];

  const revenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.total), 0);
  const pending = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((s, i) => s + parseFloat(i.total), 0);

  const paidCount = invoices.filter(i => i.status === 'PAID').length;
  const collectionRate = Math.round((paidCount / Math.max(invoices.length, 1)) * 100);

  const statusLabels = {
    PAID:    t('common.paid'),
    PENDING: t('common.pending'),
    OVERDUE: t('common.overdue'),
  };

  const statusColors = {
    PAID:    'bg-accent',
    PENDING: 'bg-[#FFB300]',
    OVERDUE: 'bg-destructive',
  };

  const statusData = (['PAID', 'PENDING', 'OVERDUE'] as const).map(status => {
    const count = invoices.filter(i => i.status === status).length;
    const total = invoices.filter(i => i.status === status).reduce((s, i) => s + parseFloat(i.total), 0);
    const pct   = invoices.length > 0 ? Math.round((count / invoices.length) * 100) : 0;
    return { label: statusLabels[status], count, total, pct, color: statusColors[status] };
  });

  const chartData = buildRevenueData(invoices, period);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                period === p ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
              )}
            >
              {t(`dashboard.period${p.charAt(0).toUpperCase() + p.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card data-testid="dashboard-hero-revenue" className="lg:col-span-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.revenue')}</p>
          <p className="font-display mt-1 text-3xl font-bold tracking-tight text-foreground">{formatAmount(revenue)}</p>
          {paidCount > 0 ? (
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip
                    formatter={(v) => formatAmount(Number(v))}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2.5} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex h-40 items-center justify-center">
              <p className="text-sm text-muted-foreground">{t('dashboard.noPayments')}</p>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card data-testid="dashboard-stat-outstanding" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.receivable')}</p>
            <p className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground">{formatAmount(pending)}</p>
          </Card>
          <Card data-testid="dashboard-stat-paid" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.paidRate')}</p>
            <p className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground dark:text-accent">
              {collectionRate}%
            </p>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card data-testid="dashboard-status-bars" className="lg:col-span-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.byStatus')}</p>
          <div className="mt-4 space-y-3">
            {statusData.map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="text-muted-foreground">{s.count} · {formatAmount(s.total)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full', s.color)} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card data-testid="dashboard-recent" className="lg:col-span-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.recentInvoices')}</p>
            <Link to="/invoices" className="text-xs font-semibold text-primary hover:underline">{t('dashboard.viewAll')}</Link>
          </div>
          <div className="mt-3">
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <p className="text-sm">{t('dashboard.noInvoices')}</p>
                <Link to="/invoices/new" className="text-xs font-semibold text-primary hover:underline">{t('dashboard.createFirst')}</Link>
              </div>
            ) : (
              invoices.slice(0, 6).map((inv) => (
                <Link
                  key={inv.id}
                  to={`/invoices/${inv.id}`}
                  className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0 hover:bg-muted/50"
                >
                  <span className="font-mono text-xs font-bold text-foreground">{inv.number}</span>
                  <span className="truncate text-xs text-muted-foreground">{inv.client.name}</span>
                  <StatusBadge status={inv.status} className="ml-auto shrink-0" />
                  <span className="w-24 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                    {formatAmount(parseFloat(inv.total))}
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
