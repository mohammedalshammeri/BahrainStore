"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatBHD } from "@/lib/utils";
import { Plus, Trash2, Save, Search, User, ArrowRight } from "lucide-react";
import Link from "next/link";

interface DraftItem {
  productId: string;
  variantId?: string;
  name: string;
  nameAr: string;
  price: number;
  quantity: number;
}

export default function DraftOrderPage() {
  const router = useRouter();
  const { store } = useAuthStore();
  const queryClient = useQueryClient();

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");

  const { data: productsData } = useQuery({
    queryKey: ["products-search", store?.id, productSearch],
    queryFn: async () => {
      const res = await api.get("/products", {
        params: { storeId: store!.id, search: productSearch, limit: 10 },
      });
      return res.data.products;
    },
    enabled: !!store?.id && productSearch.length >= 2,
  });

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      api.post("/orders/draft", {
        storeId: store!.id,
        customerPhone: customerPhone || undefined,
        customerFirstName: customerFirstName || undefined,
        customerLastName: customerLastName || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        notes: notes || undefined,
        shippingCost,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push(`/orders?highlight=${res.data.order.id}`);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error ?? "حدث خطأ");
    },
  });

  function addProduct(product: any) {
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      setItems(items.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems([...items, {
        productId: product.id,
        name: product.name,
        nameAr: product.nameAr,
        price: Number(product.price),
        quantity: 1,
      }]);
    }
    setProductSearch("");
  }

  function removeItem(productId: string) {
    setItems(items.filter((i) => i.productId !== productId));
  }

  function updateQty(productId: string, qty: number) {
    if (qty < 1) return;
    setItems(items.map((i) => i.productId === productId ? { ...i, quantity: qty } : i));
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal + shippingCost;

  return (
    <div className="flex flex-col">
      <Header title="طلب مسودة جديد" subtitle="إنشاء طلب يدوياً للعميل" />

      <div className="p-6">
        <div className="mb-4">
          <Link href="/orders" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowRight className="h-4 w-4" />
            العودة للطلبات
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Left: Items */}
          <div className="xl:col-span-2 space-y-6">
            {/* Product Search */}
            <Card>
              <CardHeader title="إضافة منتجات" />
              <CardBody className="space-y-3">
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ابحث عن منتج..."
                    className="w-full rounded-lg border border-slate-300 bg-white pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {productsData && productsData.length > 0 && productSearch.length >= 2 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {productsData.map((product: any) => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 border-b last:border-b-0 text-right transition"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{product.nameAr || product.name}</p>
                          <p className="text-xs text-slate-500">{formatBHD(product.price)}</p>
                        </div>
                        <Plus className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Items Table */}
                {items.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">المنتج</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600 w-24">السعر</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600 w-24">الكمية</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600 w-24">الإجمالي</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.productId} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium">{item.nameAr || item.name}</td>
                            <td className="px-3 py-2 text-slate-600">{formatBHD(item.price)}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateQty(item.productId, parseInt(e.target.value) || 1)}
                                className="w-16 rounded border border-slate-300 px-2 py-1 text-sm text-center"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium">{formatBHD(item.price * item.quantity)}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => removeItem(item.productId)} className="text-slate-400 hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader title="ملاحظات" />
              <CardBody>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="ملاحظات إضافية للطلب..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </CardBody>
            </Card>
          </div>

          {/* Right: Customer + Summary */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader title="معلومات العميل" />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="الاسم"
                    value={customerFirstName}
                    onChange={(e) => setCustomerFirstName(e.target.value)}
                    placeholder="الاسم الأول"
                  />
                  <Input
                    label="الكنية"
                    value={customerLastName}
                    onChange={(e) => setCustomerLastName(e.target.value)}
                    placeholder="الكنية"
                  />
                </div>
                <Input
                  label="رقم الهاتف"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+973 XXXX XXXX"
                />
              </CardBody>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader title="ملخص الطلب" />
              <CardBody className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">المجموع الفرعي</span>
                  <span className="font-medium">{formatBHD(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">الشحن</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-left"
                  />
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between font-bold">
                  <span>الإجمالي</span>
                  <span className="text-indigo-600">{formatBHD(total)}</span>
                </div>

                <Button
                  className="w-full mt-2"
                  onClick={() => saveDraftMutation.mutate()}
                  loading={saveDraftMutation.isPending}
                  disabled={items.length === 0}
                >
                  <Save className="h-4 w-4" />
                  حفظ الطلب المسودة
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
