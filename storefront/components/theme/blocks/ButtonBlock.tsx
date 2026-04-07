"use client";

import Link from "next/link";
import clsx from "clsx";
import type { BlockComponentProps } from "../types";

export default function ButtonBlock({ transformedProps }: BlockComponentProps) {
  const label = typeof transformedProps.label === "string" ? transformedProps.label : "استعرض الآن";
  const href = typeof transformedProps.href === "string" ? transformedProps.href : "#";
  const target = typeof transformedProps.target === "string" ? transformedProps.target : "_self";
  const variant = typeof transformedProps.variant === "string" ? transformedProps.variant : "primary";
  const fullWidth = transformedProps.fullWidth === true;

  const variantClass = {
    primary: "bg-[var(--store-primary,#111827)] text-white hover:opacity-90",
    secondary: "bg-white text-gray-900 border border-gray-300 hover:border-gray-400",
    ghost: "bg-transparent text-gray-900 hover:bg-gray-100",
  }[variant] ?? "bg-[var(--store-primary,#111827)] text-white hover:opacity-90";

  return (
    <Link
      href={href}
      target={target}
      className={clsx(
        "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition",
        variantClass,
        fullWidth && "w-full"
      )}
    >
      {label}
    </Link>
  );
}