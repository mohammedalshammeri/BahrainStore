import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" && "py-8 gap-2",
        size === "md" && "py-12 gap-3",
        size === "lg" && "py-20 gap-4",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl gradient-brand-subtle",
            size === "sm" && "h-12 w-12 [&_svg]:h-5 [&_svg]:w-5",
            size === "md" && "h-16 w-16 [&_svg]:h-7 [&_svg]:w-7",
            size === "lg" && "h-20 w-20 [&_svg]:h-9 [&_svg]:w-9",
            "text-indigo-400"
          )}
        >
          {icon}
        </div>
      )}

      <div className={cn("space-y-1", size === "lg" && "space-y-2")}>
        <p
          className={cn(
            "font-semibold text-slate-700",
            size === "sm" && "text-sm",
            size === "md" && "text-base",
            size === "lg" && "text-lg"
          )}
        >
          {title}
        </p>
        {description && (
          <p
            className={cn(
              "text-slate-400 max-w-xs mx-auto",
              size === "sm" && "text-xs",
              size === "md" && "text-sm",
              size === "lg" && "text-base"
            )}
          >
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
