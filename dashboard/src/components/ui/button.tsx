"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, icon, children, ...props }, ref) => {
    const base = [
      "inline-flex items-center justify-center gap-2 rounded-xl font-medium",
      "transition-all duration-150 select-none cursor-pointer",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
      "disabled:pointer-events-none disabled:opacity-50",
      "active:scale-[0.97]",
    ].join(" ");

    const variants = {
      primary:   "gradient-brand text-white shadow-brand-sm hover:shadow-brand hover:brightness-110",
      secondary: "bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow-md",
      outline:   "border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm",
      ghost:     "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      danger:    "bg-red-500 text-white shadow-sm hover:bg-red-600 hover:shadow-md",
      success:   "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:shadow-md",
    };

    const sizes = {
      xs: "h-7 px-2.5 text-xs gap-1",
      sm: "h-8 px-3 text-xs",
      md: "h-9 px-4 text-sm",
      lg: "h-11 px-6 text-[15px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          icon && <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";


