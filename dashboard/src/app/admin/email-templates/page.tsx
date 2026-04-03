"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Mail, Pencil, X, Eye, RefreshCw, Save, ChevronRight, ChevronLeft,
  Code2, AlignLeft,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  nameAr: string;
  subject: string;
  subjectAr: string;
  body: string;
  bodyAr: string;
  vars: string[];
  createdAt: string;
  updatedAt: string;
}

interface PreviewData {
  subject: string;
  html: string;
  lang: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TEMPLATE_META: Record<string, { icon: string; desc: string }> = {
  welcome:                    { icon: "👋", desc: "يُرسل عند إنشاء حساب تاجر جديد" },
  subscription_renewal:       { icon: "🔄", desc: "يُرسل عند تجديد الاشتراك بنجاح" },
  subscription_expiry_warning:{ icon: "⏰", desc: "يُرسل قبل انتهاء الاشتراك بأيام قليلة" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<Partial<EmailTemplate>>({});
  const [previewLang, setPreviewLang] = useState<"ar" | "en">("ar");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"ar" | "en">("ar");

  const { data, isLoading } = useQuery<{ templates: EmailTemplate[] }>({
    queryKey: ["admin-email-templates"],
    queryFn: () => api.get("/admin/email-templates").then((r) => r.data),
  });

  const templates = data?.templates ?? [];

  const updateMut = useMutation({
    mutationFn: ({ key, ...d }: Partial<EmailTemplate> & { key: string }) =>
      api.put(`/admin/email-templates/${key}`, d),
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ["admin-email-templates"] });
      // Update local selected state
      setSelected((prev) => prev ? { ...prev, ...form } as EmailTemplate : prev);
    },
  });

  function openTemplate(t: EmailTemplate) {
    setSelected(t);
    setForm({ ...t });
    setShowPreview(false);
    setPreviewData(null);
    setActiveTab("ar");
  }

  async function loadPreview(lang: "ar" | "en") {
    if (!selected) return;
    setLoadingPreview(true);
    setPreviewLang(lang);
    try {
      const res = await api.get(`/admin/email-templates/${selected.key}/preview?lang=${lang}`);
      setPreviewData(res.data);
      setShowPreview(true);
    } finally {
      setLoadingPreview(false);
    }
  }

  function save() {
    if (!selected) return;
    updateMut.mutate({ key: selected.key, ...form } as any);
  }

  return (
    <div dir="rtl" style={{ background: "#060b18", minHeight: "100vh", color: "#dce8f5", fontFamily: "Cairo, sans-serif" }}>
      <style>{`
        .tpl-item:hover { background: rgba(59,130,246,.05) !important; cursor: pointer; }
        .html-preview { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #1a1a1a; }
        .html-preview h1, .html-preview h2, .html-preview h3 { color: #111; margin-bottom: 8px; }
        .html-preview a { color: #2563eb; }
        .html-preview p { margin-bottom: 10px; }
      `}</style>

      <div className="flex h-screen overflow-hidden">
        {/* ── Left: Template List ─────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto"
          style={{ background: "#07101e", borderLeft: "1px solid #1a2840" }}>
          <div className="p-4" style={{ borderBottom: "1px solid #1a2840" }}>
            <h1 className="text-base font-black" style={{ color: "#e2eef8" }}>قوالب الإيميل</h1>
            <p className="text-xs mt-0.5" style={{ color: "#3d5470" }}>تعديل قوالب بريد المنصة</p>
          </div>

          {isLoading ? (
            <div className="py-10 text-center">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto" style={{ color: "#3b82f6" }} />
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {templates.map((t) => {
                const meta = TEMPLATE_META[t.key];
                const isActive = selected?.key === t.key;
                return (
                  <button key={t.id} onClick={() => openTemplate(t)}
                    className="tpl-item w-full text-right p-3 rounded-xl transition"
                    style={{
                      background: isActive ? "rgba(59,130,246,.1)" : "transparent",
                      border: `1px solid ${isActive ? "rgba(59,130,246,.2)" : "transparent"}`,
                    }}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl leading-none">{meta?.icon ?? "📧"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate" style={{ color: isActive ? "#60a5fa" : "#dce8f5" }}>
                          {t.nameAr}
                        </p>
                        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "#3d5470" }}>
                          {meta?.desc ?? t.name}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Editor ──────────────────────────────────────────────── */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Mail className="w-12 h-12 mx-auto opacity-20" style={{ color: "#60a5fa" }} />
              <p className="text-sm" style={{ color: "#2d4560" }}>اختر قالباً من القائمة للتعديل</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor header */}
            <div className="flex items-center justify-between p-4 flex-shrink-0"
              style={{ borderBottom: "1px solid #1a2840", background: "#0a1220" }}>
              <div>
                <p className="font-black text-base" style={{ color: "#e2eef8" }}>
                  {TEMPLATE_META[selected.key]?.icon} {selected.nameAr}
                </p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: "#3d5470" }}>{selected.key}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Preview buttons */}
                <button onClick={() => loadPreview("ar")} disabled={loadingPreview}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.15)", color: "#a78bfa" }}>
                  {loadingPreview && previewLang === "ar" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                  معاينة عربي
                </button>
                <button onClick={() => loadPreview("en")} disabled={loadingPreview}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.15)", color: "#60a5fa" }}>
                  {loadingPreview && previewLang === "en" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                  Preview EN
                </button>
                <button onClick={save} disabled={updateMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black disabled:opacity-40"
                  style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.2)", color: "#34d399" }}>
                  {updateMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  حفظ
                </button>
              </div>
            </div>

            {/* Available vars */}
            {selected.vars.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap flex-shrink-0"
                style={{ borderBottom: "1px solid #1a2840", background: "rgba(59,130,246,.03)" }}>
                <span className="text-[10px] font-black" style={{ color: "#3d5470" }}>المتغيرات المتاحة:</span>
                {selected.vars.map((v) => (
                  <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,.15)" }}>
                    {v}
                  </span>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid #1a2840" }}>
              {(["ar", "en"] as const).map((lang) => (
                <button key={lang} onClick={() => setActiveTab(lang)}
                  className="px-5 py-2.5 text-xs font-bold transition"
                  style={{
                    color: activeTab === lang ? "#60a5fa" : "#3d5470",
                    borderBottom: activeTab === lang ? "2px solid #60a5fa" : "2px solid transparent",
                  }}>
                  {lang === "ar" ? "النسخة العربية" : "English Version"}
                </button>
              ))}
            </div>

            {/* Editor body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {activeTab === "ar" ? (
                <>
                  <Field label="سطر الموضوع (عربي)">
                    <input value={form.subjectAr ?? ""}
                      onChange={(e) => setForm({ ...form, subjectAr: e.target.value })}
                      style={inputStyle} />
                  </Field>
                  <Field label="محتوى الإيميل HTML (عربي)">
                    <textarea value={form.bodyAr ?? ""}
                      onChange={(e) => setForm({ ...form, bodyAr: e.target.value })}
                      rows={16} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Subject Line (English)">
                    <input value={form.subject ?? ""}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      style={{ ...inputStyle, direction: "ltr" }} />
                  </Field>
                  <Field label="Email HTML Body (English)">
                    <textarea value={form.body ?? ""}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                      rows={16} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12, direction: "ltr" }} />
                  </Field>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Preview Modal ─────────────────────────────────────────────────── */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.8)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{ background: "#fff", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {/* Preview header */}
            <div className="flex items-center justify-between px-5 py-3"
              style={{ background: "#1e293b", borderBottom: "1px solid #334155" }}>
              <div>
                <p className="text-xs font-black" style={{ color: "#94a3b8" }}>معاينة الإيميل — {previewData.lang === "ar" ? "عربي" : "English"}</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "#e2e8f0" }}>{previewData.subject}</p>
              </div>
              <button onClick={() => setShowPreview(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.2)" }}>
                <X className="w-4 h-4" style={{ color: "#f87171" }} />
              </button>
            </div>
            {/* Preview content */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
              <div className="html-preview max-w-xl mx-auto bg-white rounded-xl p-8 shadow-sm"
                dangerouslySetInnerHTML={{ __html: previewData.html }} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black mb-1.5" style={{ color: "#4a6480" }}>{label}</p>
      {children}
    </div>
  );
}
