import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText, Mail, Phone, MapPin } from 'lucide-react';
import { clientsApi, invoicesApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/BadgeLegacy';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/Spinner';
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
    return <LoadingState />;
  }

  if (!client) {
    return (
      <div className="space-y-5">
        <div className="py-20 text-center text-muted-foreground">
          <p>{t('clientDetail.notFound')}</p>
          <Link to="/clients" className="mt-2 inline-block text-sm text-primary hover:underline">
            {t('clientDetail.backToClients')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> {t('clientDetail.backButton')}
          </Button>
        </Link>
      </div>

      <PageHeader
        title={client.name}
        subtitle={t('clientDetail.invoices', { count: invoices.length })}
      />

      <Card className="p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('clientDetail.contactInfo')}</h2>
        <div className="space-y-2.5">
          {client.email && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <a href={`mailto:${client.email}`} className="transition-colors hover:text-primary hover:underline">{client.email}</a>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{client.address}</span>
            </div>
          )}
          {!client.email && !client.phone && !client.address && (
            <p className="text-sm text-muted-foreground">{t('clientDetail.noContact')}</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('clientDetail.totalBilled')}</p>
          <p className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground">{formatAmount(totalInvoiced)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('clientDetail.paid')}</p>
          <p className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground dark:text-accent">{formatAmount(totalPaid)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('clientDetail.outstanding')}</p>
          <p className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground">{formatAmount(totalPending)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('clientDetail.invoicesSection')}</h2>
          <Link to="/invoices/new">
            <Button size="sm">{t('clientDetail.newInvoice')}</Button>
          </Link>
        </div>
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title={t('clientDetail.noInvoices')} />
        ) : (
          <>
            <div className="hidden items-center gap-3 border-b border-border px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:flex">
              <span className="w-24 shrink-0">#</span>
              <span className="w-24 shrink-0">{t('invoices.colIssued')}</span>
              <span className="w-24 shrink-0">{t('invoices.colDue')}</span>
              <span className="shrink-0">{t('common.status')}</span>
              <span className="ml-auto w-28 shrink-0 text-right">{t('common.total')}</span>
            </div>
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/40">
                <Link to={`/invoices/${inv.id}`} className="w-24 shrink-0 rounded font-mono text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
                  {inv.number}
                </Link>
                <span className="hidden w-24 shrink-0 text-xs text-muted-foreground sm:block">{formatDate(inv.dateIssued)}</span>
                <span className="hidden w-24 shrink-0 text-xs text-muted-foreground sm:block">{formatDate(inv.dueDate)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:hidden">
                  {formatDate(inv.dateIssued)} · {formatDate(inv.dueDate)}
                </span>
                <StatusBadge status={inv.status} className="shrink-0" />
                <span className="ml-auto w-28 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                  {formatAmount(inv.total)}
                </span>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}
