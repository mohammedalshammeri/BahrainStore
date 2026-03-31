"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Layers3, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface Popup {
  id: string;
  name: string;
  titleAr: string | null;
  title: string | null;
  bodyAr: string | null;
  body: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  trigger: "ON_LOAD" | "ON_EXIT" | "ON_SCROLL" | "AFTER_DELAY";
  delaySeconds: number;
  couponCode: string | null;
  imageUrl: string | null;
  isActive: boolean;
  showOnce: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
  ON_LOAD: "عند التحميل",
  ON_EXIT: "عند المغادرة",
  ON_SCROLL: "عند التمرير",
  AFTER_DELAY: "بعد تأخير",
};

const TRIGGER_COLORS: Record<string, string> = {
  ON_LOAD: "bg-blue-100 text-blue-700",
  ON_EXIT: "bg-red-100 text-red-700",
  ON_SCROLL: "bg-purple-100 text-purple-700",
  AFTER_DELAY: "bg-yellow-100 text-yellow-700",
};

type TriggerType = "ON_LOAD" | "ON_EXIT" | "ON_SCROLL" | "AFTER_DELAY";

const EMPTY_FORM: { name: string; titleAr: string; title: string; bodyAr: string; body: string; buttonText: string; buttonUrl: string; trigger: TriggerType; delaySeconds: number; couponCode: string; imageUrl: string; isActive: boolean; showOnce: boolean } = { name: "", titleAr: "", title: "", bodyAr: "", body: "", buttonText: "", buttonUrl: "", trigger: "ON_LOAD", delaySeconds: 0, couponCode: "", imageUrl: "", isActive: true, showOnce: true };

export default function PopupsPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Popup | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["popups", store?.id],
    queryFn: async () => {
      const res = await api.get(`/popups?storeId=${store?.id}`);
      return res.data as { popups: Popup[]; total: number };
    },
    enabled: !!store?.id,
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (p: Popup) => {
    setEditing(p);
    setForm({ name: p.name, titleAr: p.titleAr ?? "", title: p.title ?? "", bodyAr: p.bodyAr ?? "", body: p.body ?? "", buttonText: p.buttonText ?? "", buttonUrl: p.buttonUrl ?? "", trigger: p.trigger, delaySeconds: p.delaySeconds, couponCode: p.couponCode ?? "", imageUrl: p.imageUrl ?? "", isActive: p.isActive, showOnce: p.showOnce });
    setShowModal(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? api.put(`/popups/${editing.id}`, { storeId: store?.id, ...form })
      : api.post("/popups", { storeId: store?.id, ...form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["popups"] }); setShowModal(false); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/popups/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["popups"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/popups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["popups"] }),
  });

  const popups = data?.popups ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Layers3 className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">النوافذ المنبثقة</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{data?.total ?? 0}</span>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          <Plus className="h-4 w-4" />
          إضافة نافذة
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : popups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد نوافذ منبثقة بعد</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {popups.map((popup) => (
            <div key={popup.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{popup.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_COLORS[popup.trigger]}`}>
                    {TRIGGER_LABELS[popup.trigger]}
                  </span>
                  {popup.couponCode && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">كوبون: {popup.couponCode}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{popup.titleAr || popup.title || "بدون عنوان"}</p>
                {popup.trigger === "AFTER_DELAY" && (
                  <p className="text-xs text-gray-400 mt-0.5">بعد {popup.delaySeconds} ثانية</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {popup.showOnce && <span className="text-xs text-gray-400 hidden sm:inline">مرة واحدة</span>}
                <button onClick={() => toggleMutation.mutate({ id: popup.id, isActive: !popup.isActive })}>
                  {popup.isActive
                    ? <ToggleRight className="h-6 w-6 text-green-500" />
                    : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                </button>
                <button onClick={() => openEdit(popup)} className="text-gray-400 hover:text-indigo-600 transition">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => { if (confirm("حذف هذه النافذة؟")) deleteMutation.mutate(popup.id); }} className="text-gray-400 hover:text-red-600 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" dir="rtl">
            <h2 className="text-lg font-bold text-gray-900 mb-5">{editing ? "تعديل النافذة" : "نافذة منبثقة جديدة"}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">اسم النافذة (داخلي) *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" placeholder="مثال: نافذة الترحيب" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">العنوان بالعربية</label>
                  <input value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">العنوان بالإنجليزية</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">النص بالعربية</label>
                  <textarea rows={3} value={form.bodyAr} onChange={e => setForm(f => ({ ...f, bodyAr: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">النص بالإنجليزية</label>
                  <textarea rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">نص الزر</label>
                  <input value={form.buttonText} onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">رابط الزر</label>
                  <input value={form.buttonUrl} onChange={e => setForm(f => ({ ...f, buttonUrl: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">المشغّل</label>
                  <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value as TriggerType }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="ON_LOAD">عند التحميل</option>
                    <option value="ON_EXIT">عند المغادرة</option>
                    <option value="ON_SCROLL">عند التمرير</option>
                    <option value="AFTER_DELAY">بعد تأخير</option>
                  </select>
                </div>
                {form.trigger === "AFTER_DELAY" && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">التأخير (ثانية)</label>
                    <input type="number" min="0" value={form.delaySeconds} onChange={e => setForm(f => ({ ...f, delaySeconds: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">كوبون مرفق (اختياري)</label>
                <input value={form.couponCode} onChange={e => setForm(f => ({ ...f, couponCode: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" placeholder="WELCOME10" />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.showOnce} onChange={e => setForm(f => ({ ...f, showOnce: e.target.checked }))} className="rounded" />
                  اعرض مرة واحدة فقط
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                  نشط
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
