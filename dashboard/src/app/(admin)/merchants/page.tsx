"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search, ShieldCheck, ShieldOff, CheckCircle,
  XCircle, Store, ChevronLeft, ChevronRight,
} from "lucide-react";

interface AdminMerchant {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  _count: { stores: number };
}

export default function AdminMerchantsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__adminSearchTimer);
    (window as any).__adminSearchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-merchants", page, debouncedSearch],
    queryFn: async () => {
      const q = new URLSearchParams({
        page: String(page),
        limit: "15",
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await api.get(`/admin/merchants?${q}`);
      return res.data as { merchants: AdminMerchant[]; total: number; pages: number };
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/merchants/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-merchants"] }),
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">التجار المسجلون</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            إجمالي {data?.total ?? 0} تاجر
          </p>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالاسم أو البريد أو الهاتف..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pr-9 pl-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-72 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-right">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-8">#</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">التاجر</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">البريد الإلكتروني</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">الهاتف</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">موثق</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">المتاجر</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">تاريخ التسجيل</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading
                ? Array(8)
                    .fill(0)
                    .map((_, i) => (
                      <tr key={i}>
                        {Array(8)
                          .fill(0)
                          .map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 bg-slate-100 rounded animate-pulse" />
                            </td>
                          ))}
                      </tr>
                    ))
                : data?.merchants.map((m, i) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {(page - 1) * 15 + i + 1}
                      </td>

                      {/* Name + avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                            {m.firstName[0]}
                            {m.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {m.firstName} {m.lastName}
                            </p>
                            {m.isAdmin && (
                              <span className="text-xs text-amber-600 font-medium">
                                🛡️ مشرف المنصة
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{m.email}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{m.phone ?? "—"}</td>

                      {/* Verified */}
                      <td className="px-4 py-3 text-center">
                        {m.isVerified ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300 inline" />
                        )}
                      </td>

                      {/* Stores count */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Store className="w-3.5 h-3.5" />
                          {m._count.stores}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(m.createdAt).toLocaleDateString("ar-BH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Toggle active */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            toggleActive.mutate({ id: m.id, isActive: !m.isActive })
                          }
                          disabled={toggleActive.isPending || m.isAdmin}
                          title={m.isAdmin ? "لا يمكن تعطيل حساب المشرف" : undefined}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition disabled:opacity-50 ${
                            m.isActive
                              ? "bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700"
                              : "bg-red-100 text-red-700 hover:bg-emerald-100 hover:text-emerald-700"
                          }`}
                        >
                          {m.isActive ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5" /> نشط
                            </>
                          ) : (
                            <>
                              <ShieldOff className="w-3.5 h-3.5" /> موقوف
                            </>
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
              صفحة {page} من {data.pages} — إجمالي {data.total} تاجر
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
        {!isLoading && data?.merchants.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا يوجد تجار مطابقون للبحث</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Import for empty icon
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
