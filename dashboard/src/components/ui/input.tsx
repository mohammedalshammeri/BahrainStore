"use client";

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, startIcon, endIcon, id, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "text-xs font-semibold transition-colors duration-150",
              focused ? "text-indigo-600" : "text-slate-600",
              error && "!text-red-500"
            )}
          >
            {label}
            {props.required && <span className="mr-1 text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {startIcon && (
            <div className={cn(
              "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 [&_svg]:h-4 [&_svg]:w-4",
              focused ? "text-indigo-500" : "text-slate-400"
            )}>
              {startIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
            onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
            className={cn(
              "h-9 w-full rounded-xl border bg-white px-3 text-sm text-slate-900",
              "placeholder:text-slate-400 transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400",
              error
                ? "border-red-300 bg-red-50/20 focus:ring-red-400/20 focus:border-red-400"
                : "border-slate-200 hover:border-slate-300",
              "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
              startIcon && "pr-9",
              endIcon   && "pl-9",
              className
            )}
            {...props}
          />

          {endIcon && (
            <div className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-150 [&_svg]:h-4 [&_svg]:w-4",
              focused ? "text-indigo-500" : "text-slate-400"
            )}>
              {endIcon}
            </div>
          )}
        </div>

        {error && (
          <p className="flex items-center gap-1 text-xs text-red-500 animate-fade-in">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-slate-400">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, startIcon, endIcon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-500 mr-1">*</span>}
          </label>
        )}
        <div className="relative">
          {startIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {startIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
              "placeholder:text-slate-400 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              "disabled:bg-slate-50 disabled:text-slate-500",
              startIcon && "pr-9",
              endIcon && "pl-9",
              error && "border-red-400 focus:ring-red-400",
              className
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {endIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
