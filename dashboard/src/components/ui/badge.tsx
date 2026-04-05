import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "purple" | "brand";

const variantStyles: Record<BadgeVariant, { cls: string; dot: string }> = {
  default: { cls: "bg-slate-100  text-slate-600  ring-slate-200/80",         dot: "bg-slate-400"   },
  success: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",       dot: "bg-emerald-500" },
  warning: { cls: "bg-amber-50   text-amber-700   ring-amber-200/80",         dot: "bg-amber-500"   },
  error:   { cls: "bg-red-50     text-red-600     ring-red-200/80",           dot: "bg-red-500"     },
  info:    { cls: "bg-blue-50    text-blue-700    ring-blue-200/80",          dot: "bg-blue-500"    },
  purple:  { cls: "bg-violet-50  text-violet-700  ring-violet-200/80",        dot: "bg-violet-500"  },
  brand:   { cls: "bg-indigo-50  text-indigo-700  ring-indigo-200/80",        dot: "bg-indigo-500"  },
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export function Badge({ children, variant = "default", dot = false, className }: BadgeProps) {
  const s = variantStyles[variant];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
      s.cls,
      className
    )}>
      {dot && (
        <span className={cn("h-[5px] w-[5px] shrink-0 rounded-full", s.dot)} />
      )}
      {children}
    </span>
  );
}

/* ─── Order Status Badge ─── */
export function orderStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT:      { label: "مسودة",           variant: "default"  },
    PENDING:    { label: "معلّق",            variant: "warning"  },
    CONFIRMED:  { label: "مؤكّد",            variant: "info"     },
    PROCESSING: { label: "قيد التجهيز",    variant: "purple"   },
    SHIPPED:    { label: "تم الشحن",       variant: "info"     },
    DELIVERED:  { label: "مُسلَّم",         variant: "success"  },
    CANCELLED:  { label: "ملغي",            variant: "error"    },
    REFUNDED:   { label: "مُسترد",          variant: "default"  },
  };
  const c = map[status] ?? { label: status, variant: "default" as BadgeVariant };
  return <Badge variant={c.variant} dot>{c.label}</Badge>;
}

export function paymentStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    PENDING:  { label: "لم يُدفع",  variant: "warning" },
    PAID:     { label: "مدفوع",     variant: "success" },
    FAILED:   { label: "فشل",       variant: "error"   },
    REFUNDED: { label: "مُسترد",    variant: "default" },
  };
  const c = map[status] ?? { label: status, variant: "default" as BadgeVariant };
  return <Badge variant={c.variant} dot>{c.label}</Badge>;
}
