import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "sage" | "champagne" | "outline" | "success" | "accent";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}) => {
  const baseStyles = "inline-flex items-center font-serif font-medium rounded-full tracking-wide";

  const variants = {
    primary: "bg-[#DCECF8] text-[#258FE5] border border-[#258FE5]/30",
    secondary: "bg-[#123D68] text-white border border-[#123D68]",
    accent: "bg-[#E6F8F7] text-[#20B8AD] border border-[#20B8AD]/40",
    sage: "bg-[#E6F8F7] text-[#20B8AD] border border-[#20B8AD]/40",
    champagne: "bg-[#EDF5FA] text-[#163B63] border border-[#D5E4EF]",
    outline: "border border-[#D5E4EF] text-[#526A82] bg-white",
    success: "bg-[#E6F8F7] text-[#20B8AD] border border-[#20B8AD]/40 font-semibold",
  };

  const sizes = {
    sm: "text-[10px] sm:text-[11px] px-2.5 py-0.5 gap-1",
    md: "text-xs px-3 py-1 gap-1.5",
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
