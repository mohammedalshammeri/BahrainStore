"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Award, CheckCircle, RefreshCw, Loader2, ShieldCheck, Star } from "lucide-react";

interface BadgeDef {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  icon: string;
  color: string;
  criteria: Record<string, any>;
}

interface EarnedBadge {
  id: string;
  badgeId: string;
  earnedAt: string;
  badge: BadgeDef;
}

export default function BadgesPage() {
  const { store } = useAuthStore();
  const [allBadges, setAllBadges] = useState<BadgeDef[]>([]);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    try {
      const [badgesRes, earnedRes] = await Promise.all([
        api.get("/badges"),
        api.get(`/badges/store/${store.id}`),
      ]);
      setAllBadges(badgesRes.data.badges || []);
      setEarned(earnedRes.data.badges || []);
    } catch {}
    setLoading(false);
  }, [store]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const checkEligibility = async () => {
    if (!store) return;
    setChecking(true);
    try {
      const res = await api.post(`/badges/check/${store.id}`);
      const newlyEarned = res.data.newlyEarned || [];
      if (newlyEarned.length > 0) {
        alert(`🎉 مبروك! حصلت على ${newlyEarned.length} شارة جديدة!`);
      } else {
        alert("تم الفحص — لم تحصل على شارات جديدة حالياً. استمر في تطوير متجرك!");
      }
      loadData();
    } catch {}
    setChecking(false);
  };

  const earnedIds = new Set(earned.map((e) => e.badgeId));

  const iconMap: Record<string, string> = {
    "⭐": "text-yellow-500",
    "🚀": "text-blue-500",
    "🥇": "text-amber-500",
    "🌍": "text-green-500",
    "🆕": "text-indigo-500",
    "✅": "text-emerald-500",
    "❤️": "text-red-500",
    "🏆": "text-orange-500",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Award className="h-7 w-7 text-yellow-500" />
            شارات التاجر
          </h1>
          <p className="text-slate-500 mt-1">اكسب شارات تُعزِّز ثقة العملاء بمتجرك</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 text-slate-500 hover:text-slate-700">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={checkEligibility}
            disabled={checking}
            className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            فحص الأهلية
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-5 text-center">
          <p className="text-3xl font-bold text-yellow-500">{earned.length}</p>
          <p className="text-sm text-slate-500 mt-1">شارات مكتسبة</p>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <p className="text-3xl font-bold text-slate-900">{allBadges.length}</p>
          <p className="text-sm text-slate-500 mt-1">إجمالي الشارات</p>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <p className="text-3xl font-bold text-indigo-600">
            {allBadges.length > 0 ? Math.round((earned.length / allBadges.length) * 100) : 0}%
          </p>
          <p className="text-sm text-slate-500 mt-1">نسبة الإنجاز</p>
        </div>
      </div>

      {/* Earned badges */}
      {earned.length > 0 && (
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border border-yellow-200 p-6">
          <h2 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            شاراتك المكتسبة
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {earned.map((e) => (
              <div key={e.id} className="bg-white rounded-xl p-4 text-center shadow-sm border border-yellow-100">
                <div className="text-3xl mb-2">{e.badge.icon}</div>
                <p className="font-semibold text-slate-900 text-sm">{e.badge.nameAr}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{e.badge.descriptionAr}</p>
                <p className="text-xs text-yellow-600 mt-2">
                  {new Date(e.earnedAt).toLocaleDateString("ar-BH")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All badges */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-bold text-slate-900 mb-4">جميع الشارات</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {allBadges.map((badge) => {
            const isEarned = earnedIds.has(badge.id);
            return (
              <div
                key={badge.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  isEarned
                    ? "bg-green-50 border-green-200"
                    : "bg-slate-50 border-slate-200 opacity-70"
                }`}
              >
                <div className={`text-3xl flex-shrink-0 ${isEarned ? "" : "grayscale"}`}>
                  {badge.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900">{badge.nameAr}</p>
                    {isEarned && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500">{badge.descriptionAr}</p>

                  {/* Criteria */}
                  {badge.criteria && Object.keys(badge.criteria).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(badge.criteria).map(([k, v]) => (
                        <span key={k} className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {allBadges.length === 0 && (
            <div className="col-span-2 text-center py-8 text-slate-400">
              <Award className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              لا توجد شارات بعد
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-slate-50 rounded-2xl border p-6">
        <h2 className="font-bold text-slate-900 mb-3">كيف تكسب المزيد من الشارات؟</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>اجمع 100 تقييم أو أكثر بمعدل 4.5 نجوم لتحصل على شارة "تاجر موثوق"</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>اشحن 90% من الطلبيات في أقل من 24 ساعة للحصول على شارة "شحن سريع"</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>أضف 10 منتجات جديدة في 30 يوماً لتحصل على شارة "وصول جديد"</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>حقق 1000 طلبية مكتملة لتحصل على شارة "بائع ذهبي"</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
