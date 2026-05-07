import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-black/[0.04] transition-shadow duration-200',
      'dark:border-slate-800 dark:bg-slate-900 dark:ring-white/[0.04]',
      className
    )}>
      {children}
    </div>
  );
}
