import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-slate-200 bg-white shadow-sm',
      'dark:border-slate-800 dark:bg-slate-900 dark:shadow-none',
      className
    )}>
      {children}
    </div>
  );
}
