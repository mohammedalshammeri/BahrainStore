import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "purple";

const variants: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  purple: "bg-indigo-100 text-indigo-700",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Order Status Badge
export function orderStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    PENDING:    { label: "معلّق",      variant: "warning" },
    CONFIRMED:  { label: "مؤكّد",      variant: "info" },
    PROCESSING: { label: "قيد التجهيز", variant: "purple" },
    SHIPPED:    { label: "تم الشحن",   variant: "info" },
    DELIVERED:  { label: "مُسلَّم",    variant: "success" },
    CANCELLED:  { label: "ملغي",       variant: "error" },
    REFUNDED:   { label: "مُسترد",     variant: "default" },
  };
  const config = map[status] ?? { label: status, variant: "default" as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function paymentStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    PENDING:  { label: "لم يُدفع",  variant: "warning" },
    PAID:     { label: "مدفوع",     variant: "success" },
    FAILED:   { label: "فشل",      variant: "error" },
    REFUNDED: { label: "مُسترد",   variant: "default" },
  };
  const config = map[status] ?? { label: status, variant: "default" as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
