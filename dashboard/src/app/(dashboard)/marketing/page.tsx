"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Megaphone, ExternalLink, Info } from "lucide-react";

interface Pixels {
  googleTagId: string | null;
  facebookPixelId: string | null;
  tiktokPixelId: string | null;
  snapchatPixelId: string | null;
  googleAdsId: string | null;
}

const PIXEL_FIELDS: { key: keyof Pixels; label: string; placeholder: string; helpText: string; docsUrl: string }[] = [
  { key: "googleTagId", label: "Google Tag Manager / Analytics (GTM)", placeholder: "GTM-XXXXXXX أو G-XXXXXXXXXX", helpText: "معرّف حاوية GTM أو معرّف GA4", docsUrl: "https://support.google.com/tagmanager/answer/6103696" },
  { key: "facebookPixelId", label: "Facebook / Meta Pixel", placeholder: "123456789012345", helpText: "معرّف بكسل ميتا من لوحة تحكم الأعمال", docsUrl: "https://www.facebook.com/business/help/952192354843755" },
  { key: "tiktokPixelId", label: "TikTok Pixel", placeholder: "XXXXXXXXXXXXXXXXXX", helpText: "معرّف بكسل تيك توك من TikTok Ads Manager", docsUrl: "https://ads.tiktok.com/help/article/get-started-pixel" },
  { key: "snapchatPixelId", label: "Snapchat Pixel", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", helpText: "معرّف بكسل سناب شات", docsUrl: "https://businesshelp.snapchat.com/s/article/pixel-setup" },
  { key: "googleAdsId", label: "Google Ads (Conversion Tracking)", placeholder: "AW-XXXXXXXXXX", helpText: "معرّف تتبع تحويلات إعلانات جوجل", docsUrl: "https://support.google.com/google-ads/answer/6095821" },
];

export default function MarketingPage() {
  const { store } = useAuthStore();
  const qc = useQueryClient();
  const [form, setForm] = useState<Pixels>({
    googleTagId: "", facebookPixelId: "", tiktokPixelId: "", snapchatPixelId: "", googleAdsId: "",
  });
  const [saved, setSaved] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["marketing-pixels", store?.id],
    queryFn: async () => {
      const res = await api.get(`/marketing/pixels?storeId=${store?.id}`);
      const px = res.data as Pixels;
      setForm({
        googleTagId: px.googleTagId ?? "",
        facebookPixelId: px.facebookPixelId ?? "",
        tiktokPixelId: px.tiktokPixelId ?? "",
        snapchatPixelId: px.snapchatPixelId ?? "",
        googleAdsId: px.googleAdsId ?? "",
      });
      return px;
    },
    enabled: !!store?.id,
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put("/marketing/pixels", { storeId: store?.id, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-pixels"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const activeCount = Object.values(form).filter(v => v && String(v).trim()).length;

  return (
    <div className="p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <Megaphone className="h-6 w-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">التسويق والبكسلات</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">أدخل معرّفات بكسلات التسويق لتتبع الزوار والتحويلات تلقائيًا في متجرك.</p>

      {/* Active Pixels Banner */}
      {activeCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 flex items-center gap-2">
          <span className="text-green-600 font-semibold text-sm">{activeCount} بكسل</span>
          <span className="text-green-700 text-sm">نشط ومفعّل في متجرك</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : (
        <div className="space-y-4">
          {PIXEL_FIELDS.map((field) => (
            <div key={field.key} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">{field.label}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {field.helpText}
                  </p>
                </div>
                <a href={field.docsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 shrink-0">
                  <ExternalLink className="h-3 w-3" />
                  كيفية الحصول عليه
                </a>
              </div>
              <div className="relative">
                <input
                  value={form[field.key] ?? ""}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-400 transition ${form[field.key] ? "border-green-300 bg-green-50" : ""}`}
                  dir="ltr"
                />
                {form[field.key] && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 text-xs">✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className={`px-8 py-2.5 rounded-lg text-sm font-medium transition ${saved ? "bg-green-50 text-green-700 border border-green-200" : "bg-indigo-600 text-white hover:bg-indigo-700"} disabled:opacity-50`}
        >
          {saveMutation.isPending ? "جاري الحفظ..." : saved ? "✓ تم الحفظ" : "حفظ البكسلات"}
        </button>
        <p className="text-xs text-gray-400">يتم تحديث البكسلات في المتجر فورًا بعد الحفظ</p>
      </div>
    </div>
  );
}
