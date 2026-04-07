"use client";

import { ChangeEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, Eye, FileSpreadsheet, Rocket, UploadCloud, Wand2 } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

const PLATFORMS = [
  { id: "SALLA", name: "سلة", icon: "🛒" },
  { id: "ZID", name: "زد", icon: "🔷" },
  { id: "SHOPIFY", name: "Shopify", icon: "🟩" },
  { id: "WOOCOMMERCE", name: "WooCommerce", icon: "🟣" },
] as const;

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "success" | "warning" | "error" | "info" | "brand" | "purple" }> = {
  PENDING: { label: "في الانتظار", variant: "warning" },
  PROCESSING: { label: "جارٍ الاستيراد", variant: "info" },
  RUNNING: { label: "جارٍ الاستيراد", variant: "info" },
  COMPLETED: { label: "مكتمل", variant: "success" },
  DONE: { label: "مكتمل", variant: "success" },
  FAILED: { label: "فشل", variant: "error" },
  PARTIAL: { label: "جزئي", variant: "warning" },
};

type ImportJob = {
  id: string;
  source: string;
  status: string;
  imported: number;
  failed: number;
  totalItems: number;
  createdAt: string;
  apiConfig?: Record<string, unknown>;
};

type PreviewSummary = {
  totalRows: number;
  blockedRows: number;
  warningRows?: number;
  validRows?: number;
  variantRowCount?: number;
};

type PreviewRow = {
  index: number;
  severity?: string;
  issues: Array<{ field: string; message: string; severity: string }>;
  normalized: { title?: string | null; sku?: string | null; price?: number | null; stock?: number | null; category?: string | null };
};

type PreviewArtifact = {
  fileName: string;
  fileKind: string;
  warnings: string[];
  summary: PreviewSummary;
  mapping: Array<{ field: string; header?: string | null; sourceHeader?: string | null; confidence: number; source: string }>;
  rows: PreviewRow[];
};

type ImportReport = {
  importedProducts: number;
  skippedRows: number;
};

type ImportRemediation = {
  summary: {
    blockedRows: number;
    warningRows: number;
    skippedRows: number;
    missingImageCount: number;
    duplicateSkuCount: number;
  };
  actions: Array<{
    key: string;
    priority: "critical" | "high" | "medium";
    label: string;
    reason: string;
    cta: string;
    count?: number;
  }>;
  queue: Array<{
    rowIndex: number;
    severity: "blocked" | "warning";
    title: string;
    sku?: string;
    issues: string[];
    suggestedAction: string;
  }>;
};

type PreviewResponse = {
  job: ImportJob;
  preview: PreviewArtifact;
  report?: ImportReport;
};

type RemediationResponse = {
  jobId: string;
  remediation: ImportRemediation;
};

