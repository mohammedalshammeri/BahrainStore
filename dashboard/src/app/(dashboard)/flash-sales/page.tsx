"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  Zap,
  Plus,
  Trash2,
  Clock,
  Tag,
  Package,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Percent,
} from "lucide-react";

interface FlashSaleItem {
  id: string;
  product: {
    id: string;
    name: string;
    nameAr: string;
    price: number;
    images: { url: string }[];
  };
}

interface FlashSale {
  id: string;
  name: string;
  nameAr: string;
  startsAt: string;
  endsAt: string;
  discountType: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  discountValue: number;
  isActive: boolean;
  items: FlashSaleItem[];
}

interface Product {
  id: string;
  name: string;
  nameAr: string;
  price: number;
}

/* ─── Countdown Timer ─── */
function Countdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("انتهى"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const isEnded = remaining === "انتهى";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-bold ${
        isEnded ? "bg-slate-100 text-slate-400" : "bg-red-50 text-red-600"
      }`}
    >
      <Clock className="h-3 w-3" />
      {remaining}
    </span>
  );
}

/* ─── Status Badge ─── */
function SaleStatus({ sale }: { sale: FlashSale }) {
  const now = Date.now();
  const start = new Date(sale.startsAt).getTime();
  const end = new Date(sale.endsAt).getTime();

  if (!sale.isActive)
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        موقوف
      </span>
    );
  if (now < start)
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
        قادم
      </span>
    );
  if (now >= start && now <= end)
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600 animate-pulse">
        🔴 مباشر
      </span>
    );
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400">
      انتهى
    </span>
  );
}

/* ─── Create Modal ─── */
function CreateModal({
  storeId,
  onClose,
}: {
  storeId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    nameAr: "",
    startsAt: "",
    endsAt: "",
    discountType: "PERCENTAGE",
    discountValue: 20,
    isActive: true,
  });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");

  const { data: productsData } = useQuery({
    queryKey: ["products-picker", storeId],
    queryFn: async () => {
      const res = await api.get(`/products`, {
        params: { storeId, limit: 50 },
      });
      return res.data.products as Product[];
    },
  });

  const products: Product[] = productsData ?? [];
  const filtered = products.filter(
    (p) =>
      p.nameAr.includes(productSearch) ||
      p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/flash-sales", {
        storeId,
        ...form,
        discountValue: Number(form.discountValue),
        productIds: selectedProductIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flash-sales", storeId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error ?? "حدث خطأ");
    },
  });

  const toggle = (id: string) =>
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl mx-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">إنشاء عرض جديد</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">الاسم عربي</label>
              <input
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="عرض الجمعة السوداء"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">الاسم إنجليزي</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Black Friday Sale"
                dir="ltr"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">تاريخ البدء</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">تاريخ الانتهاء</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">نوع الخصم</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PERCENTAGE">نسبة مئوية (%)</option>
                <option value="FIXED">مبلغ ثابت (BHD)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                قيمة الخصم {form.discountType === "PERCENTAGE" ? "%" : "BHD"}
              </label>
              <input
                type="number"
                min={1}
                max={form.discountType === "PERCENTAGE" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Products */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              المنتجات المشمولة ({selectedProductIds.length} محدد)
            </label>
            <input
              type="text"
              placeholder="بحث عن منتج..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {filtered.slice(0, 20).map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4 rounded text-indigo-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{p.nameAr}</p>
                    <p className="text-xs text-slate-400" dir="ltr">{p.name}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {Number(p.price).toFixed(3)} BD
                  </span>
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">
                  لا توجد منتجات
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            إلغاء
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !form.name ||
              !form.nameAr ||
              !form.startsAt ||
              !form.endsAt ||
              selectedProductIds.length === 0
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            إنشاء العرض
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function FlashSalesPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["flash-sales", store?.id],
    queryFn: async () => {
      const res = await api.get("/flash-sales", {
        params: { storeId: store!.id },
      });
      return res.data.sales as FlashSale[];
    },
    enabled: !!store?.id,
    refetchInterval: 30000,
  });

  const sales: FlashSale[] = data ?? [];
  const activeSales = sales.filter(
    (s) => s.isActive && new Date(s.endsAt) > new Date() && new Date(s.startsAt) <= new Date()
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/flash-sales/${id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["flash-sales", store?.id] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/flash-sales/${id}`, { isActive }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["flash-sales", store?.id] }),
  });

  return (
    <div className="flex flex-col">
      <Header
        title="التخفيضات السريعة"
        subtitle={`${activeSales.length} عرض نشط حالياً`}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            عرض جديد
          </button>
        }
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <Zap className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{activeSales.length}</p>
              <p className="text-xs text-slate-500">نشط الآن</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {sales.filter((s) => s.isActive && new Date(s.startsAt) > new Date()).length}
              </p>
              <p className="text-xs text-slate-500">قادم</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Tag className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{sales.length}</p>
              <p className="text-xs text-slate-500">إجمالي العروض</p>
            </div>
          </Card>
        </div>

        {/* Sales List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : !sales.length ? (
          <Card className="py-16 text-center">
            <Zap className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-2 font-medium text-slate-500">لا توجد عروض بعد</p>
            <p className="mt-1 text-xs text-slate-400">
              أنشئ أول عرض سريع لجذب العملاء
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              إنشاء عرض
            </button>
          </Card>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <Card key={sale.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800">{sale.nameAr}</h3>
                      <SaleStatus sale={sale} />
                      {new Date(sale.endsAt) > new Date() && sale.isActive && new Date(sale.startsAt) <= new Date() && (
                        <Countdown endsAt={sale.endsAt} />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(sale.startsAt)} — {formatDate(sale.endsAt)}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-indigo-600">
                        <Percent className="h-3.5 w-3.5" />
                        {sale.discountType === "PERCENTAGE"
                          ? `خصم ${sale.discountValue}%`
                          : `خصم ${Number(sale.discountValue).toFixed(3)} BD`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {sale.items.length} منتج
                      </span>
                    </div>

                    {/* Product chips */}
                    {sale.items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sale.items.slice(0, 5).map((item) => (
                          <span
                            key={item.id}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {item.product.nameAr}
                          </span>
                        ))}
                        {sale.items.length > 5 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                            +{sale.items.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      title={sale.isActive ? "إيقاف" : "تفعيل"}
                      onClick={() =>
                        toggleMutation.mutate({ id: sale.id, isActive: !sale.isActive })
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        sale.isActive
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {sale.isActive ? "إيقاف" : "تفعيل"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(sale.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && store && (
        <CreateModal storeId={store.id} onClose={() => setShowCreate(false)} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">تأكيد الحذف</h2>
            <p className="mt-2 text-sm text-slate-500">
              هل تريد حذف هذا العرض؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete)}
                disabled={deleteMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
