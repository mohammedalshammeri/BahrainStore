"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search, Plus, Package, CheckCircle2, XCircle, ShieldOff, ShieldCheck,
  RefreshCw, Pencil, Trash2, X, Puzzle, Star, Zap, Globe,
} from "lucide-react";

interface AppItem {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string | null;
  category: string;
  developer: string;
  developerEmail: string | null;
  webhookUrl: string | null;
  isOfficial: boolean;
  isApproved: boolean;
  pricingType: string;
  monthlyPrice: number | null;
  isActive: boolean;
  createdAt: string;
  _count: { installs: number };
}

interface AppsData {
  apps: AppItem[];
  total: number;
  pages: number;
}

interface AppStats {
  total: number;
  pending: number;
  official: number;
  totalInstalls: number;
}

const CATEGORY_AR: Record<string, string> = {
  MARKETING: "تسويق", SHIPPING: "شحن", ACCOUNTING: "محاسبة",
  CRM: "CRM", ERP: "ERP", ANALYTICS: "تحليلات",
  PAYMENTS: "مدفوعات", SOCIAL: "اجتماعي", OTHER: "أخرى",
};

const PRICING_AR: Record<string, { label: string; color: string }> = {
  FREE:     { label: "مجاني",    color: "#34d399" },
  PAID:     { label: "مدفوع",    color: "#fbbf24" },
  FREEMIUM: { label: "فريميوم",  color: "#a78bfa" },
};

const EMPTY_FORM = {
  name: "", nameAr: "", slug: "", description: "", descriptionAr: "",
  icon: "", category: "MARKETING", developer: "", developerEmail: "",
  webhookUrl: "", pricingType: "FREE", monthlyPrice: "",
  isOfficial: false,
};

