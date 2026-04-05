"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Plus, Play, Square, Eye, ShoppingBag, Copy, Check } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "مجدول", color: "bg-blue-100 text-blue-700" },
  LIVE: { label: "مباشر الآن", color: "bg-red-100 text-red-700" },
  ENDED: { label: "انتهى", color: "bg-gray-100 text-gray-600" },
};

type Platform = "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "CUSTOM";

const PLATFORMS: { value: Platform; label: string; color: string; hint: string }[] = [
  {
    value: "YOUTUBE",
    label: "YouTube Live",
    color: "border-red-400 bg-red-50 text-red-700",
    hint: "ابدأ البث من YouTube Studio وأضف رابط التضمين (embed URL) ليظهر في متجرك.",
  },
  {
    value: "TIKTOK",
    label: "TikTok Live",
    color: "border-gray-800 bg-gray-900 text-white",
    hint: "ابدأ البث من تطبيق TikTok وأضف رابط بثك المباشر.",
  },
  {
    value: "INSTAGRAM",
    label: "Instagram Live",
    color: "border-pink-400 bg-gradient-to-r from-purple-50 to-pink-50 text-pink-700",
    hint: "ابدأ البث من Instagram وشارك رابط ملفك الشخصي مع عملائك.",
  },
  {
    value: "CUSTOM",
    label: "RTMP مخصص",
    color: "border-indigo-400 bg-indigo-50 text-indigo-700",
    hint: "استخدم OBS أو أي برنامج بث مع رابط RTMP الخاص بمتجرك.",
  },
];

export default function LiveCommercePage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    scheduledAt: "",
    platform: "YOUTUBE" as Platform,
    embedUrl: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["live-streams", store?.id],
    queryFn: async () => {
      const res = await api.get(`/live/streams?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/live/streams", {
        storeId: store!.id,
        title: form.title,
        description: form.description || undefined,
        scheduledAt: form.scheduledAt || undefined,
        platform: form.platform,
        embedUrl: form.embedUrl || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-streams"] });
      setShowForm(false);
      setForm({ title: "", description: "", scheduledAt: "", platform: "YOUTUBE", embedUrl: "" });
    },
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/live/streams/${id}/start`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-streams"] }),
  });

  const endMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/live/streams/${id}/end`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-streams"] }),
  });

  const copyRtmp = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const streams = data?.streams || [];
  const liveStream = streams.find((s: any) => s.status === "LIVE");
  const selectedPlatformInfo = PLATFORMS.find((p) => p.value === form.platform)!;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="البث المباشر"
        subtitle="بيع منتجاتك مباشرة عبر TikTok أو YouTube أو Instagram"
        action={
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            جلسة بث جديدة
          </Button>
        }
      />

      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Active live banner */}
        {liveStream && (
          <Card className="p-5 bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <div>
                  <div className="font-bold text-red-800">{liveStream.title}</div>
                  <div className="flex items-center gap-4 text-sm text-red-600 mt-1">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{liveStream.viewerCount || 0} مشاهد</span>
                    <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{liveStream._count?.products || 0} منتج</span>
                    <span className="font-medium">{liveStream.platform}</span>
                  </div>
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => endMutation.mutate(liveStream.id)}>
                <Square className="w-4 h-4 mr-1" />
                إنهاء البث
              </Button>
            </div>

            {liveStream.platform === "CUSTOM" && liveStream.streamKey && (
              <div className="mt-3 bg-red-100 rounded-lg p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-red-600 mb-0.5">رابط RTMP للبث</div>
                  <code className="text-xs text-red-800 font-mono">rtmp://live.bazar.bh/live/{liveStream.streamKey}</code>
                </div>
                <button
                  onClick={() => copyRtmp(`rtmp://live.bazar.bh/live/${liveStream.streamKey}`)}
                  className="p-1.5 rounded hover:bg-red-200 text-red-600"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            {liveStream.embedUrl && (
              <div className="mt-3 aspect-video rounded-lg overflow-hidden bg-black">
                <iframe src={liveStream.embedUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
              </div>
            )}
          </Card>
        )}

        {/* Create form */}
        {showForm && (
          <Card className="p-5">
            <h3 className="font-semibold mb-4">إنشاء جلسة بث جديدة</h3>

            {/* Platform selector */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">اختر منصة البث</label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setForm((prev) => ({ ...prev, platform: p.value }))}
                    className={`p-3 rounded-xl border-2 text-sm font-semibold text-right transition-all ${
                      form.platform === p.value
                        ? `${p.color} border-2`
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg p-2">{selectedPlatformInfo.hint}</p>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="عنوان البث *"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
              <Input
                placeholder="وصف البث (اختياري)"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
              {(form.platform === "YOUTUBE" || form.platform === "TIKTOK") && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    رابط التضمين (Embed URL)
                  </label>
                  <Input
                    placeholder={
                      form.platform === "YOUTUBE"
                        ? "https://www.youtube.com/embed/XXXXX"
                        : "https://www.tiktok.com/embed/live/@username"
                    }
                    value={form.embedUrl}
                    onChange={(e) => setForm((p) => ({ ...p, embedUrl: e.target.value }))}
                    dir="ltr"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">موعد البث (اختياري)</label>
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.title || createMutation.isPending}
              >
                إنشاء
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </Card>
        )}

        {/* Streams list */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">جارٍ التحميل...</div>
        ) : (
          <div className="space-y-3">
            {streams.map((s: any) => {
              const st = STATUS_LABELS[s.status] || STATUS_LABELS.ENDED;
              const platform = PLATFORMS.find((p) => p.value === s.platform) ?? PLATFORMS[3];

              return (
                <Card key={s.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <Video className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <div className="font-semibold">{s.title}</div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span>{formatDate(s.createdAt)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${platform.color}`}>{platform.label}</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{s.viewerCount || 0}</span>
                          <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{s._count?.products || 0} منتج</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={st.color}>{st.label}</Badge>
                      {s.status === "SCHEDULED" && (
                        <Button
                          size="sm"
                          className="bg-red-500 hover:bg-red-600 text-white"
                          onClick={() => startMutation.mutate(s.id)}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          بدء البث
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && streams.length === 0 && (
          <div className="text-center py-12">
            <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">لم تبدأ أي جلسة بث مباشر بعد</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              أنشئ أول جلسة بث
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}

