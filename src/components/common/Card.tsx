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
        "rounded-[10px] border border-[#d9e2ec] bg-white p-4 text-[#102a43] shadow-[0_1px_2px_rgba(16,42,67,0.06)] transition-colors",
        hoverable && "hover:border-teal-400 hover:bg-teal-50/20 cursor-pointer",
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
        "flex items-center justify-between pb-3 border-b border-[#d9e2ec]",
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
        "text-sm font-semibold tracking-tight text-[#102a43]",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
};
