"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/* ──────────────────────────── Animated Number Hook ──────────────────────────── */
function useAnimatedNumber(target: number, duration = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(target * ease));
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/* ──────────────────────────── Card ──────────────────────────── */
interface CardProps {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
  glass?: boolean;
}

export function Card({ className, children, hover = false, glass = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-card",
        glass && "glass !bg-transparent",
        hover && "hover-lift cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────── CardHeader ──────────────────────────── */
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between border-b border-slate-100 px-6 py-4", className)}>
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* ──────────────────────────── CardBody ──────────────────────────── */
export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

/* ──────────────────────────── StatCard ──────────────────────────── */
const colorMap = {
  indigo:  { icon: "bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600",  ring: "ring-indigo-200/60",  bar: "bg-indigo-500",  glow: "rgba(99,102,241,0.12)" },
  amber:   { icon: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600",    ring: "ring-amber-200/60",   bar: "bg-amber-500",   glow: "rgba(245,158,11,0.12)" },
  emerald: { icon: "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600", ring: "ring-emerald-200/60", bar: "bg-emerald-500", glow: "rgba(16,185,129,0.12)" },
  blue:    { icon: "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600",       ring: "ring-blue-200/60",    bar: "bg-blue-500",    glow: "rgba(59,130,246,0.12)" },
  violet:  { icon: "bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600", ring: "ring-violet-200/60",  bar: "bg-violet-500",  glow: "rgba(139,92,246,0.12)" },
  rose:    { icon: "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600",       ring: "ring-rose-200/60",    bar: "bg-rose-500",    glow: "rgba(244,63,94,0.12)" },
} as const;

type StatColor = keyof typeof colorMap;

/* Legacy iconBg support */
const iconBgToColor: Record<string, StatColor> = {
  "bg-indigo-100": "indigo",
  "bg-amber-100":  "amber",
  "bg-emerald-100": "emerald",
  "bg-green-100":  "emerald",
  "bg-blue-100":   "blue",
  "bg-violet-100": "violet",
  "bg-purple-100": "violet",
  "bg-rose-100":   "rose",
};

interface StatCardProps {
  title: string;
  value: string | number;
  rawValue?: number;
  change?: number;
  icon: React.ReactNode;
  color?: StatColor;
  /** @deprecated use color instead */
  iconBg?: string;
  className?: string;
}

export function StatCard({ title, value, rawValue, change, icon, color, iconBg, className }: StatCardProps) {
  const resolvedColor: StatColor = color ?? (iconBg ? (iconBgToColor[iconBg] ?? "indigo") : "indigo");
  const c = colorMap[resolvedColor];

  const animated = useAnimatedNumber(rawValue ?? 0);
  const displayValue = rawValue !== undefined ? animated.toLocaleString("ar") : value;

  const isUp   = (change ?? 0) > 0;
  const isDown = (change ?? 0) < 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white",
        "p-5 shadow-card hover-lift animate-slide-up",
        className
      )}
    >
      {/* Corner glow */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full"
        style={{ background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)` }}
      />

      <div className="flex items-start justify-between gap-3">
        {/* Icon */}
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 [&_svg]:h-5 [&_svg]:w-5", c.icon, c.ring)}>
          {icon}
        </div>

        {/* Change badge */}
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
            isUp   && "bg-emerald-50 text-emerald-700",
            isDown && "bg-red-50 text-red-600",
            !isUp && !isDown && "bg-slate-100 text-slate-500"
          )}>
            {isUp   && <TrendingUp   className="h-3 w-3" />}
            {isDown && <TrendingDown className="h-3 w-3" />}
            {!isUp && !isDown && <Minus className="h-3 w-3" />}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
          {displayValue}
        </p>
      </div>

      {/* Bottom accent bar */}
      <div className={cn("absolute bottom-0 left-0 right-0 h-[3px] opacity-50", c.bar)} />
    </div>
  );
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between border-b border-slate-100 px-6 py-4", className)}>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

// Stat card
interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  iconBg?: string;
}

export function StatCard({ title, value, change, icon, iconBg = "bg-indigo-100" }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {change !== undefined && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                change >= 0 ? "text-emerald-600" : "text-red-500"
              )}
            >
              {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}٪ من الشهر الماضي
            </p>
          )}
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconBg)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
