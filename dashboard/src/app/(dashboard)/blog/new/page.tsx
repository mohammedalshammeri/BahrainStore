"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Save, Loader2 } from "lucide-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function NewBlogPostPage() {
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
    coverImage: "",
    isPublished: false,
    seoTitle: "",
    seoDesc: "",
    tags: "",
    authorName: "",
  });

  function set(field: string, value: string | boolean) {
    setForm((p) => ({
      ...p,
      [field]: value,
      ...(field === "title" && !p.slug ? { slug: slugify(value as string) } : {}),
    }));
  }

  async function handleSave(publish: boolean) {
    if (!store?.id) return;
    if (!form.title.trim()) return setError("العنوان مطلوب");
    if (!form.content.trim()) return setError("المحتوى مطلوب");
    setSaving(true);
    setError("");
    try {
      await api.post("/blog", {
        storeId: store.id,
        title: form.title,
        titleAr: form.titleAr || undefined,
        slug: form.slug || undefined,
        content: form.content,
        contentAr: form.contentAr || undefined,
        excerpt: form.excerpt || undefined,
        coverImage: form.coverImage || undefined,
        isPublished: publish,
        seoTitle: form.seoTitle || undefined,
        seoDesc: form.seoDesc || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        authorName: form.authorName || undefined,
      });
      router.push("/blog");
    } catch {
      setError("حدث خطأ أثناء الحفظ");
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
        <h1 className="text-2xl font-bold text-gray-900">مقال جديد</h1>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="المحتوى" />
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان بالعربية *</label>
                <Input value={form.titleAr} onChange={(e) => set("titleAr", e.target.value)} placeholder="عنوان المقال" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (English) *</label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Post title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الـ Slug (رابط المقال)</label>
                <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="slug-url" className="font-mono text-sm" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المحتوى (عربي) *</label>
                <textarea
                  value={form.contentAr}
                  onChange={(e) => set("contentAr", e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="اكتب محتوى المقال بالعربية..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content (English)</label>
                <textarea
                  value={form.content}
                  onChange={(e) => set("content", e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  dir="ltr"
                  placeholder="Write post content in English..."
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="النشر" />
            <CardBody className="space-y-3">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
                نشر الآن
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                حفظ كمسودة
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="إعدادات" />
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">صورة الغلاف</label>
                <Input value={form.coverImage} onChange={(e) => set("coverImage", e.target.value)} placeholder="https://..." dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المقتطف</label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => set("excerpt", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="وصف مختصر..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكاتب</label>
                <Input value={form.authorName} onChange={(e) => set("authorName", e.target.value)} placeholder="اسم الكاتب" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوسوم (مفصولة بفاصلة)</label>
                <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="تقنية, تجارة, ..." />
              </div>
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
                  placeholder="وصف لمحركات البحث (160 حرف)"
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
