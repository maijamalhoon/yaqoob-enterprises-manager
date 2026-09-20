import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'teal' | 'indigo' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer rounded-lg active:scale-[0.985]';

    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs shadow-indigo-950/50 border border-indigo-500/30',
      indigo: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs shadow-indigo-950/50 border border-indigo-500/30',
      teal: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-950/50 border border-emerald-500/30',
      emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-950/50 border border-emerald-500/30',
      secondary: 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/70 hover:border-slate-600 shadow-2xs',
      outline: 'border border-slate-700/80 hover:bg-slate-800/70 text-slate-300 hover:text-white',
      danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs shadow-rose-950/50 border border-rose-500/30',
      ghost: 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-100',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
      lg: 'h-11 px-6 text-base gap-2.5 font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
