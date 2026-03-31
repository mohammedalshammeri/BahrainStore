"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Zap, Plus, Trash2, Loader2, X, Package, Clock } from "lucide-react";

interface Product {
  id: string;
  name: string;
  nameAr: string;
  price: number;
}

interface FlashSaleItem {
  id: string;
  productId: string;
  product: Product;
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
  createdAt: string;
}

function saleStatus(sale: FlashSale): { label: string; variant: "success" | "warning" | "default" | "error" } {
  const now = new Date();
  const start = new Date(sale.startsAt);
  const end = new Date(sale.endsAt);
  if (!sale.isActive) return { label: "معطّل", variant: "default" };
  if (now < start) return { label: "قادم", variant: "info" as any };
  if (now > end) return { label: "منتهي", variant: "error" };
  return { label: "جاري الآن", variant: "success" };
}

export default function PromotionsPage() {
  const { store } = useAuthStore();
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    name: "",
    nameAr: "",
    startsAt: "",
    endsAt: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    selectedProducts: [] as string[],
  });

  const fetchSales = useCallback(async () => {
    if (!store?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/flash-sales?storeId=${store.id}`);
      setSales(res.data.sales ?? []);
    } finally {
      setLoading(false);
    }
  }, [store?.id]);

  const fetchProducts = useCallback(async () => {
    if (!store?.id) return;
    const res = await api.get(`/products?storeId=${store.id}&limit=100`);
    setProducts(res.data.products ?? []);
  }, [store?.id]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  async function openForm() {
    await fetchProducts();
    setShowForm(true);
  }

  async function handleCreate() {
    if (!store?.id) return;
    if (!form.nameAr || !form.startsAt || !form.endsAt || !form.discountValue) {
      return setFormError("يرجى ملء جميع الحقول المطلوبة");
    }
    if (form.selectedProducts.length === 0) return setFormError("يرجى اختيار منتج واحد على الأقل");
    setSaving(true);
    setFormError("");
    try {
      await api.post("/flash-sales", {
        storeId: store.id,
        name: form.name || form.nameAr,
        nameAr: form.nameAr,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        isActive: true,
        productIds: form.selectedProducts,
      });
      setShowForm(false);
      setForm({ name: "", nameAr: "", startsAt: "", endsAt: "", discountType: "PERCENTAGE", discountValue: "", selectedProducts: [] });
      fetchSales();
    } catch (err: any) {
      setFormError(err?.response?.data?.error ?? "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(sale: FlashSale) {
    await api.put(`/flash-sales/${sale.id}`, { isActive: !sale.isActive });
    fetchSales();
  }

  async function deleteSale(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا العرض؟")) return;
    setDeleting(id);
    try { await api.delete(`/flash-sales/${id}`); fetchSales(); } finally { setDeleting(null); }
  }

  function toggleProduct(id: string) {
    setForm((p) => ({
      ...p,
      selectedProducts: p.selectedProducts.includes(id)
        ? p.selectedProducts.filter((x) => x !== id)
        : [...p.selectedProducts, id],
    }));
  }

  const active = sales.filter((s) => {
    const now = new Date();
    return s.isActive && new Date(s.startsAt) <= now && new Date(s.endsAt) >= now;
  }).length;

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">العروض والتخفيضات</h1>
            <p className="text-sm text-gray-500">{sales.length} عرض {active > 0 && `· ${active} نشط الآن`}</p>
          </div>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={openForm}>
          <Plus className="h-4 w-4" />
          عرض جديد
        </Button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">عرض محدود جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">{formError}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم العرض (عربي) *</label>
                  <Input value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} placeholder="تخفيض نهاية الموسم" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="End of Season Sale" dir="ltr" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البدء *</label>
                  <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء *</label>
                  <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} dir="ltr" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع الخصم</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PERCENTAGE">نسبة مئوية (%)</option>
                    <option value="FIXED">مبلغ ثابت (BD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    قيمة الخصم * {form.discountType === "PERCENTAGE" ? "(%)" : "(BD)"}
                  </label>
                  <Input
                    type="number"
                    value={form.discountValue}
                    onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                    placeholder={form.discountType === "PERCENTAGE" ? "20" : "5.000"}
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المنتجات * ({form.selectedProducts.length} مختار)
                </label>
                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.selectedProducts.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                      />
                      <span className="flex-1 text-sm">{p.nameAr}</span>
                      <span className="text-xs text-gray-500">{Number(p.price).toFixed(3)} BD</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="primary" className="flex-1" onClick={handleCreate} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  إنشاء العرض
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Zap className="h-12 w-12 mb-3" />
          <p>لا توجد عروض بعد</p>
          <Button variant="primary" className="mt-4" onClick={openForm}>ابدأ أول عرض</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sales.map((sale) => {
            const st = saleStatus(sale);
            const now = new Date();
            const end = new Date(sale.endsAt);
            const start = new Date(sale.startsAt);
            const isLive = sale.isActive && now >= start && now <= end;
            const msLeft = end.getTime() - now.getTime();
            const hoursLeft = Math.floor(msLeft / 3600000);
            const minutesLeft = Math.floor((msLeft % 3600000) / 60000);

            return (
              <Card key={sale.id} className={isLive ? "ring-2 ring-green-400" : ""}>
                <CardBody className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{sale.nameAr}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{sale.name}</p>
                    </div>
                    <Badge variant={st.variant as any}>{st.label}</Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>
                        خصم {sale.discountType === "PERCENTAGE" ? `${sale.discountValue}%` : `${Number(sale.discountValue).toFixed(3)} BD`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                      <span>
                        {new Date(sale.startsAt).toLocaleDateString("ar-BH")} — {new Date(sale.endsAt).toLocaleDateString("ar-BH")}
                      </span>
                    </div>
                    {isLive && msLeft > 0 && (
                      <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>ينتهي بعد {hoursLeft > 0 ? `${hoursLeft} ساعة ` : ""}{minutesLeft} دقيقة</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Package className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>{sale.items.length} منتج</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={sale.isActive ? "outline" : "primary"}
                      className="flex-1 text-xs"
                      onClick={() => toggleActive(sale)}
                    >
                      {sale.isActive ? "تعطيل" : "تفعيل"}
                    </Button>
                    <button
                      onClick={() => deleteSale(sale.id)}
                      disabled={deleting === sale.id}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500 border border-gray-200"
                    >
                      {deleting === sale.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
