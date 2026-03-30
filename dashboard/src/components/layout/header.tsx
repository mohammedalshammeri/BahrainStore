"use client";

import { Bell, Search } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { store } = useAuthStore();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Left: Title */}
      <div>
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث..."
            className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 pr-9 pl-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            3
          </span>
        </button>

        {/* Store plan badge */}
        {store?.plan && (
          <span className="hidden rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 sm:inline-flex">
            {store.plan === "FREE" ? "مجاني" : store.plan}
          </span>
        )}
      </div>
    </header>
  );
}
