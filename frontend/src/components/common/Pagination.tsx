import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  label: ReactNode;
  onPageChange: (page: number) => void;
  prevLabel: string;
  nextLabel: string;
  testid?: string;
}

export function Pagination({ page, totalPages, label, onPageChange, prevLabel, nextLabel, testid }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div data-testid={testid} className="flex items-center justify-between border-t border-border px-5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" aria-label={prevLabel} disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.min(Math.max(page - 2, 1), Math.max(totalPages - 4, 1));
          const pageNum = start + i;
          if (pageNum > totalPages) return null;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={cn(
                'h-7 w-7 rounded text-xs font-medium transition-colors',
                page === pageNum ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {pageNum}
            </button>
          );
        })}
        <Button variant="ghost" size="sm" aria-label={nextLabel} disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
