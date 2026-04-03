"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle, Clock, AlertCircle, Camera } from "lucide-react";
import { formatDate } from "@/lib/utils";

const PLATFORMS = [
  { id: "SALLA",       name: "سلة",        icon: "🛒", color: "bg-green-500"  },
  { id: "ZID",         name: "زد",         icon: "🔷", color: "bg-blue-600"   },
  { id: "SHOPIFY",     name: "Shopify",    icon: "🟩", color: "bg-green-600"  },
  { id: "WOOCOMMERCE", name: "WooCommerce",icon: "🟣", color: "bg-purple-600" },
  { id: "CSV",         name: "ملف CSV",    icon: "📄", color: "bg-gray-600"   },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:    { label: "في الانتظار",     color: "bg-yellow-100 text-yellow-700" },
  PROCESSING: { label: "جارٍ الاستيراد", color: "bg-blue-100 text-blue-700"     },
  COMPLETED:  { label: "مكتمل",           color: "bg-green-100 text-green-700"   },
  FAILED:     { label: "فشل",             color: "bg-red-100 text-red-700"       },
  PARTIAL:    { label: "جزئي",            color: "bg-orange-100 text-orange-700" },
};

const DEMO_POSTS = [
  { id: "ig1", image: "https://placehold.co/400x400/f472b6/fff?text=Post+1", caption: "عطر فاخر جديد، رائحة زهر العود" },
  { id: "ig2", image: "https://placehold.co/400x400/818cf8/fff?text=Post+2", caption: "حقيبة جلد يدوية الصنع - إصدار محدود" },
  { id: "ig3", image: "https://placehold.co/400x400/34d399/fff?text=Post+3", caption: "منتج عضوي طبيعي 100%" },
  { id: "ig4", image: "https://placehold.co/400x400/fb923c/fff?text=Post+4", caption: "ساعة يد سويسرية أصلية" },
  { id: "ig5", image: "https://placehold.co/400x400/60a5fa/fff?text=Post+5", caption: "إكسسوار ذهبي فاخر" },
  { id: "ig6", image: "https://placehold.co/400x400/a78bfa/fff?text=Post+6", caption: "مجموعة عناية بالبشرة" },
];

