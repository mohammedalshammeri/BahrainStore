"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search, Plus, Layers, CheckCircle2, XCircle, Star, RefreshCw,
  Pencil, Trash2, X, ShoppingBag, DollarSign, ImageIcon,
} from "lucide-react";

interface ThemeItem {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  description: string | null;
  descriptionAr: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  demoUrl: string | null;
  downloadUrl: string | null;
  authorName: string;
  authorEmail: string | null;
  price: number;
  isPremium: boolean;
  isApproved: boolean;
  isActive: boolean;
  isFeatured: boolean;
  tags: string[];
  installCount: number;
  rating: number;
  ratingCount: number;
  createdAt: string;
  _count: { purchases: number };
}

interface ThemesData {
  themes: ThemeItem[];
  total: number;
  pages: number;
}

interface ThemeStats {
  total: number;
  pending: number;
  featured: number;
  totalRevenue: number;
}

const EMPTY_FORM = {
  name: "", nameAr: "", slug: "", description: "", descriptionAr: "",
  thumbnailUrl: "", previewUrl: "", demoUrl: "", downloadUrl: "",
  authorName: "", authorEmail: "", price: "0", isPremium: false, tags: "",
};

export default function ThemesPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; editing: ThemeItem | null }>({ open: false, editing: null });
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [confirmDelete, setConfirmDelete] = useState<ThemeItem | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const params = new URLSearchParams({ page: String(page), limit: "18" });
  if (search.trim()) params.set("search", search.trim());

  const { data, isLoading } = useQuery<ThemesData>({
    queryKey: ["admin-themes", page, search],
    queryFn: () => api.get(`/admin/themes?${params}`).then((r) => r.data),
    placeholderData: (p) => p,
  });

  const { data: stats } = useQuery<ThemeStats>({
    queryKey: ["admin-themes-stats"],
    queryFn: () => api.get("/admin/themes/stats").then((r) => r.data),
  });

  const action = useMutation({
    mutationFn: ({ url }: { url: string }) => api.post(url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-themes"] });
      qc.invalidateQueries({ queryKey: ["admin-themes-stats"] });
      showToast("تم تنفيذ الإجراء ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const saveTheme = useMutation({
    mutationFn: (body: any) =>
      modal.editing
        ? api.patch(`/admin/themes/${modal.editing.id}`, body)
        : api.post("/admin/themes", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-themes"] });
      qc.invalidateQueries({ queryKey: ["admin-themes-stats"] });
      setModal({ open: false, editing: null });
      setForm({ ...EMPTY_FORM });
      showToast(modal.editing ? "تم تحديث الثيم ✅" : "تم إنشاء الثيم ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const deleteTheme = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/themes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-themes"] });
      qc.invalidateQueries({ queryKey: ["admin-themes-stats"] });
      setConfirmDelete(null);
      showToast("تم حذف الثيم ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setModal({ open: true, editing: null });
  };

  const openEdit = (theme: ThemeItem) => {
    setForm({
      name: theme.name, nameAr: theme.nameAr, slug: theme.slug,
      description: theme.description ?? "", descriptionAr: theme.descriptionAr ?? "",
      thumbnailUrl: theme.thumbnailUrl ?? "", previewUrl: theme.previewUrl ?? "",
      demoUrl: theme.demoUrl ?? "", downloadUrl: theme.downloadUrl ?? "",
      authorName: theme.authorName, authorEmail: theme.authorEmail ?? "",
      price: String(theme.price), isPremium: theme.isPremium,
      tags: theme.tags.join(", "),
    });
    setModal({ open: true, editing: theme });
  };

  const submitForm = () => {
    const body: any = {
      name: form.name, nameAr: form.nameAr, slug: form.slug,
      authorName: form.authorName, isPremium: form.isPremium,
      price: parseFloat(form.price) || 0,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };
    if (form.description) body.description = form.description;
    if (form.descriptionAr) body.descriptionAr = form.descriptionAr;
    if (form.thumbnailUrl) body.thumbnailUrl = form.thumbnailUrl;
    if (form.previewUrl) body.previewUrl = form.previewUrl;
    if (form.demoUrl) body.demoUrl = form.demoUrl;
    if (form.downloadUrl) body.downloadUrl = form.downloadUrl;
    if (form.authorEmail) body.authorEmail = form.authorEmail;
    saveTheme.mutate(body);
  };

  // Client-side filter
  const allThemes = data?.themes ?? [];
  const filtered = allThemes.filter((t) => {
    if (filter === "PENDING")  return !t.isApproved && t.isActive;
    if (filter === "APPROVED") return t.isApproved;
    if (filter === "FEATURED") return t.isFeatured;
    if (filter === "PREMIUM")  return t.isPremium;
    if (filter === "FREE")     return !t.isPremium;
    return true;
  });

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slide-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .toast-anim { animation: fadein .3s ease; }
        .card-anim { animation: slide-up .25s ease; }
        .card-hover:hover { border-color: rgba(139,92,246,.4) !important; transform: translateY(-1px); }
        .card-hover { transition: all .2s ease; }
      `}</style>

      {toast && (
        <div className="toast-anim fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? "#10b981" : "#ef4444", color: "#fff" }}>
          {toast.msg}
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.75)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <h2 className="font-black text-center" style={{ color: "#e2eef8" }}>تأكيد الحذف</h2>
            <p className="text-sm text-center" style={{ color: "#4a6480" }}>
              هل تريد حذف ثيم <span style={{ color: "#f87171" }}>{confirmDelete.nameAr}</span>؟ لا يمكن التراجع.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(255,255,255,.05)", border: "1px solid #1a2840", color: "#8aa8c4" }}>
                إلغاء
              </button>
              <button onClick={() => deleteTheme.mutate(confirmDelete.id)} disabled={deleteTheme.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", color: "#f87171" }}>
                {deleteTheme.isPending ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,.8)" }}
          onClick={() => setModal({ open: false, editing: null })}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 my-8"
            style={{ background: "#0c1526", border: "1px solid #1a2840" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg" style={{ color: "#e2eef8" }}>
                {modal.editing ? "تعديل الثيم" : "إضافة ثيم جديد"}
              </h2>
              <button onClick={() => setModal({ open: false, editing: null })} style={{ color: "#4a6480" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "name",        label: "الاسم (EN)" },
                { key: "nameAr",      label: "الاسم (AR)" },
                { key: "slug",        label: "Slug" },
                { key: "authorName",  label: "اسم المصمم" },
                { key: "authorEmail", label: "بريد المصمم",  col: false },
                { key: "thumbnailUrl", label: "رابط الصورة المصغرة", col: false },
                { key: "previewUrl",  label: "رابط المعاينة",     col: false },
                { key: "demoUrl",     label: "رابط الديمو",       col: false },
                { key: "downloadUrl", label: "رابط التحميل",      col: false },
                { key: "tags",        label: "الوسوم (فاصلة)",    col: false },
              ].map(({ key, label, col }) => (
                <div key={key} className={col === false ? "col-span-2" : ""}>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>{label}</label>
                  <input type="text" value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>الوصف (AR)</label>
                <textarea rows={2} value={form.descriptionAr} onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>السعر (BD)</label>
                <input type="number" min={0} step={0.001} value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }} />
              </div>
              <div className="flex items-end pb-0.5">
                <button onClick={() => setForm((f) => ({ ...f, isPremium: !f.isPremium }))}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                  style={{
                    background: form.isPremium ? "rgba(251,191,36,.1)" : "rgba(255,255,255,.04)",
                    border: `1px solid ${form.isPremium ? "rgba(251,191,36,.3)" : "#1a2840"}`,
                    color: form.isPremium ? "#fbbf24" : "#4a6480",
                  }}>
                  <Star className="w-3.5 h-3.5" />
                  {form.isPremium ? "ثيم مميز" : "ثيم عادي"}
                </button>
              </div>
            </div>

            <button onClick={submitForm} disabled={saveTheme.isPending || !form.name || !form.slug || !form.authorName}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "rgba(139,92,246,.15)", border: "1px solid rgba(139,92,246,.3)", color: "#a78bfa" }}>
              {saveTheme.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {modal.editing ? "حفظ التعديلات" : "إنشاء الثيم"}
            </button>
          </div>
        </div>
      )}

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>سوق الثيمات</h1>
            <p className="text-sm mt-1" style={{ color: "#3d5470" }}>إدارة جميع ثيمات المنصة</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(139,92,246,.12)", border: "1px solid rgba(139,92,246,.3)", color: "#a78bfa" }}>
            <Plus className="w-4 h-4" /> إضافة ثيم
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الثيمات",    value: stats?.total ?? "—",        icon: Layers,       color: "#a78bfa",  bg: "rgba(139,92,246,.1)" },
            { label: "بانتظار الموافقة",   value: stats?.pending ?? "—",      icon: RefreshCw,    color: "#fbbf24",  bg: "rgba(245,158,11,.1)" },
            { label: "ثيمات مميزة",        value: stats?.featured ?? "—",     icon: Star,         color: "#fbbf24",  bg: "rgba(251,191,36,.1)" },
            { label: "إجمالي الإيرادات",   value: stats ? `${stats.totalRevenue.toFixed(2)} BD` : "—", icon: DollarSign, color: "#34d399", bg: "rgba(16,185,129,.1)" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl p-4 space-y-1" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "#4a6480" }}>{label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
              </div>
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#2d4560" }} />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ابحث عن ثيم..."
              className="w-full pr-9 pl-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#c8ddf0" }} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: "ALL",      label: "الكل",               color: "#a78bfa" },
              { key: "PENDING",  label: "بانتظار الموافقة",   color: "#fbbf24" },
              { key: "APPROVED", label: "معتمدة",             color: "#34d399" },
              { key: "FEATURED", label: "مميزة",              color: "#fbbf24" },
              { key: "PREMIUM",  label: "مدفوعة",             color: "#60a5fa" },
              { key: "FREE",     label: "مجانية",             color: "#94a3b8" },
            ].map(({ key, label, color }) => (
              <button key={key} onClick={() => setFilter(key)}
                className="px-3 py-2.5 rounded-xl text-xs font-bold transition"
                style={{
                  background: filter === key ? `${color}18` : "rgba(255,255,255,.03)",
                  border: `1px solid ${filter === key ? `${color}40` : "rgba(255,255,255,.06)"}`,
                  color: filter === key ? color : "#3d5470",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Themes Grid */}
        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto" style={{ color: "#a78bfa" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: "#a78bfa" }} />
            <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد ثيمات</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((theme) => (
              <div key={theme.id} className="card-anim card-hover rounded-2xl overflow-hidden"
                style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                {/* Thumbnail */}
                <div className="w-full h-36 relative overflow-hidden"
                  style={{ background: "rgba(139,92,246,.06)", borderBottom: "1px solid #0f1a2d" }}>
                  {theme.thumbnailUrl ? (
                    <img src={theme.thumbnailUrl} alt={theme.nameAr}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 opacity-20" style={{ color: "#a78bfa" }} />
                    </div>
                  )}
                  {/* Badges overlay */}
                  <div className="absolute top-2 right-2 flex gap-1.5 flex-wrap">
                    {theme.isFeatured && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: "rgba(251,191,36,.9)", color: "#000" }}>
                        <Star className="w-2.5 h-2.5" /> مميز
                      </span>
                    )}
                    {theme.isPremium && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(96,165,250,.9)", color: "#000" }}>
                        Premium
                      </span>
                    )}
                  </div>
                  {/* Preview link */}
                  {theme.demoUrl && (
                    <a href={theme.demoUrl} target="_blank" rel="noreferrer"
                      className="absolute bottom-2 left-2 text-[9px] font-bold px-2 py-1 rounded-full"
                      style={{ background: "rgba(0,0,0,.7)", color: "#c8ddf0" }}>
                      معاينة
                    </a>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  {/* Name + Author */}
                  <div>
                    <p className="font-black text-sm" style={{ color: "#e2eef8" }}>{theme.nameAr}</p>
                    <p className="text-[10px]" style={{ color: "#2d4560" }}>{theme.authorName}</p>
                  </div>

                  {/* Price + rating + installs */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-black" style={{ color: theme.price > 0 ? "#fbbf24" : "#34d399" }}>
                      {theme.price > 0 ? `${Number(theme.price).toFixed(3)} BD` : "مجاني"}
                    </span>
                    {theme.ratingCount > 0 && (
                      <span className="flex items-center gap-1" style={{ color: "#fbbf24" }}>
                        <Star className="w-3 h-3 fill-current" />
                        <span>{Number(theme.rating).toFixed(1)}</span>
                        <span style={{ color: "#2d4560" }}>({theme.ratingCount})</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1" style={{ color: "#3d5470" }}>
                      <ShoppingBag className="w-3 h-3" />
                      {theme._count.purchases} مبيعة
                    </span>
                  </div>

                  {/* Status badges */}
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{
                        background: theme.isApproved ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
                        color: theme.isApproved ? "#34d399" : "#fbbf24",
                      }}>
                      {theme.isApproved ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                      {theme.isApproved ? "معتمد" : "قيد المراجعة"}
                    </span>
                    {!theme.isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(239,68,68,.1)", color: "#f87171" }}>
                        معطل
                      </span>
                    )}
                    {theme.tags.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,.04)", color: "#3d5470" }}>
                        {theme.tags[0]}{theme.tags.length > 1 ? ` +${theme.tags.length - 1}` : ""}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: "#0f1a2d" }}>
                    {!theme.isApproved && theme.isActive && (
                      <button onClick={() => action.mutate({ url: `/admin/themes/${theme.id}/approve` })}
                        disabled={action.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                        style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.2)", color: "#34d399" }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> موافقة
                      </button>
                    )}
                    {theme.isApproved && (
                      <button onClick={() => action.mutate({ url: `/admin/themes/${theme.id}/reject` })}
                        disabled={action.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                        style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171" }}>
                        <XCircle className="w-3.5 h-3.5" /> رفض
                      </button>
                    )}
                    <button onClick={() => action.mutate({ url: `/admin/themes/${theme.id}/toggle-featured` })}
                      disabled={action.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                      style={{
                        background: theme.isFeatured ? "rgba(251,191,36,.12)" : "rgba(255,255,255,.04)",
                        border: `1px solid ${theme.isFeatured ? "rgba(251,191,36,.3)" : "rgba(255,255,255,.08)"}`,
                        color: theme.isFeatured ? "#fbbf24" : "#4a6480",
                      }}>
                      <Star className={`w-3.5 h-3.5 ${theme.isFeatured ? "fill-current" : ""}`} />
                      {theme.isFeatured ? "إلغاء التمييز" : "تمييز"}
                    </button>
                    <div className="mr-auto flex gap-1.5">
                      <button onClick={() => openEdit(theme)}
                        className="p-1.5 rounded-xl" style={{ background: "rgba(255,255,255,.04)", color: "#4a6480" }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(theme)}
                        className="p-1.5 rounded-xl" style={{ background: "rgba(239,68,68,.06)", color: "#f87171" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "#2d4560" }}>
              صفحة {page} من {data?.pages} — {data?.total} ثيم
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30"
                style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#a78bfa" }}>
                السابق
              </button>
              <button onClick={() => setPage((p) => Math.min(data?.pages ?? 1, p + 1))} disabled={page === (data?.pages ?? 1)}
                className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30"
                style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#a78bfa" }}>
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
