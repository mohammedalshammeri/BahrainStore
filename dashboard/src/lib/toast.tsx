"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

/* ─── Types ─── */
type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

/* ─── Context ─── */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/* ─── Config ─── */
const config: Record<ToastType, { icon: React.ElementType; bg: string }> = {
  success: { icon: CheckCircle2, bg: "bg-emerald-500" },
  error:   { icon: XCircle,      bg: "bg-red-500"     },
  warning: { icon: AlertTriangle, bg: "bg-amber-500"  },
  info:    { icon: Info,          bg: "bg-blue-500"   },
};

/* ─── Provider ─── */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "success", duration = 3500) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container — bottom left in RTL = bottom right visually */}
      <div
        className="fixed bottom-5 left-5 z-[9999] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const { icon: Icon, bg } = config[toast.type];
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex items-center gap-3",
                "rounded-2xl px-4 py-3 min-w-[260px] max-w-sm",
                "text-white text-sm font-medium shadow-lg",
                "animate-slide-up",
                bg
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-lg p-0.5 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
