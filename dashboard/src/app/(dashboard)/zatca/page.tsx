"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, Download, Search } from "lucide-react";
import { formatBHD, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export default function ZatcaPage() {
  const { store } = useAuthStore();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["zatca-invoices", store?.id, page],
    queryFn: async () => {
      const res = await api.get(`/zatca/invoices?storeId=${store!.id}&page=${page}&limit=20`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const invoices = data?.invoices || [];
  const total = data?.total || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="فواتير ZATCA"
        subtitle="الفوترة الإلكترونية المتوافقة مع هيئة الزكاة"
      />
      <div className="p-6 max-w-5xl mx-auto space-y-5">

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "إجمالي الفواتير", value: total },
            { label: "فواتير اليوم", value: invoices.filter((i: any) => new Date(i.createdAt).toDateString() === new Date().toDateString()).length },
            { label: "إجمالي ضريبة القيمة المضافة", value: formatBHD(invoices.reduce((s: number, i: any) => s + Number(i.vatAmount || 0), 0)) },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <span className="font-semibold">الفواتير الإلكترونية</span>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">لا توجد فواتير إلكترونية بعد. ستظهر هنا عند إتمام الطلبات.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-right">رقم الفاتورة</th>
                  <th className="p-3 text-right">الإجمالي</th>
                  <th className="p-3 text-right">الضريبة</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">التاريخ</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="p-3 font-medium">{formatBHD(Number(inv.totalAmount))}</td>
                    <td className="p-3 text-gray-500">{formatBHD(Number(inv.vatAmount))}</td>
                    <td className="p-3">
                      <Badge className={
                        inv.status === "REPORTED" ? "bg-green-100 text-green-700" :
                        inv.status === "ERROR" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }>
                        {inv.status === "REPORTED" ? "مُبلَّغ" : inv.status === "ERROR" ? "خطأ" : "معلق"}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-500">{formatDate(inv.createdAt)}</td>
                    <td className="p-3">
                      {inv.qrCode && (
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=40x40&data=${inv.qrCode}`} alt="QR" className="w-8 h-8" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
            <span className="flex items-center text-sm text-gray-600">صفحة {page} من {Math.ceil(total / 20)}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>التالي</Button>
          </div>
        )}

      </div>
    </div>
  );
}
