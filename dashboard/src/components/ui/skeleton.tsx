import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "rect" | "circle" | "text";
}

export function Skeleton({ className, variant = "rect" }: SkeletonProps) {
  if (variant === "circle") {
    return <div className={cn("shimmer rounded-full", className ?? "h-10 w-10")} />;
  }
  if (variant === "text") {
    return <div className={cn("shimmer h-3.5 rounded-md", className ?? "w-3/4")} />;
  }
  return <div className={cn("shimmer rounded-xl", className ?? "h-12 w-full")} />;
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
      <div className="flex items-start justify-between">
        <Skeleton variant="circle" className="h-11 w-11 rounded-xl" />
        <Skeleton variant="text" className="w-14 h-5 rounded-full" />
      </div>
      <div className="space-y-2 mt-4">
        <Skeleton variant="text" className="w-20 h-3" />
        <Skeleton variant="text" className="w-28 h-7" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-3.5">
          <Skeleton variant="text" className={cn("h-3.5", i === 0 ? "w-24" : "w-16")} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-4 shadow-card">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/2 h-3" />
          <Skeleton variant="text" className="w-1/3 h-3" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn("h-3.5", i === rows - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
