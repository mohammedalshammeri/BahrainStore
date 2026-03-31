"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  CheckCircle2,
  Package,
  Loader2,
} from "lucide-react";

type AppCategory =
  | "ALL"
  | "MARKETING"
  | "SHIPPING"
  | "ACCOUNTING"
  | "CRM"
  | "ERP"
  | "ANALYTICS"
  | "PAYMENTS"
  | "SOCIAL"
  | "OTHER";

interface App {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string | null;
  category: string;
  developer: string;
  isOfficial: boolean;
  pricingType: "FREE" | "PAID" | "FREEMIUM";
  monthlyPrice: number | null;
  installed: boolean;
  installedAndActive: boolean;
}

const CATEGORY_LABELS: Record<AppCategory, string> = {
  ALL: "الكل",
  MARKETING: "التسويق",
  SHIPPING: "الشحن",
  ACCOUNTING: "المحاسبة",
  CRM: "إدارة العملاء",
  ERP: "ERP",
  ANALYTICS: "التحليلات",
  PAYMENTS: "الدفع",
  SOCIAL: "التواصل الاجتماعي",
  OTHER: "أخرى",
};

const CATEGORIES: AppCategory[] = [
  "ALL",
  "MARKETING",
  "SHIPPING",
  "ACCOUNTING",
  "CRM",
  "ERP",
  "ANALYTICS",
  "PAYMENTS",
  "SOCIAL",
  "OTHER",
];

function pricingLabel(app: App): string {
  if (app.pricingType === "FREE") return "مجاني";
  if (app.pricingType === "FREEMIUM") return "مجاني / مدفوع";
  if (app.monthlyPrice) return `${app.monthlyPrice} BD / شهر`;
  return "مدفوع";
}

export default function AppsPage() {
  const { store } = useAuthStore();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<AppCategory>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchApps() {
    if (!store?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/apps?storeId=${store.id}`);
      setApps(res.data.apps ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  async function handleInstall(appId: string) {
    if (!store?.id) return;
    setActionLoading(appId);
    try {
      await api.post("/apps/install", { storeId: store.id, appId });
      await fetchApps();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUninstall(appId: string) {
    if (!store?.id) return;
    setActionLoading(appId);
    try {
      await api.post("/apps/uninstall", { storeId: store.id, appId });
      await fetchApps();
    } finally {
      setActionLoading(null);
    }
  }

  const filtered =
    activeCategory === "ALL"
      ? apps
      : apps.filter((a) => a.category === activeCategory);

  const installedApps = apps.filter((a) => a.installedAndActive);

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutGrid className="h-7 w-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">متجر التطبيقات</h1>
          <p className="text-sm text-gray-500">
            قم بتثبيت التطبيقات لتوسيع قدرات متجرك
          </p>
        </div>
      </div>

      {/* Installed count */}
      {installedApps.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <span className="text-sm text-green-800">
            لديك{" "}
            <strong>{installedApps.length}</strong>{" "}
            {installedApps.length === 1 ? "تطبيق مثبت" : "تطبيقات مثبتة"}
          </span>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count =
            cat === "ALL"
              ? apps.length
              : apps.filter((a) => a.category === cat).length;
          if (count === 0 && cat !== "ALL") return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {CATEGORY_LABELS[cat]}
              <span className="mr-1.5 text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Apps grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Package className="h-12 w-12 mb-3" />
          <p>لا توجد تطبيقات في هذه الفئة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              loading={actionLoading === app.id}
              onInstall={() => handleInstall(app.id)}
              onUninstall={() => handleUninstall(app.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AppCard({
  app,
  loading,
  onInstall,
  onUninstall,
}: {
  app: App;
  loading: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Icon + badges row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl shrink-0">
          {app.icon ?? "📦"}
        </div>
        <div className="flex flex-col items-end gap-1">
          {app.isOfficial && (
            <Badge variant="info">رسمي</Badge>
          )}
          {app.installedAndActive && (
            <Badge variant="success">مثبت</Badge>
          )}
        </div>
      </div>

      {/* Name + developer */}
      <h3 className="font-semibold text-gray-900 text-base leading-tight">{app.nameAr}</h3>
      <p className="text-xs text-gray-400 mb-2">{app.developer}</p>

      {/* Description */}
      <p className="text-sm text-gray-600 flex-1 mb-4 line-clamp-2">
        {app.descriptionAr}
      </p>

      {/* Pricing */}
      <p className="text-xs font-medium text-indigo-600 mb-4">{pricingLabel(app)}</p>

      {/* Action */}
      {app.installedAndActive ? (
        <Button
          variant="outline"
          className="w-full text-sm"
          onClick={onUninstall}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "إلغاء التثبيت"}
        </Button>
      ) : (
        <Button
          variant="primary"
          className="w-full text-sm"
          onClick={onInstall}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تثبيت"}
        </Button>
      )}
    </div>
  );
}
