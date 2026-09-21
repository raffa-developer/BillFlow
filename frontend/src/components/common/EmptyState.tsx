import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
      {Icon && <Icon className="h-8 w-8" />}
      <p className="text-sm font-medium">{title}</p>
      {action}
    </div>
  );
}
