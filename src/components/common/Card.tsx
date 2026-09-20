import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hoverable, children, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 text-slate-100 shadow-sm transition-all',
        hoverable && 'hover:border-slate-700 hover:bg-slate-900 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn('flex items-center justify-between pb-3 border-b border-slate-800/80', className)} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <h3 className={cn('text-sm font-semibold tracking-tight text-slate-200', className)} {...props}>
      {children}
    </h3>
  );
};
