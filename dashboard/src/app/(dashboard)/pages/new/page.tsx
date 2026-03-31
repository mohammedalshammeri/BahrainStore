"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Save, Loader2 } from "lucide-react";

const PAGE_TYPES = [
  { value: "ABOUT", label: "من نحن" },
  { value: "CONTACT", label: "تواصل معنا" },
  { value: "PRIVACY", label: "سياسة الخصوصية" },
  { value: "TERMS", label: "الشروط والأحكام" },
  { value: "SHIPPING_POLICY", label: "سياسة الشحن" },
  { value: "RETURNS_POLICY", label: "سياسة الإرجاع" },
  { value: "FAQ", label: "الأسئلة الشائعة" },
  { value: "CUSTOM", label: "صفحة مخصصة" },
];

export default function NewPagePage() {
  const { store } = useAuthStore();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    titleAr: "",
    slug: "",
    content: "",
    contentAr: "",
    excerpt: "",
    pageType: "CUSTOM",
    isActive: true,
    seoTitle: "",
    seoDesc: "",
  });

  function set(field: string, value: string | boolean) {
    setForm((p) => ({
      ...p,
      [field]: value,
    }));
  }

  async function handleSave() {
    if (!store?.id) return;
    if (!form.title.trim() || !form.titleAr.trim()) return setError("العنوان مطلوب بالعربية والإنجليزية");
    if (!form.slug.trim()) return setError("الـ Slug مطلوب");
    setSaving(true);
    setError("");
    try {
      await api.post("/pages", {
        storeId: store.id,
        title: form.title,
        titleAr: form.titleAr,
        slug: form.slug,
        content: form.content || "",
        contentAr: form.contentAr || undefined,
        excerpt: form.excerpt || undefined,
        pageType: form.pageType,
        isActive: form.isActive,
        seoTitle: form.seoTitle || undefined,
        seoDesc: form.seoDesc || undefined,
      });
      router.push("/pages");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl" dir="rtl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded hover:bg-gray-100">
          <ArrowRight className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">صفحة جديدة</h1>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="المحتوى" />
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان بالعربية *</label>
                <Input value={form.titleAr} onChange={(e) => set("titleAr", e.target.value)} placeholder="عنوان الصفحة" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (English) *</label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Page title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الـ Slug *</label>
                <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="about-us" className="font-mono text-sm" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المحتوى (عربي)</label>
                <textarea
                  value={form.contentAr}
                  onChange={(e) => set("contentAr", e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="اكتب محتوى الصفحة بالعربية..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content (English)</label>
                <textarea
                  value={form.content}
                  onChange={(e) => set("content", e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="ltr"
                  placeholder="Page content in English..."
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="الإعدادات" />
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الصفحة</label>
                <select
                  value={form.pageType}
                  onChange={(e) => set("pageType", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PAGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => set("isActive", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">الصفحة مفعّلة</label>
              </div>
              <Button variant="primary" className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ الصفحة
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="SEO" />
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title</label>
                <Input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder="عنوان لمحركات البحث" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SEO Description</label>
                <textarea
                  value={form.seoDesc}
                  onChange={(e) => set("seoDesc", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="وصف لمحركات البحث"
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
