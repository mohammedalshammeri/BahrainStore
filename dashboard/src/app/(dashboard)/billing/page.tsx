"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Zap, TrendingUp, Star, Building2, RefreshCw, Key, Copy, RotateCcw } from "lucide-react";

interface PlanInfo {
  monthly: number;
  name: string;
  nameAr: string;
  features: string[];
}

interface BillingStatus {
  plan: string;
  planInfo: PlanInfo;
  isTrialActive: boolean;
  trialDaysLeft: number | null;
  isPlanActive: boolean;
  daysUntilExpiry: number | null;
  planExpiresAt: string | null;
  trialEndsAt: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  plan: string;
  amountBD: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | "WAIVED";
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  STARTER: <Zap className="h-5 w-5 text-gray-500" />,
  GROWTH: <TrendingUp className="h-5 w-5 text-blue-500" />,
  PRO: <Star className="h-5 w-5 text-purple-500" />,
  ENTERPRISE: <Building2 className="h-5 w-5 text-amber-500" />,
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: "border-gray-200",
  GROWTH: "border-blue-500",
  PRO: "border-purple-500",
  ENTERPRISE: "border-amber-500",
};

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; color: string }> = {
    PAID: { label: "مدفوعة", color: "bg-emerald-100 text-emerald-700" },
    PENDING: { label: "معلقة", color: "bg-amber-100 text-amber-700" },
    OVERDUE: { label: "متأخرة", color: "bg-red-100 text-red-700" },
    CANCELLED: { label: "ملغاة", color: "bg-gray-100 text-gray-500" },
    WAIVED: { label: "معفوة", color: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] ?? { label: status, color: "bg-gray-100 text-gray-500" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>;
};

export default function BillingPage() {
  const { store } = useAuthStore();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<Record<string, PlanInfo>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [apiKeyInfo, setApiKeyInfo] = useState<{ hasApiKey: boolean; maskedKey: string | null } | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  async function fetchAll() {
    if (!store?.id) return;
    setLoading(true);
    try {
      const [statusRes, plansRes, invoicesRes, apiKeyRes] = await Promise.all([
        api.get(`/billing/status?storeId=${store.id}`),
        api.get("/billing/plans"),
        api.get(`/billing/invoices?storeId=${store.id}`),
        api.get(`/billing/api-key?storeId=${store.id}`),
      ]);
      setBillingStatus(statusRes.data);
      setPlans(plansRes.data.plans);
      setInvoices(invoicesRes.data.invoices ?? []);
      setApiKeyInfo(apiKeyRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (store?.id) fetchAll();
  }, [store?.id]);

  async function startTrial() {
    if (!store?.id) return;
    try {
      await api.post("/billing/start-trial", { storeId: store.id });
      setMsg({ ok: true, text: "بدأت الفترة التجريبية المجانية 14 يوماً ✅" });
      fetchAll();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.error ?? "حدث خطأ" });
    }
  }

  async function generateApiKey() {
    if (!store?.id) return;
    setGeneratingKey(true);
    setNewApiKey(null);
    try {
      const res = await api.post("/billing/api-key", { storeId: store.id });
      setNewApiKey(res.data.apiKey);
      fetchAll();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.error ?? "فشل توليد مفتاح API" });
    } finally {
      setGeneratingKey(false);
    }
  }

  async function upgradePlan(plan: string) {    if (!store?.id) return;
    setUpgrading(plan);
    setMsg(null);
    try {
      const res = await api.post("/billing/upgrade", { storeId: store.id, plan });
      setMsg({ ok: true, text: res.data?.message ?? `تم إنشاء طلب الترقية لخطة ${plans[plan]?.nameAr ?? plan}` });
      fetchAll();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.error ?? "فشل الترقية" });
    } finally {
      setUpgrading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const currentPlan = billingStatus?.plan ?? "STARTER";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الاشتراك والفوترة</h1>
          <p className="text-slate-500 mt-1">إدارة خطة اشتراكك وفواتيرك</p>
        </div>
        <Button variant="outline" onClick={fetchAll}>
          <RefreshCw className="h-4 w-4 ml-2" /> تحديث
        </Button>
      </div>

      {/* Alert message */}
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Current Status Card */}
      <Card>
        <CardHeader title="حالة الاشتراك الحالية" />
        <CardBody>
          {billingStatus && (
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-3">
                {PLAN_ICONS[currentPlan]}
                <div>
                  <p className="text-sm text-slate-500">الخطة الحالية</p>
                  <p className="text-lg font-bold text-slate-900">{billingStatus.planInfo?.nameAr ?? currentPlan}</p>
                </div>
              </div>

              {billingStatus.isTrialActive && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-blue-600">الفترة التجريبية</p>
                    <p className="font-semibold text-blue-700">{billingStatus.trialDaysLeft} يوم متبقي</p>
                  </div>
                </div>
              )}

              {billingStatus.daysUntilExpiry !== null && !billingStatus.isTrialActive && (
                <div className={`flex items-center gap-2 rounded-lg px-4 py-2 border ${billingStatus.daysUntilExpiry <= 7 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                  <Clock className={`h-4 w-4 ${billingStatus.daysUntilExpiry <= 7 ? "text-amber-500" : "text-slate-400"}`} />
                  <div>
                    <p className="text-xs text-slate-500">الاشتراك ينتهي</p>
                    <p className="font-semibold text-slate-700">{billingStatus.daysUntilExpiry} يوم</p>
                  </div>
                </div>
              )}

              {!billingStatus.isTrialActive && !billingStatus.trialEndsAt && (
                <Button variant="outline" onClick={startTrial}>
                  <Zap className="h-4 w-4 ml-2" />
                  ابدأ تجربة مجانية 14 يوم
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Plans Grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">الخطط المتاحة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.entries(plans).map(([planKey, planInfo]) => {
            const isCurrent = planKey === currentPlan;
            return (
              <div
                key={planKey}
                className={`rounded-xl border-2 bg-white p-5 flex flex-col gap-3 transition ${PLAN_COLORS[planKey]} ${isCurrent ? "shadow-md" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {PLAN_ICONS[planKey]}
                    <span className="font-bold text-slate-900">{planInfo.nameAr}</span>
                  </div>
                  {isCurrent && <Badge variant="success">الحالية</Badge>}
                </div>

                <div>
                  {planInfo.monthly === 0 ? (
                    <p className="text-2xl font-bold text-slate-900">مجاني</p>
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">
                      {planInfo.monthly} BD<span className="text-sm font-normal text-slate-500">/شهر</span>
                    </p>
                  )}
                </div>

                <ul className="space-y-1.5 flex-1">
                  {planInfo.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-slate-600">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "primary"}
                  disabled={isCurrent || upgrading !== null}
                  onClick={() => !isCurrent && upgradePlan(planKey)}
                >
                  {upgrading === planKey ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "خطتك الحالية"
                  ) : (
                    planInfo.monthly === 0 ? "التبديل" : "ترقية الآن"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader title="سجل الفواتير" subtitle="فواتير اشتراكك السابقة" />
        <CardBody className="p-0">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <AlertCircle className="h-10 w-10 mb-3" />
              <p>لا توجد فواتير بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-right">
                    <th className="px-4 py-3 font-medium text-slate-600">رقم الفاتورة</th>
                    <th className="px-4 py-3 font-medium text-slate-600">الخطة</th>
                    <th className="px-4 py-3 font-medium text-slate-600">المبلغ</th>
                    <th className="px-4 py-3 font-medium text-slate-600">الفترة</th>
                    <th className="px-4 py-3 font-medium text-slate-600">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-slate-700">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {PLAN_ICONS[inv.plan]}
                          <span className="text-slate-700">{plans[inv.plan]?.nameAr ?? inv.plan}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {Number(inv.amountBD) === 0 ? "مجاني" : `${Number(inv.amountBD).toFixed(3)} BD`}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(inv.periodStart).toLocaleDateString("ar-BH")}
                        {" — "}
                        {new Date(inv.periodEnd).toLocaleDateString("ar-BH")}
                      </td>
                      <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* API Key Section */}
      <Card>
        <CardHeader
          title="مفتاح API"
          subtitle="استخدم هذا المفتاح للوصول إلى بياناتك برمجياً (Public API)"
        />
        <CardBody>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              يمكنك استخدام مفتاح API للوصول إلى منتجاتك وطلباتك وعملاءك من أي تطبيق خارجي.<br />
              التوثيق متاح على: <code className="bg-slate-100 rounded px-1">/docs</code>
            </p>

            {newApiKey && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm font-medium text-amber-800 mb-2">⚠️ احفظ هذا المفتاح — لن يظهر مرة أخرى!</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-300 rounded px-3 py-2 text-sm font-mono break-all">{newApiKey}</code>
                  <Button variant="outline" className="shrink-0" onClick={() => { navigator.clipboard.writeText(newApiKey); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!newApiKey && apiKeyInfo && (
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-slate-400" />
                {apiKeyInfo.hasApiKey ? (
                  <code className="text-sm font-mono text-slate-600 bg-slate-100 rounded px-3 py-1.5">{apiKeyInfo.maskedKey}</code>
                ) : (
                  <span className="text-sm text-slate-500">لم يتم توليد مفتاح API بعد</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                variant={apiKeyInfo?.hasApiKey ? "outline" : "primary"}
                onClick={generateApiKey}
                disabled={generatingKey}
              >
                {generatingKey ? (
                  <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                ) : apiKeyInfo?.hasApiKey ? (
                  <RotateCcw className="h-4 w-4 ml-2" />
                ) : (
                  <Key className="h-4 w-4 ml-2" />
                )}
                {apiKeyInfo?.hasApiKey ? "تدوير المفتاح (Rotate)" : "توليد مفتاح API"}
              </Button>
              {apiKeyInfo?.hasApiKey && !newApiKey && (
                <p className="text-xs text-slate-500">سيؤدي تدوير المفتاح إلى إبطال المفتاح القديم</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
