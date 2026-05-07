import { cn } from '../../lib/utils';
import type { InvoiceStatus } from '../../types';

interface BadgeProps {
  status: InvoiceStatus;
  className?: string;
}

const styles: Record<InvoiceStatus, { badge: string; dot: string }> = {
  PAID:    { badge: 'bg-green-50 text-green-700 ring-1 ring-green-600/15',  dot: 'bg-green-500' },
  PENDING: { badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/15', dot: 'bg-amber-400' },
  OVERDUE: { badge: 'bg-red-50 text-red-700 ring-1 ring-red-600/15',       dot: 'bg-red-500'   },
};

const labels: Record<InvoiceStatus, string> = {
  PAID: 'Pago',
  PENDING: 'Pendente',
  OVERDUE: 'Vencido',
};

export function StatusBadge({ status, className }: BadgeProps) {
  const { badge, dot } = styles[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />
      {labels[status]}
    </span>
  );
}