export default function ImportPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ apiKey: "", shopUrl: "", consumerKey: "", consumerSecret: "" });

  // Instagram import state
  const [igStep, setIgStep] = useState<"idle" | "connect" | "posts" | "fill">("idle");
  const [igPost, setIgPost] = useState<{ id: string; image: string; caption: string } | null>(null);
  const [igForm, setIgForm] = useState({ nameAr: "", price: "", stock: "" });
  const [igError, setIgError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["import-jobs", store?.id],
    queryFn: async () => {
      const res = await api.get(`/import/jobs?storeId=${store!.id}`);
      return res.data as any;
    },
    enabled: !!store?.id,
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const body: any = { storeId: store!.id, source: selected };
      if (selected === "SHOPIFY") {
        body.shopifyDomain = credentials.shopUrl;
        body.shopifyToken = credentials.apiKey;
      } else if (selected === "WOOCOMMERCE") {
        body.wcUrl = credentials.shopUrl;
        body.wcConsumerKey = credentials.consumerKey;
        body.wcConsumerSecret = credentials.consumerSecret;
      } else if (selected === "SALLA" || selected === "ZID") {
        body.apiKey = credentials.apiKey;
      }
      await api.post("/import/start", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      setSelected(null);
      setCredentials({ apiKey: "", shopUrl: "", consumerKey: "", consumerSecret: "" });
    },
  });

  const igPublishMutation = useMutation({
    mutationFn: async () => {
      if (!igPost || !igForm.nameAr.trim() || !igForm.price) throw new Error("بيانات ناقصة");
      await api.post("/products", {
        storeId: store!.id,
        nameAr: igForm.nameAr,
        name: igForm.nameAr,
        description: igPost.caption,
        price: parseFloat(igForm.price),
        stock: parseInt(igForm.stock) || 0,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIgStep("idle");
      setIgPost(null);
      setIgForm({ nameAr: "", price: "", stock: "" });
      setIgError("");
    },
    onError: (e: any) => setIgError(e?.response?.data?.message ?? "حدث خطأ"),
  });

  const jobs = data?.jobs || [];
  const activeJob = jobs.find((j: any) => j.status === "PROCESSING");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="استيراد المنتجات" subtitle="نقل منتجاتك من منصتك القديمة بكل سهولة" />

      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Instagram Import Section */}
        <div className="rounded-2xl border-2 border-dashed border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shrink-0">
              <Camera className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800">استيراد من انستقرام</h3>
              <p className="text-xs text-slate-500">حول بوسطاتك مباشرة لمنتجات في متجرك</p>
            </div>
            {igStep === "idle" && (
              <Button
                size="sm"
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white border-0 shrink-0"
                onClick={() => setIgStep("connect")}
              >
                ربط الحساب
              </Button>
            )}
            {igStep !== "idle" && (
              <button
                onClick={() => { setIgStep("idle"); setIgPost(null); }}
                className="text-xs text-slate-500 hover:text-slate-700 shrink-0"
              >
                إغلاق
              </button>
            )}
          </div>

          {igStep === "connect" && (
            <div className="text-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-white border-2 border-pink-200 flex items-center justify-center mx-auto">
                <Camera className="h-8 w-8 text-pink-500" />
              </div>
              <div>
                <p className="font-medium text-slate-800">تسجيل الدخول بانستقرام</p>
                <p className="text-xs text-slate-500 mt-1">سيتم فتح نافذة تسجيل الدخول بحسابك — بازار لن يرى كلمة المرور</p>
              </div>
              <Button
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white border-0 hover:from-pink-600 hover:to-purple-700"
                onClick={() => setIgStep("posts")}
              >
                تسجيل الدخول بانستقرام (OAuth)
              </Button>
              <p className="text-[10px] text-slate-400">عرض تجريبي — الإصدار النهائي يستخدم Instagram Basic Display API</p>
            </div>
          )}

          {igStep === "posts" && !igPost && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">اختر البوست الذي تريد تحويله لمنتج:</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {DEMO_POSTS.map(post => (
                  <button
                    key={post.id}
                    onClick={() => {
                      setIgPost(post);
                      setIgStep("fill");
                      setIgForm({ nameAr: post.caption.split("،")[0].trim(), price: "", stock: "" });
                    }}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-pink-400 transition group"
                  >
                    <img src={post.image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="text-white text-xs font-bold">اختيار</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {igStep === "fill" && igPost && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="aspect-square rounded-xl overflow-hidden">
                <img src={igPost.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-500 line-clamp-3">{igPost.caption}</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">اسم المنتج (عربي)</label>
                  <input
                    type="text"
                    value={igForm.nameAr}
                    onChange={e => setIgForm(f => ({ ...f, nameAr: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">السعر (BHD)</label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={igForm.price}
                      onChange={e => setIgForm(f => ({ ...f, price: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">الكمية</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={igForm.stock}
                      onChange={e => setIgForm(f => ({ ...f, stock: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>
                {igError && <p className="text-xs text-red-600">{igError}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setIgPost(null); setIgStep("posts"); }}>
                    رجوع
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white border-0"
                    disabled={!igForm.nameAr.trim() || !igForm.price || igPublishMutation.isPending}
                    onClick={() => igPublishMutation.mutate()}
                  >
                    {igPublishMutation.isPending ? "جارٍ النشر..." : "نشر في المتجر"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Active job banner */}
        {activeJob && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <div className="font-medium text-blue-800">جارٍ استيراد المنتجات من {activeJob.source}</div>
                <div className="text-sm text-blue-600">
                  {activeJob.processedCount || 0} / {activeJob.totalCount || "?"} منتج
                </div>
              </div>
              <div className="mr-auto">
                <div className="w-32 bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: activeJob.totalCount ? `${(activeJob.processedCount / activeJob.totalCount) * 100}%` : "30%" }}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Platform Selection */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">اختر المنصة للاستيراد منها</h3>
          <div className="grid grid-cols-5 gap-3">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(selected === p.id ? null : p.id)}
                className={`rounded-xl border-2 p-4 text-center transition-all ${selected === p.id ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="text-2xl mb-1">{p.icon}</div>
                <div className="text-xs font-medium">{p.name}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* Credentials Form */}
        {selected && selected !== "CSV" && (
          <Card className="p-5">
            <h3 className="font-semibold mb-4">بيانات الاتصال — {PLATFORMS.find(p => p.id === selected)?.name}</h3>
            <div className="space-y-3">
              {(selected === "SALLA" || selected === "ZID") && (
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  dir="ltr"
                  placeholder="API Key"
                  value={credentials.apiKey}
                  onChange={e => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              )}
              {selected === "SHOPIFY" && (
                <>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" placeholder="mystore.myshopify.com" value={credentials.shopUrl} onChange={e => setCredentials(prev => ({ ...prev, shopUrl: e.target.value }))} />
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" placeholder="Admin API Access Token" value={credentials.apiKey} onChange={e => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))} />
                </>
              )}
              {selected === "WOOCOMMERCE" && (
                <>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" placeholder="https://yourstore.com" value={credentials.shopUrl} onChange={e => setCredentials(prev => ({ ...prev, shopUrl: e.target.value }))} />
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" placeholder="Consumer Key" value={credentials.consumerKey} onChange={e => setCredentials(prev => ({ ...prev, consumerKey: e.target.value }))} />
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" placeholder="Consumer Secret" value={credentials.consumerSecret} onChange={e => setCredentials(prev => ({ ...prev, consumerSecret: e.target.value }))} />
                </>
              )}
            </div>
            <Button className="mt-4" onClick={() => startMutation.mutate()} disabled={startMutation.isPending || !!activeJob}>
              <Download className="w-4 h-4 mr-2" />
              {startMutation.isPending ? "جارٍ البدء..." : "بدء الاستيراد"}
            </Button>
          </Card>
        )}

        {/* Import History */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b font-semibold">سجل الاستيراد</div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">لا يوجد سجل استيراد</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-right">المنصة</th>
                  <th className="p-3 text-right">المنتجات</th>
                  <th className="p-3 text-right">الأخطاء</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j: any) => {
                  const s = STATUS_LABELS[j.status] || STATUS_LABELS.PENDING;
                  return (
                    <tr key={j.id} className="border-t">
                      <td className="p-3 font-medium">{PLATFORMS.find(p => p.id === j.source)?.name || j.source}</td>
                      <td className="p-3">{j.importedCount || 0} / {j.totalCount || "?"}</td>
                      <td className="p-3 text-red-500">{j.errorCount || 0}</td>
                      <td className="p-3"><Badge className={s.color}>{s.label}</Badge></td>
                      <td className="p-3 text-gray-500">{formatDate(j.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

      </div>
    </div>
  );
}
