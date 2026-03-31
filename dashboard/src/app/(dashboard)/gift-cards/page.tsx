"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Gift, Plus, Copy, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface GiftCard {
  id: string;
  code: string;
  initialValue: number;
  balance: number;
  isActive: boolean;
  expiresAt: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  createdAt: string;
  _count: { transactions: number };
}

export default function GiftCardsPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ value: 10, quantity: 1, expiresAt: "", recipientEmail: "", recipientName: "", message: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["gift-cards", store?.id],
    queryFn: async () => {
      const res = await api.get(`/gift-cards?storeId=${store?.id}`);
      return res.data as { giftCards: GiftCard[]; total: number };
    },
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/gift-cards", { storeId: store?.id, ...form, value: Number(form.value), quantity: Number(form.quantity) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gift-cards"] }); setShowModal(false); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/gift-cards/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gift-cards"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gift-cards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gift-cards"] }),
  });

  const cards = data?.giftCards ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">كروت الهدية</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{data?.total ?? 0}</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Plus className="h-4 w-4" />
          إنشاء كارت هدية
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد كروت هدية بعد</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b">
              <tr>
                <th className="text-right px-4 py-3">الكود</th>
                <th className="text-right px-4 py-3">القيمة الأصلية</th>
                <th className="text-right px-4 py-3">الرصيد المتبقي</th>
                <th className="text-right px-4 py-3">المستلم</th>
                <th className="text-right px-4 py-3">الانتهاء</th>
                <th className="text-right px-4 py-3">الحالة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cards.map((card) => (
                <tr key={card.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{card.code}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(card.code)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{Number(card.initialValue).toFixed(3)} د.ب</td>
                  <td className="px-4 py-3">
                    <span className={Number(card.balance) === 0 ? "text-red-500" : "text-green-600"}>
                      {Number(card.balance).toFixed(3)} د.ب
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{card.recipientName || card.recipientEmail || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{card.expiresAt ? new Date(card.expiresAt).toLocaleDateString("ar-BH") : "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleMutation.mutate({ id: card.id, isActive: !card.isActive })}>
                      {card.isActive
                        ? <ToggleRight className="h-5 w-5 text-green-500" />
                        : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { if (confirm("حذف هذا الكارت؟")) deleteMutation.mutate(card.id); }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" dir="rtl">
            <h2 className="text-lg font-bold text-gray-900 mb-5">إنشاء كارت هدية جديد</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">القيمة (د.ب) *</label>
                  <input type="number" min="1" value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">الكمية</label>
                  <input type="number" min="1" max="50" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">تاريخ الانتهاء (اختياري)</label>
                <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">اسم المستلم (اختياري)</label>
                <input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" placeholder="مثال: محمد أحمد" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">بريد المستلم (اختياري)</label>
                <input type="email" value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" placeholder="example@email.com" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.value}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
