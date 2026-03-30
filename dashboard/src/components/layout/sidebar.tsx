"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tag,
  BarChart2,
  Settings,
  LogOut,
  Store,
  ChevronLeft,
} from "lucide-react";

const navItems = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/products", label: "المنتجات", icon: Package },
  { href: "/orders", label: "الطلبات", icon: ShoppingCart },
  { href: "/customers", label: "العملاء", icon: Users },
  { href: "/coupons", label: "الكوبونات", icon: Tag },
  { href: "/analytics", label: "التحليلات", icon: BarChart2 },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { merchant, store, logout } = useAuthStore();

  return (
    <aside className="flex h-screen w-64 flex-col bg-[#1e1b4b] text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-indigo-900 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 text-white font-bold text-lg">
          ب
        </div>
        <div>
          <p className="font-bold text-white text-lg leading-tight">بزار</p>
          <p className="text-xs text-indigo-300">BSMC.BH</p>
        </div>
      </div>

      {/* Store info */}
      {store && (
        <div className="border-b border-indigo-900 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-indigo-900/50 px-3 py-2">
            <Store className="h-4 w-4 text-indigo-300 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{store.name}</p>
              <p className="text-xs text-indigo-400">{store.subdomain}.bazar.bh</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-indigo-200 hover:bg-indigo-900/60 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                  {isActive && <ChevronLeft className="mr-auto h-3.5 w-3.5 opacity-70" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-indigo-900 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold">
            {merchant?.name?.[0] ?? "م"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{merchant?.name ?? "تاجر"}</p>
            <p className="truncate text-xs text-indigo-400">{merchant?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
