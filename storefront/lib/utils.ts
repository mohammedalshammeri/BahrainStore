import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBHD(amount: number): string {
  return new Intl.NumberFormat("ar-BH", {
    style: "currency",
    currency: "BHD",
    minimumFractionDigits: 3,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("ar-BH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
