"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import Link from "next/link";
import { BarChart2, Users, Store, ArrowRight, ShieldAlert } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { merchant } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (merchant !== null && !(merchant as any).isAdmin) {
      router.replace("/");
    }
  }, [merchant, router]);

  if (!merchant || !(merchant as any).isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <ShieldAlert className="w-14 h-14 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm">جارٍ التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "الإحصائيات", icon: BarChart2 },
    { href: "/admin/merchants", label: "التجار", icon: Users },
    { href: "/admin/stores", label: "المتاجر", icon: Store },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" dir="rtl">
      {/* Admin Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#1e1b4b] flex flex-col">
        <div className="px-5 py-5 border-b border-indigo-900">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-bold text-amber-400">إدارة المنصة</p>
          </div>
          <p className="text-xs text-indigo-400 truncate">{merchant.email}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? "bg-amber-500 text-white"
                    : "text-indigo-200 hover:bg-indigo-900/60 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-indigo-900">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-300 hover:text-white transition rounded-lg hover:bg-indigo-900/50"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للداشبورد
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
