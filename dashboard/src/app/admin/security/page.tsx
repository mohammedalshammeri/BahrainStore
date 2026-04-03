"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Shield, ShieldAlert, ShieldCheck, Key, Users, Activity,
  Plus, Trash2, AlertTriangle, CheckCircle2, Lock,
  X, Ban, RefreshCw, Eye, ChevronLeft, ChevronRight,
  Settings, UserCheck, Globe, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityOverview {
  admins: { total: number; with2FA: number; without2FA: number };
  logins: { failedLast24h: number; successLast24h: number };
  ipWhitelistCount: number;
  bannedIpsCount: number;
  settings: SecuritySettings;
}

interface SecuritySettings {
  require2FAForAdmins: boolean;
  ipWhitelistEnabled: boolean;
  maxLoginAttempts: number;
  banDurationMinutes: number;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireUpper: boolean;
  passwordRequireNumber: boolean;
  passwordExpiryDays: number;
}

interface IpEntry {
  id: string;
  ip: string;
  label: string | null;
  addedBy: string | null;
  createdAt: string;
}

interface LoginAttempt {
  id: string;
  ip: string;
  email: string | null;
  success: boolean;
  userAgent: string | null;
  createdAt: string;
}

interface BannedIp {
  ip: string;
  failCount: number;
  lastAttempt: string;
}

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  twoFactorEnabled: boolean;
  lastLoginIp: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ background: `${color}22`, borderRadius: 8, padding: 8 }}>
          <Icon size={18} color={color} />
        </div>
        <span style={{ color: "#64748b", fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9" }}>
        {typeof value === "number" ? value.toLocaleString("ar") : value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Tab 1: Overview ──────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading } = useQuery<SecurityOverview>({
    queryKey: ["admin-security-overview"],
    queryFn: () => api.get("/admin/security/overview").then((r) => r.data),
  });

  if (isLoading) return <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>جاري التحميل...</div>;
  if (!data) return null;

  const twoFaPct = data.admins.total > 0
    ? Math.round((data.admins.with2FA / data.admins.total) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard label="تغطية 2FA للأدمن" value={`${twoFaPct}%`} sub={`${data.admins.with2FA} من ${data.admins.total}`} icon={ShieldCheck} color="#34d399" />
        <StatCard label="تسجيل دخول ناجح (24h)" value={data.logins.successLast24h} icon={CheckCircle2} color="#60a5fa" />
        <StatCard label="محاولات فاشلة (24h)" value={data.logins.failedLast24h} icon={AlertTriangle} color="#f87171" />
        <StatCard label="IPs محظورة" value={data.bannedIpsCount} sub={`بعد ${data.settings.maxLoginAttempts} محاولات`} icon={Ban} color="#fbbf24" />
        <StatCard label="IP Whitelist" value={data.ipWhitelistCount} sub={data.settings.ipWhitelistEnabled ? "مفعّل" : "معطّل"} icon={Globe} color="#a78bfa" />
        <StatCard label="مهلة الجلسة" value={`${data.settings.sessionTimeoutMinutes}د`} sub="تلقائي بعد خمول" icon={Clock} color="#f97316" />
      </div>

      {/* 2FA Bar */}
      <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={16} color="#34d399" /> حالة 2FA للأدمن
        </div>
        <div style={{ background: "#111827", borderRadius: 8, height: 12, overflow: "hidden" }}>
          <div style={{ width: `${twoFaPct}%`, background: "linear-gradient(90deg, #34d399, #059669)", height: "100%", borderRadius: 8, transition: "width 0.4s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "#34d399" }}>✅ {data.admins.with2FA} مع 2FA</span>
          <span style={{ fontSize: 12, color: "#f87171" }}>⚠ {data.admins.without2FA} بدون 2FA</span>
        </div>
        {!data.settings.require2FAForAdmins && data.admins.without2FA > 0 && (
          <div style={{ marginTop: 10, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 8, padding: "8px 12px", color: "#fbbf24", fontSize: 13 }}>
            ⚠ يُنصح بتفعيل "إجبار 2FA للأدمن" من تبويب الإعدادات
          </div>
        )}
      </div>

      {/* Current Settings Summary */}
      <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Settings size={16} color="#60a5fa" /> ملخص الإعدادات الحالية
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "إجبار 2FA للأدمن", val: data.settings.require2FAForAdmins },
            { label: "IP Whitelist مفعّل", val: data.settings.ipWhitelistEnabled },
            { label: "تعقيد كلمة المرور (أحرف كبيرة)", val: data.settings.passwordRequireUpper },
            { label: "تعقيد كلمة المرور (أرقام)", val: data.settings.passwordRequireNumber },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#111827", borderRadius: 8 }}>
              <span style={{ fontSize: 14 }}>{item.val ? "✅" : "❌"}</span>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>{item.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#111827", borderRadius: 8 }}>
            <Lock size={14} color="#60a5fa" />
            <span style={{ color: "#94a3b8", fontSize: 13 }}>حد كلمة المرور: {data.settings.passwordMinLength} أحرف</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#111827", borderRadius: 8 }}>
            <Ban size={14} color="#f87171" />
            <span style={{ color: "#94a3b8", fontSize: 13 }}>حظر بعد: {data.settings.maxLoginAttempts} محاولة</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: IP Whitelist ──────────────────────────────────────────────────────

function IpWhitelistTab() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [newIp, setNewIp] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isLoading } = useQuery<{ entries: IpEntry[] }>({
    queryKey: ["admin-ip-whitelist"],
    queryFn: () => api.get("/admin/security/ip-whitelist").then((r) => r.data),
  });

  const addMut = useMutation({
    mutationFn: () => api.post("/admin/security/ip-whitelist", { ip: newIp, label: newLabel || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-ip-whitelist"] }); qc.invalidateQueries({ queryKey: ["admin-security-overview"] }); setNewIp(""); setNewLabel(""); showToast("تم إضافة IP"); },
    onError: (e: any) => showToast(e.response?.data?.error ?? "حدث خطأ", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/security/ip-whitelist/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-ip-whitelist"] }); qc.invalidateQueries({ queryKey: ["admin-security-overview"] }); showToast("تم الحذف"); },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const entries = data?.entries ?? [];

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "success" ? "#065f46" : "#7f1d1d", color: "#fff", padding: "10px 24px", borderRadius: 10, zIndex: 9999, fontWeight: 600, fontSize: 14 }}>
          {toast.msg}
        </div>
      )}

      {/* Warning */}
      <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#fbbf24", fontSize: 13, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>تأكد من إضافة IP حسابك قبل تفعيل IP Whitelist من الإعدادات — وإلا ستُغلق على نفسك!</span>
      </div>

      {/* Add form */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          value={newIp}
          onChange={(e) => setNewIp(e.target.value)}
          placeholder="عنوان IP (مثال: 192.168.1.1)"
          style={{ flex: 1, background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontFamily: "monospace" }}
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="ملاحظة (اختياري)"
          style={{ width: 200, background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9", borderRadius: 7, padding: "8px 12px", fontSize: 13 }}
        />
        <button
          onClick={() => addMut.mutate()}
          disabled={!newIp || addMut.isPending}
          style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", opacity: !newIp ? 0.5 : 1 }}
        >
          <Plus size={14} /> إضافة
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>جاري التحميل...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1a2840" }}>
                {["عنوان IP", "الملاحظة", "تاريخ الإضافة", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#64748b", fontSize: 13, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, color: "#475569" }}>لا توجد IPs مضافة — القائمة البيضاء فارغة</td></tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: "1px solid #111827" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <code style={{ background: "#1e3a5f", color: "#93c5fd", padding: "3px 8px", borderRadius: 6, fontSize: 13 }}>{entry.ip}</code>
                  </td>
                  <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 13 }}>{entry.label ?? "—"}</td>
                  <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12 }}>{fmtDate(entry.createdAt)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => deleteMut.mutate(entry.id)}
                      disabled={deleteMut.isPending}
                      style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Login Attempts ────────────────────────────────────────────────────

function LoginAttemptsTab() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [page, setPage] = useState(1);
  const [failedOnly, setFailedOnly] = useState(false);
  const [ipFilter, setIpFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"log" | "banned">("banned");

  const showToast = (msg: string, type: "success" | "error" = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const { data: attemptsData, isLoading: attemptsLoading } = useQuery<{ attempts: LoginAttempt[]; total: number }>({
    queryKey: ["admin-login-attempts", page, failedOnly, ipFilter],
    queryFn: () => api.get(`/admin/security/login-attempts?page=${page}&limit=50${failedOnly ? "&failedOnly=true" : ""}${ipFilter ? `&ip=${ipFilter}` : ""}`).then((r) => r.data),
  });

  const { data: bannedData, isLoading: bannedLoading, refetch: refetchBanned } = useQuery<{ bannedIps: BannedIp[] }>({
    queryKey: ["admin-banned-ips"],
    queryFn: () => api.get("/admin/security/banned-ips").then((r) => r.data),
  });

  const unbanMut = useMutation({
    mutationFn: (ip: string) => api.delete(`/admin/security/banned-ips/${encodeURIComponent(ip)}`),
    onSuccess: () => { refetchBanned(); qc.invalidateQueries({ queryKey: ["admin-security-overview"] }); showToast("تم رفع الحظر"); },
    onError: () => showToast("حدث خطأ", "error"),
  });

  const totalPages = Math.ceil((attemptsData?.total ?? 0) / 50);

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "success" ? "#065f46" : "#7f1d1d", color: "#fff", padding: "10px 24px", borderRadius: 10, zIndex: 9999, fontWeight: 600, fontSize: 14 }}>
          {toast.msg}
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#111827", borderRadius: 8, padding: 3, width: "fit-content" }}>
        {[{ id: "banned" as const, label: "IPs المحظورة" }, { id: "log" as const, label: "سجل المحاولات" }].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "6px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: "Cairo, sans-serif", background: activeTab === t.id ? "#2563eb" : "transparent", color: activeTab === t.id ? "#fff" : "#64748b" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "banned" && (
        bannedLoading ? <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>جاري التحميل...</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid #1a2840" }}>
                {["عنوان IP", "عدد الإخفاقات", "آخر محاولة", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#64748b", fontSize: 13, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(bannedData?.bannedIps ?? []).length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, color: "#475569" }}>لا توجد IPs محظورة حالياً ✅</td></tr>
                )}
                {(bannedData?.bannedIps ?? []).map((b) => (
                  <tr key={b.ip} style={{ borderBottom: "1px solid #111827" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <code style={{ background: "rgba(239,68,68,.1)", color: "#f87171", padding: "3px 8px", borderRadius: 6, fontSize: 13 }}>{b.ip}</code>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#fbbf24", fontWeight: 700 }}>{b.failCount}</td>
                    <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12 }}>{fmtDate(b.lastAttempt)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <button
                        onClick={() => unbanMut.mutate(b.ip)}
                        disabled={unbanMut.isPending}
                        style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", color: "#34d399", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <RefreshCw size={12} /> رفع الحظر
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === "log" && (
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              value={ipFilter}
              onChange={(e) => { setIpFilter(e.target.value); setPage(1); }}
              placeholder="فلتر بـ IP..."
              style={{ background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9", borderRadius: 7, padding: "7px 12px", fontSize: 13, fontFamily: "monospace", width: 220 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={failedOnly} onChange={(e) => { setFailedOnly(e.target.checked); setPage(1); }} style={{ accentColor: "#ef4444", width: 14, height: 14 }} />
              الفاشلة فقط
            </label>
          </div>

          {attemptsLoading ? <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>جاري التحميل...</div> : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: "1px solid #1a2840" }}>
                    {["IP", "البريد", "الحالة", "المتصفح", "الوقت"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#64748b", fontSize: 13, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(attemptsData?.attempts ?? []).map((a) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #111827" }}>
                        <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>{a.ip}</td>
                        <td style={{ padding: "9px 14px", fontSize: 12, color: "#64748b" }}>{a.email ?? "—"}</td>
                        <td style={{ padding: "9px 14px" }}>
                          <span style={{ background: a.success ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)", color: a.success ? "#34d399" : "#f87171", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                            {a.success ? "✅ ناجح" : "❌ فاشل"}
                          </span>
                        </td>
                        <td style={{ padding: "9px 14px", fontSize: 11, color: "#374151", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.userAgent ?? "—"}</td>
                        <td style={{ padding: "9px 14px", fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(a.createdAt)}</td>
                      </tr>
                    ))}
                    {(attemptsData?.attempts ?? []).length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "#475569" }}>لا توجد سجلات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "#1a2840", border: "none", color: "#94a3b8", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}><ChevronRight size={14} /></button>
                  <span style={{ color: "#64748b", fontSize: 13, alignSelf: "center" }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: "#1a2840", border: "none", color: "#94a3b8", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}><ChevronLeft size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Admin 2FA Status ──────────────────────────────────────────────────

function Admin2FATab() {
  const { data, isLoading } = useQuery<{ admins: AdminUser[] }>({
    queryKey: ["admin-2fa-status"],
    queryFn: () => api.get("/admin/security/admin-2fa").then((r) => r.data),
  });

  if (isLoading) return <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>جاري التحميل...</div>;
  const admins = data?.admins ?? [];
  const withOut = admins.filter((a) => !a.twoFactorEnabled);

  return (
    <div>
      {withOut.length > 0 && (
        <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#f87171", fontSize: 13, display: "flex", gap: 8 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{withOut.length} أدمن بدون 2FA: {withOut.map((a) => `${a.firstName} ${a.lastName}`).join("، ")}</span>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid #1a2840" }}>
            {["الأدمن", "2FA", "آخر IP", "آخر دخول", "تاريخ الإنشاء"].map((h) => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#64748b", fontSize: 13, fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #111827" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 600, color: "#f1f5f9" }}>{a.firstName} {a.lastName}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{a.email}</div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ background: a.twoFactorEnabled ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)", color: a.twoFactorEnabled ? "#34d399" : "#f87171", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    {a.twoFactorEnabled ? "✅ مفعّل" : "❌ غير مفعّل"}
                  </span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {a.lastLoginIp ? <code style={{ background: "#111827", color: "#94a3b8", padding: "2px 7px", borderRadius: 5, fontSize: 12 }}>{a.lastLoginIp}</code> : <span style={{ color: "#374151", fontSize: 12 }}>—</span>}
                </td>
                <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12 }}>{fmtDate(a.lastLoginAt)}</td>
                <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12 }}>{fmtDate(a.createdAt)}</td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "#475569" }}>لا يوجد أدمن</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 5: Security Settings ─────────────────────────────────────────────────

function SecuritySettingsTab() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const { data, isLoading } = useQuery<{ settings: SecuritySettings | null }>({
    queryKey: ["admin-security-settings"],
    queryFn: () => api.get("/admin/security/settings").then((r) => r.data),
  });

  const defaults: SecuritySettings = {
    require2FAForAdmins: false, ipWhitelistEnabled: false,
    maxLoginAttempts: 5, banDurationMinutes: 30, sessionTimeoutMinutes: 120,
    passwordMinLength: 8, passwordRequireUpper: false, passwordRequireNumber: false, passwordExpiryDays: 0,
  };

  const [form, setForm] = useState<SecuritySettings | null>(null);
  const current = form ?? (data?.settings ?? defaults);

  const saveMut = useMutation({
    mutationFn: (payload: SecuritySettings) => api.patch("/admin/security/settings", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-security-settings"] }); qc.invalidateQueries({ queryKey: ["admin-security-overview"] }); setForm(null); showToast("تم حفظ الإعدادات"); },
    onError: () => showToast("حدث خطأ أثناء الحفظ", "error"),
  });

  // Initialize form when data loads
  if (!form && data?.settings && form === null) {
    // Do nothing, form will use `current`
  }

  const set = (key: keyof SecuritySettings, val: boolean | number) => {
    setForm((f) => ({ ...(f ?? (data?.settings ?? defaults)), [key]: val }));
  };

  if (isLoading) return <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>جاري التحميل...</div>;

  const isDirty = form !== null;

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    background: "#060b18", border: "1px solid #1a2840", color: "#f1f5f9",
    borderRadius: 7, padding: "8px 12px", fontSize: 13, width: "100%", boxSizing: "border-box",
    ...style,
  });

  const toggle = (key: keyof SecuritySettings) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div
        onClick={() => set(key, !(current[key] as boolean))}
        style={{
          width: 40, height: 20, borderRadius: 10, cursor: "pointer",
          background: current[key] ? "#2563eb" : "#1a2840",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff",
          top: 2, left: current[key] ? 22 : 2, transition: "left 0.2s",
        }} />
      </div>
    </label>
  );

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "success" ? "#065f46" : "#7f1d1d", color: "#fff", padding: "10px 24px", borderRadius: 10, zIndex: 9999, fontWeight: 600, fontSize: 14 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Admin Protection */}
        <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={16} color="#34d399" /> حماية الأدمن
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#111827", borderRadius: 8 }}>
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>إجبار 2FA لجميع الأدمن</div>
                <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>لن يتمكن أي أدمن من الدخول بدون 2FA</div>
              </div>
              {toggle("require2FAForAdmins")}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#111827", borderRadius: 8 }}>
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>تفعيل IP Whitelist</div>
                <div style={{ color: "#f87171", fontSize: 12, marginTop: 2 }}>⚠ احرص على إضافة IP حسابك أولاً</div>
              </div>
              {toggle("ipWhitelistEnabled")}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#111827", borderRadius: 8 }}>
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>مهلة الجلسة (دقيقة)</div>
                <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>تسجيل خروج تلقائي بعد الخمول</div>
              </div>
              <input
                type="number" min={5} max={1440}
                value={current.sessionTimeoutMinutes}
                onChange={(e) => set("sessionTimeoutMinutes", parseInt(e.target.value) || 120)}
                style={{ ...inp(), width: 90 }}
              />
            </div>
          </div>
        </div>

        {/* Brute Force Protection */}
        <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Ban size={16} color="#f87171" /> حماية Brute Force
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>الحد الأقصى للمحاولات</label>
              <input type="number" min={1} max={20} value={current.maxLoginAttempts} onChange={(e) => set("maxLoginAttempts", parseInt(e.target.value) || 5)} style={inp()} />
              <div style={{ color: "#475569", fontSize: 11, marginTop: 3 }}>قبل حظر IP</div>
            </div>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>مدة الحظر (دقيقة)</label>
              <input type="number" min={1} max={10080} value={current.banDurationMinutes} onChange={(e) => set("banDurationMinutes", parseInt(e.target.value) || 30)} style={inp()} />
              <div style={{ color: "#475569", fontSize: 11, marginTop: 3 }}>بعد الحظر التلقائي</div>
            </div>
          </div>
        </div>

        {/* Password Policy */}
        <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={16} color="#a78bfa" /> سياسة كلمات المرور
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>الحد الأدنى للطول</label>
                <input type="number" min={6} max={64} value={current.passwordMinLength} onChange={(e) => set("passwordMinLength", parseInt(e.target.value) || 8)} style={inp()} />
              </div>
              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>انتهاء صلاحية (يوم، 0=أبداً)</label>
                <input type="number" min={0} max={365} value={current.passwordExpiryDays} onChange={(e) => set("passwordExpiryDays", parseInt(e.target.value) || 0)} style={inp()} />
              </div>
            </div>
            {[
              { key: "passwordRequireUpper" as const, label: "يجب أن تحتوي على أحرف كبيرة (A-Z)" },
              { key: "passwordRequireNumber" as const, label: "يجب أن تحتوي على أرقام (0-9)" },
            ].map((item) => (
              <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#111827", borderRadius: 8 }}>
                <span style={{ color: "#e2e8f0", fontSize: 14 }}>{item.label}</span>
                {toggle(item.key)}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => saveMut.mutate(current)}
            disabled={saveMut.isPending}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14, opacity: saveMut.isPending ? 0.7 : 1 }}
          >
            {saveMut.isPending ? "جاري الحفظ..." : "💾 حفظ الإعدادات"}
          </button>
          {isDirty && (
            <button onClick={() => setForm(null)} style={{ background: "#1a2840", color: "#94a3b8", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>
              تراجع
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  label: "نظرة عامة",     icon: ShieldCheck },
  { id: "2fa",       label: "حالة 2FA",       icon: UserCheck },
  { id: "whitelist", label: "IP Whitelist",   icon: Globe },
  { id: "attempts",  label: "محاولات الدخول", icon: Activity },
  { id: "settings",  label: "الإعدادات",      icon: Settings },
];

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{ background: "#060b18", minHeight: "100vh", padding: "28px 32px", fontFamily: "Cairo, sans-serif" }} dir="rtl">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ background: "rgba(239,68,68,.15)", borderRadius: 10, padding: 10 }}>
            <Shield size={22} color="#f87171" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>الأمان المتقدم</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>حماية الأدمن، قوائم IP، تتبع محاولات الدخول، وسياسة كلمات المرور</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#0c1526", borderRadius: 10, padding: 4, border: "1px solid #1a2840", flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px", border: "none", borderRadius: 7, cursor: "pointer",
              fontWeight: 600, fontSize: 13, fontFamily: "Cairo, sans-serif",
              display: "flex", alignItems: "center", gap: 6,
              background: activeTab === tab.id ? "#2563eb" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#64748b",
              transition: "all 0.15s",
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ background: "#0c1526", border: "1px solid #1a2840", borderRadius: 14, padding: 24 }}>
        {activeTab === "overview"  && <OverviewTab />}
        {activeTab === "2fa"       && <Admin2FATab />}
        {activeTab === "whitelist" && <IpWhitelistTab />}
        {activeTab === "attempts"  && <LoginAttemptsTab />}
        {activeTab === "settings"  && <SecuritySettingsTab />}
      </div>
    </div>
  );
}
