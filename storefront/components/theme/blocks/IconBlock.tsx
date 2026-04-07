"use client";

import Link from "next/link";
import clsx from "clsx";
import {
  BadgeCheck,
  CreditCard,
  Gift,
  Headphones,
  HeartHandshake,
  Lock,
  Package,
  Percent,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { BlockComponentProps } from "../types";

const iconMap: Record<string, LucideIcon> = {
  truck: Truck,
  shield: ShieldCheck,
  lock: Lock,
  star: Star,
  gift: Gift,
  package: Package,
  support: Headphones,
  discount: Percent,
  refresh: RefreshCcw,
  payment: CreditCard,
  premium: Sparkles,
  verified: BadgeCheck,
  trust: HeartHandshake,
  store: Store,
};

export default function IconBlock({ transformedProps }: BlockComponentProps) {
  const iconName = typeof transformedProps.icon === "string" ? transformedProps.icon : "star";
  const title = typeof transformedProps.title === "string" ? transformedProps.title : "ميزة";
  const description = typeof transformedProps.description === "string" ? transformedProps.description : "";
  const href = typeof transformedProps.href === "string" ? transformedProps.href : "";
  const align = typeof transformedProps.align === "string" ? transformedProps.align : "center";
  const tone = typeof transformedProps.tone === "string" ? transformedProps.tone : "primary";

  const Icon = iconMap[iconName] ?? Star;
  const toneClass = {
    primary: "bg-[color-mix(in_oklch,var(--store-primary,#111827),white_88%)] text-[var(--store-primary,#111827)]",
    secondary: "bg-[color-mix(in_oklch,var(--store-secondary,#0f766e),white_84%)] text-[var(--store-secondary,#0f766e)]",
    dark: "bg-gray-900 text-white",
  }[tone] ?? "bg-[color-mix(in_oklch,var(--store-primary,#111827),white_88%)] text-[var(--store-primary,#111827)]";

  const alignClass = {
    left: "items-start text-left",
    center: "items-center text-center",
    right: "items-end text-right",
  }[align] ?? "items-center text-center";

  const content = (
    <div className={clsx("flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", alignClass)}>
      <div className={clsx("flex h-12 w-12 items-center justify-center rounded-2xl", toneClass)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>}
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}