import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[11px] font-serif font-semibold text-[#163B63] tracking-wider uppercase"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#526A82]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "w-full h-11 rounded-xl border border-[#D5E4EF] bg-white px-3.5 text-sm font-serif text-[#163B63] placeholder:text-[#8FA3B8] transition-all duration-200 focus:border-[#258FE5] focus:outline-none focus:ring-2 focus:ring-[#258FE5]/15 disabled:cursor-not-allowed disabled:bg-[#EDF5FA]",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[#526A82]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 font-serif font-medium">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-[#526A82] font-serif">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
