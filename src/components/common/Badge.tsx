import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'cyan' | 'teal' | 'purple' | 'amber' | 'emerald' | 'rose' | 'slate';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'cyan',
  size = 'md',
  children,
  ...props
}) => {
  const variants = {
    cyan: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
    teal: 'bg-teal-950/80 text-teal-300 border-teal-800/60',
    purple: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
    amber: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
    emerald: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    rose: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
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
