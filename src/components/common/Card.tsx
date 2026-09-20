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
        "rounded-xl border border-[#e6e8ec] bg-white p-6 text-[#14181f] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-150",
        hoverable && "hover:border-[#c7c4d8] hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] cursor-pointer",
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
        "flex items-center justify-between pb-4 border-b border-[#e6e8ec] mb-4",
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
        "text-base font-semibold tracking-[-0.005em] text-[#14181f]",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
};
