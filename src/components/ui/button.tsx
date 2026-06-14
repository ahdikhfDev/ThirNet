import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
          'disabled:opacity-50 disabled:pointer-events-none',
          variant === 'default' && 'bg-sky-600 text-white hover:bg-sky-500',
          variant === 'outline' && 'border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-200',
          variant === 'ghost' && 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
          size === 'sm' && 'px-2 py-1 text-xs',
          size === 'md' && 'px-3 py-1.5 text-sm',
          size === 'lg' && 'px-4 py-2 text-base',
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
