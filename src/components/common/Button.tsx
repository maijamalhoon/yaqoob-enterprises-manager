import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "danger"
    | "ghost"
    | "teal"
    | "indigo"
    | "emerald";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer rounded-[10px]";

    const variants = {
      primary:
        "bg-teal-700 hover:bg-teal-800 text-white border border-teal-700 shadow-[0_1px_2px_rgba(16,42,67,0.08)]",
      indigo:
        "bg-teal-700 hover:bg-teal-800 text-white border border-teal-700 shadow-[0_1px_2px_rgba(16,42,67,0.08)]",
      teal: "bg-teal-700 hover:bg-teal-800 text-white border border-teal-700 shadow-[0_1px_2px_rgba(16,42,67,0.08)]",
      emerald:
        "bg-teal-700 hover:bg-teal-800 text-white border border-teal-700 shadow-[0_1px_2px_rgba(16,42,67,0.08)]",
      secondary:
        "bg-white hover:bg-[#f5f7fa] text-[#243b53] border border-[#d9e2ec] shadow-[0_1px_2px_rgba(16,42,67,0.04)]",
      outline:
        "bg-white border border-[#d9e2ec] hover:bg-[#f5f7fa] text-[#243b53]",
      danger: "bg-rose-700 hover:bg-rose-800 text-white border border-rose-700 shadow-[0_1px_2px_rgba(16,42,67,0.08)]",
      ghost: "hover:bg-[#eef2f6] text-[#486581] hover:text-[#102a43]",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-sm gap-2",
      lg: "h-11 px-6 text-base gap-2.5 font-semibold",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ?
          <svg
            className="animate-spin h-4 w-4 text-current"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
