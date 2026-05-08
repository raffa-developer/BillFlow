import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-9 w-full rounded-lg border px-3 text-sm shadow-sm transition-all duration-150',
            'bg-white text-slate-900 placeholder:text-slate-400',
            'border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            'dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500',
            'dark:focus:border-blue-500 dark:focus:ring-blue-500/25',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-600',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
