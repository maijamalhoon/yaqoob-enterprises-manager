import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'indigo' | 'blue' | 'cyan' | 'teal' | 'purple' | 'amber' | 'emerald' | 'rose' | 'slate';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'indigo',
  size = 'md',
  children,
  ...props
}) => {
  const variants = {
    indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    cyan: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25', // Maps smoothly to enterprise theme
    teal: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    slate: 'bg-slate-800/60 text-slate-300 border-slate-700/50',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px] font-medium leading-none',
    md: 'px-2.5 py-1 text-xs font-medium leading-none',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border tracking-wide whitespace-nowrap select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
