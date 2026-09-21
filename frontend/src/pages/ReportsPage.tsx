import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download, TrendingUp, Clock, AlertCircle, BarChart3, X,
  FileText, Table2, Printer, ChevronDown,
} from 'lucide-react';
import { invoicesApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '../components/ui/BadgeLegacy';
import { useCurrency } from '../contexts/CurrencyContext';
import { formatDate, cn } from '../lib/utils';
import { discountAmountFor } from '../lib/invoiceMath';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Invoice } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

/* ── period helpers ─────────────────────────────────────────────── */

type Preset = '1m' | '3m' | '6m' | '12m' | 'all' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: '1m',     label: '1M' },
  { value: '3m',     label: '3M' },
  { value: '6m',     label: '6M' },
  { value: '12m',    label: '12M' },
  { value: 'all',    label: 'All' },
  { value: 'custom', label: 'Custom' },
];

function presetStart(preset: Preset): Date | null {
  if (preset === 'all' || preset === 'custom') return null;
  const months = preset === '1m' ? 1 : preset === '3m' ? 3 : preset === '6m' ? 6 : 12;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ── data builders ──────────────────────────────────────────────── */

function buildMonthlyRevenue(invoices: Invoice[]) {
  const map = new Map<string, { month: string; paid: number; pending: number; overdue: number }>();
  for (const inv of invoices) {
    const d = new Date(inv.dateIssued);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('default', { month: 'short', year: '2-digit' });
    if (!map.has(key)) map.set(key, { month: label, paid: 0, pending: 0, overdue: 0 });
    const entry = map.get(key)!;
    if (inv.status === 'PAID')    entry.paid    += parseFloat(inv.total);
    if (inv.status === 'PENDING') entry.pending += parseFloat(inv.total);
    if (inv.status === 'OVERDUE') entry.overdue += parseFloat(inv.total);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function buildTopClients(invoices: Invoice[]) {
  const map = new Map<number, { name: string; revenue: number; total: number; count: number }>();
  for (const inv of invoices) {
    const existing = map.get(inv.clientId) ?? { name: inv.client.name, revenue: 0, total: 0, count: 0 };
    existing.total   += parseFloat(inv.total);
    existing.count   += 1;
    if (inv.status === 'PAID') existing.revenue += parseFloat(inv.total);
    map.set(inv.clientId, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
}

/* ── stat card ──────────────────────────────────────────────────── */

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', accent)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

const escapeHtml = (value: unknown): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export default function ReportsPage() {
  const { formatAmount } = useCurrency();

  const [preset, setPreset]           = useState<Preset>('6m');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'PENDING' | 'OVERDUE'>('all');
  const [showExport, setShowExport]   = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });
  const allInvoices = useMemo(() => (data?.data.invoices ?? []) as Invoice[], [data]);

  const periodFiltered = useMemo(() => {
    if (preset === 'custom') {
      let list = allInvoices;
      if (dateFrom) list = list.filter(i => new Date(i.dateIssued) >= new Date(dateFrom));
      if (dateTo)   list = list.filter(i => new Date(i.dateIssued) <= new Date(dateTo + 'T23:59:59'));
      return list;
    }
    const start = presetStart(preset);
    return start ? allInvoices.filter(i => new Date(i.dateIssued) >= start) : allInvoices;
  }, [allInvoices, preset, dateFrom, dateTo]);

  const filtered = useMemo(
    () => statusFilter === 'all' ? periodFiltered : periodFiltered.filter(i => i.status === statusFilter),
    [periodFiltered, statusFilter]
  );

  const paidList    = periodFiltered.filter(i => i.status === 'PAID');
  const pendingList = periodFiltered.filter(i => i.status === 'PENDING');
  const overdueList = periodFiltered.filter(i => i.status === 'OVERDUE');

  const revenue    = paidList.reduce((s, i) => s + parseFloat(i.total), 0);
  const outstanding = [...pendingList, ...overdueList].reduce((s, i) => s + parseFloat(i.total), 0);
  const collectionRate = periodFiltered.length > 0
    ? Math.round((paidList.length / periodFiltered.length) * 100)
    : 0;
  const avg = periodFiltered.length > 0
    ? periodFiltered.reduce((s, i) => s + parseFloat(i.total), 0) / periodFiltered.length
    : 0;

  const monthlyData = useMemo(() => buildMonthlyRevenue(periodFiltered), [periodFiltered]);
  const topClients  = useMemo(() => buildTopClients(periodFiltered), [periodFiltered]);
  const maxRevenue  = topClients[0]?.revenue ?? 0;

  const chart = {
    grid:          'var(--border)',
    tick:          'var(--muted-foreground)',
    tooltipBg:     'var(--popover)',
    tooltipBorder: 'var(--border)',
    tooltipLabel:  'var(--muted-foreground)',
  };

  /* ── helpers ────────────────────────────────────────────────── */

  const getPeriodLabel = () => {
    if (preset === 'custom') {
      if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`;
      if (dateFrom) return `From ${dateFrom}`;
      if (dateTo)   return `Until ${dateTo}`;
      return 'Custom period';
    }
    return { '1m': 'Last month', '3m': 'Last 3 months', '6m': 'Last 6 months', '12m': 'Last 12 months', all: 'All time', custom: 'Custom' }[preset];
  };

  const filename = () => `report-${new Date().toISOString().slice(0, 10)}`;

  /* ── CSV export ─────────────────────────────────────────────── */

  const exportCSV = (invoices: Invoice[]) => {
    const headers = ['Invoice #', 'Client', 'Issued', 'Due', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total'];
    const rows = invoices.map(inv => [
      inv.number, inv.client.name,
      new Date(inv.dateIssued).toLocaleDateString(),
      new Date(inv.dueDate).toLocaleDateString(),
      inv.status,
      inv.subtotal,
      discountAmountFor(parseFloat(inv.subtotal), inv.discountType, parseFloat(inv.discountValue)),
      inv.taxAmount,
      inv.total,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${filename()}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  /* ── Excel export ───────────────────────────────────────────── */

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();

    const addSheet = (name: string, rows: (string | number)[][], widths: number[]) => {
      const ws = wb.addWorksheet(name);
      ws.addRows(rows);
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    };

    addSheet('Summary', [
      ['BillFlow Revenue Report'],
      [`Period: ${getPeriodLabel()}`],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ['Metric', 'Value'],
      ['Revenue (Paid)', revenue],
      ['Outstanding (Pending + Overdue)', outstanding],
      ['Collection Rate (%)', collectionRate],
      ['Average Invoice', avg],
      [],
      ['Status', 'Count', 'Volume'],
      ['Paid',    paidList.length,    paidList.reduce((s, i) => s + parseFloat(i.total), 0)],
      ['Pending', pendingList.length, pendingList.reduce((s, i) => s + parseFloat(i.total), 0)],
      ['Overdue', overdueList.length, overdueList.reduce((s, i) => s + parseFloat(i.total), 0)],
    ], [32, 18]);

    addSheet('Monthly Revenue', [
      ['Month', 'Paid', 'Pending', 'Overdue', 'Total'],
      ...monthlyData.map(m => [m.month, m.paid, m.pending, m.overdue, m.paid + m.pending + m.overdue]),
    ], [12, 14, 14, 14, 14]);

    addSheet('Top Clients', [
      ['Rank', 'Client', 'Invoices', 'Total Billed', 'Paid Revenue'],
      ...topClients.map((c, i) => [i + 1, c.name, c.count, c.total, c.revenue]),
    ], [6, 28, 10, 14, 14]);

    addSheet('Invoices', [
      ['Invoice #', 'Client', 'Date Issued', 'Due Date', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total'],
      ...filtered.map(inv => [
        inv.number,
        inv.client.name,
        new Date(inv.dateIssued).toLocaleDateString(),
        new Date(inv.dueDate).toLocaleDateString(),
        inv.status,
        parseFloat(inv.subtotal),
        discountAmountFor(parseFloat(inv.subtotal), inv.discountType, parseFloat(inv.discountValue)),
        parseFloat(inv.taxAmount),
        parseFloat(inv.total),
      ]),
    ], [16, 26, 12, 12, 10, 12, 10, 10, 12]);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── PDF export ─────────────────────────────────────────────── */

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const addPageHeader = (title: string, sub: string) => {
      doc.setFillColor(0, 121, 107);
      doc.rect(0, 0, pageW, 20, 'F');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('BillFlow', 14, 13);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(title, pageW - 14, 10, { align: 'right' });
      doc.setFontSize(8);
      doc.setTextColor(178, 223, 219);
      doc.text(sub, pageW - 14, 15.5, { align: 'right' });
    };

    /* ─ Page 1: Summary ─ */
    addPageHeader('Revenue Report', getPeriodLabel() ?? '');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(96, 125, 139);
    doc.text(`Generated: ${new Date().toLocaleDateString()} · ${periodFiltered.length} invoices`, 14, 28);

    // Summary metrics
    autoTable(doc, {
      startY: 34,
      head: [['Revenue', 'Outstanding', 'Collection Rate', 'Avg. Invoice']],
      body: [[
        formatAmount(revenue),
        formatAmount(outstanding),
        `${collectionRate}%`,
        formatAmount(avg),
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: [238, 238, 238],
        textColor: [66, 66, 66],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 12,
        fontStyle: 'bold',
        textColor: [66, 66, 66],
        halign: 'center',
        cellPadding: 6,
      },
    });

    // Status breakdown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y1 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(66, 66, 66);
    doc.text('Invoice Breakdown by Status', 14, y1);

    autoTable(doc, {
      startY: y1 + 4,
      head: [['Status', 'Count', 'Volume']],
      body: [
        ['Paid',    paidList.length,    formatAmount(paidList.reduce((s, i) => s + parseFloat(i.total), 0))],
        ['Pending', pendingList.length, formatAmount(pendingList.reduce((s, i) => s + parseFloat(i.total), 0))],
        ['Overdue', overdueList.length, formatAmount(overdueList.reduce((s, i) => s + parseFloat(i.total), 0))],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 121, 107], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [66, 66, 66] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const statusColors: Record<string, [number, number, number]> = {
            Paid: [0, 121, 107], Pending: [255, 179, 0], Overdue: [229, 57, 53],
          };
          const raw = String(data.cell.raw);
          const color = statusColors[raw];
          if (color) {
            doc.setTextColor(...color);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(raw, data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.height / 2 + 1.5, { baseline: 'middle' });
            doc.setTextColor(66, 66, 66);
            doc.setFont('helvetica', 'normal');
          }
        }
      },
    });

    // Monthly Revenue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y2 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(66, 66, 66);
    doc.text('Monthly Revenue', 14, y2);

    autoTable(doc, {
      startY: y2 + 4,
      head: [['Month', 'Paid', 'Pending', 'Overdue', 'Total']],
      body: monthlyData.map(m => [
        m.month,
        formatAmount(m.paid),
        formatAmount(m.pending),
        formatAmount(m.overdue),
        formatAmount(m.paid + m.pending + m.overdue),
      ]),
      foot: [['Total', formatAmount(revenue), formatAmount(outstanding - overdueList.reduce((s, i) => s + parseFloat(i.total), 0)), formatAmount(overdueList.reduce((s, i) => s + parseFloat(i.total), 0)), formatAmount(revenue + outstanding)]],
      theme: 'striped',
      headStyles: { fillColor: [0, 121, 107], textColor: [255, 255, 255], fontSize: 9 },
      footStyles: { fillColor: [238, 238, 238], textColor: [66, 66, 66], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [66, 66, 66] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { textColor: [0, 121, 107], halign: 'right' },
        2: { textColor: [255, 179, 0], halign: 'right' },
        3: { textColor: [229, 57, 53], halign: 'right' },
        4: { fontStyle: 'bold', halign: 'right' },
      },
    });

    // Top Clients
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y3 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(66, 66, 66);
    doc.text('Top Clients by Revenue', 14, y3);

    autoTable(doc, {
      startY: y3 + 4,
      head: [['#', 'Client', 'Invoices', 'Total Billed', 'Paid Revenue']],
      body: topClients.map((c, i) => [
        i + 1,
        c.name,
        c.count,
        formatAmount(c.total),
        formatAmount(c.revenue),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 121, 107], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [66, 66, 66] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold', textColor: [0, 121, 107] },
      },
    });

    /* ─ Page 2: Invoice list ─ */
    doc.addPage();
    addPageHeader('Invoice List', `${filtered.length} invoices · ${getPeriodLabel()}`);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(96, 125, 139);
    doc.text(`Total: ${formatAmount(filtered.reduce((s, i) => s + parseFloat(i.total), 0))}`, 14, 28);

    autoTable(doc, {
      startY: 34,
      head: [['Invoice #', 'Client', 'Issued', 'Due', 'Status', 'Total']],
      body: filtered.map(inv => [
        inv.number,
        inv.client.name,
        new Date(inv.dateIssued).toLocaleDateString(),
        new Date(inv.dueDate).toLocaleDateString(),
        inv.status,
        formatAmount(parseFloat(inv.total)),
      ]),
      foot: [['', `${filtered.length} invoices`, '', '', 'Grand Total', formatAmount(filtered.reduce((s, i) => s + parseFloat(i.total), 0))]],
      theme: 'striped',
      headStyles: { fillColor: [0, 121, 107], textColor: [255, 255, 255], fontSize: 9 },
      footStyles: { fillColor: [238, 238, 238], textColor: [66, 66, 66], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [66, 66, 66] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 28, font: 'courier' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const status = String(data.cell.raw);
          const statusColors: Record<string, [number, number, number]> = {
            PAID: [0, 121, 107], PENDING: [255, 179, 0], OVERDUE: [229, 57, 53],
          };
          const color = statusColors[status];
          if (color) {
            doc.setTextColor(...color);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text(status, data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.height / 2 + 1.5, { baseline: 'middle' });
            doc.setTextColor(66, 66, 66);
            doc.setFont('helvetica', 'normal');
          }
        }
      },
    });

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let pg = 1; pg <= pageCount; pg++) {
      doc.setPage(pg);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(96, 125, 139);
      doc.text(`Page ${pg} of ${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
      doc.text('Generated by BillFlow', 14, pageH - 6);
    }

    doc.save(`${filename()}.pdf`);
  };

  /* ── Print export ───────────────────────────────────────────── */

  const exportPrint = () => {
    const totalVolume = filtered.reduce((s, i) => s + parseFloat(i.total), 0);
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Revenue Report · BillFlow</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 28px 32px; color: #424242; background: #EEEEEE; font-size: 13px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 2px solid #00796B; margin-bottom: 22px; }
    .brand { font-size: 22px; font-weight: 700; color: #00796B; }
    .brand-sub { font-size: 12px; color: #546E7A; margin-top: 2px; }
    .meta { text-align: right; font-size: 11px; color: #546E7A; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
    .stat { background: #FFFFFF; border: 1px solid rgba(84, 110, 122, 0.28); border-radius: 10px; padding: 14px 16px; }
    .stat-label { font-size: 10px; color: #546E7A; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
    .stat-value { font-size: 20px; font-weight: 700; margin-top: 5px; color: #424242; }
    .stat-sub { font-size: 11px; color: #546E7A; margin-top: 3px; }
    h2 { font-size: 13px; font-weight: 700; color: #424242; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 22px; background: #FFFFFF; }
    thead tr { background: #EEEEEE; }
    th { text-align: left; padding: 8px 12px; font-size: 10px; color: #546E7A; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid rgba(84, 110, 122, 0.28); }
    td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #EEEEEE; color: #424242; }
    tr:last-child td { border-bottom: none; }
    .status-paid { color: #00796B; font-weight: 700; }
    .status-pending { color: #FFB300; font-weight: 700; }
    .status-overdue { color: #E53935; font-weight: 700; }
    .right { text-align: right; }
    .mono { font-family: 'Courier New', monospace; font-size: 11px; }
    .bold { font-weight: 700; }
    tfoot tr { background: #EEEEEE; }
    tfoot td { font-weight: 700; border-top: 1px solid rgba(84, 110, 122, 0.28); }
    .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid rgba(84, 110, 122, 0.28); font-size: 10px; color: #546E7A; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 16px 20px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <div>
      <div class="brand">BillFlow</div>
      <div class="brand-sub">Revenue Report · ${getPeriodLabel()}</div>
    </div>
    <div class="meta">
      Generated on ${new Date().toLocaleDateString()}<br>
      ${periodFiltered.length} invoices in period
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Revenue</div>
      <div class="stat-value">${formatAmount(revenue)}</div>
      <div class="stat-sub">${paidList.length} paid invoice${paidList.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Outstanding</div>
      <div class="stat-value">${formatAmount(outstanding)}</div>
      <div class="stat-sub">${pendingList.length + overdueList.length} unpaid</div>
    </div>
    <div class="stat">
      <div class="stat-label">Collection Rate</div>
      <div class="stat-value">${collectionRate}%</div>
      <div class="stat-sub">${periodFiltered.length} total invoices</div>
    </div>
    <div class="stat">
      <div class="stat-label">Avg. Invoice</div>
      <div class="stat-value">${formatAmount(avg)}</div>
      <div class="stat-sub">${overdueList.length} overdue</div>
    </div>
  </div>

  <h2>Monthly Revenue</h2>
  <table>
    <thead><tr><th>Month</th><th class="right">Paid</th><th class="right">Pending</th><th class="right">Overdue</th><th class="right">Total</th></tr></thead>
    <tbody>
      ${monthlyData.map(m => `<tr>
        <td class="bold">${m.month}</td>
        <td class="right status-paid">${formatAmount(m.paid)}</td>
        <td class="right status-pending">${formatAmount(m.pending)}</td>
        <td class="right status-overdue">${formatAmount(m.overdue)}</td>
        <td class="right bold">${formatAmount(m.paid + m.pending + m.overdue)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Top Clients</h2>
  <table>
    <thead><tr><th>#</th><th>Client</th><th class="right">Invoices</th><th class="right">Total Billed</th><th class="right">Paid Revenue</th></tr></thead>
    <tbody>
      ${topClients.map((c, i) => `<tr>
        <td>${i + 1}</td>
        <td class="bold">${escapeHtml(c.name)}</td>
        <td class="right">${c.count}</td>
        <td class="right">${formatAmount(c.total)}</td>
        <td class="right status-paid">${formatAmount(c.revenue)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="page-break"></div>

  <h2>Invoices (${filtered.length})</h2>
  <table>
    <thead><tr><th>Invoice #</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th class="right">Total</th></tr></thead>
    <tbody>
      ${filtered.map(inv => `<tr>
        <td class="mono">${escapeHtml(inv.number)}</td>
        <td>${escapeHtml(inv.client.name)}</td>
        <td>${new Date(inv.dateIssued).toLocaleDateString()}</td>
        <td>${new Date(inv.dueDate).toLocaleDateString()}</td>
        <td class="status-${inv.status.toLowerCase()}">${inv.status}</td>
        <td class="right bold">${formatAmount(parseFloat(inv.total))}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="right">Grand Total</td>
        <td class="right">${formatAmount(totalVolume)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>Generated by BillFlow</span>
    <span>${new Date().toLocaleString()}</span>
  </div>

  <script>window.print();</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  /* ── render ─────────────────────────────────────────────────── */

  const hasCustomDates = preset === 'custom' && (dateFrom || dateTo);

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <PageHeader
        title="Reports"
        subtitle={`${periodFiltered.length} invoices · ${formatAmount(revenue + outstanding)} total volume`}
        actions={
          <div ref={exportRef} className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowExport(v => !v)}
            >
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', showExport && 'rotate-180')} />
            </Button>

            {showExport && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-popover py-1.5 shadow-xl">

                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Download
                </p>

                {/* PDF */}
                <button
                  onClick={() => { exportPDF(); setShowExport(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive dark:bg-destructive/20">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">PDF Report</p>
                    <p className="text-xs text-muted-foreground">Summary + full invoice list</p>
                  </div>
                </button>

                {/* Excel */}
                <button
                  onClick={() => { exportExcel(); setShowExport(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/25 text-accent-foreground dark:bg-accent/20 dark:text-accent">
                    <Table2 className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Excel Workbook</p>
                    <p className="text-xs text-muted-foreground">4 sheets: summary, monthly, clients, invoices</p>
                  </div>
                </button>

                {/* CSV */}
                <button
                  onClick={() => { exportCSV(filtered); setShowExport(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">CSV</p>
                    <p className="text-xs text-muted-foreground">
                      {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} as spreadsheet
                    </p>
                  </div>
                </button>

                <div className="my-1 mx-3 h-px bg-border" />

                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Other
                </p>

                {/* Print */}
                <button
                  onClick={() => { exportPrint(); setShowExport(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Printer className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Print</p>
                    <p className="text-xs text-muted-foreground">Open print-friendly view</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {PRESETS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setPreset(p.value);
                if (p.value !== 'custom') { setDateFrom(''); setDateTo(''); }
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                preset === p.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {hasCustomDates && (
              <button
                type="button"
                aria-label="Clear dates"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          {(['all', 'PAID', 'PENDING', 'OVERDUE'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors',
                statusFilter === s
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              {s === 'all' ? 'All statuses' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatAmount(revenue)}
          sub={`${paidList.length} paid invoice${paidList.length !== 1 ? 's' : ''}`}
          icon={TrendingUp}
          accent="bg-accent text-accent-foreground"
        />
        <StatCard
          label="Outstanding"
          value={formatAmount(outstanding)}
          sub={`${pendingList.length + overdueList.length} unpaid`}
          icon={Clock}
          accent="bg-[#FFB300]/25 text-foreground dark:bg-[#FFB300]/20"
        />
        <StatCard
          label="Collection rate"
          value={`${collectionRate}%`}
          sub={`${periodFiltered.length} total invoices`}
          icon={BarChart3}
          accent={
            collectionRate >= 75
              ? 'bg-accent text-accent-foreground'
              : collectionRate >= 40
              ? 'bg-[#FFB300]/25 text-foreground dark:bg-[#FFB300]/20'
              : 'bg-destructive/15 text-destructive dark:bg-destructive/20'
          }
        />
        <StatCard
          label="Avg. invoice"
          value={formatAmount(avg)}
          sub={`${overdueList.length} overdue`}
          icon={AlertCircle}
          accent="bg-secondary/15 text-secondary"
        />
      </div>

      {/* ── Chart ────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly revenue</h2>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />Paid</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#FFB300]" />Pending</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive" />Overdue</span>
          </div>
        </div>

        {isLoading ? (
          <LoadingState className="h-52 items-center py-0" />
        ) : monthlyData.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={18} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => formatAmount(v)}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  background: chart.tooltipBg,
                  borderRadius: '10px',
                  border: `1px solid ${chart.tooltipBorder}`,
                  fontSize: '12px',
                  padding: '10px 14px',
                }}
                labelStyle={{ color: chart.tooltipLabel, fontWeight: 600, marginBottom: 4 }}
                formatter={(v, name) => [
                  formatAmount(Number(v)),
                  name === 'paid' ? 'Paid' : name === 'pending' ? 'Pending' : 'Overdue',
                ]}
                cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
              />
              <Bar dataKey="paid"    fill="var(--accent)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="pending" fill="#FFB300" radius={[3, 3, 0, 0]} />
              <Bar dataKey="overdue" fill="var(--destructive)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Aging report ─────────────────────────────────────── */}
      {(() => {
        const now = new Date();
        const unpaid = allInvoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE');
        const buckets = [
          // Not-yet-due invoices (negative days) belong to the current bucket.
          { label: '0–30 days',  min: -Infinity, max: 30  },
          { label: '31–60 days', min: 31, max: 60  },
          { label: '61–90 days', min: 61, max: 90  },
          { label: '90+ days',   min: 91, max: Infinity },
        ].map(b => {
          const list = unpaid.filter(i => {
            const days = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
            return days >= b.min && days <= b.max;
          });
          return { ...b, count: list.length, amount: list.reduce((s, i) => s + parseFloat(i.total), 0) };
        });
        const totalUnpaid = unpaid.reduce((s, i) => s + parseFloat(i.total), 0);
        const bars = ['bg-secondary', 'bg-[#FFB300]', 'bg-destructive/60', 'bg-destructive'];
        return (
          <Card className="p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice Aging</h2>
            <p className="mb-5 mt-0.5 text-xs text-muted-foreground">
              {unpaid.length} unpaid invoice{unpaid.length !== 1 ? 's' : ''} · {formatAmount(totalUnpaid)} outstanding (all time)
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {buckets.map((b, i) => {
                const pct = totalUnpaid > 0 ? (b.amount / totalUnpaid) * 100 : 0;
                return (
                  <div key={b.label} className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className={cn('inline-block h-2 w-2 shrink-0 rounded-sm', bars[i])} />
                      {b.label}
                    </p>
                    <p className="font-display text-xl font-bold tabular-nums text-foreground">{formatAmount(b.amount)}</p>
                    <p className="text-xs text-muted-foreground">{b.count} invoice{b.count !== 1 ? 's' : ''}</p>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div className={cn('h-1.5 rounded-full transition-all duration-500', bars[i])} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* ── Bottom row ───────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-5">

        {/* Top clients */}
        <Card className="lg:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top clients</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">By paid revenue</p>
          </div>
          {topClients.length === 0 ? (
            <EmptyState title="No data for this period" />
          ) : (
            <div>
              {topClients.map((client, i) => {
                const pct = maxRevenue > 0 ? (client.revenue / maxRevenue) * 100 : 0;
                const barColors = ['bg-primary', 'bg-accent', 'bg-secondary', 'bg-[#FFB300]', 'bg-destructive', 'bg-primary/60'];
                const avatarBgs = [
                  'bg-primary/10 text-primary',
                  'bg-accent/25 text-accent-foreground dark:bg-accent/20 dark:text-accent',
                  'bg-secondary/15 text-secondary',
                  'bg-[#FFB300]/25 text-foreground dark:bg-[#FFB300]/20',
                  'bg-destructive/15 text-destructive dark:bg-destructive/20',
                  'bg-primary/10 text-primary',
                ];
                const initials = client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={client.name} className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0 hover:bg-muted/40">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold', avatarBgs[i % avatarBgs.length])}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{client.name}</span>
                        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">{formatAmount(client.revenue)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-1.5 rounded-full transition-all duration-500', barColors[i % barColors.length])} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {client.count} invoice{client.count !== 1 ? 's' : ''} · {formatAmount(client.total)} total
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Filtered invoice list */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoices</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="No invoices match the selected filters" />
          ) : (
            <div
              role="region"
              aria-label="Invoice results"
              tabIndex={0}
              className="max-h-[400px] overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {filtered.slice(0, 30).map(inv => (
                <div key={inv.id} className="flex items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/40">
                  <span className="w-20 shrink-0 font-mono text-xs font-medium text-muted-foreground">{inv.number}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{inv.client.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(inv.dateIssued)}</p>
                  </div>
                  <StatusBadge status={inv.status} />
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatAmount(inv.total)}
                  </span>
                </div>
              ))}
              {filtered.length > 30 && (
                <div className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">
                  Showing 30 of {filtered.length} — export for full list
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
