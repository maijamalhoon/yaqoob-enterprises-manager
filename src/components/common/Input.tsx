import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shortcutHint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, leftIcon, rightIcon, shortcutHint, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#243b53]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[#627d98]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'w-full rounded-[10px] bg-white border border-[#d9e2ec] px-3 py-2 text-sm text-[#102a43] placeholder:text-[#627d98] transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-50 font-sans shadow-[0_1px_2px_rgba(16,42,67,0.04)]',
              leftIcon && 'pl-9',
              (rightIcon || shortcutHint) && 'pr-12',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
              className
            )}
            {...props}
          />
          {shortcutHint && !rightIcon && (
            <div className="absolute right-2.5 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#627d98] bg-[#f5f7fa] border border-[#d9e2ec] rounded shadow-xs">
                {shortcutHint}
              </kbd>
            </div>
          )}
          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-[#627d98]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
