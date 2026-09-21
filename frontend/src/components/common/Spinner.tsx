import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn('h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent', className)}
    />
  );
}

export function LoadingState({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center py-12', className)}>
      <Spinner />
    </div>
  );
}
