import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  hoverable,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-slate-200 bg-white p-4 text-slate-900 shadow-sm transition-colors",
        hoverable && "hover:border-teal-300 hover:bg-teal-50/20 cursor-pointer",
        className,
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
    <div
      className={cn(
        "flex items-center justify-between pb-3 border-b border-slate-200",
        className,
      )}
      {...props}
    >
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
    <h3
      className={cn(
        "text-sm font-semibold tracking-tight text-slate-900",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
};
