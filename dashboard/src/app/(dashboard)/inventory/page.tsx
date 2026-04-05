"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import {
  BarChart2,
  AlertTriangle,
  Download,
  Upload,
  Search,
  Package,
  ArrowUp,
  ArrowDown,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  nameAr: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  lowStockAlert: number;
  trackInventory: boolean;
  isActive: boolean;
  images: { url: string }[];
}

/* ─── Stock Badge ─── */
function StockBadge({ product }: { product: Product }) {
  if (!product.trackInventory)
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
        غير محدود
      </span>
    );
  if (product.stock === 0)
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
        نفد
      </span>
    );
  if (product.stock <= product.lowStockAlert)
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
        منخفض ({product.stock})
      </span>
    );
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
      {product.stock.toLocaleString("ar")}
    </span>
  );
}

/* ─── Quick Stock Editor ─── */
function StockEditor({
  product,
  storeId,
}: {
  product: Product;
  storeId: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(product.stock));

  const mutation = useMutation({
    mutationFn: (stock: number) =>
      api.patch(`/products/${product.id}`, { storeId, stock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", storeId] });
      setEditing(false);
    },
  });

  if (!product.trackInventory)
    return <span className="text-xs text-slate-400">—</span>;

  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded px-2 py-0.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        {product.stock}
      </button>
    );

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 rounded border border-indigo-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") mutation.mutate(Number(value));
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => mutation.mutate(Number(value))}
        disabled={mutation.isPending}
        className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── Import Result ─── */
interface ImportResult {
  created: string[];
  updated: string[];
  errors: { row: number; error: string }[];
}

