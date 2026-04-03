"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Shield, FileText, Ban, CheckCircle2, XCircle,
  Clock, RefreshCw, Plus, Trash2, Eye, Save,
  AlertTriangle, ClipboardList, Settings, ToggleLeft, ToggleRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KycDoc {
  id: string;
  merchantId: string;
  type: string;
  fileUrl: string;
  fileName: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  merchant: { id: string; email: string; firstName: string; lastName: string; kycStatus: string };
}

interface KycStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

interface BlacklistItem {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

interface LegalPage {
  id: string;
  type: string;
  title: string;
  content: string;
  updatedAt: string;
  updatedBy: string | null;
}

interface TermsEntry {
  id: string;
  merchantId: string;
  version: string;
  acceptedAt: string;
  ipAddress: string | null;
  merchant: { email: string; firstName: string; lastName: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABEL: Record<string, string> = {
  NATIONAL_ID: "هوية وطنية",
  COMMERCIAL_REGISTRATION: "سجل تجاري",
  VAT_CERTIFICATE: "شهادة ضريبة القيمة المضافة",
  OTHER: "أخرى",
};

const KYC_STATUS_STYLE: Record<string, { color: string; bg: string; label: string; icon: React.ElementType }> = {
  NONE:     { color: "#64748b", bg: "rgba(100,116,139,.12)", label: "لا يوجد",   icon: Clock },
  PENDING:  { color: "#f59e0b", bg: "rgba(245,158,11,.12)",  label: "قيد المراجعة", icon: Clock },
  APPROVED: { color: "#10b981", bg: "rgba(16,185,129,.12)",  label: "موافق",      icon: CheckCircle2 },
  REJECTED: { color: "#ef4444", bg: "rgba(239,68,68,.12)",   label: "مرفوض",      icon: XCircle },
};

const BLACKLIST_TYPE_COLOR: Record<string, string> = {
  IP: "#3b82f6", EMAIL: "#8b5cf6", DOMAIN: "#f59e0b",
};

const SURFACE = { background: "#0c1526", border: "1px solid #1a2840" };
const PAGE_BG = { background: "#060b18", color: "#e2e8f0" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-BH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Badge({ status, map }: { status: string; map: Record<string, { color: string; bg: string; label: string; icon: React.ElementType }> }) {
  const s = map[status] ?? { color: "#64748b", bg: "rgba(100,116,139,.12)", label: status, icon: Clock };
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ color: s.color, background: s.bg }}>
      <Icon size={11} />
      {s.label}
    </span>
  );
}

// ─── Tab: KYC ─────────────────────────────────────────────────────────────────

function KycTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [reviewModal, setReviewModal] = useState<KycDoc | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data: stats } = useQuery<KycStats>({
    queryKey: ["admin", "kyc", "stats"],
    queryFn: () => api.get("/admin/kyc/stats").then((r) => r.data),
  });

  const { data, isLoading, refetch } = useQuery<{ docs: KycDoc[]; total: number }>({
    queryKey: ["admin", "kyc", { status: statusFilter }],
    queryFn: () => api.get(`/admin/kyc?status=${statusFilter}`).then((r) => r.data),
  });

  const reviewMut = useMutation({
    mutationFn: (vars: { id: string; status: "APPROVED" | "REJECTED"; reviewNote?: string }) =>
      api.patch(`/admin/kyc/${vars.id}/review`, { status: vars.status, reviewNote: vars.reviewNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "kyc"] });
      setReviewModal(null);
      setReviewNote("");
    },
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الوثائق", value: stats?.total ?? 0, color: "#3b82f6" },
          { label: "قيد المراجعة", value: stats?.pending ?? 0, color: "#f59e0b" },
          { label: "مقبولة", value: stats?.approved ?? 0, color: "#10b981" },
          { label: "مرفوضة", value: stats?.rejected ?? 0, color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={SURFACE}>
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + Refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={
              statusFilter === s
                ? { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6" }
                : { background: "#131e30", color: "#64748b", border: "1px solid #1a2840" }
            }
          >
            {KYC_STATUS_STYLE[s]?.label}
          </button>
        ))}
        <button onClick={() => refetch()} className="mr-auto p-1.5 rounded text-slate-500" style={{ background: "#131e30" }}>
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={SURFACE}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #1a2840", color: "#64748b" }}>
              <th className="text-right py-3 px-4">التاجر</th>
              <th className="text-right py-3 px-4">نوع الوثيقة</th>
              <th className="text-right py-3 px-4">حالة KYC</th>
              <th className="text-right py-3 px-4">تاريخ الرفع</th>
              <th className="text-right py-3 px-4">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">جارٍ التحميل...</td></tr>
            )}
            {!isLoading && (data?.docs ?? []).length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">لا توجد وثائق بهذه الحالة</td></tr>
            )}
            {(data?.docs ?? []).map((doc) => (
              <tr key={doc.id} style={{ borderBottom: "1px solid #1a284044" }}>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{doc.merchant.firstName} {doc.merchant.lastName}</p>
                  <p className="text-slate-500 text-xs">{doc.merchant.email}</p>
                </td>
                <td className="py-3 px-4 text-slate-300">{DOC_TYPE_LABEL[doc.type] ?? doc.type}</td>
                <td className="py-3 px-4">
                  <Badge status={doc.merchant.kycStatus} map={KYC_STATUS_STYLE} />
                </td>
                <td className="py-3 px-4 text-slate-400 text-xs">{fmtDate(doc.createdAt)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded text-blue-400"
                      style={{ background: "rgba(59,130,246,.12)" }}
                    >
                      <Eye size={13} />
                    </a>
                    {doc.status === "PENDING" && (
                      <button
                        onClick={() => { setReviewModal(doc); setReviewNote(""); }}
                        className="px-3 py-1 rounded text-xs text-white"
                        style={{ background: "#1e3a5f" }}
                      >
                        مراجعة
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.7)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md mx-4" style={{ background: "#0c1526", border: "1px solid #1a2840" }}>
            <h3 className="text-white font-semibold text-lg mb-1">مراجعة وثيقة KYC</h3>
            <p className="text-slate-400 text-sm mb-4">
              {reviewModal.merchant.firstName} {reviewModal.merchant.lastName} — {DOC_TYPE_LABEL[reviewModal.type] ?? reviewModal.type}
            </p>
            <textarea
              placeholder="ملاحظة المراجعة (اختياري)"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm text-white mb-4 resize-none"
              style={{ background: "#131e30", border: "1px solid #1a2840" }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => reviewMut.mutate({ id: reviewModal.id, status: "APPROVED", reviewNote })}
                disabled={reviewMut.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#059669" }}
              >
                <CheckCircle2 size={14} className="inline ml-1" />
                قبول
              </button>
              <button
                onClick={() => reviewMut.mutate({ id: reviewModal.id, status: "REJECTED", reviewNote })}
                disabled={reviewMut.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#dc2626" }}
              >
                <XCircle size={14} className="inline ml-1" />
                رفض
              </button>
              <button
                onClick={() => setReviewModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400"
                style={{ background: "#131e30" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Blacklist ────────────────────────────────────────────────────────────

function BlacklistTab() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [addForm, setAddForm] = useState({ type: "IP", value: "", reason: "" });

  const { data, isLoading, refetch } = useQuery<{ items: BlacklistItem[]; total: number }>({
    queryKey: ["admin", "blacklist", { type: typeFilter, search }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      return api.get(`/admin/blacklist?${params}`).then((r) => r.data);
    },
  });

  const addMut = useMutation({
    mutationFn: (body: { type: string; value: string; reason?: string }) =>
      api.post("/admin/blacklist", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blacklist"] });
      setAddForm({ type: "IP", value: "", reason: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/blacklist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blacklist"] }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/blacklist/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blacklist"] }),
  });

  return (
    <div className="space-y-4">
      {/* Add Form */}
      <div className="rounded-xl p-4" style={SURFACE}>
        <h3 className="text-white font-medium mb-3 text-sm">إضافة إلى القائمة السوداء</h3>
        <div className="flex gap-2 flex-wrap">
          <select
            value={addForm.type}
            onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          >
            <option value="IP">IP</option>
            <option value="EMAIL">بريد إلكتروني</option>
            <option value="DOMAIN">نطاق (Domain)</option>
          </select>
          <input
            placeholder={addForm.type === "IP" ? "مثال: 192.168.1.1" : addForm.type === "EMAIL" ? "مثال: user@example.com" : "مثال: example.com"}
            value={addForm.value}
            onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <input
            placeholder="السبب (اختياري)"
            value={addForm.reason}
            onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: "#131e30", border: "1px solid #1a2840" }}
          />
          <button
            onClick={() => addMut.mutate({ type: addForm.type, value: addForm.value, reason: addForm.reason || undefined })}
            disabled={!addForm.value || addMut.isPending}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "#dc2626" }}
          >
            <Plus size={14} />
            حظر
          </button>
        </div>
        {addMut.isError && (
          <p className="text-red-400 text-xs mt-2">هذا المدخل موجود بالفعل في القائمة السوداء</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["", "IP", "EMAIL", "DOMAIN"].map((t) => (
          <button
            key={t || "ALL"}
            onClick={() => setTypeFilter(t)}
            className="px-3 py-1.5 text-xs rounded-lg"
            style={
              typeFilter === t
                ? { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6" }
                : { background: "#131e30", color: "#64748b", border: "1px solid #1a2840" }
            }
          >
            {t || "الكل"}
          </button>
        ))}
        <input
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mr-auto px-3 py-1.5 rounded-lg text-xs text-white w-40"
          style={{ background: "#131e30", border: "1px solid #1a2840" }}
        />
        <button onClick={() => refetch()} className="p-1.5 rounded text-slate-500" style={{ background: "#131e30" }}>
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={SURFACE}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #1a2840", color: "#64748b" }}>
              <th className="text-right py-3 px-4">النوع</th>
              <th className="text-right py-3 px-4">القيمة</th>
              <th className="text-right py-3 px-4">السبب</th>
              <th className="text-right py-3 px-4">الحالة</th>
              <th className="text-right py-3 px-4">تاريخ الإضافة</th>
              <th className="text-right py-3 px-4">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">جارٍ التحميل...</td></tr>
            )}
            {!isLoading && (data?.items ?? []).length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">القائمة السوداء فارغة</td></tr>
            )}
            {(data?.items ?? []).map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #1a284044", opacity: item.isActive ? 1 : 0.5 }}>
                <td className="py-3 px-4">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-mono font-medium"
                    style={{ color: BLACKLIST_TYPE_COLOR[item.type] ?? "#64748b", background: `${BLACKLIST_TYPE_COLOR[item.type] ?? "#64748b"}22` }}
                  >
                    {item.type}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-white text-xs">{item.value}</td>
                <td className="py-3 px-4 text-slate-400 text-xs">{item.reason ?? "—"}</td>
                <td className="py-3 px-4">
                  <button onClick={() => toggleMut.mutate(item.id)}>
                    {item.isActive
                      ? <ToggleRight size={20} className="text-emerald-400" />
                      : <ToggleLeft size={20} className="text-slate-500" />
                    }
                  </button>
                </td>
                <td className="py-3 px-4 text-slate-500 text-xs">{fmtDate(item.createdAt)}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => { if (confirm("حذف هذا التقييد؟")) deleteMut.mutate(item.id); }}
                    className="p-1.5 rounded text-red-400"
                    style={{ background: "rgba(239,68,68,.1)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Legal Pages ─────────────────────────────────────────────────────────

function LegalTab() {
  const qc = useQueryClient();
  const [activeDoc, setActiveDoc] = useState<"PRIVACY_POLICY" | "TERMS_OF_SERVICE">("PRIVACY_POLICY");
  const [editing, setEditing] = useState<{ title: string; content: string } | null>(null);

  const { data, isLoading } = useQuery<{ page: LegalPage | null }>({
    queryKey: ["admin", "legal", activeDoc],
    queryFn: () => api.get(`/admin/legal/${activeDoc}`).then((r) => r.data),
  });

  const saveMut = useMutation({
    mutationFn: (body: { title: string; content: string }) =>
      api.put(`/admin/legal/${activeDoc}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "legal", activeDoc] });
      setEditing(null);
    },
  });

  const page = data?.page;
  const form = editing ?? { title: page?.title ?? "", content: page?.content ?? "" };

  return (
    <div className="space-y-4">
      {/* Doc Type Tabs */}
      <div className="flex gap-2">
        {[
          { key: "PRIVACY_POLICY", label: "سياسة الخصوصية" },
          { key: "TERMS_OF_SERVICE", label: "شروط الخدمة" },
        ].map((d) => (
          <button
            key={d.key}
            onClick={() => { setActiveDoc(d.key as any); setEditing(null); }}
            className="px-4 py-2 rounded-lg text-sm"
            style={
              activeDoc === d.key
                ? { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6" }
                : { background: "#131e30", color: "#64748b", border: "1px solid #1a2840" }
            }
          >
            {d.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-slate-500 text-sm py-4">جارٍ التحميل...</p>}

      {!isLoading && (
        <div className="rounded-xl p-5" style={SURFACE}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500">
                {page ? `آخر تحديث: ${fmtDate(page.updatedAt)} ${page.updatedBy ? `بواسطة ${page.updatedBy}` : ""}` : "لم يتم إنشاء هذه الصفحة بعد"}
              </p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing({ title: page?.title ?? (activeDoc === "PRIVACY_POLICY" ? "سياسة الخصوصية" : "شروط الخدمة"), content: page?.content ?? "" })}
                className="px-4 py-2 rounded-lg text-sm text-white"
                style={{ background: "#1e3a5f" }}
              >
                تعديل
              </button>
            )}
          </div>

          <div className="mb-3">
            <label className="text-xs text-slate-400 mb-1 block">العنوان</label>
            <input
              value={form.title}
              onChange={(e) => setEditing({ ...form, title: e.target.value })}
              readOnly={!editing}
              className="w-full px-3 py-2 rounded-lg text-sm text-white"
              style={{ background: editing ? "#131e30" : "#0a1422", border: "1px solid #1a2840" }}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">المحتوى (Markdown / HTML)</label>
            <textarea
              value={form.content}
              onChange={(e) => setEditing({ ...form, content: e.target.value })}
              readOnly={!editing}
              rows={16}
              className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono resize-y"
              style={{ background: editing ? "#131e30" : "#0a1422", border: "1px solid #1a2840" }}
              placeholder="أدخل محتوى الصفحة..."
            />
          </div>

          {editing && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => saveMut.mutate(editing)}
                disabled={saveMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#059669" }}
              >
                <Save size={14} />
                {saveMut.isPending ? "جارٍ الحفظ..." : "حفظ"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400"
                style={{ background: "#131e30" }}
              >
                إلغاء
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Compliance ──────────────────────────────────────────────────────────

function ComplianceTab() {
  const qc = useQueryClient();

  const { data: termsData, isLoading: termsLoading } = useQuery<{ entries: TermsEntry[]; total: number }>({
    queryKey: ["admin", "terms-acceptance"],
    queryFn: () => api.get("/admin/terms-acceptance").then((r) => r.data),
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ["admin", "platform-settings"],
    queryFn: () => api.get("/admin/platform-settings").then((r) => r.data),
  });

  const [vatSettings, setVatSettings] = useState<Record<string, string>>({});
  const [settingsEdited, setSettingsEdited] = useState(false);

  const defaultSettings = settingsData?.settings ?? {};
  const currentSettings = settingsEdited ? vatSettings : defaultSettings;

  const saveMut = useMutation({
    mutationFn: () => api.put("/admin/platform-settings", currentSettings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "platform-settings"] });
      setSettingsEdited(false);
    },
  });

  function updateSetting(key: string, value: string) {
    setVatSettings({ ...currentSettings, [key]: value });
    setSettingsEdited(true);
  }

  const SETTINGS_FIELDS = [
    { key: "vat_enabled", label: "تفعيل ضريبة القيمة المضافة", type: "boolean" },
    { key: "vat_rate", label: "نسبة الضريبة (%)", type: "number", placeholder: "15" },
    { key: "zatca_enabled", label: "تفعيل ZATCA (الفوترة الإلكترونية)", type: "boolean" },
    { key: "zatca_environment", label: "بيئة ZATCA", type: "select", options: ["sandbox", "production"] },
    { key: "platform_cr", label: "رقم السجل التجاري للمنصة", type: "text", placeholder: "1234567890" },
    { key: "platform_vat_number", label: "الرقم الضريبي للمنصة", type: "text", placeholder: "300000000000003" },
    { key: "kyc_required", label: "إلزامية KYC قبل رفع حد المبيعات", type: "boolean" },
    { key: "kyc_sales_limit_bd", label: "حد المبيعات قبل طلب KYC (BD)", type: "number", placeholder: "1000" },
  ];

  return (
    <div className="space-y-6">
      {/* Platform Settings */}
      <div className="rounded-xl p-5" style={SURFACE}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">إعدادات المنصة — ZATCA / VAT</h3>
          {settingsEdited && (
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "#059669" }}
            >
              <Save size={13} />
              {saveMut.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
            </button>
          )}
        </div>

        {settingsLoading && <p className="text-slate-500 text-sm">جارٍ التحميل...</p>}
        {!settingsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SETTINGS_FIELDS.map((f) => {
              const val = currentSettings[f.key] ?? "";
              return (
                <div key={f.key}>
                  <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                  {f.type === "boolean" ? (
                    <button
                      onClick={() => updateSetting(f.key, val === "true" ? "false" : "true")}
                      className="flex items-center gap-2 text-sm"
                    >
                      {val === "true"
                        ? <ToggleRight size={24} className="text-emerald-400" />
                        : <ToggleLeft size={24} className="text-slate-500" />
                      }
                      <span className={val === "true" ? "text-emerald-400" : "text-slate-500"}>
                        {val === "true" ? "مفعّل" : "معطّل"}
                      </span>
                    </button>
                  ) : f.type === "select" ? (
                    <select
                      value={val}
                      onChange={(e) => updateSetting(f.key, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white"
                      style={{ background: "#131e30", border: "1px solid #1a2840" }}
                    >
                      {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : "text"}
                      value={val}
                      onChange={(e) => updateSetting(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white"
                      style={{ background: "#131e30", border: "1px solid #1a2840" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Terms Acceptance Log */}
      <div className="rounded-xl p-5" style={SURFACE}>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList size={17} className="text-slate-400" />
          <h3 className="text-white font-semibold">سجل قبول الشروط</h3>
          {termsData && (
            <span className="text-xs px-2 py-0.5 rounded-full mr-1" style={{ background: "#1e3a5f", color: "#60a5fa" }}>
              {termsData.total} إدخال
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #1a2840", color: "#64748b" }}>
                <th className="text-right py-2 px-3">التاجر</th>
                <th className="text-right py-2 px-3">البريد الإلكتروني</th>
                <th className="text-right py-2 px-3">الإصدار</th>
                <th className="text-right py-2 px-3">تاريخ القبول</th>
                <th className="text-right py-2 px-3">عنوان IP</th>
              </tr>
            </thead>
            <tbody>
              {termsLoading && (
                <tr><td colSpan={5} className="text-center py-6 text-slate-500">جارٍ التحميل...</td></tr>
              )}
              {!termsLoading && (termsData?.entries ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-slate-500">لا توجد سجلات قبول بعد</td></tr>
              )}
              {(termsData?.entries ?? []).map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #1a284044" }}>
                  <td className="py-2 px-3 text-white">{e.merchant.firstName} {e.merchant.lastName}</td>
                  <td className="py-2 px-3 text-slate-400 text-xs">{e.merchant.email}</td>
                  <td className="py-2 px-3">
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "#1e3a5f", color: "#60a5fa" }}>
                      v{e.version}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-xs">{fmtDate(e.acceptedAt)}</td>
                  <td className="py-2 px-3 text-slate-500 font-mono text-xs">{e.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "kyc",        label: "KYC للتجار",       icon: Shield },
  { key: "blacklist",  label: "القوائم السوداء",   icon: Ban },
  { key: "legal",      label: "الصفحات القانونية", icon: FileText },
  { key: "compliance", label: "الامتثال والإعدادات", icon: Settings },
];

export default function GovernancePage() {
  const [tab, setTab] = useState("kyc");

  return (
    <div className="min-h-screen p-6" style={PAGE_BG}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">الحوكمة والامتثال</h1>
        <p className="text-slate-400 text-sm mt-1">KYC، القوائم السوداء، الصفحات القانونية، وإعدادات الامتثال</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
              style={
                tab === t.key
                  ? { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6" }
                  : { background: "#0c1526", color: "#64748b", border: "1px solid #1a2840" }
              }
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === "kyc"        && <KycTab />}
      {tab === "blacklist"  && <BlacklistTab />}
      {tab === "legal"      && <LegalTab />}
      {tab === "compliance" && <ComplianceTab />}
    </div>
  );
}
