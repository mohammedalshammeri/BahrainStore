"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, ShoppingCart, CreditCard, DollarSign, Package, X, Plus, Search, Barcode } from "lucide-react";
import { formatBHD } from "@/lib/utils";

type CartItem = { id: string; name: string; price: number; qty: number; image?: string };

export default function PosPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openingCash, setOpeningCash] = useState("0");

  const { data: products } = useQuery({
    queryKey: ["pos-products", store?.id, search],
    queryFn: async () => {
      const res = await api.get(`/pos/products?storeId=${store!.id}&search=${search}`);
      return (res.data as any).products || [];
    },
    enabled: !!store?.id,
  });

  const openSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/pos/sessions/open", {
        storeId: store!.id,
        openingCash: parseFloat(openingCash),
      });
      return res.data as any;
    },
    onSuccess: (data) => {
      setSessionId(data.session?.id);
      setSessionOpen(true);
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/pos/sessions/${sessionId}/close`, { closingCash: 0 });
    },
    onSuccess: () => {
      setSessionOpen(false);
      setSessionId(null);
      setCart([]);
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/pos/orders", {
        storeId: store!.id,
        sessionId,
        items: cart.map(i => ({ productId: i.id, quantity: i.qty, unitPrice: i.price })),
        paymentMethod,
        cashReceived: paymentMethod === "CASH" ? parseFloat(cashReceived) : undefined,
      });
      return res.data as any;
    },
    onSuccess: (data) => {
      alert(`✅ تم البيع! التغيير: ${formatBHD(data.order?.change || 0)}`);
      setCart([]);
      setCashReceived("");
    },
  });

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price: Number(product.price), qty: 1, image: product.images?.[0] }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const vat = subtotal * 0.1;
  const total = subtotal + vat;
  const change = paymentMethod === "CASH" ? parseFloat(cashReceived || "0") - total : 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-gray-800 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-orange-400" />
          <span className="font-bold">نقطة البيع — {store?.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {!sessionOpen ? (
            <div className="flex items-center gap-2">
              <Input
                className="w-32 h-8 text-sm bg-gray-700 border-gray-600 text-white"
                placeholder="النقد الافتتاحي"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
              />
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openSessionMutation.mutate()}>
                فتح الجلسة
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600">الجلسة مفتوحة</Badge>
              <Button size="sm" variant="danger" onClick={() => closeSessionMutation.mutate()}>
                إغلاق الجلسة
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Products */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
              placeholder="بحث بالاسم أو الباركود..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(products || []).map((p: any) => (
              <button
                key={p.id}
                onClick={() => sessionOpen && addToCart(p)}
                disabled={!sessionOpen}
                className="bg-white rounded-xl p-3 text-right hover:shadow-md transition-shadow border disabled:opacity-50"
              >
                {p.images?.[0] && (
                  <img src={p.images[0]} alt={p.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                )}
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-orange-600 font-bold">{formatBHD(Number(p.price))}</div>
                <div className="text-xs text-gray-400">المخزون: {p.stock}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="w-80 bg-white border-r flex flex-col">
          <div className="p-4 border-b flex items-center gap-2 font-semibold">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            السلة ({cart.length})
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">أضف منتجات للبدء</div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-orange-600">{formatBHD(item.price)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="w-6 h-6 bg-gray-200 rounded text-sm" onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
                    <span className="text-sm w-6 text-center">{item.qty}</span>
                    <button className="w-6 h-6 bg-gray-200 rounded text-sm" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                  </div>
                  <button className="text-red-400" onClick={() => removeFromCart(item.id)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          <div className="border-t p-4 space-y-2">
            <div className="flex justify-between text-sm"><span>المجموع الفرعي</span><span>{formatBHD(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>ضريبة القيمة المضافة (10%)</span><span>{formatBHD(vat)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2"><span>الإجمالي</span><span className="text-orange-600">{formatBHD(total)}</span></div>

            <div className="space-y-2 mt-3">
              <div className="grid grid-cols-2 gap-2">
                {["CASH", "CARD", "MADA"].map(m => (
                  <button
                    key={m}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${paymentMethod === m ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600"}`}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m === "CASH" ? "نقدي" : m === "CARD" ? "بطاقة" : "مدى"}
                  </button>
                ))}
              </div>

              {paymentMethod === "CASH" && (
                <Input
                  placeholder="المبلغ المستلم"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  type="number"
                  className="text-sm"
                />
              )}

              {paymentMethod === "CASH" && parseFloat(cashReceived) > 0 && (
                <div className={`text-center font-bold ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
                  التغيير: {formatBHD(Math.abs(change))} {change < 0 ? "(ناقص)" : ""}
                </div>
              )}

              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={cart.length === 0 || !sessionOpen || checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate()}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                إتمام البيع
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