/* ─── Main Page ─── */
export default function InventoryPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [sortField, setSortField] = useState<"name" | "stock">("stock");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", store?.id],
    queryFn: async () => {
      const res = await api.get("/products", {
        params: { storeId: store!.id, limit: 500 },
      });
      return res.data.products as Product[];
    },
    enabled: !!store?.id,
  });

  const products: Product[] = data ?? [];

  /* Filter */
  const filtered = products
    .filter((p) => {
      const matchSearch =
        !search ||
        p.nameAr.includes(search) ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filter === "out") return p.trackInventory && p.stock === 0;
      if (filter === "low") return p.trackInventory && p.stock > 0 && p.stock <= p.lowStockAlert;
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortField === "stock") return (a.stock - b.stock) * mul;
      return a.nameAr.localeCompare(b.nameAr, "ar") * mul;
    });

  const outOfStock = products.filter((p) => p.trackInventory && p.stock === 0).length;
  const lowStock = products.filter(
    (p) => p.trackInventory && p.stock > 0 && p.stock <= p.lowStockAlert
  ).length;

  /* Export */
  const handleExport = async () => {
    if (!store) return;
    setExporting(true);
    try {
      const res = await api.get("/inventory/export", {
        params: { storeId: store.id },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-${store.slug}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  /* Import */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store) return;
    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const csv = ev.target?.result as string;
      try {
        const res = await api.post("/inventory/import", {
          storeId: store.id,
          csv,
        });
        setImportResult(res.data);
        queryClient.invalidateQueries({ queryKey: ["inventory", store.id] });
      } catch (err: any) {
        setImportResult({
          created: [],
          updated: [],
          errors: [{ row: 0, error: err?.response?.data?.error ?? "فشل الاستيراد" }],
        });
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field ? (
      sortDir === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" />
      )
    ) : null;

  return (
    <div className="flex flex-col">
      <Header
        title="إدارة المخزون"
        subtitle={`${products.length.toLocaleString("ar")} منتج`}
        action={
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              استيراد CSV
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              تصدير CSV
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div
            className="p-4 flex items-center gap-3 cursor-pointer rounded-2xl border border-slate-200/80 bg-white shadow-card hover-lift"
            onClick={() => setFilter("all")}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${filter === "all" ? "bg-indigo-600" : "bg-indigo-100"}`}>
              <Package className={`h-5 w-5 ${filter === "all" ? "text-white" : "text-indigo-600"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{products.length}</p>
              <p className="text-xs text-slate-500">إجمالي المنتجات</p>
            </div>
          </div>
          <div
            className="p-4 flex items-center gap-3 cursor-pointer rounded-2xl border border-slate-200/80 bg-white shadow-card hover-lift"
            onClick={() => setFilter("low")}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${filter === "low" ? "bg-amber-500" : "bg-amber-100"}`}>
              <AlertTriangle className={`h-5 w-5 ${filter === "low" ? "text-white" : "text-amber-600"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{lowStock}</p>
              <p className="text-xs text-slate-500">مخزون منخفض</p>
            </div>
          </div>
          <div
            className="p-4 flex items-center gap-3 cursor-pointer rounded-2xl border border-slate-200/80 bg-white shadow-card hover-lift"
            onClick={() => setFilter("out")}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${filter === "out" ? "bg-red-500" : "bg-red-100"}`}>
              <XCircle className={`h-5 w-5 ${filter === "out" ? "text-white" : "text-red-500"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{outOfStock}</p>
              <p className="text-xs text-slate-500">نفد من المخزون</p>
            </div>
          </div>
        </div>

        {/* Import Result */}
        {importResult && (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-slate-800">نتيجة الاستيراد</p>
                {importResult.created.length > 0 && (
                  <p className="text-emerald-600">
                    <CheckCircle2 className="inline h-4 w-4 ml-1" />
                    تم إنشاء {importResult.created.length} منتج جديد
                  </p>
                )}
                {importResult.updated.length > 0 && (
                  <p className="text-indigo-600">
                    <CheckCircle2 className="inline h-4 w-4 ml-1" />
                    تم تحديث {importResult.updated.length} منتج
                  </p>
                )}
                {importResult.errors.length > 0 && (
                  <div className="space-y-0.5">
                    {importResult.errors.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-red-500">
                        <XCircle className="inline h-4 w-4 ml-1" />
                        {e.row > 0 ? `صف ${e.row}: ` : ""}
                        {e.error}
                      </p>
                    ))}
                    {importResult.errors.length > 5 && (
                      <p className="text-slate-400 text-xs">
                        +{importResult.errors.length - 5} خطأ آخر
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setImportResult(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </Card>
        )}

        {/* Filters + Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الباركود أو SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
            {(["all", "low", "out"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filter === f
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f === "all" ? "الكل" : f === "low" ? "منخفض" : "نفد"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-right">
                  <th className="px-4 py-3 font-medium text-slate-500">المنتج</th>
                  <th className="px-4 py-3 font-medium text-slate-500 hidden sm:table-cell">
                    SKU / باركود
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-slate-500 cursor-pointer select-none"
                    onClick={() => toggleSort("stock")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      المخزون
                      <SortIcon field="stock" />
                    </span>
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-4 py-3 font-medium text-slate-500">تعديل سريع</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 animate-pulse rounded bg-slate-100" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : !filtered.length
                  ? (
                    <tr>
                      <td colSpan={5} className="py-14 text-center">
                        <Package className="mx-auto h-12 w-12 text-slate-300" />
                        <p className="mt-2 font-medium text-slate-500">
                          {filter !== "all"
                            ? "لا توجد منتجات بهذا الفلتر"
                            : "لا توجد منتجات بعد"}
                        </p>
                      </td>
                    </tr>
                  )
                  : filtered.map((product) => (
                      <tr
                        key={product.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                          product.trackInventory && product.stock === 0
                            ? "bg-red-50/30"
                            : product.trackInventory && product.stock <= product.lowStockAlert
                            ? "bg-amber-50/30"
                            : ""
                        }`}
                      >
                        {/* Product */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.images?.[0] ? (
                              <img
                                src={product.images[0].url}
                                alt=""
                                className="h-9 w-9 rounded-lg object-cover border border-slate-100"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                <Package className="h-4 w-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 max-w-[180px]">
                                {product.nameAr}
                              </p>
                              <p className="text-xs text-slate-400" dir="ltr">
                                {Number(product.price).toFixed(3)} BD
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* SKU / Barcode */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="space-y-0.5">
                            {product.sku && (
                              <p className="text-xs font-mono text-slate-600">
                                SKU: {product.sku}
                              </p>
                            )}
                            {product.barcode && (
                              <p className="text-xs font-mono text-slate-400">
                                {product.barcode}
                              </p>
                            )}
                            {!product.sku && !product.barcode && (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="px-4 py-3 text-right">
                          <StockBadge product={product} />
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              product.isActive
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {product.isActive ? "منشور" : "مخفي"}
                          </span>
                        </td>

                        {/* Quick Edit */}
                        <td className="px-4 py-3">
                          <StockEditor product={product} storeId={store!.id} />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              عرض {filtered.length} من {products.length} منتج
            </div>
          )}
        </Card>

        {/* Info */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-700">تعديل سريع للمخزون</p>
          <p>اضغط على رقم المخزون في أي منتج لتعديله مباشرة. اضغط Enter للحفظ أو Esc للإلغاء.</p>
          <p>الاستيراد يدعم إنشاء منتجات جديدة وتحديث المنتجات الموجودة (بإضافة العمود id).</p>
        </div>
      </div>
    </div>
  );
}
