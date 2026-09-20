import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shortcutHint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      leftIcon,
      rightIcon,
      shortcutHint,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId =
      id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[#14181f]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[#667085]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              "w-full h-10 rounded-lg bg-white border border-[#e6e8ec] px-3 py-2 text-sm text-[#14181f] placeholder:text-[#98a2b3] transition-all duration-150 focus:border-[#4f46e5] focus:outline-none focus:ring-3 focus:ring-[#4f46e5]/12 disabled:cursor-not-allowed disabled:opacity-50 font-sans shadow-xs",
              leftIcon && "pl-9",
              (rightIcon || shortcutHint) && "pr-12",
              error && "border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/15",
              className,
            )}
            {...props}
          />
          {shortcutHint && !rightIcon && (
            <div className="absolute right-2.5 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#667085] bg-[#f7f8fa] border border-[#e6e8ec] rounded-sm">
                {shortcutHint}
              </kbd>
            </div>
          )}
          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-[#667085]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-[#dc2626] mt-1">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