type PlatformImportBody = {
  storeId: string | undefined;
  source: string | null;
  apiConfig?: {
    accessToken?: string;
    storeUrl?: string;
    apiKey?: string;
    apiSecret?: string;
  };
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: unknown } }).response?.data &&
    typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error === "string"
  ) {
    return (error as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const payload = value.includes(",") ? value.split(",")[1] : value;
      resolve(payload);
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export default function ImportPage() {
  const { store } = useAuthStore();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [credentials, setCredentials] = useState({ apiKey: "", shopUrl: "", consumerKey: "", consumerSecret: "" });

  const jobsQuery = useQuery({
    queryKey: ["import-jobs", store?.id],
    queryFn: async () => {
      const res = await api.get(`/import/jobs?storeId=${store?.id}`);
      return res.data as { jobs: ImportJob[] };
    },
    enabled: !!store?.id,
    refetchInterval: 5000,
  });

  const previewQuery = useQuery({
    queryKey: ["import-preview", selectedJobId],
    queryFn: async () => {
      const res = await api.get(`/import/jobs/${selectedJobId}/preview`);
      return res.data as PreviewResponse;
    },
    enabled: !!selectedJobId,
  });

  const remediationQuery = useQuery({
    queryKey: ["import-remediation", selectedJobId],
    queryFn: async () => {
      const res = await api.get(`/import/jobs/${selectedJobId}/remediation`);
      return res.data as RemediationResponse;
    },
    enabled: !!selectedJobId,
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await toBase64(file);
      const res = await api.post("/import/preview", {
        storeId: store?.id,
        fileName: file.name,
        fileContent: base64,
        encoding: "base64",
      });
      return res.data as PreviewResponse;
    },
    onSuccess: (data) => {
      setSelectedJobId(data.job.id);
      setFileName(data.preview.fileName);
      queryClient.invalidateQueries({ queryKey: ["import-jobs", store?.id] });
      showToast("تم إنشاء معاينة الملف بنجاح", "success");
    },
    onError: (error: unknown) => {
      showToast(getApiErrorMessage(error, "تعذر توليد معاينة الملف"), "error");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await api.post(`/import/jobs/${jobId}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-jobs", store?.id] });
      previewQuery.refetch();
      remediationQuery.refetch();
      showToast("تم اعتماد المعاينة وبدأ التنفيذ", "success");
    },
    onError: (error: unknown) => {
      showToast(getApiErrorMessage(error, "تعذر اعتماد المعاينة"), "error");
    },
  });

  const startPlatformMutation = useMutation({
    mutationFn: async () => {
      const body: PlatformImportBody = { storeId: store?.id, source: selectedPlatform };
      if (selectedPlatform === "SHOPIFY") {
        body.apiConfig = { storeUrl: credentials.shopUrl, accessToken: credentials.apiKey };
      } else if (selectedPlatform === "WOOCOMMERCE") {
        body.apiConfig = { storeUrl: credentials.shopUrl, apiKey: credentials.consumerKey, apiSecret: credentials.consumerSecret };
      } else if (selectedPlatform === "SALLA" || selectedPlatform === "ZID") {
        body.apiConfig = { accessToken: credentials.apiKey };
      }
      await api.post("/import/start", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-jobs", store?.id] });
      showToast("تم بدء الاستيراد من المنصة الخارجية", "success");
      setSelectedPlatform(null);
      setCredentials({ apiKey: "", shopUrl: "", consumerKey: "", consumerSecret: "" });
    },
    onError: (error: unknown) => {
      showToast(getApiErrorMessage(error, "تعذر بدء الاستيراد"), "error");
    },
  });

  const jobs = jobsQuery.data?.jobs ?? [];
  const activeJob = jobs.find((job) => job.status === "PENDING" || job.status === "PROCESSING" || job.status === "RUNNING");
  const readyRowCount = previewQuery.data ? previewQuery.data.preview.summary.totalRows - previewQuery.data.preview.summary.blockedRows : 0;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    await uploadMutation.mutateAsync(file);
    event.target.value = "";
  };

  if (!store) {
    return <div className="p-8 text-slate-500">جاري تحميل بيانات المتجر...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="مركز الاستيراد الذكي" subtitle="Preview قبل الكتابة، واعتماد صريح قبل التنفيذ، ثم تقرير نهائي على نفس المهمة." />

      <div className="mx-auto max-w-7xl space-y-6 p-6" dir="rtl">
        {activeJob && (
          <Card className="border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <div className="font-medium text-blue-900">مهمة نشطة: {activeJob.source}</div>
                  <div className="text-sm text-blue-700">
                    {(activeJob.imported || 0) + (activeJob.failed || 0)} / {activeJob.totalItems || "?"} صف
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedJobId(activeJob.id)} icon={<Eye />}>
                عرض التفاصيل
              </Button>
            </div>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">CSV / Excel مع معاينة ذكية</div>
                    <div className="text-sm text-slate-500">ارفع الملف، راجع المطابقة والتنبيهات، ثم اعتمد التنفيذ.</div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-[linear-gradient(180deg,_#ffffff_0%,_#eef2ff_100%)] px-6 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40">
                  <UploadCloud className="mb-4 h-8 w-8 text-indigo-600" />
                  <div className="text-base font-medium text-slate-900">ارفع ملف CSV أو XLSX</div>
                  <div className="mt-2 text-sm text-slate-500">ندعم المعاينة الذكية، كشف الصفوف المحجوبة، وقراءة الأعمدة الشائعة تلقائياً.</div>
                  <div className="mt-4 rounded-full bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
                    {fileName || "لم يتم اختيار ملف بعد"}
                  </div>
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
                </label>
                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <Badge variant="brand">Preview</Badge>
                  <Badge variant="info">Mapping ذكي</Badge>
                  <Badge variant="warning">Blocked rows قبل التنفيذ</Badge>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">استيراد من منصة خارجية</div>
                  <div className="text-sm text-slate-500">هذا المسار يبقى مناسباً للنقل المباشر من سلة أو زد أو Shopify أو WooCommerce.</div>
                </div>
                <Badge variant="info">Direct Sync</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => setSelectedPlatform((current) => (current === platform.id ? null : platform.id))}
                    className={`rounded-2xl border p-4 text-center transition ${
                      selectedPlatform === platform.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="mb-2 text-2xl">{platform.icon}</div>
                    <div className="text-sm font-medium text-slate-800">{platform.name}</div>
                  </button>
                ))}
              </div>

              {selectedPlatform && (
                <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {(selectedPlatform === "SALLA" || selectedPlatform === "ZID") && (
                    <Input
                      dir="ltr"
                      label="Access Token"
                      value={credentials.apiKey}
                      onChange={(event) => setCredentials((current) => ({ ...current, apiKey: event.target.value }))}
                    />
                  )}
                  {selectedPlatform === "SHOPIFY" && (
                    <>
                      <Input dir="ltr" label="Shop URL" value={credentials.shopUrl} onChange={(event) => setCredentials((current) => ({ ...current, shopUrl: event.target.value }))} />
                      <Input dir="ltr" label="Admin API Access Token" value={credentials.apiKey} onChange={(event) => setCredentials((current) => ({ ...current, apiKey: event.target.value }))} />
                    </>
                  )}
                  {selectedPlatform === "WOOCOMMERCE" && (
                    <>
                      <Input dir="ltr" label="Store URL" value={credentials.shopUrl} onChange={(event) => setCredentials((current) => ({ ...current, shopUrl: event.target.value }))} />
                      <Input dir="ltr" label="Consumer Key" value={credentials.consumerKey} onChange={(event) => setCredentials((current) => ({ ...current, consumerKey: event.target.value }))} />
                      <Input dir="ltr" label="Consumer Secret" value={credentials.consumerSecret} onChange={(event) => setCredentials((current) => ({ ...current, consumerSecret: event.target.value }))} />
                    </>
                  )}

                  <Button loading={startPlatformMutation.isPending} onClick={() => startPlatformMutation.mutate()} icon={<Rocket />}>
                    بدء الاستيراد
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">لوحة المعاينة</div>
                  <div className="text-sm text-slate-500">راجع الصفوف والتنبيهات قبل الاعتماد النهائي.</div>
                </div>
                {previewQuery.data?.job && (
                  <Button
                    variant="success"
                    size="sm"
                    loading={approveMutation.isPending}
                    disabled={previewQuery.data.job.status === "RUNNING" || previewQuery.data.job.status === "DONE"}
                    onClick={() => approveMutation.mutate(previewQuery.data!.job.id)}
                    icon={<CheckCircle2 />}
                  >
                    اعتماد التنفيذ
                  </Button>
                )}
              </div>

              {!selectedJobId ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  اختر مهمة من السجل أو ارفع ملفاً لتظهر المعاينة هنا.
                </div>
              ) : previewQuery.isLoading ? (
                <div className="p-6 text-sm text-slate-500">جاري تحميل تفاصيل المعاينة...</div>
              ) : previewQuery.data?.preview ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="brand">{previewQuery.data.preview.fileKind}</Badge>
                    <Badge variant="info">{previewQuery.data.preview.summary.totalRows} صف</Badge>
                    <Badge variant="success">{readyRowCount} قابل للمراجعة</Badge>
                    <Badge variant="error">{previewQuery.data.preview.summary.blockedRows} محجوب</Badge>
                  </div>

                  {previewQuery.data.preview.warnings.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-2 flex items-center gap-2 font-medium text-amber-900">
                        <AlertCircle className="h-4 w-4" />
                        تنبيهات المعاينة
                      </div>
                      <div className="space-y-2 text-sm text-amber-800">
                        {previewQuery.data.preview.warnings.map((warning) => (
                          <div key={warning}>{warning}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium text-slate-900">
                      <Wand2 className="h-4 w-4 text-indigo-600" />
                      المطابقة المقترحة للأعمدة
                    </div>
                    <div className="space-y-2 text-sm">
                      {previewQuery.data.preview.mapping.map((mapping) => (
                        <div key={mapping.field} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <span className="font-medium text-slate-700">{mapping.field}</span>
                          <span className="text-slate-500">{mapping.sourceHeader || "غير مرتبط"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 font-medium text-slate-900">عينات من الصفوف</div>
                    <div className="space-y-2">
                      {previewQuery.data.preview.rows.slice(0, 6).map((row) => (
                        <div key={row.index} className="rounded-2xl bg-slate-50 p-3 text-sm">
                          {(() => {
                            const isBlocked = row.severity === "blocked";
                            return (
                              <>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-slate-800">صف #{row.index}</span>
                            <Badge variant={isBlocked ? "error" : "success"}>{isBlocked ? "محجوب" : "قابل للمراجعة"}</Badge>
                          </div>
                          <div className="text-slate-600">{row.normalized.title || "بدون عنوان"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            SKU: {row.normalized.sku || "-"} | السعر: {row.normalized.price ?? "-"} | المخزون: {row.normalized.stock ?? "-"}
                          </div>
                          {row.issues.length > 0 && <div className="mt-2 text-xs text-red-600">{row.issues.map((issue) => issue.message).join(" | ")}</div>}
                              </>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>

                  {previewQuery.data.report && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      تم التنفيذ: {previewQuery.data.report.importedProducts} منتج، {previewQuery.data.report.skippedRows} صف متجاوز.
                    </div>
                  )}

                  {remediationQuery.data?.remediation && (
                    <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-900">قائمة الإصلاحات المقترحة</div>
                        <Badge variant="warning">{remediationQuery.data.remediation.actions.length} إجراءات</Badge>
                      </div>

                      <div className="grid gap-3">
                        {remediationQuery.data.remediation.actions.map((action) => (
                          <div key={action.key} className="rounded-2xl bg-slate-50 p-3">
                            <div className="mb-1 flex items-center justify-between">
                              <div className="font-medium text-slate-800">{action.label}</div>
                              <Badge variant={action.priority === "critical" ? "error" : action.priority === "high" ? "warning" : "info"}>
                                {action.priority}
                              </Badge>
                            </div>
                            <div className="text-sm text-slate-600">{action.reason}</div>
                            <div className="mt-2 text-xs text-slate-500">{action.cta}{action.count ? ` (${action.count})` : ""}</div>
                          </div>
                        ))}
                      </div>

                      {remediationQuery.data.remediation.queue.length > 0 && (
                        <div className="rounded-2xl bg-amber-50 p-4">
                          <div className="mb-3 font-medium text-amber-900">الصفوف التي تحتاج متابعة</div>
                          <div className="space-y-2">
                            {remediationQuery.data.remediation.queue.slice(0, 6).map((item) => (
                              <div key={`${item.rowIndex}-${item.title}`} className="rounded-xl bg-white p-3 text-sm">
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="font-medium text-slate-800">صف #{item.rowIndex} - {item.title}</span>
                                  <Badge variant={item.severity === "blocked" ? "error" : "warning"}>{item.severity}</Badge>
                                </div>
                                <div className="text-slate-600">{item.issues.join(" | ")}</div>
                                <div className="mt-1 text-xs text-slate-500">{item.suggestedAction}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  هذه المهمة ليست معاينة ملف أو لم يعد artifact متاحاً.
                </div>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 p-4 font-semibold text-slate-900">سجل مهام الاستيراد</div>
              {jobsQuery.isLoading ? (
                <div className="p-8 text-center text-slate-500">جاري تحميل السجل...</div>
              ) : jobs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">لا توجد مهام استيراد بعد.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {jobs.map((job) => {
                    const status = STATUS_LABELS[job.status] || STATUS_LABELS.PENDING;
                    return (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className="flex w-full items-center gap-4 px-4 py-4 text-right transition hover:bg-slate-50"
                      >
                        <div className="min-w-[68px]">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{job.apiConfig?.mode === "preview" ? "ملف مرفوع" : job.source}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {job.imported || 0} ناجح / {job.failed || 0} فشل / {job.totalItems || 0} إجمالي
                          </div>
                        </div>
                        <div className="text-xs text-slate-400">{formatDate(job.createdAt)}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="border-pink-200 bg-pink-50 p-5">
              <div className="mb-2 flex items-center gap-2 font-semibold text-pink-900">
                <AlertCircle className="h-4 w-4" />
                Instagram Import غير مفعل بعد
              </div>
              <div className="text-sm leading-6 text-pink-800">
                ما زال هذا المسار غير موصول بعقد backend حقيقي، لذلك أبقيته معطلاً صراحةً بدلاً من واجهة توحي بأنه يعمل.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
