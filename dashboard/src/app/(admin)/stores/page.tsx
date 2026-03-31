"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatBHD } from "@/lib/utils";
import {
  Search, CheckCircle2, XCircle, ChevronLeft,
  ChevronRight, ExternalLink, ToggleLeft, ToggleRight,
} from "lucide-react";

interface AdminStore {
  id: string;
  name: string;
  nameAr: string;
  subdomain: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  revenue: number;
  merchant: { id: string; email: string; firstName: string; lastName: string };
  _count: { orders: number; products: number; customers: number };
}

const PLANS = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"];

const PLAN_COLORS: Record<string, string> = {
  STARTER: "bg-slate-100 text-slate-600",
  GROWTH: "bg-blue-100 text-blue-700",
  PRO: "bg-indigo-100 text-indigo-700",
  ENTERPRISE: "bg-purple-100 text-purple-700",
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: "ستارتر",
  GROWTH: "نمو",
  PRO: "برو",
  ENTERPRISE: "مؤسسات",
};

export default function AdminStoresPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__adminStoreTimer);
    (window as any).__adminStoreTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stores", page, debouncedSearch],
    queryFn: async () => {
      const q = new URLSearchParams({
        page: String(page),
        limit: "15",
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await api.get(`/admin/stores?${q}`);
      return res.data as { stores: AdminStore[]; total: number; pages: number };
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/stores/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-stores"] }),
  });

  const changePlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      api.patch(`/admin/stores/${id}`, { plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-stores"] }),
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">المتاجر</h1>
          <p className="text-sm text-slate-500 mt-0.5">إجمالي {data?.total ?? 0} متجر</p>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الرابط أو البريد..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pr-9 pl-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-72 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-right">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-8">#</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">المتجر</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">التاجر</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">الخطة</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">الطلبات</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">المنتجات</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">العملاء</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">الإيراد</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">تاريخ الإنشاء</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading
                ? Array(8)
                    .fill(0)
                    .map((_, i) => (
                      <tr key={i}>
                        {Array(10)
                          .fill(0)
                          .map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 bg-slate-100 rounded animate-pulse" />
                            </td>
                          ))}
                      </tr>
                    ))
                : data?.stores.map((s, i) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {(page - 1) * 15 + i + 1}
                      </td>

                      {/* Store name + link */}
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-slate-900">{s.nameAr || s.name}</p>
                            <a
                              href={`http://${s.subdomain}.bazar.bh`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-300 hover:text-indigo-500 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <p className="text-xs text-slate-400 font-mono">{s.subdomain}.bazar.bh</p>
                        </div>
                      </td>

                      {/* Merchant */}
                      <td className="px-4 py-3">
                        <p className="text-slate-700 text-xs">
                          {s.merchant.firstName} {s.merchant.lastName}
                        </p>
                        <p className="text-slate-400 text-xs font-mono">{s.merchant.email}</p>
                      </td>

                      {/* Plan selector */}
                      <td className="px-4 py-3 text-center">
                        <select
                          value={s.plan}
                          onChange={(e) => changePlan.mutate({ id: s.id, plan: e.target.value })}
                          className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                            PLAN_COLORS[s.plan] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {PLANS.map((p) => (
                            <option key={p} value={p}>
                              {PLAN_LABELS[p] ?? p}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Orders / Products / Customers */}
                      <td className="px-4 py-3 text-center text-slate-600 text-xs font-medium">
                        {s._count.orders.toLocaleString("ar")}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 text-xs">
                        {s._count.products.toLocaleString("ar")}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 text-xs">
                        {s._count.customers.toLocaleString("ar")}
                      </td>

                      {/* Revenue */}
                      <td className="px-4 py-3 text-slate-700 font-medium text-xs">
                        {formatBHD(s.revenue)}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(s.createdAt).toLocaleDateString("ar-BH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Toggle active */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            toggleActive.mutate({ id: s.id, isActive: !s.isActive })
                          }
                          disabled={toggleActive.isPending}
                          title={s.isActive ? "إيقاف المتجر" : "تفعيل المتجر"}
                          className="text-slate-400 hover:text-indigo-600 transition disabled:opacity-40"
                        >
                          {s.isActive ? (
                            <ToggleRight className="w-6 h-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              صفحة {page} من {data.pages} — إجمالي {data.total} متجر
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data?.stores.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <XCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد متاجر مطابقة للبحث</p>
          </div>
        )}
      </div>
    </div>
  );
}
