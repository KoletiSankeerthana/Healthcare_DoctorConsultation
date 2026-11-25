"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "champagne" | "sage" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-serif font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none tracking-tight";

    const variants = {
      primary:
        "bg-[#258FE5] text-white hover:bg-[#1D78C4] active:bg-[#1D78C4] focus:ring-[#258FE5]/40 shadow-sm border border-[#258FE5] hover:shadow-md",
      secondary:
        "bg-white text-[#123D68] hover:bg-[#EDF5FA] hover:text-[#163B63] active:bg-[#DCECF8] focus:ring-[#258FE5]/30 border-2 border-[#258FE5] shadow-sm",
      accent:
        "bg-[#20B8AD] text-white hover:bg-[#1A9E94] active:bg-[#1A9E94] focus:ring-[#20B8AD]/40 shadow-sm border border-[#20B8AD]",
      outline:
        "border border-[#D5E4EF] bg-white text-[#163B63] hover:bg-[#EDF5FA] hover:border-[#258FE5] focus:ring-[#258FE5]/20 shadow-xs",
      ghost:
        "text-[#526A82] hover:text-[#123D68] hover:bg-[#DCECF8]/50 focus:ring-[#258FE5]/20",
      champagne:
        "bg-[#DCECF8] text-[#123D68] border border-[#D5E4EF] hover:bg-[#20B8AD]/15 focus:ring-[#20B8AD]/30 font-semibold",
      sage:
        "bg-[#20B8AD] text-white hover:bg-[#1A9E94] focus:ring-[#20B8AD]/30 font-semibold shadow-sm",
      danger:
        "bg-rose-700 text-white hover:bg-rose-800 focus:ring-rose-600/40",
    };

    const sizes = {
      sm: "text-xs px-3.5 py-1.5 gap-1.5 h-8",
      md: "text-xs sm:text-sm px-5 py-2.5 gap-2 h-10",
      lg: "text-sm sm:text-base px-6 py-3 gap-2.5 h-12",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.985 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
