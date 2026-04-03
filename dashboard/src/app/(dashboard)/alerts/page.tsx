"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import {
  AlertCircle, Bell, Check, CheckCheck, Trash2, RefreshCw,
  Loader2, Settings, Zap, Package, ShoppingCart, Star, AlertTriangle, Info
} from "lucide-react";

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  priority: string;
  createdAt: string;
  data?: any;
}

interface AlertConfig {
  lowStockDays: number;
  abandonedCartMinutes: number;
  inactiveCustomerDays: number;
  channels: {
    email?: boolean;
    push?: boolean;
    whatsapp?: boolean;
  };
}

const priorityConfig: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  URGENT: { color: "text-red-600",    bg: "bg-red-50 border-red-200",    label: "عاجل",   icon: AlertCircle },
  HIGH:   { color: "text-orange-600", bg: "bg-orange-50 border-orange-200", label: "مهم",  icon: AlertTriangle },
  MEDIUM: { color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",   label: "متوسط", icon: Bell },
  LOW:    { color: "text-slate-500",  bg: "bg-slate-50 border-slate-200",   label: "منخفض", icon: Info },
};

const typeIcons: Record<string, any> = {
  LOW_STOCK:         Package,
  OUT_OF_STOCK:      Package,
  ABANDONED_CART:    ShoppingCart,
  NEW_REVIEW:        Star,
  LARGE_ORDER:       Zap,
  SEASONAL_REMINDER: Bell,
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

export default function AlertsPage() {
  const { store } = useAuthStore();
  const [tab, setTab] = useState<"alerts" | "config">("alerts");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Config
  const [config, setConfig] = useState<AlertConfig>({
    lowStockDays: 7,
    abandonedCartMinutes: 30,
    inactiveCustomerDays: 60,
    channels: { email: true, push: true, whatsapp: false },
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const loadData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    try {
      const [alertsRes, cfgRes] = await Promise.all([
        api.get(`/alerts?storeId=${store.id}&limit=50`),
        api.get(`/alerts/config?storeId=${store.id}`),
      ]);
      setAlerts(alertsRes.data.alerts || []);
      if (cfgRes.data.config) setConfig(cfgRes.data.config);
    } catch {}
    setLoading(false);
  }, [store]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const generateAlerts = async () => {
    if (!store) return;
    setGenerating(true);
    try {
      const res = await api.post("/alerts/generate", { storeId: store.id });
      alert(`✅ تم توليد ${res.data.generated || 0} تنبيه جديد`);
      loadData();
    } catch {}
    setGenerating(false);
  };

  const markAllRead = async () => {
    if (!store) return;
    setMarkingAll(true);
    try {
      await api.post("/alerts/read-all", { storeId: store.id });
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    } catch {}
    setMarkingAll(false);
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/alerts/${id}/read`);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isRead: true } : a));
    } catch {}
  };

  const deleteAlert = async (id: string) => {
    try {
      await api.delete(`/alerts/${id}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {}
  };

  const saveConfig = async () => {
    if (!store) return;
    setSavingConfig(true);
    try {
      await api.put("/alerts/config", { storeId: store.id, ...config });
      alert("✅ تم حفظ الإعدادات");
    } catch {}
    setSavingConfig(false);
  };

  const filtered = filter === "unread" ? alerts.filter((a) => !a.isRead) : alerts;
  const unreadCount = alerts.filter((a) => !a.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <AlertCircle className="h-7 w-7 text-amber-500" />
            التنبيهات الذكية
            {unreadCount > 0 && (
              <span className="h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-slate-500 mt-1">تنبيهات ذكية بناءً على نشاط متجرك</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 text-slate-500 hover:text-slate-700">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={generateAlerts}
            disabled={generating}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            توليد تنبيهات
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[{ id: "alerts", label: "التنبيهات", icon: Bell }, { id: "config", label: "الإعدادات", icon: Settings }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Alerts tab */}
      {tab === "alerts" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === f ? "bg-amber-100 text-amber-700" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {f === "all" ? "الكل" : `غير مقروءة (${unreadCount})`}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
              >
                <CheckCheck className="h-4 w-4" />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border p-12 text-center">
              <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">
                {filter === "unread" ? "لا توجد تنبيهات غير مقروءة" : "لا توجد تنبيهات بعد"}
              </p>
              <p className="text-sm text-slate-400 mt-1">اضغط "توليد تنبيهات" لفحص متجرك</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((alert) => {
                const pCfg = priorityConfig[alert.priority] || priorityConfig.LOW;
                const TypeIcon = typeIcons[alert.type] || Bell;
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${pCfg.bg} ${
                      !alert.isRead ? "shadow-sm" : "opacity-75"
                    }`}
                  >
                    <div className={`flex-shrink-0 mt-0.5 ${pCfg.color}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`font-semibold text-sm ${!alert.isRead ? "text-slate-900" : "text-slate-600"}`}>
                          {alert.title}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${pCfg.color} bg-white`}>
                          {pCfg.label}
                        </span>
                        {!alert.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{alert.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{timeAgo(alert.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!alert.isRead && (
                        <button
                          onClick={() => markRead(alert.id)}
                          className="p-1.5 text-slate-400 hover:text-green-600 transition-colors"
                          title="تحديد كمقروء"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Config tab */}
      {tab === "config" && (
        <div className="bg-white rounded-2xl border p-6 space-y-6">
          <h2 className="font-bold text-slate-900">إعدادات التنبيهات</h2>

          <div className="space-y-5">
            {/* Sliders */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                حد المخزون المنخفض (أيام المبيعات المتبقية): {config.lowStockDays} أيام
              </label>
              <input
                type="range"
                min={1} max={30} step={1}
                value={config.lowStockDays}
                onChange={(e) => setConfig({ ...config, lowStockDays: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1 يوم</span><span>30 يوم</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                وقت التذكير بالسلة المهجورة: {config.abandonedCartMinutes} دقيقة
              </label>
              <input
                type="range"
                min={10} max={120} step={5}
                value={config.abandonedCartMinutes}
                onChange={(e) => setConfig({ ...config, abandonedCartMinutes: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>10 دقائق</span><span>120 دقيقة</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                أيام عدم النشاط للعميل: {config.inactiveCustomerDays} يوم
              </label>
              <input
                type="range"
                min={7} max={180} step={7}
                value={config.inactiveCustomerDays}
                onChange={(e) => setConfig({ ...config, inactiveCustomerDays: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>7 أيام</span><span>180 يوم</span>
              </div>
            </div>

            {/* Channels */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">قنوات الإشعارات</label>
              <div className="space-y-2">
                {[
                  { key: "email", label: "البريد الإلكتروني", desc: "تنبيهات عبر الإيميل" },
                  { key: "push", label: "إشعارات المتصفح", desc: "Push notifications" },
                  { key: "whatsapp", label: "واتساب", desc: "تنبيهات عبر واتساب (يتطلب إعداد واتساب)" },
                ].map((ch) => (
                  <label key={ch.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{ch.label}</p>
                      <p className="text-xs text-slate-400">{ch.desc}</p>
                    </div>
                    <div
                      onClick={() => setConfig({
                        ...config,
                        channels: { ...config.channels, [ch.key]: !(config.channels as any)[ch.key] }
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        (config.channels as any)[ch.key] ? "bg-amber-500" : "bg-slate-300"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                        (config.channels as any)[ch.key] ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="flex items-center gap-2 bg-amber-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            حفظ الإعدادات
          </button>
        </div>
      )}
    </div>
  );
}
