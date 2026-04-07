"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Layers,
  Package,
  ShieldAlert,
  Webhook,
  Handshake,
  Radar,
} from "lucide-react";

interface LaunchReadinessResponse {
  generatedAt: string;
  status: "ready" | "blocked";
  summary: {
    blockers: number;
    warnings: number;
    readyForExecutiveSignOff: boolean;
  };
  governance: {
    apps: { pending: number; approved: number };
    themes: { pending: number; approved: number };
    partners: { pending: number; approved: number };
  };
  operations: {
    webhookDeliveries: number;
    failedWebhookDeliveries: number;
    webhookFailureRate: number;
    activeIncidents: number;
  };
  api: {
    publicContract: string;
    webhookContract: string;
    publishedChangelogCount: number;
    latestChangelog: { version: string; title: string; publishedAt: string } | null;
    sdks: string[];
  };
  checklist: Array<{
    id: string;
    title: string;
    status: "pass" | "warn" | "block";
    detail: string;
  }>;
}

const PAGE_BG = "#060b18";
const SURFACE = { background: "#0c1526", border: "1px solid #1a2840" };

const STATUS_STYLE = {
  pass: { color: "#34d399", bg: "rgba(16,185,129,.12)", icon: CheckCircle2, label: "جاهز" },
  warn: { color: "#fbbf24", bg: "rgba(245,158,11,.12)", icon: AlertTriangle, label: "تحذير" },
  block: { color: "#f87171", bg: "rgba(239,68,68,.12)", icon: ShieldAlert, label: "مانع" },
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ar-BH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function LaunchReadinessPage() {
  const { data, isLoading } = useQuery<LaunchReadinessResponse>({
    queryKey: ["admin-launch-readiness"],
    queryFn: () => api.get("/admin/launch-readiness").then((res) => res.data),
  });

  return (
    <div dir="rtl" className="min-h-screen p-6" style={{ background: PAGE_BG, color: "#dce8f5" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(59,130,246,.14)", border: "1px solid rgba(59,130,246,.24)" }}>
                <Radar className="w-5 h-5" style={{ color: "#60a5fa" }} />
              </div>
              <div>
                <h1 className="text-2xl font-black">Launch Readiness Review</h1>
                <p className="text-sm" style={{ color: "#6b85a1" }}>مراجعة تنفيذية مبنية على queues الحوكمة، webhooks، وpublic API contracts.</p>
              </div>
            </div>
          </div>
          {data && (
            <div className="px-4 py-3 rounded-2xl min-w-[240px]" style={SURFACE}>
              <p className="text-xs mb-1" style={{ color: "#6b85a1" }}>آخر تحديث</p>
              <p className="font-bold">{formatDate(data.generatedAt)}</p>
              <p className="text-xs mt-2" style={{ color: data.status === "ready" ? "#34d399" : "#f87171" }}>
                {data.summary.readyForExecutiveSignOff ? "جاهز للتوقيع التنفيذي" : "غير جاهز للتوقيع التنفيذي"}
              </p>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-24" style={{ color: "#6b85a1" }}>جارٍ تحميل مراجعة الجاهزية...</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "Blockers", value: data.summary.blockers, color: "#f87171", icon: ShieldAlert },
                { label: "Warnings", value: data.summary.warnings, color: "#fbbf24", icon: AlertTriangle },
                { label: "Webhook Failure Rate", value: `${data.operations.webhookFailureRate}%`, color: "#60a5fa", icon: Webhook },
                { label: "Published API Notes", value: data.api.publishedChangelogCount, color: "#34d399", icon: ClipboardList },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl p-4" style={SURFACE}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: "#6b85a1" }}>{card.label}</p>
                    <card.icon className="w-4 h-4" style={{ color: card.color }} />
                  </div>
                  <p className="text-3xl font-black" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">
              <div className="rounded-3xl p-5" style={SURFACE}>
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="w-4 h-4" style={{ color: "#60a5fa" }} />
                  <h2 className="font-black">Execution Gates</h2>
                </div>
                <div className="space-y-3">
                  {data.checklist.map((item) => {
                    const style = STATUS_STYLE[item.status];
                    const Icon = style.icon;
                    return (
                      <div key={item.id} className="rounded-2xl p-4" style={{ background: "#09111f", border: "1px solid #152237" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-sm">{item.title}</p>
                            <p className="text-sm mt-1 leading-6" style={{ color: "#7c94af" }}>{item.detail}</p>
                          </div>
                          <div className="px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-xs font-bold shrink-0" style={{ color: style.color, background: style.bg }}>
                            <Icon className="w-3.5 h-3.5" />
                            {style.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl p-5" style={SURFACE}>
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4" style={{ color: "#a78bfa" }} />
                    <h2 className="font-black">Governance Queue</h2>
                  </div>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: "Apps", icon: Package, pending: data.governance.apps.pending, approved: data.governance.apps.approved, color: "#60a5fa" },
                      { label: "Themes", icon: Layers, pending: data.governance.themes.pending, approved: data.governance.themes.approved, color: "#a78bfa" },
                      { label: "Partners", icon: Handshake, pending: data.governance.partners.pending, approved: data.governance.partners.approved, color: "#34d399" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl p-3" style={{ background: "#09111f", border: "1px solid #152237" }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <item.icon className="w-4 h-4" style={{ color: item.color }} />
                            <span className="font-semibold">{item.label}</span>
                          </div>
                          <span className="text-xs" style={{ color: "#6b85a1" }}>approved {item.approved}</span>
                        </div>
                        <p className="text-sm" style={{ color: item.pending === 0 ? "#34d399" : "#f87171" }}>
                          pending {item.pending}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl p-5" style={SURFACE}>
                  <div className="flex items-center gap-2 mb-4">
                    <Webhook className="w-4 h-4" style={{ color: "#fbbf24" }} />
                    <h2 className="font-black">Contracts And Sign-off Inputs</h2>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-2xl p-3" style={{ background: "#09111f", border: "1px solid #152237" }}>
                      <p className="text-xs mb-1" style={{ color: "#6b85a1" }}>Public API contract</p>
                      <p className="font-mono text-sm" dir="ltr">{data.api.publicContract}</p>
                    </div>
                    <div className="rounded-2xl p-3" style={{ background: "#09111f", border: "1px solid #152237" }}>
                      <p className="text-xs mb-1" style={{ color: "#6b85a1" }}>Webhook contract</p>
                      <p className="font-mono text-sm" dir="ltr">{data.api.webhookContract}</p>
                    </div>
                    <div className="rounded-2xl p-3" style={{ background: "#09111f", border: "1px solid #152237" }}>
                      <p className="text-xs mb-1" style={{ color: "#6b85a1" }}>SDK coverage</p>
                      <p>{data.api.sdks.join(" / ")}</p>
                    </div>
                    <div className="rounded-2xl p-3" style={{ background: "#09111f", border: "1px solid #152237" }}>
                      <p className="text-xs mb-1" style={{ color: "#6b85a1" }}>Latest published changelog</p>
                      {data.api.latestChangelog ? (
                        <>
                          <p className="font-semibold">{data.api.latestChangelog.version} — {data.api.latestChangelog.title}</p>
                          <p className="text-xs mt-1" style={{ color: "#6b85a1" }}>{formatDate(data.api.latestChangelog.publishedAt)}</p>
                        </>
                      ) : (
                        <p style={{ color: "#fbbf24" }}>لا يوجد changelog منشور بعد.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}