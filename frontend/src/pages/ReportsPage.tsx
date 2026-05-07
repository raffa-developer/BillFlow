import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useCurrency } from '../contexts/CurrencyContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Invoice } from '../types';

type Period = '3m' | '6m' | '12m' | 'all';

function getPeriodStart(period: Period): Date | null {
  if (period === 'all') return null;
  const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

function buildMonthlyRevenue(invoices: Invoice[]) {
  const map: Record<string, number> = {};
  for (const inv of invoices) {
    if (inv.status !== 'PAID') continue;
    const d = new Date(inv.dateIssued);
    const key = d.toLocaleDateString('default', { month: 'short', year: '2-digit' });
    map[key] = (map[key] ?? 0) + parseFloat(inv.total);
  }
  return Object.entries(map).map(([month, total]) => ({ month, total }));
}

function buildTopClients(invoices: Invoice[]) {
  const map: Record<string, { name: string; total: number; count: number }> = {};
  for (const inv of invoices) {
    const key = String(inv.clientId);
    if (!map[key]) map[key] = { name: inv.client.name, total: 0, count: 0 };
    map[key].total += parseFloat(inv.total);
    map[key].count += 1;
  }
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const [period, setPeriod] = useState<Period>('6m');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });

  const allInvoices = data?.data.invoices ?? [];

  const filtered = useMemo(() => {
    const start = getPeriodStart(period);
    if (!start) return allInvoices;
    return allInvoices.filter((i) => new Date(i.dateIssued) >= start);
  }, [allInvoices, period]);

  const revenue = filtered.filter((i) => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.total), 0);
  const pending = filtered.filter((i) => i.status === 'PENDING').reduce((s, i) => s + parseFloat(i.total), 0);
  const overdue = filtered.filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + parseFloat(i.total), 0);
  const avg = filtered.length > 0 ? filtered.reduce((s, i) => s + parseFloat(i.total), 0) / filtered.length : 0;

  const monthlyRevenue = useMemo(() => buildMonthlyRevenue(filtered), [filtered]);
  const topClients = useMemo(() => buildTopClients(filtered), [filtered]);

  const periods: { value: Period; label: string }[] = [
    { value: '3m', label: t('reports.period3m') },
    { value: '6m', label: t('reports.period6m') },
    { value: '12m', label: t('reports.period12m') },
    { value: 'all', label: t('reports.periodAll') },
  ];

  const exportCSV = (invoices: Invoice[]) => {
    const headers = [
      t('reports.csvNum'), t('reports.csvClient'), t('reports.csvIssued'),
      t('reports.csvDue'), t('reports.csvStatus'), t('reports.csvSubtotal'),
      t('reports.csvDiscount'), t('reports.csvTax'), t('reports.csvTotal'),
    ];
    const rows = invoices.map((inv) => [
      inv.number, inv.client.name,
      new Date(inv.dateIssued).toLocaleDateString(),
      new Date(inv.dueDate).toLocaleDateString(),
      inv.status, inv.subtotal, inv.discountValue, inv.taxAmount, inv.total,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('reports.title')}</h1>
          <p className="text-sm text-slate-500">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => exportCSV(allInvoices)}>
            <Download className="h-4 w-4" /> {t('reports.exportCsv')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('reports.revenue')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatAmount(revenue)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {t('reports.paidInvoices', { count: filtered.filter((i) => i.status === 'PAID').length })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('reports.pending')}</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{formatAmount(pending)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {t('reports.invoiceCount', { count: filtered.filter((i) => i.status === 'PENDING').length })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('reports.overdue')}</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{formatAmount(overdue)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {t('reports.invoiceCount', { count: filtered.filter((i) => i.status === 'OVERDUE').length })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('reports.avgValue')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatAmount(avg)}</p>
          <p className="text-xs text-slate-400 mt-1">{t('reports.invoiceCount', { count: filtered.length })}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-5">{t('reports.monthlyRevenue')}</h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : monthlyRevenue.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            {t('reports.noPayments')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyRevenue} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAmount(v)} width={80} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: '12px' }}
                formatter={(v) => [formatAmount(Number(v)), t('reports.revenueLabel')]}
              />
              <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">{t('reports.topClients')}</h2>
        </div>
        {topClients.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            {t('reports.noData')}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {topClients.map((client, i) => {
              const pct = topClients[0].total > 0 ? (client.total / topClients[0].total) * 100 : 0;
              return (
                <div key={client.name} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="text-xs font-bold text-slate-400 w-5 shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{client.name}</span>
                      <span className="text-sm font-semibold text-slate-900 ml-4 shrink-0">{formatAmount(client.total)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">
                      {t('reports.invoiceCount', { count: client.count })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
