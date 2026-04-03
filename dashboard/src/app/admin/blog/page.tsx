"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  BookOpen, Plus, X, Pencil, Trash2, Globe, EyeOff,
  RefreshCw, Search, Tag, Eye, ChevronDown,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  title: string;
  titleAr: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string;
  isPublished: boolean;
  publishedAt: string | null;
  authorName: string | null;
  tags: string[];
  views: number;
  createdAt: string;
  updatedAt: string;
}

interface PostFull extends BlogPost {
  content: string;
  contentAr: string | null;
  excerptAr: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  news:   { label: "أخبار",       color: "#60a5fa", bg: "rgba(59,130,246,.12)"  },
  update: { label: "تحديثات",     color: "#34d399", bg: "rgba(16,185,129,.12)"  },
  guide:  { label: "دليل",        color: "#fbbf24", bg: "rgba(245,158,11,.12)"  },
};

const CAT_OPTS = ["news", "update", "guide"];

const EMPTY_POST: Partial<PostFull> = {
  title: "", titleAr: "", slug: "",
  content: "", contentAr: "",
  excerpt: "", excerptAr: "",
  coverImage: "", category: "news",
  isPublished: false, authorName: "فريق المنصة", tags: [],
};

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "").slice(0, 80);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlatformBlogPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [pubFilter, setPubFilter] = useState("ALL");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<PostFull>>(EMPTY_POST);
  const [editId, setEditId] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");

  const { data, isLoading } = useQuery<{ posts: BlogPost[] }>({
    queryKey: ["admin-platform-blog", catFilter, pubFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (catFilter !== "ALL") p.set("category", catFilter);
      if (pubFilter === "published") p.set("published", "true");
      if (pubFilter === "draft") p.set("published", "false");
      return api.get(`/admin/platform-blog?${p}`).then((r) => r.data);
    },
  });

  const posts = (data?.posts ?? []).filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.titleAr.includes(search)
  );

  const createMut = useMutation({
    mutationFn: (d: Partial<PostFull>) => api.post("/admin/platform-blog", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-platform-blog"] }); close(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<PostFull> & { id: string }) =>
      api.put(`/admin/platform-blog/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-platform-blog"] }); close(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/platform-blog/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-platform-blog"] }),
  });
  const publishMut = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/platform-blog/${id}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-platform-blog"] }),
  });

  async function openEdit(post: BlogPost) {
    const full = await api.get(`/admin/platform-blog/${post.id}`).then((r) => r.data.post);
    setForm({ ...full, tags: full.tags ?? [] });
    setTagsInput((full.tags ?? []).join(", "));
    setEditId(post.id);
    setModal("edit");
  }
  function openCreate() {
    setForm({ ...EMPTY_POST, tags: [] });
    setTagsInput("");
    setEditId(null);
    setModal("create");
  }
  function close() { setModal(null); }

  function submit() {
    const tags = tagsInput ? tagsInput.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const payload = { ...form, tags };
    if (modal === "create") createMut.mutate(payload);
    else if (modal === "edit" && editId) updateMut.mutate({ ...payload, id: editId } as any);
  }

  const isBusy = createMut.isPending || updateMut.isPending;
  const totalViews = posts.reduce((s, p) => s + p.views, 0);

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>مدونة المنصة</h1>
            <p className="text-sm mt-0.5" style={{ color: "#3d5470" }}>أخبار المنصة وتحديثاتها ومقالاتها</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.2)", color: "#60a5fa" }}>
            <Plus className="w-4 h-4" />
            مقال جديد
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي المقالات", value: data?.posts.length ?? 0, color: "#60a5fa" },
            { label: "منشورة",          value: data?.posts.filter(p => p.isPublished).length ?? 0, color: "#34d399" },
            { label: "مسودة",           value: data?.posts.filter(p => !p.isPublished).length ?? 0, color: "#fbbf24" },
            { label: "إجمالي القراءات", value: totalViews, color: "#a78bfa" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-4 text-center"
              style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              <p className="text-xl font-black" style={{ color }}>{value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#3d5470" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-44 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#3d5470" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في المقالات..."
              className="w-full pr-9 pl-3 py-2.5 rounded-xl text-sm"
              style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#dce8f5", outline: "none" }} />
          </div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#8aa8c4" }}>
            <option value="ALL">كل الفئات</option>
            {CAT_OPTS.map(c => <option key={c} value={c}>{CATEGORY_MAP[c]?.label ?? c}</option>)}
          </select>
          <select value={pubFilter} onChange={(e) => setPubFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#8aa8c4" }}>
            <option value="ALL">الجميع</option>
            <option value="published">منشور</option>
            <option value="draft">مسودة</option>
          </select>
        </div>

        {/* Posts grid */}
        {isLoading ? (
          <div className="py-10 text-center">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center rounded-2xl" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
            <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد مقالات</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((post) => {
              const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.news;
              return (
                <div key={post.id} className="rounded-2xl overflow-hidden"
                  style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                  {/* Cover */}
                  {post.coverImage ? (
                    <img src={post.coverImage} alt={post.titleAr}
                      className="w-full h-40 object-cover"
                      style={{ borderBottom: "1px solid #1a2840" }} />
                  ) : (
                    <div className="w-full h-28 flex items-center justify-center"
                      style={{ background: "#070e1c", borderBottom: "1px solid #1a2840" }}>
                      <BookOpen className="w-8 h-8 opacity-20" style={{ color: "#60a5fa" }} />
                    </div>
                  )}

                  <div className="p-4 space-y-2">
                    {/* Title + badges */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-sm leading-snug" style={{ color: "#dce8f5" }}>
                        {post.titleAr}
                      </p>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: post.isPublished ? "rgba(16,185,129,.1)" : "rgba(100,116,139,.1)",
                            color: post.isPublished ? "#34d399" : "#94a3b8",
                          }}>
                          {post.isPublished ? "منشور" : "مسودة"}
                        </span>
                      </div>
                    </div>

                    {/* Excerpt */}
                    {post.excerpt && (
                      <p className="text-xs line-clamp-2" style={{ color: "#4a6480" }}>{post.excerpt}</p>
                    )}

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-lg"
                            style={{ background: "rgba(59,130,246,.06)", color: "#3b82f6", border: "1px solid rgba(59,130,246,.1)" }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: "#3d5470" }}>
                          <Eye className="w-3 h-3" />{post.views}
                        </span>
                        <span className="text-[10px]" style={{ color: "#3d5470" }}>
                          {formatDate(post.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => publishMut.mutate(post.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{
                            background: post.isPublished ? "rgba(100,116,139,.1)" : "rgba(16,185,129,.1)",
                            border: `1px solid ${post.isPublished ? "rgba(100,116,139,.2)" : "rgba(16,185,129,.2)"}`,
                          }}>
                          {post.isPublished
                            ? <EyeOff className="w-3 h-3" style={{ color: "#94a3b8" }} />
                            : <Globe className="w-3 h-3" style={{ color: "#34d399" }} />}
                        </button>
                        <button onClick={() => openEdit(post)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.15)" }}>
                          <Pencil className="w-3 h-3" style={{ color: "#60a5fa" }} />
                        </button>
                        <button onClick={() => confirm("حذف هذا المقال؟") && deleteMut.mutate(post.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.12)" }}>
                          <Trash2 className="w-3 h-3" style={{ color: "#f87171" }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Modal ─── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.75)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-y-auto max-h-[90vh]"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <div className="flex items-center justify-between p-5"
              style={{ borderBottom: "1px solid #1a2840" }}>
              <h2 className="text-lg font-black" style={{ color: "#e2eef8" }}>
                {modal === "create" ? "مقال جديد" : "تعديل المقال"}
              </h2>
              <button onClick={close}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.12)" }}>
                <X className="w-4 h-4" style={{ color: "#f87171" }} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="العنوان (عربي)" required>
                  <input value={form.titleAr ?? ""} onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                    placeholder="عنوان المقال بالعربي" style={inputStyle} />
                </Field>
                <Field label="العنوان (إنجليزي)" required>
                  <input value={form.title ?? ""} onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, title: v, slug: slugify(v) }));
                  }} placeholder="Article title in English" style={inputStyle} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Slug" required>
                  <input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="article-slug" style={{ ...inputStyle, direction: "ltr" }} />
                </Field>
                <Field label="الفئة">
                  <select value={form.category ?? "news"} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={inputStyle}>
                    {CAT_OPTS.map(c => <option key={c} value={c}>{CATEGORY_MAP[c]?.label ?? c}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="مقتطف (عربي)">
                  <textarea value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                    rows={2} placeholder="مقتطف قصير..." style={{ ...inputStyle, resize: "none" }} />
                </Field>
                <Field label="مقتطف (إنجليزي)">
                  <textarea value={form.excerptAr ?? ""} onChange={(e) => setForm({ ...form, excerptAr: e.target.value })}
                    rows={2} placeholder="Short excerpt..." style={{ ...inputStyle, resize: "none" }} />
                </Field>
              </div>

              <Field label="المحتوى (عربي)" required>
                <textarea value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={6} placeholder="محتوى المقال الكامل..." style={{ ...inputStyle, resize: "vertical" }} />
              </Field>

              <Field label="المحتوى (إنجليزي)">
                <textarea value={form.contentAr ?? ""} onChange={(e) => setForm({ ...form, contentAr: e.target.value })}
                  rows={4} placeholder="Full article content in English..." style={{ ...inputStyle, resize: "vertical", direction: "ltr" }} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="رابط صورة الغلاف">
                  <input value={form.coverImage ?? ""} onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                    placeholder="https://..." style={{ ...inputStyle, direction: "ltr" }} />
                </Field>
                <Field label="اسم الكاتب">
                  <input value={form.authorName ?? ""} onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                    placeholder="فريق المنصة" style={inputStyle} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="الوسوم (tags) — مفصولة بفاصلة">
                  <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="تحديث, ميزة, تقني" style={inputStyle} />
                </Field>
                <Field label="الخيارات">
                  <div className="flex items-center gap-3 mt-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#8aa8c4" }}>
                      <input type="checkbox" checked={form.isPublished ?? false}
                        onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="accent-green-400" />
                      نشر الآن
                    </label>
                  </div>
                </Field>
              </div>
            </div>

            <div className="flex gap-3 p-5" style={{ borderTop: "1px solid #1a2840" }}>
              <button onClick={submit} disabled={isBusy || !form.titleAr || !form.title || !form.slug || !form.content}
                className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-40"
                style={{ background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.25)", color: "#60a5fa" }}>
                {isBusy ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : modal === "create" ? "نشر المقال" : "حفظ التعديلات"}
              </button>
              <button onClick={close} className="px-6 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "#0f1a2d", border: "1px solid #1a2840", color: "#4a6480" }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 10,
  background: "#0a1220", border: "1px solid #1a2840",
  color: "#dce8f5", fontSize: 13, outline: "none",
};

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black mb-1.5" style={{ color: "#4a6480" }}>
        {label}{required && <span style={{ color: "#f87171" }}> *</span>}
      </p>
      {children}
    </div>
  );
}