export default function AppsPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; editing: AppItem | null }>({ open: false, editing: null });
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [confirmDelete, setConfirmDelete] = useState<AppItem | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const params = new URLSearchParams({ page: String(page), limit: "18" });
  if (search.trim()) params.set("search", search.trim());

  const { data, isLoading } = useQuery<AppsData>({
    queryKey: ["admin-apps", page, search],
    queryFn: () => api.get(`/admin/apps?${params}`).then((r) => r.data),
    placeholderData: (p) => p,
  });

  const { data: stats } = useQuery<AppStats>({
    queryKey: ["admin-apps-stats"],
    queryFn: () => api.get("/admin/apps/stats").then((r) => r.data),
  });

  const action = useMutation({
    mutationFn: ({ url, method = "post", body }: { url: string; method?: string; body?: any }) =>
      (api as any)[method](url, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-apps"] });
      qc.invalidateQueries({ queryKey: ["admin-apps-stats"] });
      showToast("تم تنفيذ الإجراء ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const saveApp = useMutation({
    mutationFn: (body: any) =>
      modal.editing
        ? api.patch(`/admin/apps/${modal.editing.id}`, body)
        : api.post("/admin/apps", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-apps"] });
      qc.invalidateQueries({ queryKey: ["admin-apps-stats"] });
      setModal({ open: false, editing: null });
      setForm({ ...EMPTY_FORM });
      showToast(modal.editing ? "تم تحديث التطبيق ✅" : "تم إنشاء التطبيق ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const deleteApp = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/apps/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-apps"] });
      qc.invalidateQueries({ queryKey: ["admin-apps-stats"] });
      setConfirmDelete(null);
      showToast("تم حذف التطبيق ✅");
    },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setModal({ open: true, editing: null });
  };

  const openEdit = (app: AppItem) => {
    setForm({
      name: app.name, nameAr: app.nameAr, slug: app.slug,
      description: app.description, descriptionAr: app.descriptionAr,
      icon: app.icon ?? "", category: app.category,
      developer: app.developer, developerEmail: app.developerEmail ?? "",
      webhookUrl: app.webhookUrl ?? "", pricingType: app.pricingType,
      monthlyPrice: app.monthlyPrice != null ? String(app.monthlyPrice) : "",
      isOfficial: app.isOfficial,
    });
    setModal({ open: true, editing: app });
  };

  const submitForm = () => {
    const body: any = {
      name: form.name, nameAr: form.nameAr, slug: form.slug,
      description: form.description, descriptionAr: form.descriptionAr,
      category: form.category, developer: form.developer,
      pricingType: form.pricingType, isOfficial: form.isOfficial,
    };
    if (form.icon) body.icon = form.icon;
    if (form.developerEmail) body.developerEmail = form.developerEmail;
    if (form.webhookUrl) body.webhookUrl = form.webhookUrl;
    if (form.monthlyPrice) body.monthlyPrice = parseFloat(form.monthlyPrice);
    saveApp.mutate(body);
  };

  // Client-side filter
  const allApps = data?.apps ?? [];
  const filtered = allApps.filter((a) => {
    if (filter === "PENDING")  return !a.isApproved && a.isActive;
    if (filter === "APPROVED") return a.isApproved && a.isActive;
    if (filter === "OFFICIAL") return a.isOfficial;
    if (filter === "DISABLED") return !a.isActive;
    return true;
  });

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slide-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .toast-anim { animation: fadein .3s ease; }
        .card-anim { animation: slide-up .25s ease; }
        .card-hover:hover { border-color: rgba(59,130,246,.35) !important; transform: translateY(-1px); }
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
              هل تريد حذف تطبيق <span style={{ color: "#f87171" }}>{confirmDelete.nameAr}</span>؟ لا يمكن التراجع.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(255,255,255,.05)", border: "1px solid #1a2840", color: "#8aa8c4" }}>
                إلغاء
              </button>
              <button onClick={() => deleteApp.mutate(confirmDelete.id)} disabled={deleteApp.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", color: "#f87171" }}>
                {deleteApp.isPending ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "حذف"}
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
                {modal.editing ? "تعديل التطبيق" : "إضافة تطبيق جديد"}
              </h2>
              <button onClick={() => setModal({ open: false, editing: null })} style={{ color: "#4a6480" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "name",     label: "الاسم (EN)" },
                { key: "nameAr",   label: "الاسم (AR)" },
                { key: "slug",     label: "Slug" },
                { key: "developer", label: "المطور" },
                { key: "developerEmail", label: "بريد المطور", col: false },
                { key: "webhookUrl", label: "Webhook URL", col: false },
                { key: "icon",     label: "رابط الأيقونة", col: false },
              ].map(({ key, label, col }) => (
                <div key={key} className={col === false ? "col-span-2" : ""}>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>{label}</label>
                  <input
                    type="text"
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>الوصف (AR)</label>
                <textarea rows={2} value={form.descriptionAr} onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }} />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>الوصف (EN)</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>الفئة</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }}>
                  {Object.keys(CATEGORY_AR).map((k) => <option key={k} value={k}>{CATEGORY_AR[k]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>نوع التسعير</label>
                <select value={form.pricingType} onChange={(e) => setForm((f) => ({ ...f, pricingType: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }}>
                  <option value="FREE">مجاني</option>
                  <option value="PAID">مدفوع</option>
                  <option value="FREEMIUM">فريميوم</option>
                </select>
              </div>
              {form.pricingType !== "FREE" && (
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: "#4a6480" }}>السعر الشهري (BD)</label>
                  <input type="number" min={0} step={0.001} value={form.monthlyPrice}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: "#060b18", border: "1px solid #1a2840", color: "#c8ddf0" }} />
                </div>
              )}
              <div className="flex items-center gap-3 col-span-2">
                <button onClick={() => setForm((f) => ({ ...f, isOfficial: !f.isOfficial }))}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                  style={{
                    background: form.isOfficial ? "rgba(251,191,36,.1)" : "rgba(255,255,255,.04)",
                    border: `1px solid ${form.isOfficial ? "rgba(251,191,36,.3)" : "#1a2840"}`,
                    color: form.isOfficial ? "#fbbf24" : "#4a6480",
                  }}>
                  <Star className="w-3.5 h-3.5" />
                  تطبيق رسمي
                </button>
              </div>
            </div>

            <button onClick={submitForm} disabled={saveApp.isPending || !form.name || !form.slug}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.3)", color: "#60a5fa" }}>
              {saveApp.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {modal.editing ? "حفظ التعديلات" : "إنشاء التطبيق"}
            </button>
          </div>
        </div>
      )}

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e2eef8" }}>سوق التطبيقات</h1>
            <p className="text-sm mt-1" style={{ color: "#3d5470" }}>إدارة جميع تطبيقات المنصة</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.3)", color: "#60a5fa" }}>
            <Plus className="w-4 h-4" /> إضافة تطبيق
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي التطبيقات", value: stats?.total ?? "—",    icon: Package,      color: "#60a5fa",  bg: "rgba(59,130,246,.1)" },
            { label: "بانتظار الموافقة",  value: stats?.pending ?? "—",  icon: RefreshCw,    color: "#fbbf24",  bg: "rgba(245,158,11,.1)" },
            { label: "تطبيقات رسمية",    value: stats?.official ?? "—", icon: Star,         color: "#fbbf24",  bg: "rgba(251,191,36,.1)" },
            { label: "إجمالي التثبيتات", value: stats?.totalInstalls ?? "—", icon: Zap,     color: "#34d399",  bg: "rgba(16,185,129,.1)" },
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
              placeholder="ابحث عن تطبيق..."
              className="w-full pr-9 pl-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#c8ddf0" }} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: "ALL",      label: "الكل",               color: "#60a5fa" },
              { key: "PENDING",  label: "بانتظار الموافقة",   color: "#fbbf24" },
              { key: "APPROVED", label: "معتمدة",             color: "#34d399" },
              { key: "OFFICIAL", label: "رسمية",              color: "#fbbf24" },
              { key: "DISABLED", label: "معطلة",              color: "#f87171" },
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

        {/* Apps Grid */}
        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: "#60a5fa" }} />
            <p className="text-sm" style={{ color: "#2d4560" }}>لا توجد تطبيقات</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((app) => {
              const pricing = PRICING_AR[app.pricingType] ?? PRICING_AR.FREE;
              return (
                <div key={app.id} className="card-anim card-hover rounded-2xl p-5 space-y-3"
                  style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.15)" }}>
                      {app.icon
                        ? <img src={app.icon} alt="" className="w-full h-full object-cover rounded-xl" />
                        : <Puzzle className="w-5 h-5" style={{ color: "#60a5fa" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-sm truncate" style={{ color: "#e2eef8" }}>{app.nameAr}</p>
                        {app.isOfficial && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                            style={{ background: "rgba(251,191,36,.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,.2)" }}>
                            <Star className="w-2.5 h-2.5" /> رسمي
                          </span>
                        )}
                      </div>
                      <p className="text-[10px]" style={{ color: "#2d4560" }}>{app.developer}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs line-clamp-2" style={{ color: "#4a6480" }}>{app.descriptionAr || app.description}</p>

                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,.15)" }}>
                      {CATEGORY_AR[app.category] ?? app.category}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${pricing.color}12`, color: pricing.color }}>
                      {pricing.label}{app.monthlyPrice ? ` · ${Number(app.monthlyPrice).toFixed(3)} BD` : ""}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{
                        background: app.isApproved ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
                        color: app.isApproved ? "#34d399" : "#fbbf24",
                      }}>
                      {app.isApproved ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                      {app.isApproved ? "معتمد" : "قيد المراجعة"}
                    </span>
                    {!app.isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(239,68,68,.1)", color: "#f87171" }}>
                        معطل
                      </span>
                    )}
                  </div>

                  {/* Installs */}
                  <div className="flex items-center gap-1 text-xs" style={{ color: "#3d5470" }}>
                    <Zap className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
                    <span style={{ color: "#34d399", fontWeight: 700 }}>{app._count.installs}</span> تثبيت
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: "#0f1a2d" }}>
                    {!app.isApproved && app.isActive && (
                      <button onClick={() => action.mutate({ url: `/admin/apps/${app.id}/approve` })}
                        disabled={action.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                        style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.2)", color: "#34d399" }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> موافقة
                      </button>
                    )}
                    {app.isApproved && (
                      <button onClick={() => action.mutate({ url: `/admin/apps/${app.id}/reject` })}
                        disabled={action.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                        style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171" }}>
                        <XCircle className="w-3.5 h-3.5" /> رفض
                      </button>
                    )}
                    {app.isActive ? (
                      <button onClick={() => action.mutate({ url: `/admin/apps/${app.id}/disable-all` })}
                        disabled={action.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                        style={{ background: "rgba(100,116,139,.08)", border: "1px solid rgba(100,116,139,.2)", color: "#94a3b8" }}>
                        <ShieldOff className="w-3.5 h-3.5" /> إيقاف للكل
                      </button>
                    ) : (
                      <button onClick={() => action.mutate({ url: `/admin/apps/${app.id}/enable` })}
                        disabled={action.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                        style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)", color: "#34d399" }}>
                        <ShieldCheck className="w-3.5 h-3.5" /> تفعيل
                      </button>
                    )}
                    <div className="mr-auto flex gap-1.5">
                      <button onClick={() => openEdit(app)}
                        className="p-1.5 rounded-xl" style={{ background: "rgba(255,255,255,.04)", color: "#4a6480" }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(app)}
                        className="p-1.5 rounded-xl" style={{ background: "rgba(239,68,68,.06)", color: "#f87171" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "#2d4560" }}>
              صفحة {page} من {data?.pages} — {data?.total} تطبيق
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30"
                style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#60a5fa" }}>
                السابق
              </button>
              <button onClick={() => setPage((p) => Math.min(data?.pages ?? 1, p + 1))} disabled={page === (data?.pages ?? 1)}
                className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30"
                style={{ background: "#0c1526", border: "1px solid #1a2840", color: "#60a5fa" }}>
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
