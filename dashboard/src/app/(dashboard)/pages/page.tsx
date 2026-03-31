"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, LayoutList, Edit, Trash2, Loader2, CheckCircle2 } from "lucide-react";

const PAGE_TYPE_LABELS: Record<string, string> = {
  ABOUT: "من نحن",
  CONTACT: "تواصل معنا",
  PRIVACY: "سياسة الخصوصية",
  TERMS: "الشروط والأحكام",
  SHIPPING_POLICY: "سياسة الشحن",
  RETURNS_POLICY: "سياسة الإرجاع",
  FAQ: "الأسئلة الشائعة",
  CUSTOM: "مخصصة",
};

interface StorePage {
  id: string;
  title: string;
  titleAr: string;
  slug: string;
  pageType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function PagesManagementPage() {
  const { store } = useAuthStore();
  const [pages, setPages] = useState<StorePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPages = useCallback(async () => {
    if (!store?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/pages?storeId=${store.id}`);
      setPages(res.data.pages ?? []);
    } finally {
      setLoading(false);
    }
  }, [store?.id]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  async function toggleActive(page: StorePage) {
    await api.put(`/pages/${page.id}`, { isActive: !page.isActive });
    fetchPages();
  }

  async function deletePage(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذه الصفحة؟")) return;
    setDeleting(id);
    try {
      await api.delete(`/pages/${id}`);
      fetchPages();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutList className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الصفحات</h1>
            <p className="text-sm text-gray-500">{pages.length} صفحة</p>
          </div>
        </div>
        <Link href="/pages/new">
          <Button variant="primary" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            صفحة جديدة
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="صفحات المتجر" subtitle="أنشئ صفحات المحتوى كـ 'من نحن' وسياسة الخصوصية" />
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <LayoutList className="h-12 w-12 mb-3" />
              <p>لا توجد صفحات بعد</p>
              <Link href="/pages/new">
                <Button variant="primary" className="mt-4">أنشئ أول صفحة</Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 text-right">الصفحة</th>
                  <th className="px-6 py-3 text-center">النوع</th>
                  <th className="px-6 py-3 text-center">الحالة</th>
                  <th className="px-6 py-3 text-center">آخر تحديث</th>
                  <th className="px-6 py-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{page.titleAr}</p>
                        <p className="text-xs text-gray-500">{page.title}</p>
                        <p className="text-xs text-gray-400 font-mono mt-1">/{page.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={page.pageType === "CUSTOM" ? "default" : "info"}>
                        {PAGE_TYPE_LABELS[page.pageType] ?? page.pageType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => toggleActive(page)}>
                        <Badge variant={page.isActive ? "success" : "default"}>
                          {page.isActive ? "مفعّلة" : "مخفية"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500 text-xs">
                      {new Date(page.updatedAt).toLocaleDateString("ar-BH")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/pages/${page.id}/edit`}>
                          <button className="p-1.5 rounded hover:bg-gray-100 text-indigo-500">
                            <Edit className="h-4 w-4" />
                          </button>
                        </Link>
                        <button
                          onClick={() => deletePage(page.id)}
                          disabled={deleting === page.id}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        >
                          {deleting === page.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
