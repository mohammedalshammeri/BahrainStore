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
import { FileText, Plus, Download, Send } from "lucide-react";
import { formatBHD, formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "مسودة", color: "bg-gray-100 text-gray-600" },
  SENT: { label: "أُرسلت", color: "bg-blue-100 text-blue-700" },
  PAID: { label: "مدفوعة", color: "bg-green-100 text-green-700" },
  OVERDUE: { label: "متأخرة", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "ملغاة", color: "bg-gray-100 text-gray-500" },
};

export default function B2BInvoicesPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    clientName: "", clientVatNumber: "", clientEmail: "",
    items: [{ description: "", quantity: 1, unitPrice: 0, vatRate: 0.15 }],
    notes: "", dueDate: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["b2b-invoices", store?.id, status],
    queryFn: async () => {
      const params = new URLSearchParams({ storeId: store!.id });
      if (status) params.set("status", status);
      const res = await api.get(`/b2b/invoices?${params}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/b2b/invoices", {
        storeId: store!.id,
        clientName: form.clientName,
        clientVatNumber: form.clientVatNumber,
        clientEmail: form.clientEmail,
        items: form.items,
        notes: form.notes,
        dueDate: form.dueDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b2b-invoices"] });
      setShowForm(false);
      setForm({ clientName: "", clientVatNumber: "", clientEmail: "", items: [{ description: "", quantity: 1, unitPrice: 0, vatRate: 0.15 }], notes: "", dueDate: "" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.patch(`/b2b/invoices/${id}/status`, { status: newStatus });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["b2b-invoices"] }),
  });

  const invoices = data?.invoices || [];

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { description: "", quantity: 1, unitPrice: 0, vatRate: 0.15 }] }));
  const updateItem = (i: number, field: string, value: any) => {
    setForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) }));
  };

  const subtotal = form.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = form.items.reduce((s, i) => s + i.quantity * i.unitPrice * i.vatRate, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="فواتير B2B"
        subtitle="إنشاء وإدارة الفواتير للعملاء التجاريين"
        action={
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            فاتورة جديدة
          </Button>
        }
      />
      <div className="p-6 max-w-5xl mx-auto space-y-5">

        {/* Create Form */}
        {showForm && (
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold">إنشاء فاتورة B2B</h3>
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="اسم الشركة / العميل" value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} />
              <Input placeholder="الرقم الضريبي VAT" dir="ltr" value={form.clientVatNumber} onChange={e => setForm(p => ({ ...p, clientVatNumber: e.target.value }))} />
              <Input placeholder="البريد الإلكتروني" type="email" dir="ltr" value={form.clientEmail} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))} />
            </div>

            <div>
              <div className="text-sm font-medium mb-2">البنود</div>
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                  <Input className="col-span-2" placeholder="الوصف" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
                  <Input type="number" placeholder="الكمية" value={item.quantity} onChange={e => updateItem(i, "quantity", Number(e.target.value))} />
                  <Input type="number" placeholder="السعر" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", Number(e.target.value))} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem}>+ بند</Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="ملاحظات" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between"><span>المجموع الفرعي</span><span>{formatBHD(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>ضريبة القيمة المضافة</span><span>{formatBHD(vat)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>الإجمالي</span><span>{formatBHD(subtotal + vat)}</span></div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={!form.clientName || createMutation.isPending}>إنشاء الفاتورة</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </Card>
        )}

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {["", "DRAFT", "SENT", "PAID", "OVERDUE"].map(s => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "primary" : "outline"}
              onClick={() => setStatus(s)}
            >
              {s ? STATUS_LABELS[s]?.label : "الكل"}
            </Button>
          ))}
        </div>

        {/* Invoices Table */}
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3 text-right">رقم الفاتورة</th>
                <th className="p-3 text-right">العميل</th>
                <th className="p-3 text-right">الإجمالي</th>
                <th className="p-3 text-right">الاستحقاق</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">جارٍ التحميل...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد فواتير</td></tr>
              ) : (
                invoices.map((inv: any) => {
                  const s = STATUS_LABELS[inv.status] || STATUS_LABELS.DRAFT;
                  return (
                    <tr key={inv.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="p-3">
                        <div className="font-medium">{inv.buyerCompany}</div>
                        <div className="text-xs text-gray-400">{inv.buyerEmail}</div>
                      </td>
                      <td className="p-3 font-medium">{formatBHD(Number(inv.total))}</td>
                      <td className="p-3 text-gray-500">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                      <td className="p-3"><Badge className={s.color}>{s.label}</Badge></td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {inv.status === "DRAFT" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: inv.id, newStatus: "SENT" })}>
                              <Send className="w-3 h-3" />
                            </Button>
                          )}
                          {inv.status === "SENT" && (
                            <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateStatusMutation.mutate({ id: inv.id, newStatus: "PAID" })}>
                              تأكيد الدفع
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>

      </div>
    </div>
  );
}
