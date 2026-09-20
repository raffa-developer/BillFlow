import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Package, FileText, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clientsApi, productsApi, invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { formatDate, cn } from '../lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTheme } from '../contexts/ThemeContext';
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

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  href: string;
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, href }: StatCardProps) {
  return (
    <Link to={href}>
      <Card className="group p-5 hover:shadow-md cursor-pointer overflow-hidden transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
          </div>
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110',
            iconBg
          )}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [period, setPeriod] = useState<Period>('month');

  const { data: clientsData }  = useQuery({ queryKey: ['clients'],  queryFn: () => clientsApi.list() });
  const { data: productsData } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.list() });
  const { data: invoicesData } = useQuery({ queryKey: ['invoices'], queryFn: () => invoicesApi.list() });

  const clients  = clientsData?.data.clients   ?? [];
  const products = productsData?.data.products ?? [];
  const invoices = invoicesData?.data.invoices ?? [];

  const revenue        = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.total), 0);
  const pending        = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((s, i) => s + parseFloat(i.total), 0);
  const hasPaidInvoices = invoices.some(i => i.status === 'PAID');
  const revenueData    = buildRevenueData(invoices, period);
  const recent         = [...invoices].slice(0, 6);

  const statusLabels = {
    PAID:    t('common.paid'),
    PENDING: t('common.pending'),
    OVERDUE: t('common.overdue'),
  };

  const periods: { key: Period; label: string }[] = [
    { key: 'day',   label: t('dashboard.periodDay') },
    { key: 'week',  label: t('dashboard.periodWeek') },
    { key: 'month', label: t('dashboard.periodMonth') },
    { key: 'year',  label: t('dashboard.periodYear') },
  ];

  // Chart colors that adapt to theme
  const chart = {
    grid:        isDark ? '#1e293b' : '#f1f5f9',
    tick:        isDark ? '#64748b' : '#94a3b8',
    tooltipBg:   isDark ? '#0f172a' : '#ffffff',
    tooltipBorder: isDark ? '#1e293b' : '#e2e8f0',
    tooltipLabel: isDark ? '#94a3b8' : '#64748b',
    tooltipValue: isDark ? '#60a5fa' : '#1d4ed8',
    gradStart:   isDark ? 0.25 : 0.15,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{t('dashboard.title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('dashboard.clients')}    value={clients.length}        icon={Users}      iconBg="bg-blue-100 dark:bg-blue-500/15"   iconColor="text-blue-600 dark:text-blue-400"   href="/clients" />
        <StatCard label={t('dashboard.products')}   value={products.length}       icon={Package}    iconBg="bg-violet-100 dark:bg-violet-500/15" iconColor="text-violet-600 dark:text-violet-400" href="/products" />
        <StatCard label={t('dashboard.revenue')}    value={formatAmount(revenue)} icon={TrendingUp} iconBg="bg-emerald-100 dark:bg-emerald-500/15" iconColor="text-emerald-600 dark:text-emerald-400" href="/invoices" />
        <StatCard label={t('dashboard.receivable')} value={formatAmount(pending)} icon={FileText}   iconBg="bg-amber-100 dark:bg-amber-500/15"   iconColor="text-amber-600 dark:text-amber-400"   href="/invoices" />
      </div>

      {/* Chart + status breakdown */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('dashboard.revenueChart')}
            </h2>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
              {periods.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                    period === p.key
                      ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300 dark:shadow-none'
                      : 'text-muted-foreground hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {!hasPaidInvoices ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              {t('dashboard.noPayments')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={chart.gradStart} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: chart.tick }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: chart.tick }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatAmount(v)}
                  width={72}
                />
                <Tooltip
                  contentStyle={{
                    background: chart.tooltipBg,
                    borderRadius: '10px',
                    border: `1px solid ${chart.tooltipBorder}`,
                    boxShadow: isDark
                      ? '0 8px 24px rgba(0,0,0,0.5)'
                      : '0 8px 20px -4px rgba(0,0,0,0.10)',
                    fontSize: '12px',
                    padding: '8px 14px',
                  }}
                  itemStyle={{ color: chart.tooltipValue, fontWeight: 600 }}
                  labelStyle={{ color: chart.tooltipLabel, marginBottom: 2 }}
                  formatter={(v) => [formatAmount(Number(v)), t('dashboard.revenue')]}
                  cursor={{ stroke: isDark ? '#334155' : '#cbd5e1', strokeWidth: 1 }}
                />
                <Area
                  type="monotoneX"
                  dataKey="total"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                  dot={{ r: 3, fill: '#3b82f6', stroke: isDark ? '#0f172a' : '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#3b82f6', stroke: isDark ? '#0f172a' : '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Invoice status breakdown */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('dashboard.byStatus')}
          </h2>
          <div className="space-y-4">
            {(['PAID', 'PENDING', 'OVERDUE'] as const).map(status => {
              const count = invoices.filter(i => i.status === status).length;
              const total = invoices.filter(i => i.status === status).reduce((s, i) => s + parseFloat(i.total), 0);
              const pct   = invoices.length > 0 ? Math.round((count / invoices.length) * 100) : 0;
              const bar   = { PAID: 'bg-emerald-500', PENDING: 'bg-amber-400', OVERDUE: 'bg-red-500' };
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{statusLabels[status]}</span>
                    <span className="text-muted-foreground">{count} · {formatAmount(total)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={cn('h-1.5 rounded-full transition-all duration-500', bar[status])} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent invoices */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('dashboard.recentInvoices')}
          </h2>
          <Link
            to="/invoices"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            {t('dashboard.viewAll')} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-slate-400 dark:text-slate-500">
            <FileText className="h-8 w-8" />
            <p className="text-sm">{t('dashboard.noInvoices')}</p>
            <Link to="/invoices/new" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
              {t('dashboard.createFirst')}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((inv) => (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className={cn(
                  'flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  inv.status === 'OVERDUE' && 'border-l-[3px] border-l-red-500 pl-[calc(1.25rem-3px)]'
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground text-xs font-mono font-bold dark:bg-slate-800 dark:text-slate-400">
                  #{inv.id}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{inv.client.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(inv.dateIssued)}</p>
                </div>
                <StatusBadge status={inv.status} />
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {formatAmount(inv.total)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
