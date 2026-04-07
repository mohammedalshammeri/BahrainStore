"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import {
  MessageSquare, Settings, Send, Users, ShoppingCart, RefreshCw,
  Copy, CheckCircle, Loader2, Eye, EyeOff, Radio, Wifi, AlertTriangle
} from "lucide-react";

interface Stats {
  totalSessions: number;
  activeSessions: number;
  activeCartsCount: number;
}

interface Session {
  id: string;
  phone: string;
  customerName?: string;
  state: string;
  cartItems: any[];
  lastMessageAt: string;
}

interface Config {
  phoneNumberId?: string;
  verifyToken?: string;
  isActive: boolean;
}

interface Readiness {
  status: "enabled" | "degraded" | "unavailable";
  issues: string[];
  operationalLimits: {
    broadcastMaxRecipients: number;
    activeSessionWindowHours: number;
    recipientFreshnessDays: number;
  };
  stats: {
    totalSessions: number;
    activeSessions: number;
    activeCartsCount: number;
    staleSessions: number;
  };
}

const readinessStyles: Record<Readiness["status"], string> = {
  enabled: "bg-emerald-100 text-emerald-700",
  degraded: "bg-amber-100 text-amber-700",
  unavailable: "bg-rose-100 text-rose-700",
};

const stateLabels: Record<string, { label: string; color: string }> = {
  GREETING:     { label: "ترحيب", color: "bg-slate-100 text-slate-600" },
  MAIN_MENU:    { label: "القائمة الرئيسية", color: "bg-blue-100 text-blue-600" },
  BROWSING:     { label: "يتصفح", color: "bg-indigo-100 text-indigo-600" },
  SEARCHING:    { label: "يبحث", color: "bg-amber-100 text-amber-600" },
  PRODUCT_VIEW: { label: "يشاهد منتجاً", color: "bg-orange-100 text-orange-600" },
  CART:         { label: "السلة", color: "bg-purple-100 text-purple-600" },
  CHECKOUT:     { label: "الدفع", color: "bg-green-100 text-green-600" },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

export default function WhatsappCommercePage() {
  const { store } = useAuthStore();
  const [tab, setTab] = useState<"overview" | "sessions" | "config" | "broadcast">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [config, setConfig] = useState<Config>({ isActive: false });
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  // Config form state
  const [cfgForm, setCfgForm] = useState({ phoneNumberId: "", accessToken: "", verifyToken: "" });
  const [showToken, setShowToken] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);

  // Broadcast state
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; attempted?: number; truncated?: boolean; total?: number } | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  // Webhook URL copy
  const [copied, setCopied] = useState(false);
  const webhookUrl = `https://api.bazar.bh/api/v1/whatsapp-commerce/webhook?storeId=${store?.id}`;

  const loadData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    try {
      const [statsRes, sessionsRes, cfgRes, readinessRes] = await Promise.all([
        api.get(`/whatsapp-commerce/stats?storeId=${store.id}`),
        api.get(`/whatsapp-commerce/sessions?storeId=${store.id}`),
        api.get(`/whatsapp-commerce/config?storeId=${store.id}`),
        api.get(`/whatsapp-commerce/readiness?storeId=${store.id}`),
      ]);
      setStats(statsRes.data);
      setSessions(sessionsRes.data.sessions || []);
      const c = cfgRes.data.config || {};
      setReadiness(readinessRes.data || null);
      setConfig(c);
      setCfgForm({
        phoneNumberId: c.phoneNumberId || "",
        accessToken: "",
        verifyToken: c.verifyToken || "",
      });
    } catch {}
    setLoading(false);
  }, [store]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveConfig = async () => {
    if (!store) return;
    setSavingCfg(true);
    try {
      await api.post("/whatsapp-commerce/config", { storeId: store.id, ...cfgForm });
      alert("✅ تم حفظ الإعدادات");
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || "فشل الحفظ");
    }
    setSavingCfg(false);
  };

  const sendTestMessage = async () => {
    if (!store || !testPhone.trim()) return;
    setTesting(true);
    try {
      await api.post("/whatsapp-commerce/test-message", { storeId: store.id, phone: testPhone.trim() });
      alert("✅ تم إرسال رسالة الاختبار");
    } catch (err: any) {
      alert(err?.response?.data?.error || "فشل إرسال رسالة الاختبار");
    }
    setTesting(false);
  };

  const sendBroadcast = async () => {
    if (!store || !broadcastMsg.trim()) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await api.post("/whatsapp-commerce/broadcast", {
        storeId: store.id, message: broadcastMsg,
      });
      setBroadcastResult(res.data);
      setBroadcastMsg("");
    } catch (err: any) {
      alert(err?.response?.data?.error || "فشل الإرسال");
    }
    setBroadcasting(false);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: Radio },
    { id: "sessions", label: "المحادثات", icon: Users },
    { id: "config", label: "الإعدادات", icon: Settings },
    { id: "broadcast", label: "إرسال جماعي", icon: Send },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-green-500" />
            واتساب شوب
          </h1>
          <p className="text-slate-500 mt-1">بيع منتجاتك مباشرة عبر واتساب بأوتوماتيكية</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            config.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}>
            <Wifi className="h-3.5 w-3.5" />
            {config.isActive ? "نشط" : "غير مفعّل"}
          </div>
          <button onClick={loadData} className="p-2 text-slate-500 hover:text-slate-700">
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-6">
          {readiness && (
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">جاهزية القناة</h2>
                  <p className="text-sm text-slate-500 mt-1">حالة التشغيل الحقيقية وحدود الإرسال الحالية.</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${readinessStyles[readiness.status]}`}>
                  {readiness.status === "enabled" ? "جاهز" : readiness.status === "degraded" ? "متدهور" : "غير متاح"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">حد الإرسال الجماعي</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{readiness.operationalLimits.broadcastMaxRecipients}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">نافذة النشاط</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{readiness.operationalLimits.activeSessionWindowHours} ساعة</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">الجلسات القديمة</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{readiness.stats.staleSessions}</p>
                </div>
              </div>

              {readiness.issues.length > 0 && (
                <div className="space-y-2">
                  {readiness.issues.map((issue) => (
                    <div key={issue} className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>{issue}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "إجمالي المحادثات", value: stats?.totalSessions ?? 0, icon: Users, color: "bg-blue-50 text-blue-600" },
              { label: "نشطة اليوم", value: stats?.activeSessions ?? 0, icon: Radio, color: "bg-green-50 text-green-600" },
              { label: "سلات نشطة", value: stats?.activeCartsCount ?? 0, icon: ShoppingCart, color: "bg-purple-50 text-purple-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border p-5 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-sm text-slate-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Webhook URL */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-slate-900 mb-3">رابط الويب هوك</h2>
            <p className="text-xs text-slate-500 mb-3">أضف هذا الرابط في إعدادات واتساب Business API الخاصة بك</p>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border">
              <code className="text-xs text-slate-700 flex-1 break-all">{webhookUrl}</code>
              <button onClick={copyWebhook} className="shrink-0 p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-slate-900">اختبار الاتصال</h2>
              <p className="text-xs text-slate-500 mt-1">أرسل رسالة اختبار للتأكد من صحة Phone Number ID والتوكن.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="9733XXXXXXX"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={sendTestMessage}
                disabled={testing || !testPhone.trim()}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال اختبار
              </button>
            </div>
          </div>

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-semibold text-slate-900 mb-4">آخر المحادثات</h2>
              <div className="space-y-2">
                {sessions.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-sm font-medium">
                        {s.customerName?.[0] || s.phone.slice(-2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.customerName || s.phone}</p>
                        <p className="text-xs text-slate-500">{s.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{timeAgo(s.lastMessageAt)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stateLabels[s.state]?.color || "bg-slate-100 text-slate-600"}`}>
                        {stateLabels[s.state]?.label || s.state}
                      </span>
                      {s.cartItems?.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-purple-600">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          {s.cartItems.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sessions tab */}
      {tab === "sessions" && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-right">
                  <th className="px-4 py-3 text-sm font-medium text-slate-600">الرقم</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-600">الاسم</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-600">الحالة</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-600">السلة</th>
                  <th className="px-4 py-3 text-sm font-medium text-slate-600">آخر نشاط</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">لا توجد محادثات بعد</td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-600 font-mono">{s.phone}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{s.customerName || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stateLabels[s.state]?.color || "bg-slate-100 text-slate-600"}`}>
                          {stateLabels[s.state]?.label || s.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {s.cartItems?.length > 0 ? `${s.cartItems.length} منتج` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{timeAgo(s.lastMessageAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Config tab */}
      {tab === "config" && (
        <div className="bg-white rounded-2xl border p-6 space-y-5">
          <h2 className="font-bold text-slate-900">إعدادات WhatsApp Business API</h2>
          <p className="text-sm text-slate-500">
            ستحتاج إلى حساب مطور Meta وWhatsApp Business API للتفعيل.{" "}
            <a href="https://developers.facebook.com/docs/whatsapp" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
              دليل الإعداد
            </a>
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number ID</label>
              <input
                value={cfgForm.phoneNumberId}
                onChange={(e) => setCfgForm({ ...cfgForm, phoneNumberId: e.target.value })}
                placeholder="123456789012345"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Access Token</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={cfgForm.accessToken}
                  onChange={(e) => setCfgForm({ ...cfgForm, accessToken: e.target.value })}
                  placeholder="EAAxxxxxxxx..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-10"
                />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">اتركه فارغاً للإبقاء على التوكن الحالي</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Verify Token (اختره بنفسك)</label>
              <input
                value={cfgForm.verifyToken}
                onChange={(e) => setCfgForm({ ...cfgForm, verifyToken: e.target.value })}
                placeholder="bazar_secret_token"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            <p className="font-medium mb-1">رابط الويب هوك لإضافته في Meta:</p>
            <code className="text-xs break-all">{webhookUrl}</code>
          </div>

          <button
            onClick={saveConfig}
            disabled={savingCfg}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {savingCfg ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            حفظ الإعدادات
          </button>
        </div>
      )}

      {/* Broadcast tab */}
      {tab === "broadcast" && (
        <div className="bg-white rounded-2xl border p-6 space-y-5">
          <h2 className="font-bold text-slate-900">إرسال رسالة جماعية</h2>
          <p className="text-sm text-slate-500">
            سيتم إرسال الرسالة لجميع المحادثات النشطة ({stats?.totalSessions || 0} محادثة)
          </p>

          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="مرحباً بعملائنا الكرام... 🎉"
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{broadcastMsg.length} / 1000 حرف</p>
            <button
              onClick={sendBroadcast}
              disabled={broadcasting || !broadcastMsg.trim()}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {broadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إرسال لجميع العملاء
            </button>
          </div>

          {broadcastResult && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-700">
                تم الإرسال: <strong>{broadcastResult.sent}</strong> رسالة
                {broadcastResult.failed > 0 && ` | فشل: ${broadcastResult.failed}`}
                {broadcastResult.truncated && ` | تم تقليص القائمة إلى ${broadcastResult.attempted}`}
              </p>
            </div>
          )}

          {/* Tips */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">نصائح للرسائل الجماعية:</p>
            <ul className="text-xs text-slate-500 space-y-1 list-disc pr-5">
              <li>استخدم العروض أو الخصومات لتحفيز العملاء</li>
              <li>تجنب الإرسال بشكل متكرر لمنع الحظر</li>
              <li>يُفضَّل الإرسال مرة في الأسبوع كحد أقصى</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
