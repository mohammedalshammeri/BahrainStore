"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { formatBHD, formatDate, getInitials } from "@/lib/utils";
import type { Customer } from "@/types";
import { Users, Search } from "lucide-react";

export default function CustomersPage() {
  const { store } = useAuthStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", store?.id, search, page],
    queryFn: async () => {
      const res = await api.get(`/customers`, {
        params: { storeId: store!.id, search, page, limit: 20 },
      });
      return res.data;
    },
    enabled: !!store?.id,
  });

  const customers: Customer[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="flex flex-col">
      <Header title="العملاء" subtitle={`${total.toLocaleString("ar")} عميل`} />

      <div className="p-6 space-y-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-right">
                  <th className="px-4 py-3 font-medium text-slate-500">العميل</th>
                  <th className="px-4 py-3 font-medium text-slate-500">رقم الهاتف</th>
                  <th className="px-4 py-3 font-medium text-slate-500">البريد الإلكتروني</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الطلبات</th>
                  <th className="px-4 py-3 font-medium text-slate-500">إجمالي الإنفاق</th>
                  <th className="px-4 py-3 font-medium text-slate-500">تاريخ التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !customers.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Users className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-2 text-slate-500">لا يوجد عملاء بعد</p>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      {/* Avatar + Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                            {getInitials(customer.name)}
                          </div>
                          <span className="font-medium text-slate-900">{customer.name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-600">{customer.phone}</td>

                      <td className="px-4 py-3 text-slate-600">
                        {customer.email ?? <span className="text-slate-300">—</span>}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">
                          {customer.totalOrders.toLocaleString("ar")}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatBHD(customer.totalSpent)}
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(customer.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-500">
                صفحة {page} من {data.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
                >
                  السابق
                </button>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
