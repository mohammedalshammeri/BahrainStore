"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Star, Download, Eye, CheckCircle, Search, X, Layers, Sparkles, Settings } from "lucide-react";
import { formatBHD } from "@/lib/utils";

const CATEGORIES = ["الكل", "أزياء", "إلكترونيات", "طعام", "صحة وجمال", "أثاث", "عام"];

export default function ThemeStorePage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "free" | "installed">("all");
  const [category, setCategory] = useState("الكل");
  const [preview, setPreview] = useState<any>(null);
  const [customizing, setCustomizing] = useState<any>(null);
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [fontFamily, setFontFamily] = useState("Tajawal");

  const { data, isLoading } = useQuery({
    queryKey: ["themes", search],
    queryFn: async () => {
      const res = await api.get(`/themes?search=${search}`);
      return res.data as any;
    },
  });

  const { data: purchasedData } = useQuery({
    queryKey: ["purchased-themes", store?.id],
    queryFn: async () => {
      const res = await api.get(`/themes/purchased?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (themeId: string) => {
      await api.post("/themes/purchase", { storeId: store!.id, themeId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchased-themes"] }),
  });

  const applyCustomMutation = useMutation({
    mutationFn: async (payload: { themeId: string; primaryColor: string; fontFamily: string }) => {
      await api.patch(`/themes/${payload.themeId}/customize`, {
        storeId: store!.id,
        primaryColor: payload.primaryColor,
        fontFamily: payload.fontFamily,
      });
    },
    onSuccess: () => { setCustomizing(null); queryClient.invalidateQueries({ queryKey: ["purchased-themes"] }); },
  });

  const allThemes: any[] = data?.themes || [];
  const purchasedIds = new Set((purchasedData?.themes || []).map((t: any) => t.themeId));
  const purchasedThemes: any[] = (purchasedData?.themes || []).map((t: any) => t.theme).filter(Boolean);

  const filtered = allThemes.filter((t) => {
    if (tab === "free" && !t.isFree) return false;
    if (tab === "installed" && !purchasedIds.has(t.id)) return false;
    if (category !== "الكل" && t.category !== category) return false;
    return true;
  });

  const displayList = tab === "installed" && filtered.length === 0 ? purchasedThemes : filtered;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header title="متجر القوالب" subtitle="اختر قالباً جميلاً لمتجرك" />

      <div className="p-6 space-y-5 max-w-7xl mx-auto w-full">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([["all", "جميع القوالب"], ["free", "مجانية"], ["installed", "مُثبَّتة"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {label}
              {key === "installed" && purchasedIds.size > 0 && (
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">{purchasedIds.size}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search + Category filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث عن قالب..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${category === cat ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : displayList.length === 0 ? (
          <div className="py-24 text-center">
            <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">لا توجد قوالب مطابقة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {displayList.map((theme: any) => {
              const isPurchased = purchasedIds.has(theme.id);
              return (
                <div key={theme.id} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all">
                  {/* Preview image */}
                  <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
                    {theme.previewImage ? (
                      <img src={theme.previewImage} alt={theme.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Palette className="w-10 h-10 text-slate-300" />
                      </div>
                    )}
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {theme.demoUrl && (
                        <button
                          onClick={() => setPreview(theme)}
                          className="rounded-xl bg-white text-slate-800 px-3 py-2 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          معاينة
                        </button>
                      )}
                    </div>
                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {isPurchased && <span className="rounded-md bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5">مُثبَّت</span>}
                      {theme.isFree && !isPurchased && <span className="rounded-md bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5">مجاني</span>}
                      {(theme.isNew || theme.isFeatured) && <span className="rounded-md bg-violet-500 text-white text-[10px] font-bold px-2 py-0.5">جديد</span>}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-slate-800 leading-tight">{theme.name}</h4>
                      <span className="shrink-0 font-bold text-indigo-600 text-sm">
                        {theme.isFree ? "مجاني" : formatBHD(Number(theme.price))}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mb-2">{theme.description}</p>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                      {theme.rating > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {Number(theme.rating).toFixed(1)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {theme.downloadCount || 0}
                      </span>
                      <span>{theme.category || "عام"}</span>
                    </div>

                    <div className="flex gap-2">
                      {isPurchased ? (
                        <>
                          <button
                            onClick={() => { setCustomizing(theme); setPrimaryColor("#6366f1"); setFontFamily("Tajawal"); }}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            تخصيص
                          </button>
                          <span className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 py-2 text-xs font-bold">
                            <CheckCircle className="h-3.5 w-3.5" />
                            مُثبَّت
                          </span>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                          disabled={purchaseMutation.isPending}
                          onClick={() => purchaseMutation.mutate(theme.id)}
                        >
                          <Sparkles className="h-3.5 w-3.5 ml-1" />
                          {theme.isFree ? "تثبيت مجاناً" : "شراء وتثبيت"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">معاينة: {preview.name}</h3>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[60vh]">
              {preview.demoUrl ? (
                <iframe src={preview.demoUrl} className="w-full h-full border-0" title={preview.name} sandbox="allow-scripts allow-same-origin" />
              ) : preview.previewImage ? (
                <img src={preview.previewImage} alt={preview.name} className="w-full h-full object-contain" />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">لا تتوفر معاينة</div>
              )}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
              <span className="text-sm font-bold text-indigo-600">{preview.isFree ? "مجاني" : formatBHD(Number(preview.price))}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreview(null)}>إغلاق</Button>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={purchasedIds.has(preview.id) || purchaseMutation.isPending}
                  onClick={() => { if (!purchasedIds.has(preview.id)) purchaseMutation.mutate(preview.id); setPreview(null); }}
                >
                  {purchasedIds.has(preview.id) ? "مُثبَّت بالفعل" : preview.isFree ? "تثبيت مجاناً" : "شراء وتثبيت"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customize drawer */}
      {customizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">تخصيص: {customizing.name}</h3>
              <button onClick={() => setCustomizing(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">اللون الأساسي</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-16 rounded-lg border border-slate-300 cursor-pointer" />
                  <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {/* Quick palette */}
                <div className="flex gap-2 mt-2">
                  {["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#1e293b"].map(c => (
                    <button key={c} onClick={() => setPrimaryColor(c)} className={`h-6 w-6 rounded-full border-2 transition ${primaryColor === c ? "border-slate-700 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">الخط</label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Tajawal">Tajawal (الافتراضي)</option>
                  <option value="Cairo">Cairo</option>
                  <option value="Almarai">Almarai</option>
                  <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
                  <option value="Noto Kufi Arabic">Noto Kufi Arabic</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setCustomizing(null)}>إلغاء</Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                loading={applyCustomMutation.isPending}
                onClick={() => applyCustomMutation.mutate({ themeId: customizing.id, primaryColor, fontFamily })}
              >
                تطبيق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
