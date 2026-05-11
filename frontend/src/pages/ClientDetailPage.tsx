import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText, Mail, Phone, MapPin } from 'lucide-react';
import { clientsApi, invoicesApi } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { formatDate } from '../lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id!);
  const { formatAmount } = useCurrency();

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  });

  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });

  const client = clientsData?.data.clients.find((c) => c.id === clientId);
  const invoices = (invoicesData?.data.invoices ?? []).filter((i) => i.clientId === clientId);

  const totalInvoiced = invoices.reduce((s, i) => s + parseFloat(i.total), 0);
  const totalPaid = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.total), 0);
  const totalPending = invoices.filter((i) => i.status !== 'PAID').reduce((s, i) => s + parseFloat(i.total), 0);

  if (loadingClients || loadingInvoices) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        <p>{t('clientDetail.notFound')}</p>
        <Link to="/clients" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          {t('clientDetail.backToClients')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> {t('clientDetail.backButton')}
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{client.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('clientDetail.invoices', { count: invoices.length })}
        </p>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{t('clientDetail.contactInfo')}</h2>
        <div className="space-y-2.5">
          {client.email && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <a href={`mailto:${client.email}`} className="hover:text-blue-600 hover:underline">{client.email}</a>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              <Phone className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
              <span>{client.address}</span>
            </div>
          )}
          {!client.email && !client.phone && !client.address && (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('clientDetail.noContact')}</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('clientDetail.totalBilled')}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatAmount(totalInvoiced)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('clientDetail.paid')}</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatAmount(totalPaid)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('clientDetail.outstanding')}</p>
          <p className="text-xl font-bold text-amber-500 mt-1">{formatAmount(totalPending)}</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('clientDetail.invoicesSection')}</h2>
          <Link to="/invoices/new">
            <Button size="sm">{t('clientDetail.newInvoice')}</Button>
          </Link>
        </div>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-slate-400 dark:text-slate-500">
            <FileText className="h-8 w-8" />
            <p className="text-sm">{t('clientDetail.noInvoices')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('invoices.colIssued')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('invoices.colDue')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.status')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link to={`/invoices/${inv.id}`} className="font-mono text-xs text-blue-600 hover:underline">{inv.number}</Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(inv.dateIssued)}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">{formatAmount(inv.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
