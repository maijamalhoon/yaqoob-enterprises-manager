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
    | "slate"
    | "primary"
    | "neutral"
    | "success"
    | "warning"
    | "danger";
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
    indigo: "bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe]",
    primary: "bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe]",
    blue: "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]",
    cyan: "bg-[#ecfeff] text-[#0891b2] border-[#a5f3fc]",
    teal: "bg-[#f0fdf4] text-[#16a34a] border-[#dcfce7]",
    emerald: "bg-[#f0fdf4] text-[#16a34a] border-[#dcfce7]",
    success: "bg-[#f0fdf4] text-[#16a34a] border-[#dcfce7]",
    purple: "bg-[#faf5ff] text-[#7c3aed] border-[#e9d5ff]",
    amber: "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]",
    warning: "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]",
    rose: "bg-[#fef2f2] text-[#dc2626] border-[#fee2e2]",
    danger: "bg-[#fef2f2] text-[#dc2626] border-[#fee2e2]",
    slate: "bg-[#f2f4f6] text-[#555f73] border-[#e6e8ec]",
    neutral: "bg-[#f2f4f6] text-[#555f73] border-[#e6e8ec]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[11px] font-medium leading-none",
    md: "px-2.5 py-1 text-xs font-medium leading-none",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border tracking-normal whitespace-nowrap select-none",
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
