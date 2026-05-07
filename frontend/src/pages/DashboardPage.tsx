import { useQuery } from '@tanstack/react-query';
import { Users, Package, FileText, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clientsApi, productsApi, invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { formatDate, cn } from '../lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Invoice } from '../types';

function buildRevenueData(invoices: Invoice[]) {
  const map: Record<string, number> = {};
  for (const inv of invoices) {
    if (inv.status !== 'PAID') continue;
    const month = new Date(inv.dateIssued).toLocaleDateString('default', { month: 'short', year: '2-digit' });
    map[month] = (map[month] ?? 0) + parseFloat(inv.total);
  }
  return Object.entries(map).map(([month, total]) => ({ month, total })).slice(-6);
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
      <Card className="group p-5 hover:shadow-md cursor-pointer overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
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
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });
  const { data: productsData } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.list() });
  const { data: invoicesData } = useQuery({ queryKey: ['invoices'], queryFn: () => invoicesApi.list() });

  const clients = clientsData?.data.clients ?? [];
  const products = productsData?.data.products ?? [];
  const invoices = invoicesData?.data.invoices ?? [];

  const revenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.total), 0);
  const pending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + parseFloat(i.total), 0);
  const revenueData = buildRevenueData(invoices);
  const recent = [...invoices].slice(0, 6);

  const statusLabels = {
    PAID: t('common.paid'),
    PENDING: t('common.pending'),
    OVERDUE: t('common.overdue'),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('dashboard.clients')}   value={clients.length}       icon={Users}       iconBg="bg-blue-100"   iconColor="text-blue-600"   href="/clients" />
        <StatCard label={t('dashboard.products')}  value={products.length}      icon={Package}     iconBg="bg-violet-100" iconColor="text-violet-600" href="/products" />
        <StatCard label={t('dashboard.revenue')}   value={formatAmount(revenue)} icon={TrendingUp}  iconBg="bg-green-100"  iconColor="text-green-600"  href="/invoices" />
        <StatCard label={t('dashboard.receivable')} value={formatAmount(pending)} icon={FileText}    iconBg="bg-amber-100"  iconColor="text-amber-600"  href="/invoices" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">{t('dashboard.monthlyRevenue')}</h2>
          </div>
          {revenueData.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              {t('dashboard.noPayments')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAmount(v)} width={70} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 8px 16px -4px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px' }}
                  itemStyle={{ color: '#1e40af', fontWeight: 600 }}
                  labelStyle={{ color: '#64748b', marginBottom: 2 }}
                  formatter={(v) => [formatAmount(Number(v)), t('dashboard.revenue')]}
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fill="url(#grad)" dot={false} activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Invoice status summary */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">{t('dashboard.byStatus')}</h2>
          <div className="space-y-3">
            {(['PAID', 'PENDING', 'OVERDUE'] as const).map(status => {
              const count = invoices.filter(i => i.status === status).length;
              const total = invoices.filter(i => i.status === status).reduce((s, i) => s + parseFloat(i.total), 0);
              const pct = invoices.length > 0 ? Math.round((count / invoices.length) * 100) : 0;
              const colors = { PAID: 'bg-green-500', PENDING: 'bg-amber-400', OVERDUE: 'bg-red-500' };
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{statusLabels[status]}</span>
                    <span className="text-slate-400">{count} · {formatAmount(total)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full ${colors[status]} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent invoices */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">{t('dashboard.recentInvoices')}</h2>
          <Link to="/invoices" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
            {t('dashboard.viewAll')} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
            <FileText className="h-8 w-8" />
            <p className="text-sm">{t('dashboard.noInvoices')}</p>
            <Link to="/invoices/new" className="text-xs font-medium text-blue-600 hover:underline">{t('dashboard.createFirst')}</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map((inv) => (
              <Link key={inv.id} to={`/invoices/${inv.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 text-xs font-mono font-bold">
                  #{inv.id}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{inv.client.name}</p>
                  <p className="text-xs text-slate-400">{formatDate(inv.dateIssued)}</p>
                </div>
                <StatusBadge status={inv.status} />
                <span className="text-sm font-semibold text-slate-700 shrink-0">{formatAmount(inv.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
