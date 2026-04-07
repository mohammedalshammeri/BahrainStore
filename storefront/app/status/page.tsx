import { CheckCircle2, AlertCircle, AlertTriangle, Clock, Info } from "lucide-react";
import { getPublicApiUrl } from "@/lib/env";

interface IncidentUpdate { message: string; createdAt: string }
interface PlatformIncident {
  id: string;
  title: string;
  type: "OUTAGE" | "DEGRADED" | "MAINTENANCE" | "NOTICE";
  status: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
  isPublic: boolean;
  updates: IncidentUpdate[];
  resolvedAt: string | null;
  createdAt: string;
}

interface StatusData {
  status: "operational" | "degraded";
  incidents: PlatformIncident[];
  generatedAt: string;
}

const API_URL = getPublicApiUrl();

async function getStatus(): Promise<StatusData> {
  try {
    const res = await fetch(`${API_URL}/v1/status`, {
      next: { revalidate: 60 }, // revalidate every 60s
    });
    if (!res.ok) throw new Error("failed");
    return res.json();
  } catch {
    return { status: "operational", incidents: [], generatedAt: new Date().toISOString() };
  }
}

const TYPE_STYLE: Record<string, { label: string; color: string; borderColor: string; Icon: React.ElementType }> = {
  OUTAGE:      { label: "تعطل كامل",    color: "#ef4444", borderColor: "rgba(239,68,68,.3)",   Icon: AlertCircle },
  DEGRADED:    { label: "أداء منخفض",   color: "#f59e0b", borderColor: "rgba(245,158,11,.3)",  Icon: AlertTriangle },
  MAINTENANCE: { label: "صيانة مجدولة", color: "#3b82f6", borderColor: "rgba(59,130,246,.3)",  Icon: Clock },
  NOTICE:      { label: "إشعار",        color: "#8b5cf6", borderColor: "rgba(139,92,246,.3)", Icon: Info },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  INVESTIGATING: { label: "قيد التحقيق", color: "#ef4444" },
  IDENTIFIED:    { label: "تم التحديد",  color: "#f59e0b" },
  MONITORING:    { label: "مراقبة",      color: "#3b82f6" },
  RESOLVED:      { label: "تم الحل",    color: "#10b981" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ar-BH", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function IncidentCard({ incident }: { incident: PlatformIncident }) {
  const t = TYPE_STYLE[incident.type] ?? TYPE_STYLE.NOTICE;
  const s = STATUS_LABEL[incident.status] ?? STATUS_LABEL.INVESTIGATING;
  const Icon = t.Icon;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#0c1526", border: `1px solid ${t.borderColor}` }}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Icon size={18} style={{ color: t.color, marginTop: 2, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-semibold">{incident.title}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: t.color, background: `${t.color}22` }}>
                {t.label}
              </span>
              <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
            </div>
            <p className="text-slate-500 text-xs mt-1">{fmtDate(incident.createdAt)}</p>
          </div>
        </div>

        {/* Updates timeline */}
        {incident.updates.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: "#1a2840" }}>
            {[...incident.updates].reverse().map((u, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-slate-500 text-xs shrink-0 mt-0.5 min-w-[90px]">
                  {new Date(u.createdAt).toLocaleString("ar-BH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-slate-300 text-xs">{u.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function StatusPage() {
  const data = await getStatus();

  const activeIncidents = data.incidents.filter((i) => i.status !== "RESOLVED");
  const resolvedIncidents = data.incidents.filter((i) => i.status === "RESOLVED");

  const isOperational = data.status === "operational";

  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{ background: "#060b18", color: "#e2e8f0", fontFamily: "Cairo, Arial, sans-serif", direction: "rtl" }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-1">بزار 🇧🇭</h1>
          <p className="text-slate-400 text-sm">حالة المنصة</p>
        </div>

        {/* Overall status */}
        <div
          className="rounded-2xl p-6 mb-8 flex items-center gap-4"
          style={
            isOperational
              ? { background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)" }
              : { background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)" }
          }
        >
          {isOperational
            ? <CheckCircle2 size={36} className="text-emerald-400 shrink-0" />
            : <AlertCircle size={36} className="text-red-400 shrink-0" />
          }
          <div>
            <p
              className="text-xl font-bold"
              style={{ color: isOperational ? "#34d399" : "#f87171" }}
            >
              {isOperational ? "جميع الأنظمة تعمل بشكل طبيعي" : "بعض الأنظمة متأثرة"}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              آخر تحديث: {fmtDate(data.generatedAt)}
            </p>
          </div>
        </div>

        {/* Service list */}
        <div className="rounded-xl overflow-hidden mb-8" style={{ border: "1px solid #1a2840" }}>
          {[
            { name: "واجهة المتاجر",  key: "storefront" },
            { name: "داشبورد التجار", key: "dashboard" },
            { name: "بوابة API",       key: "api" },
            { name: "بوابة الدفع",    key: "payment" },
            { name: "الإشعارات",      key: "notifications" },
          ].map((svc, i, arr) => {
            const isAffected = activeIncidents.some((inc) =>
              inc.type === "OUTAGE" && !inc.resolvedAt
            );
            return (
              <div
                key={svc.key}
                className="flex items-center justify-between px-5 py-3"
                style={{
                  background: "#0c1526",
                  borderBottom: i < arr.length - 1 ? "1px solid #1a2840" : "none",
                }}
              >
                <span className="text-slate-300 text-sm">{svc.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: isAffected ? "#ef4444" : "#10b981" }} />
                  <span className="text-xs" style={{ color: isAffected ? "#f87171" : "#34d399" }}>
                    {isAffected ? "متأثر" : "يعمل"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <section className="mb-8">
            <h2 className="text-red-400 font-semibold mb-3 flex items-center gap-1.5 text-sm">
              <AlertCircle size={15} />
              حوادث نشطة ({activeIncidents.length})
            </h2>
            <div className="space-y-3">
              {activeIncidents.map((inc) => <IncidentCard key={inc.id} incident={inc} />)}
            </div>
          </section>
        )}

        {/* Past incidents */}
        {resolvedIncidents.length > 0 && (
          <section>
            <h2 className="text-slate-400 font-semibold mb-3 flex items-center gap-1.5 text-sm">
              <CheckCircle2 size={15} />
              سجل الحوادث المحلولة
            </h2>
            <div className="space-y-2">
              {resolvedIncidents.slice(0, 10).map((inc) => <IncidentCard key={inc.id} incident={inc} />)}
            </div>
          </section>
        )}

        {data.incidents.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">
            لا توجد حوادث مسجّلة
          </div>
        )}

        <p className="text-center text-slate-600 text-xs mt-10">
          بزار — المنصة التجارية للبحرين 🇧🇭
        </p>
      </div>
    </div>
  );
}
