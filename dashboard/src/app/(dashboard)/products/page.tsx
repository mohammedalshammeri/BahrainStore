"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { getPublicApiUrl } from "@/lib/env";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatBHD, formatDate } from "@/lib/utils";
import type { Product } from "@/types";
import { Plus, Search, Edit2, Trash2, Image as ImageIcon, Package, Upload, Download, AlertTriangle, Barcode } from "lucide-react";

export default function ProductsPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [csvMsg, setCsvMsg] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Fetch low-stock count once
  useQuery({
    queryKey: ["low-stock-count", store?.id],
    queryFn: async () => {
      const res = await api.get(`/inventory/low-stock?storeId=${store?.id}`);
      setLowStockCount((res.data as { total: number }).total);
      return res.data;
    },
    enabled: !!store?.id,
    staleTime: 60_000,
  });

  const handleCsvExport = async () => {
    setExportLoading(true);
    try {
      const res = await api.get(`/inventory/export?storeId=${store?.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["products", store?.id, search, page],
    queryFn: async () => {
      const res = await api.get(`/products`, {
        params: { storeId: store!.id, search, page, limit: 20 },
      });
      return res.data;
    },
    enabled: !!store?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvMsg("");
    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) { setCsvMsg("الملف فارغ"); return; }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
      const products = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
      });
      const res = await api.post("/products/bulk", { storeId: store!.id, products });
      setCsvMsg(`تم استيراد ${res.data.created} منتج بنجاح`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch {
      setCsvMsg("حدث خطأ أثناء الاستيراد");
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = "";
      setTimeout(() => setCsvMsg(""), 5000);
    }
  };

  const products: Product[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="flex flex-col">
      <Header title="المنتجات" subtitle={`${total.toLocaleString("ar")} منتج`} />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث عن منتج..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* CSV Import */}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCsvExport}
              disabled={exportLoading}
            >
              <Download className="h-4 w-4" />
              {exportLoading ? "جاري التصدير..." : "تصدير CSV"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => csvInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              استيراد CSV
            </Button>
            <Link href="/products/new">
              <Button>
                <Plus className="h-4 w-4" />
                إضافة منتج
              </Button>
            </Link>
          </div>
        </div>

        {/* Low stock banner */}
        {lowStockCount !== null && lowStockCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>{lowStockCount}</strong> منتج وصل للحد الأدنى للمخزون أو نفد</span>
          </div>
        )}

        {csvMsg && (
          <div className={`rounded-lg px-4 py-3 text-sm ${csvMsg.includes("نجاح") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {csvMsg}
          </div>
        )}

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-right">
                  <th className="px-4 py-3 font-medium text-slate-500 w-12"></th>
                  <th className="px-4 py-3 font-medium text-slate-500">المنتج</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الفئة</th>
                  <th className="px-4 py-3 font-medium text-slate-500">السعر</th>
                  <th className="px-4 py-3 font-medium text-slate-500">المخزون</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-4 py-3 font-medium text-slate-500">تاريخ الإضافة</th>
                  <th className="px-4 py-3 font-medium text-slate-500 w-20">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !products.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Package className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-2 text-slate-500">لا توجد منتجات بعد</p>
                      <Link href="/products/new" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
                        أضف أول منتج
                      </Link>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      {/* Image */}
                      <td className="px-4 py-3">
                        {product.images[0] ? (
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                            <ImageIcon className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{product.name}</p>
                        {product.nameAr && (
                          <p className="text-xs text-slate-500">{product.nameAr}</p>
                        )}
                        {product.sku && (
                          <p className="text-xs font-mono text-slate-400">SKU: {product.sku}</p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-slate-600">
                        {product.category?.name ?? <span className="text-slate-300">—</span>}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">
                          {formatBHD(product.price)}
                        </span>
                        {product.comparePrice && (
                          <p className="text-xs text-slate-400 line-through">
                            {formatBHD(product.comparePrice)}
                          </p>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-3">
                        <span
                          className={
                            product.stock === 0
                              ? "text-red-500 font-medium"
                              : product.stock < 5
                              ? "text-amber-500 font-medium"
                              : "text-slate-900"
                          }
                        >
                          {product.stock}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant={product.isActive ? "success" : "default"}>
                          {product.isActive ? "نشط" : "مخفي"}
                        </Badge>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(product.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/products/${product.id}/edit`}>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </Link>
                          <a href={`${getPublicApiUrl()}/inventory/barcode/${product.id}?storeId=${store?.id}`} download target="_blank" rel="noopener noreferrer">
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-purple-50 hover:text-purple-600 transition-colors" title="تنزيل الباركود">
                              <Barcode className="h-3.5 w-3.5" />
                            </button>
                          </a>
                          <button
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذا المنتج؟"))
                                deleteMutation.mutate(product.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
