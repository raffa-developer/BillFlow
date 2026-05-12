import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { InvoiceStatus } from '../../types';

interface BadgeProps {
  status: InvoiceStatus;
  className?: string;
}

const styles: Record<InvoiceStatus, { badge: string; dot: string }> = {
  PAID:    { badge: 'bg-green-50 text-green-700 ring-1 ring-green-600/15 dark:bg-green-900/30 dark:text-green-200 dark:ring-green-500/30',  dot: 'bg-green-500' },
  PENDING: { badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/15 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-500/30', dot: 'bg-amber-400' },
  OVERDUE: { badge: 'bg-red-50 text-red-700 ring-1 ring-red-600/15 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-500/30',       dot: 'bg-red-500'   },
};

export function StatusBadge({ status, className }: BadgeProps) {
  const { t } = useTranslation();
  const { badge, dot } = styles[status];
  const labels: Record<InvoiceStatus, string> = {
    PAID:    t('common.paid'),
    PENDING: t('common.pending'),
    OVERDUE: t('common.overdue'),
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />
      {labels[status]}
    </span>
  );
}
