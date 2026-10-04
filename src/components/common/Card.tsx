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
        "rounded-xl border border-border-standard bg-white p-5 text-on-surface shadow-level-1 transition-all duration-150 sm:p-6",
        hoverable && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-level-2",
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
        "mb-4 flex items-center justify-between border-b border-border-standard pb-4",
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
        "text-base font-semibold tracking-tight text-on-surface",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
};
