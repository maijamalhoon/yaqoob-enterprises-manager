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
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]/30 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.99]";

    const variants = {
      primary:
        "bg-[#4f46e5] hover:bg-[#4338ca] text-white border border-[#4f46e5] shadow-xs",
      indigo:
        "bg-[#4f46e5] hover:bg-[#4338ca] text-white border border-[#4f46e5] shadow-xs",
      secondary:
        "bg-white hover:bg-[#f7f8fa] text-[#14181f] border border-[#e6e8ec] shadow-xs",
      outline:
        "bg-white border border-[#e6e8ec] hover:bg-[#f7f8fa] text-[#14181f]",
      ghost:
        "bg-transparent text-[#667085] hover:text-[#14181f] hover:bg-[#f0f2f5]",
      danger:
        "bg-[#dc2626] hover:bg-[#b91c1c] text-white border border-[#dc2626] shadow-xs",
      teal:
        "bg-[#16a34a] hover:bg-[#15803d] text-white border border-[#16a34a] shadow-xs",
      emerald:
        "bg-[#16a34a] hover:bg-[#15803d] text-white border border-[#16a34a] shadow-xs",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
      md: "h-10 px-4 text-sm gap-2 rounded-lg",
      lg: "h-12 px-6 text-base gap-2.5 rounded-xl font-semibold",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
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
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
