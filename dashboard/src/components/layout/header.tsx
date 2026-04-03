"use client";

import { Bell, Search, X, Loader2, Package, ShoppingCart, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

interface SearchResult {
  type: "product" | "order" | "customer";
  id: string;
  label: string;
  sublabel?: string;
  image?: string | null;
  href: string;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { store } = useAuthStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (q: string) => {
      if (!store?.id || q.trim().length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const [prodRes, orderRes, custRes] = await Promise.all([
          api.get(`/products?storeId=${store.id}&search=${encodeURIComponent(q)}&limit=4`),
          api.get(`/orders?storeId=${store.id}&search=${encodeURIComponent(q)}&limit=3`),
          api.get(`/customers?storeId=${store.id}&search=${encodeURIComponent(q)}&limit=3`),
        ]);
        const items: SearchResult[] = [
          ...(prodRes.data.products ?? []).map((p: any) => ({
            type: "product" as const,
            id: p.id,
            label: p.nameAr || p.name,
            sublabel: `${p.price} ${store.currency ?? "BHD"}`,
            image: p.images?.[0]?.url ?? null,
            href: `/products/${p.id}`,
          })),
          ...(orderRes.data.orders ?? []).map((o: any) => ({
            type: "order" as const,
            id: o.id,
            label: `طلب #${o.orderNumber}`,
            sublabel: o.status,
            image: null,
            href: `/orders/${o.id}`,
          })),
          ...(custRes.data.customers ?? []).map((c: any) => ({
            type: "customer" as const,
            id: c.id,
            label: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
            sublabel: c.phone,
            image: null,
            href: `/customers/${c.id}`,
          })),
        ];
        setResults(items);
        setOpen(items.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [store?.id, store?.currency]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const typeIcon = (type: SearchResult["type"]) => {
    if (type === "product") return <Package className="w-3.5 h-3.5 text-indigo-400" />;
    if (type === "order") return <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />;
    return <Users className="w-3.5 h-3.5 text-amber-400" />;
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white px-6"
      style={{ boxShadow: '0 1px 0 rgba(226,232,240,0.8), 0 1px 4px rgba(0,0,0,0.03)' }}
    >
      {/* Left: Title */}
      <div>
        <h1 className="text-base font-bold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Custom action (e.g. page-level buttons) */}
        {action && <div className="flex items-center">{action}</div>}

        {/* Search */}
        <div ref={containerRef} className="relative hidden md:block">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="بحث سريع..."
            className="h-9 w-64 rounded-xl border border-slate-200 bg-slate-50/80 pr-9 pl-7 text-sm placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white focus:w-72"
          />
          {loading && <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400" />}
          {query && !loading && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2"
              onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            >
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700" />
            </button>
          )}
          {/* Dropdown */}
          {open && results.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200/80 rounded-2xl shadow-card-md z-50 overflow-hidden min-w-[320px] animate-slide-up">
              {results.map((r) => (
                <Link
                  key={`${r.type}-${r.id}`}
                  href={r.href}
                  onClick={() => { setOpen(false); setQuery(""); }}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition"
                >
                  {r.image ? (
                    <Image src={r.image} alt={r.label} width={32} height={32} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      {typeIcon(r.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.label}</p>
                    {r.sublabel && <p className="text-xs text-slate-400 truncate">{r.sublabel}</p>}
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">
                    {r.type === "product" ? "منتج" : r.type === "order" ? "طلب" : "عميل"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-all duration-150 shadow-xs">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -left-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full gradient-brand text-[9px] font-bold text-white shadow-brand-sm">
            3
          </span>
        </button>

        {/* Store plan badge */}
        {store?.plan && (
          <span className="hidden rounded-full gradient-brand px-3 py-1 text-xs font-semibold text-white shadow-brand-sm sm:inline-flex">
            {store.plan === "FREE" ? "مجاني" : store.plan}
          </span>
        )}
      </div>
    </header>
  );
}
