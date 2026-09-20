import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "indigo"
    | "blue"
    | "cyan"
    | "teal"
    | "purple"
    | "amber"
    | "emerald"
    | "rose"
    | "slate";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "teal",
  size = "md",
  children,
  ...props
}) => {
  const variants = {
    indigo: "bg-teal-50 text-teal-800 border-teal-200",
    blue: "bg-sky-50 text-sky-800 border-sky-200",
    cyan: "bg-teal-50 text-teal-800 border-teal-200",
    teal: "bg-teal-50 text-teal-800 border-teal-200",
    purple: "bg-violet-50 text-violet-800 border-violet-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
    slate: "bg-[#eef2f6] text-[#243b53] border-[#d9e2ec]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[11px] font-medium leading-none",
    md: "px-2.5 py-1 text-xs font-medium leading-none",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border tracking-wide whitespace-nowrap select-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
