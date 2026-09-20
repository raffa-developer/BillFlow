import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { InvoiceStatus } from '../../types';

interface BadgeProps {
  status: InvoiceStatus;
  className?: string;
}

const styles: Record<InvoiceStatus, { badge: string; dot: string }> = {
  PAID: {
    badge: 'bg-accent text-accent-foreground ring-1 ring-accent/60',
    dot: 'bg-[#5a8f18]',
  },
  PENDING: {
    badge: 'bg-[#FFB300]/25 text-[#8a5b00] ring-1 ring-[#FFB300]/40 dark:bg-[#FFB300]/20 dark:text-[#ffd54f]',
    dot: 'bg-[#FFB300]',
  },
  OVERDUE: {
    badge: 'bg-destructive/15 text-destructive ring-1 ring-destructive/30 dark:bg-destructive/20',
    dot: 'bg-destructive',
  },
};

export function StatusBadge({ status, className }: BadgeProps) {
  const { t } = useTranslation();
  const { badge, dot } = styles[status];
  const labels: Record<InvoiceStatus, string> = {
    PAID: t('common.paid'),
    PENDING: t('common.pending'),
    OVERDUE: t('common.overdue'),
  };
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', badge, className)}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      {labels[status]}
    </span>
  );
}
