"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Resolver } from "react-hook-form";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Save, CheckCircle, ShieldCheck, ShieldOff, QrCode, LayoutTemplate, Trash2, UserPlus, Send } from "lucide-react";
import type { StoreStaff } from "@/types";

const TEMPLATES = [
  { id: "default",  name: "الافتراضي",  description: "نظيف ومعاصر",      primaryColor: "#2563eb", secondaryColor: "#f97316", fontFamily: "Cairo"           },
  { id: "bold",     name: "جريء",       description: "قوي وعريض",         primaryColor: "#7c3aed", secondaryColor: "#fbbf24", fontFamily: "Readex Pro"      },
  { id: "elegant",  name: "أنيق",       description: "راقٍ وفاخر",        primaryColor: "#065f46", secondaryColor: "#d97706", fontFamily: "Tajawal"         },
  { id: "fresh",    name: "منعش",       description: "حيوي ومبهج",        primaryColor: "#0891b2", secondaryColor: "#ec4899", fontFamily: "Cairo"           },
  { id: "dark",     name: "داكن",       description: "أسود أنيق",         primaryColor: "#6366f1", secondaryColor: "#10b981", fontFamily: "Cairo"           },
  { id: "coastal",  name: "ساحلي",      description: "أزرق صافٍ",         primaryColor: "#0284c7", secondaryColor: "#06b6d4", fontFamily: "Cairo"           },
  { id: "minimal",  name: "مينيمال",    description: "بسيط ونظيف",        primaryColor: "#334155", secondaryColor: "#64748b", fontFamily: "Noto Sans Arabic" },
  { id: "luxury",   name: "فاخر",       description: "ذهبي راقٍ",         primaryColor: "#92400e", secondaryColor: "#d97706", fontFamily: "Tajawal"         },
  { id: "vibrant",  name: "نابض",       description: "ألوان زاهية",       primaryColor: "#db2777", secondaryColor: "#7c3aed", fontFamily: "Readex Pro"      },
  { id: "retro",    name: "كلاسيكي",    description: "تراثي دافئ",        primaryColor: "#b45309", secondaryColor: "#dc2626", fontFamily: "Tajawal"         },
  { id: "nature",   name: "طبيعي",      description: "أخضر هادئ",         primaryColor: "#15803d", secondaryColor: "#65a30d", fontFamily: "Cairo"           },
  { id: "tech",     name: "تقني",       description: "عصري رقمي",         primaryColor: "#1d4ed8", secondaryColor: "#06b6d4", fontFamily: "Readex Pro"      },
  { id: "bakery",   name: "مخبز",       description: "دافئ ولذيذ",        primaryColor: "#c2410c", secondaryColor: "#d97706", fontFamily: "Tajawal"         },
  { id: "fashion",  name: "أزياء",      description: "عصري وجذاب",        primaryColor: "#be185d", secondaryColor: "#9f1239", fontFamily: "Cairo"           },
  { id: "kids",     name: "أطفال",      description: "مرح وملون",         primaryColor: "#7c3aed", secondaryColor: "#ec4899", fontFamily: "Readex Pro"      },
] as const;

const schema = z.object({
  name: z.string().min(1, "اسم المتجر مطلوب"),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().default("BHD"),
  language: z.string().default("ar"),
  vatEnabled: z.boolean().default(false),
  vatNumber: z.string().optional(),
  vatRate: z.coerce.number().min(0).max(100).default(10),
  defaultShippingCost: z.coerce.number().min(0).default(0),
  freeShippingThreshold: z.coerce.number().optional(),
  allowCod: z.boolean().default(true),
  primaryColor: z.string().default("#2563eb"),
  secondaryColor: z.string().default("#f97316"),
  fontFamily: z.string().default("Cairo"),
  theme: z.string().default("default"),
});

type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const { store, setStore, merchant } = useAuthStore();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const [twoFASetup, setTwoFASetup] = useState<{ qrCode: string; secret: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAError, setTwoFAError] = useState("");
  const [twoFASuccess, setTwoFASuccess] = useState("");
  const twoFAEnabled = merchant?.twoFactorEnabled ?? false;

  const start2FASetup = async () => {
    setTwoFAError("");
    setTwoFALoading(true);
    try {
      const res = await api.post("/auth/2fa/setup");
      setTwoFASetup({ qrCode: res.data.qrCode, secret: res.data.secret });
      setTwoFACode("");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setTwoFAError(e.response?.data?.error ?? "حدث خطأ");
    } finally {
      setTwoFALoading(false);
    }
  };

  const confirm2FAEnable = async () => {
    if (!twoFACode.trim()) return;
    setTwoFAError("");
    setTwoFALoading(true);
    try {
      await api.post("/auth/2fa/enable", { code: twoFACode });
      const meRes = await api.get("/auth/me");
      useAuthStore.getState().setMerchant(meRes.data.merchant);
      setTwoFASetup(null);
      setTwoFACode("");
      setTwoFASuccess("تم تفعيل المصادقة الثنائية بنجاح");
      setTimeout(() => setTwoFASuccess(""), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setTwoFAError(e.response?.data?.error ?? "رمز التحقق غير صحيح");
    } finally {
      setTwoFALoading(false);
    }
  };

  const disable2FA = async () => {
    if (!twoFACode.trim()) return;
    setTwoFAError("");
    setTwoFALoading(true);
    try {
      await api.post("/auth/2fa/disable", { code: twoFACode });
      const meRes = await api.get("/auth/me");
      useAuthStore.getState().setMerchant(meRes.data.merchant);
      setTwoFACode("");
      setTwoFASuccess("تم تعطيل المصادقة الثنائية");
      setTimeout(() => setTwoFASuccess(""), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setTwoFAError(e.response?.data?.error ?? "رمز التحقق غير صحيح");
    } finally {
      setTwoFALoading(false);
    }
  };

  // ── Staff Management ──────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirst, setInviteFirst] = useState("");
  const [inviteLast, setInviteLast] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  const { data: staffList, refetch: refetchStaff } = useQuery<StoreStaff[]>({
    queryKey: ["staff", store?.id],
    queryFn: async () => {
      const res = await api.get(`/staff/${store!.id}`);
      return res.data;
    },
    enabled: !!store?.id,
  });

  const sendInvite = async () => {
    if (!inviteEmail || !inviteFirst) return;
    setInviteLoading(true);
    setInviteMsg("");
    try {
      await api.post(`/staff/${store!.id}/invite`, {
        email: inviteEmail,
        firstName: inviteFirst,
        lastName: inviteLast,
        role: inviteRole,
      });
      setInviteMsg("تم إرسال الدعوة بنجاح");
      setInviteEmail(""); setInviteFirst(""); setInviteLast("");
      refetchStaff();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setInviteMsg(e.response?.data?.error ?? "حدث خطأ");
    } finally {
      setInviteLoading(false);
      setTimeout(() => setInviteMsg(""), 4000);
    }
  };

  const removeStaff = async (staffId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا العضو؟")) return;
    try {
      await api.delete(`/staff/${store!.id}/${staffId}`);
      refetchStaff();
    } catch { /* ignore */ }
  };

  // ── WhatsApp Settings ─────────────────────────────────────────────────────
  const [waEnabled, setWaEnabled] = useState(false);
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [waSaving, setWaSaving] = useState(false);
  const [waMsg, setWaMsg] = useState("");

  // ── SMS Settings ──────────────────────────────────────────────────────────
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsSid, setSmsSid] = useState("");
  const [smsToken, setSmsToken] = useState("");
  const [smsFrom, setSmsFrom] = useState("");
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsMsg, setSmsMsg] = useState("");

  // ── Aramex Settings ───────────────────────────────────────────────────────
  const [aramexEnabled, setAramexEnabled] = useState(false);
  const [aramexUser, setAramexUser] = useState("");
  const [aramexPassword, setAramexPassword] = useState("");
  const [aramexAccount, setAramexAccount] = useState("");
  const [aramexPin, setAramexPin] = useState("");
  const [aramexSaving, setAramexSaving] = useState(false);
  const [aramexMsg, setAramexMsg] = useState("");

  // ── DHL Settings ──────────────────────────────────────────────────────────
  const [dhlEnabled, setDhlEnabled] = useState(false);
  const [dhlApiKey, setDhlApiKey] = useState("");
  const [dhlAccount, setDhlAccount] = useState("");
  const [dhlSaving, setDhlSaving] = useState(false);
  const [dhlMsg, setDhlMsg] = useState("");

  // ── Tabby / Tamara Settings ───────────────────────────────────────────────
  const [tabbyEnabled, setTabbyEnabled] = useState(false);
  const [tabbyPublicKey, setTabbyPublicKey] = useState("");
  const [tabbySecretKey, setTabbySecretKey] = useState("");
  const [tamaraEnabled, setTamaraEnabled] = useState(false);
  const [tamaraToken, setTamaraToken] = useState("");
  const [bnplSaving, setBnplSaving] = useState(false);
  const [bnplMsg, setBnplMsg] = useState("");

  // ── Apple Pay / Google Pay ────────────────────────────────────────────────
  const [applePayEnabled, setApplePayEnabled] = useState(false);
  const [applePayMerchantId, setApplePayMerchantId] = useState("");
  const [googlePayEnabled, setGooglePayEnabled] = useState(false);
  const [googlePayMerchantId, setGooglePayMerchantId] = useState("");
  const [apgSaving, setApgSaving] = useState(false);
  const [apgMsg, setApgMsg] = useState("");

  // ── Tap Payments ──────────────────────────────────────────────────────────
  const [tapEnabled, setTapEnabled] = useState(false);
  const [tapSecretKey, setTapSecretKey] = useState("");
  const [tapPublicKey, setTapPublicKey] = useState("");
  const [tapSaving, setTapSaving] = useState(false);
  const [tapMsg, setTapMsg] = useState("");

  // ── Moyasar ───────────────────────────────────────────────────────────────
  const [moyasarEnabled, setMoyasarEnabled] = useState(false);
  const [moyasarSecretKey, setMoyasarSecretKey] = useState("");
  const [moyasarPublicKey, setMoyasarPublicKey] = useState("");
  const [moyasarSaving, setMoyasarSaving] = useState(false);
  const [moyasarMsg, setMoyasarMsg] = useState("");

  // ── Benefit Pay ───────────────────────────────────────────────────────────
  const [benefitEnabled, setBenefitEnabled] = useState(false);
  const [benefitMerchantId, setBenefitMerchantId] = useState("");
  const [benefitApiKey, setBenefitApiKey] = useState("");
  const [benefitSaving, setBenefitSaving] = useState(false);
  const [benefitMsg, setBenefitMsg] = useState("");

  // ── Loyalty Program ──────────────────────────────────────────────────────
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyPointsPerBD, setLoyaltyPointsPerBD] = useState(10);
  const [loyaltyBDPerPoint, setLoyaltyBDPerPoint] = useState(0.01);
  const [loyaltyMinRedeem, setLoyaltyMinRedeem] = useState(100);
  const [loyaltyMaxRedeemPct, setLoyaltyMaxRedeemPct] = useState(20);
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [loyaltyMsg, setLoyaltyMsg] = useState("");

  useEffect(() => {
    if (store?.settings) {
      setWaEnabled(store.settings.whatsappEnabled ?? false);
      setWaPhoneId(store.settings.whatsappPhoneId ?? "");
      setWaToken(store.settings.whatsappToken ?? "");
      setSmsEnabled(store.settings.smsEnabled ?? false);
      setSmsSid(store.settings.smsTwilioSid ?? "");
      setSmsToken(store.settings.smsTwilioToken ?? "");
      setSmsFrom(store.settings.smsTwilioFrom ?? "");
      setAramexEnabled(store.settings.aramexEnabled ?? false);
      setAramexUser(store.settings.aramexUser ?? "");
      setAramexPassword(store.settings.aramexPassword ?? "");
      setAramexAccount(store.settings.aramexAccountNumber ?? "");
      setAramexPin(store.settings.aramexPinCode ?? "");
      setDhlEnabled(store.settings.dhlEnabled ?? false);
      setDhlApiKey(store.settings.dhlApiKey ?? "");
      setDhlAccount(store.settings.dhlAccountNumber ?? "");
      setTabbyEnabled(store.settings.tabbyEnabled ?? false);
      setTabbyPublicKey(store.settings.tabbyPublicKey ?? "");
      setTabbySecretKey(store.settings.tabbySecretKey ?? "");
      setTamaraEnabled(store.settings.tamaraEnabled ?? false);
      setTamaraToken(store.settings.tamaraToken ?? "");
      setApplePayEnabled(store.settings.applePayEnabled ?? false);
      setApplePayMerchantId(store.settings.applePayMerchantId ?? "");
      setGooglePayEnabled(store.settings.googlePayEnabled ?? false);
      setGooglePayMerchantId(store.settings.googlePayMerchantId ?? "");
      setTapEnabled((store.settings as any).tapEnabled ?? false);
      setTapSecretKey((store.settings as any).tapSecretKey ?? "");
      setTapPublicKey((store.settings as any).tapPublicKey ?? "");
      setMoyasarEnabled((store.settings as any).moyasarEnabled ?? false);
      setMoyasarSecretKey((store.settings as any).moyasarSecretKey ?? "");
      setMoyasarPublicKey((store.settings as any).moyasarPublicKey ?? "");
      setBenefitEnabled((store.settings as any).benefitEnabled ?? false);
      setBenefitMerchantId((store.settings as any).benefitMerchantId ?? "");
      setBenefitApiKey((store.settings as any).benefitApiKey ?? "");
      setLoyaltyEnabled((store.settings as any).loyaltyEnabled ?? false);
      setLoyaltyPointsPerBD((store.settings as any).loyaltyPointsPerBD ?? 10);
      setLoyaltyBDPerPoint(Number((store.settings as any).loyaltyBDPerPoint ?? 0.01));
      setLoyaltyMinRedeem((store.settings as any).loyaltyMinRedeem ?? 100);
      setLoyaltyMaxRedeemPct((store.settings as any).loyaltyMaxRedeemPct ?? 20);
    }
  }, [store]);

  const saveWhatsApp = async () => {
    setWaSaving(true);
    setWaMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        whatsappEnabled: waEnabled,
        whatsappPhoneId: waPhoneId,
        whatsappToken: waToken,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setWaMsg("تم الحفظ بنجاح");
    } catch {
      setWaMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setWaSaving(false);
      setTimeout(() => setWaMsg(""), 3000);
    }
  };

  const saveSms = async () => {
    setSmsSaving(true);
    setSmsMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        smsEnabled,
        smsTwilioSid: smsSid,
        smsTwilioToken: smsToken,
        smsTwilioFrom: smsFrom,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setSmsMsg("تم الحفظ بنجاح");
    } catch {
      setSmsMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setSmsSaving(false);
      setTimeout(() => setSmsMsg(""), 3000);
    }
  };

  const saveAramex = async () => {
    setAramexSaving(true);
    setAramexMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        aramexEnabled,
        aramexUser,
        aramexPassword,
        aramexAccountNumber: aramexAccount,
        aramexPinCode: aramexPin,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setAramexMsg("تم الحفظ بنجاح");
    } catch {
      setAramexMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setAramexSaving(false);
      setTimeout(() => setAramexMsg(""), 3000);
    }
  };

  const saveDhl = async () => {
    setDhlSaving(true);
    setDhlMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        dhlEnabled,
        dhlApiKey,
        dhlAccountNumber: dhlAccount,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setDhlMsg("تم الحفظ بنجاح");
    } catch {
      setDhlMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setDhlSaving(false);
      setTimeout(() => setDhlMsg(""), 3000);
    }
  };

  const saveBnpl = async () => {
    setBnplSaving(true);
    setBnplMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        tabbyEnabled,
        tabbyPublicKey,
        tabbySecretKey,
        tamaraEnabled,
        tamaraToken,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setBnplMsg("تم الحفظ بنجاح");
    } catch {
      setBnplMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setBnplSaving(false);
      setTimeout(() => setBnplMsg(""), 3000);
    }
  };

  const saveApg = async () => {
    setApgSaving(true);
    setApgMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        applePayEnabled,
        applePayMerchantId,
        googlePayEnabled,
        googlePayMerchantId,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setApgMsg("تم الحفظ بنجاح");
    } catch {
      setApgMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setApgSaving(false);
      setTimeout(() => setApgMsg(""), 3000);
    }
  };

  const saveTap = async () => {
    setTapSaving(true);
    setTapMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        tapEnabled,
        tapSecretKey,
        tapPublicKey,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setTapMsg("تم الحفظ بنجاح");
    } catch {
      setTapMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setTapSaving(false);
      setTimeout(() => setTapMsg(""), 3000);
    }
  };

  const saveMoyasar = async () => {
    setMoyasarSaving(true);
    setMoyasarMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        moyasarEnabled,
        moyasarSecretKey,
        moyasarPublicKey,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setMoyasarMsg("تم الحفظ بنجاح");
    } catch {
      setMoyasarMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setMoyasarSaving(false);
      setTimeout(() => setMoyasarMsg(""), 3000);
    }
  };

  const saveBenefit = async () => {
    setBenefitSaving(true);
    setBenefitMsg("");
    try {
      await api.patch(`/stores/${store!.id}/settings`, {
        benefitEnabled,
        benefitMerchantId,
        benefitApiKey,
      });
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      setBenefitMsg("تم الحفظ بنجاح");
    } catch {
      setBenefitMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setBenefitSaving(false);
      setTimeout(() => setBenefitMsg(""), 3000);
    }
  };

  const saveLoyalty = async () => {
    setLoyaltySaving(true);
    setLoyaltyMsg("");
    try {
      await api.put(`/loyalty/config`, {
        storeId: store!.id,
        loyaltyEnabled,
        loyaltyPointsPerBD,
        loyaltyBDPerPoint,
        loyaltyMinRedeem,
        loyaltyMaxRedeemPct,
      });
      setLoyaltyMsg("تم حفظ إعدادات الولاء بنجاح");
    } catch {
      setLoyaltyMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setLoyaltySaving(false);
      setTimeout(() => setLoyaltyMsg(""), 3000);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) as Resolver<FormData> });

  const vatEnabled = watch("vatEnabled");
  const primaryColor = watch("primaryColor");
  const secondaryColor = watch("secondaryColor");
  const selectedTheme = watch("theme");

  useEffect(() => {
    if (store) {
      reset({
        name: store.name,
        nameAr: store.nameAr ?? "",
        description: store.description ?? "",
        currency: store.currency ?? "BHD",
        language: store.language ?? "ar",
        vatEnabled: store.settings?.vatEnabled ?? false,
        vatNumber: store.settings?.vatNumber ?? "",
        vatRate: store.settings?.vatRate ?? 10,
        defaultShippingCost: store.settings?.defaultShippingCost ?? 0,
        freeShippingThreshold: store.settings?.freeShippingThreshold ?? undefined,
        allowCod: store.settings?.allowCod ?? true,
        primaryColor: store.settings?.primaryColor ?? "#2563eb",
        secondaryColor: store.settings?.secondaryColor ?? "#f97316",
        fontFamily: store.settings?.fontFamily ?? "Cairo",
        theme: store.settings?.theme ?? "default",
      });
    }
  }, [store, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { vatEnabled, vatNumber, vatRate, defaultShippingCost, freeShippingThreshold, allowCod, primaryColor, secondaryColor, fontFamily, theme, ...storeData } = data;
      await api.patch(`/stores/${store!.id}`, storeData);
      await api.patch(`/stores/${store!.id}/settings`, {
        vatEnabled, vatNumber, vatRate, defaultShippingCost, freeShippingThreshold, allowCod, primaryColor, secondaryColor, fontFamily, theme,
      });
    },
    onSuccess: async () => {
      const res = await api.get(`/stores/${store!.id}`);
      setStore(res.data);
      queryClient.invalidateQueries({ queryKey: ["store"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const TABS = [
    { id: "general",       label: "المعلومات الأساسية" },
    { id: "appearance",    label: "المظهر والقالب"     },
    { id: "tax",           label: "الضريبة والشحن"     },
    { id: "payments",      label: "بوابات الدفع"       },
    { id: "couriers",      label: "شركات الشحن"        },
    { id: "notifications", label: "الإشعارات"          },
    { id: "security",      label: "الأمان والفريق"     },
    { id: "loyalty",       label: "برنامج الولاء"      },
  ];
  const [activeTab, setActiveTab] = useState("general");
  const isFormTab = ["general", "appearance", "tax"].includes(activeTab);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="إعدادات المتجر" subtitle="تحكم في كل جانب من جوانب متجرك" />

      {/* ── Tab Navigation ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6">
        <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit((d) => updateMutation.mutate(d as FormData))}>
          <div className="space-y-6 max-w-3xl">

            {/* ── GENERAL TAB ── */}
            {activeTab === "general" && (
              <>
                <Card>
                  <CardHeader title="المعلومات الأساسية" />
                  <CardBody className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label="اسم المتجر (إنجليزي)" required error={errors.name?.message} {...register("name")} />
                      <Input label="اسم المتجر (عربي)" {...register("nameAr")} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">وصف المتجر</label>
                      <textarea rows={3} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition" {...register("description")} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">العملة</label>
                        <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition" {...register("currency")}>
                          <option value="BHD">BHD — دينار بحريني</option>
                          <option value="SAR">SAR — ريال سعودي</option>
                          <option value="USD">USD — دولار أمريكي</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">اللغة</label>
                        <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition" {...register("language")}>
                          <option value="ar">العربية</option>
                          <option value="en">English</option>
                          <option value="both">كلاهما</option>
                        </select>
                      </div>
                    </div>
                  </CardBody>
                </Card>

              </>
            )}

            {/* ── APPEARANCE TAB ── */}
            {activeTab === "appearance" && (
              <>
                <Card>
                  <CardHeader title="قالب المتجر" />
                  <input type="hidden" {...register("theme")} />
                  <CardBody className="space-y-4">
                    <div className="flex items-start gap-2">
                      <LayoutTemplate className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-slate-500">اختر قالباً لمتجرك. سيتم تطبيق الألوان والخط المقترح تلقائياً ويمكنك تعديلها لاحقاً.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setValue("theme", t.id, { shouldDirty: true });
                            setValue("primaryColor", t.primaryColor, { shouldDirty: true });
                            setValue("secondaryColor", t.secondaryColor, { shouldDirty: true });
                            setValue("fontFamily", t.fontFamily, { shouldDirty: true });
                          }}
                          className={`rounded-xl border-2 overflow-hidden text-right transition focus:outline-none ${
                            selectedTheme === t.id
                              ? "border-indigo-600 shadow-md ring-2 ring-indigo-200"
                              : "border-slate-200 hover:border-slate-400 hover:shadow-sm"
                          }`}
                        >
                          <div
                            className="h-14 w-full flex flex-col items-center justify-center gap-1.5"
                            style={{
                              background:
                                t.id === "dark" ? "linear-gradient(135deg, #0f0f1a, #1e1b4b)"
                                : t.id === "elegant" ? `linear-gradient(to bottom, ${t.primaryColor}25, ${t.primaryColor}08)`
                                : t.id === "fresh" ? `linear-gradient(135deg, ${t.primaryColor}55, ${t.secondaryColor}55)`
                                : `linear-gradient(135deg, ${t.primaryColor}, ${t.primaryColor}bb)`,
                            }}
                          >
                            <div className="h-1.5 rounded-full w-3/4" style={{ background: t.id === "elegant" ? t.primaryColor : "rgba(255,255,255,0.8)" }} />
                            <div className="h-1 rounded-full w-2/5" style={{ background: t.id === "elegant" ? t.primaryColor + "60" : "rgba(255,255,255,0.4)" }} />
                          </div>
                          <div className="bg-white px-2 pt-1.5 pb-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-700">{t.name}</span>
                              {selectedTheme === t.id && <CheckCircle className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="h-2.5 w-2.5 rounded-full border border-white shadow-sm" style={{ background: t.primaryColor }} />
                              <div className="h-2.5 w-2.5 rounded-full border border-white shadow-sm" style={{ background: t.secondaryColor }} />
                              <span className="text-[9px] text-slate-400 leading-none mr-0.5">{t.fontFamily}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="الألوان والخط" />
                  <CardBody className="space-y-5">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">اللون الرئيسي</label>
                        <div className="flex items-center gap-3">
                          <input type="color" className="h-10 w-16 cursor-pointer rounded-xl border border-slate-300 p-0.5" {...register("primaryColor")} />
                          <div className="flex-1 h-10 rounded-xl border border-slate-200 flex items-center justify-end px-3 text-xs font-mono text-white font-medium" style={{ backgroundColor: primaryColor ?? "#2563eb" }}>
                            {primaryColor ?? "#2563eb"}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">يُستخدم للأزرار والروابط في المتجر</p>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">اللون الثانوي</label>
                        <div className="flex items-center gap-3">
                          <input type="color" className="h-10 w-16 cursor-pointer rounded-xl border border-slate-300 p-0.5" {...register("secondaryColor")} />
                          <div className="flex-1 h-10 rounded-xl border border-slate-200 flex items-center justify-end px-3 text-xs font-mono text-white font-medium" style={{ backgroundColor: secondaryColor ?? "#f97316" }}>
                            {secondaryColor ?? "#f97316"}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">يُستخدم للعناصر الثانوية</p>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">الخط</label>
                      <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-64" {...register("fontFamily")}>
                        <option value="Cairo">Cairo</option>
                        <option value="Tajawal">Tajawal</option>
                        <option value="Noto Sans Arabic">Noto Sans Arabic</option>
                        <option value="Readex Pro">Readex Pro</option>
                      </select>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 flex items-center gap-1.5 border-b border-slate-200">
                        <Palette className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">معاينة</span>
                      </div>
                      <div className="p-5 flex items-center gap-4 flex-wrap">
                        <button type="button" className="px-5 py-2 rounded-full text-white text-sm font-semibold" style={{ backgroundColor: primaryColor ?? "#2563eb" }}>أضف إلى السلة</button>
                        <button type="button" className="px-5 py-2 rounded-full text-sm font-semibold border-2" style={{ borderColor: primaryColor ?? "#2563eb", color: primaryColor ?? "#2563eb" }}>عرض المنتج</button>
                        <span className="text-sm font-medium" style={{ color: secondaryColor ?? "#f97316" }}>عرض خاص</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </>
            )}

            {/* ── TAX & SHIPPING TAB ── */}
            {activeTab === "tax" && (
              <>
                <Card>
                  <CardHeader title="ضريبة القيمة المضافة (VAT)" />
                  <CardBody className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600" {...register("vatEnabled")} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">تفعيل ضريبة القيمة المضافة</p>
                        <p className="text-xs text-slate-500">سيتم إضافة الضريبة تلقائياً على الطلبات</p>
                      </div>
                    </label>
                    {vatEnabled && (
                      <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
                        <Input label="الرقم الضريبي (اختياري)" placeholder="BH123456789" {...register("vatNumber")} />
                        <Input label="نسبة الضريبة %" type="number" min="0" max="100" step="0.01" {...register("vatRate")} />
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="إعدادات الشحن الأساسية" />
                  <CardBody className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label="تكلفة الشحن الافتراضية (BHD)" type="number" min="0" step="0.001" {...register("defaultShippingCost")} />
                      <Input label="حد الشحن المجاني (BHD)" type="number" min="0" step="0.001" hint="فارغ = لا يوجد شحن مجاني" {...register("freeShippingThreshold")} />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600" {...register("allowCod")} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">السماح بالدفع عند الاستلام (COD)</p>
                        <p className="text-xs text-slate-500">يمكن للعملاء الدفع عند استلام الطلب</p>
                      </div>
                    </label>
                  </CardBody>
                </Card>
              </>
            )}

            {/* ── PAYMENTS TAB ── */}
            {activeTab === "payments" && (
              <>
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  تفعيل بوابة الدفع يتطلب سجلاً تجارياً أو وثيقة عمل حر. تواصل مع مزود البوابة مباشرة للحصول على مفاتيح API.
                </div>

                <Card>
                  <CardHeader title="BenefitPay" subtitle="خدمة الدفع الرسمية بالبحرين — الدفع المباشر من الحساب البنكي" />
                  <CardBody className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={benefitEnabled} onChange={(e) => setBenefitEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-red-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">تفعيل BenefitPay</p>
                        <p className="text-xs text-slate-500">تواصل مع بنكك للحصول على بيانات التكامل</p>
                      </div>
                    </label>
                    {benefitEnabled && (
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Merchant ID</label>
                          <input type="text" value={benefitMerchantId} onChange={(e) => setBenefitMerchantId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">API Key</label>
                          <input type="password" value={benefitApiKey} onChange={(e) => setBenefitApiKey(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveBenefit} loading={benefitSaving}><Save className="h-3.5 w-3.5" />حفظ</Button>
                      {benefitMsg && <span className={`text-sm ${benefitMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{benefitMsg}</span>}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Tap Payments" subtitle="KNET · Visa · Mastercard · Apple Pay · mada — الكويت والسعودية والبحرين والإمارات" />
                  <CardBody className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={tapEnabled} onChange={(e) => setTapEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">تفعيل Tap Payments</p>
                        <p className="text-xs text-slate-500">احصل على مفاتيحك من tap.company</p>
                      </div>
                    </label>
                    {tapEnabled && (
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Secret Key</label>
                          <input type="password" value={tapSecretKey} onChange={(e) => setTapSecretKey(e.target.value)} placeholder="sk_live_xxxxxxxxxxxxxxxxxxxx" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition" />
                          <p className="mt-1 text-xs text-slate-500">يُستخدم في الخادم فقط — لا تشاركه مع أحد</p>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Public Key</label>
                          <input type="text" value={tapPublicKey} onChange={(e) => setTapPublicKey(e.target.value)} placeholder="pk_live_xxxxxxxxxxxxxxxxxxxx" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition" />
                        </div>
                        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-700">
                          <strong>Webhook URL:</strong>
                          <span className="block font-mono mt-1 text-[11px] break-all">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/payment/tap/webhook</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveTap} loading={tapSaving}><Save className="h-3.5 w-3.5" />حفظ</Button>
                      {tapMsg && <span className={`text-sm ${tapMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{tapMsg}</span>}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Moyasar" subtitle="mada · Visa · Mastercard · Apple Pay · STC Pay — السعودية" />
                  <CardBody className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={moyasarEnabled} onChange={(e) => setMoyasarEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">تفعيل Moyasar</p>
                        <p className="text-xs text-slate-500">احصل على مفاتيحك من moyasar.com</p>
                      </div>
                    </label>
                    {moyasarEnabled && (
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Secret API Key</label>
                          <input type="password" value={moyasarSecretKey} onChange={(e) => setMoyasarSecretKey(e.target.value)} placeholder="sk_live_xxxxxxxxxxxxxxxxxxxx" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Publishable API Key</label>
                          <input type="text" value={moyasarPublicKey} onChange={(e) => setMoyasarPublicKey(e.target.value)} placeholder="pk_live_xxxxxxxxxxxxxxxxxxxx" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveMoyasar} loading={moyasarSaving}><Save className="h-3.5 w-3.5" />حفظ</Button>
                      {moyasarMsg && <span className={`text-sm ${moyasarMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{moyasarMsg}</span>}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="الدفع بالتقسيط" subtitle="Tabby و Tamara — ادفع لاحقاً أو على أقساط بدون فوائد" />
                  <CardBody className="space-y-6">
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={tabbyEnabled} onChange={(e) => setTabbyEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">تفعيل Tabby</p>
                          <p className="text-xs text-slate-500">ادفع بعد 14 يوم أو 4 أقساط بدون فوائد</p>
                        </div>
                      </label>
                      {tabbyEnabled && (
                        <div className="grid gap-3 sm:grid-cols-2 pr-7">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Public Key</label>
                            <input type="text" value={tabbyPublicKey} onChange={(e) => setTabbyPublicKey(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 transition" />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Secret Key</label>
                            <input type="password" value={tabbySecretKey} onChange={(e) => setTabbySecretKey(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 transition" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={tamaraEnabled} onChange={(e) => setTamaraEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">تفعيل Tamara</p>
                          <p className="text-xs text-slate-500">3 دفعات بدون فوائد</p>
                        </div>
                      </label>
                      {tamaraEnabled && (
                        <div className="pr-7">
                          <label className="mb-1 block text-sm font-medium text-slate-700">API Token</label>
                          <input type="password" value={tamaraToken} onChange={(e) => setTamaraToken(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveBnpl} loading={bnplSaving}><Save className="h-3.5 w-3.5" />حفظ التقسيط</Button>
                      {bnplMsg && <span className={`text-sm ${bnplMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{bnplMsg}</span>}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Apple Pay و Google Pay" subtitle="دفع سريع عبر بصمة الإصبع أو Face ID" />
                  <CardBody className="space-y-5">
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={applePayEnabled} onChange={(e) => setApplePayEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-gray-900" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">تفعيل Apple Pay</p>
                          <p className="text-xs text-slate-500">متاح على أجهزة Apple التي تدعم Face ID / Touch ID</p>
                        </div>
                      </label>
                      {applePayEnabled && (
                        <div className="pr-7">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Merchant ID</label>
                          <input type="text" value={applePayMerchantId} onChange={(e) => setApplePayMerchantId(e.target.value)} placeholder="merchant.com.yourstore" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={googlePayEnabled} onChange={(e) => setGooglePayEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">تفعيل Google Pay</p>
                          <p className="text-xs text-slate-500">متاح على أجهزة Android وChrome</p>
                        </div>
                      </label>
                      {googlePayEnabled && (
                        <div className="pr-7">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Merchant ID</label>
                          <input type="text" value={googlePayMerchantId} onChange={(e) => setGooglePayMerchantId(e.target.value)} placeholder="BCR2DN4XXXXXXXX" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveApg} loading={apgSaving}><Save className="h-3.5 w-3.5" />حفظ</Button>
                      {apgMsg && <span className={`text-sm ${apgMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{apgMsg}</span>}
                    </div>
                  </CardBody>
                </Card>
              </>
            )}

            {/* ── COURIERS TAB ── */}
            {activeTab === "couriers" && (
              <>
                <Card>
                  <CardHeader title="شحن Aramex" subtitle="إنشاء شحنات تلقائية وتتبعها مباشرة" />
                  <CardBody className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={aramexEnabled} onChange={(e) => setAramexEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">تفعيل شحن Aramex</p>
                        <p className="text-xs text-slate-500">إنشاء شحنات وعرض رقم التتبع في الطلبات</p>
                      </div>
                    </label>
                    {aramexEnabled && (
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
                            <input type="text" value={aramexUser} onChange={(e) => setAramexUser(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition" />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                            <input type="password" value={aramexPassword} onChange={(e) => setAramexPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition" />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Account Number</label>
                            <input type="text" value={aramexAccount} onChange={(e) => setAramexAccount(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition" />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">PIN Code</label>
                            <input type="password" value={aramexPin} onChange={(e) => setAramexPin(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveAramex} loading={aramexSaving}><Save className="h-3.5 w-3.5" />حفظ إعدادات Aramex</Button>
                      {aramexMsg && <span className={`text-sm ${aramexMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{aramexMsg}</span>}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="شحن DHL Express" subtitle="إنشاء شحنات دولية وطباعة ملصقات الشحن عبر myDHL+" />
                  <CardBody className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={dhlEnabled} onChange={(e) => setDhlEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">تفعيل شحن DHL</p>
                        <p className="text-xs text-slate-500">إنشاء شحنات DHL Express وطباعة ملصقات الشحن</p>
                      </div>
                    </label>
                    {dhlEnabled && (
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">API Key</label>
                          <input type="password" value={dhlApiKey} onChange={(e) => setDhlApiKey(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 transition" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Account Number</label>
                          <input type="text" value={dhlAccount} onChange={(e) => setDhlAccount(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 transition" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveDhl} loading={dhlSaving}><Save className="h-3.5 w-3.5" />حفظ إعدادات DHL</Button>
                      {dhlMsg && <span className={`text-sm ${dhlMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{dhlMsg}</span>}
                    </div>
                  </CardBody>
                </Card>
              </>
            )}

            {/* ── NOTIFICATIONS TAB ── */}
            {activeTab === "notifications" && (
              <>
                <Card>
                  <CardHeader title="إشعارات واتساب" subtitle="إرسال تأكيد الطلب وتحديثات الشحن تلقائياً عبر WhatsApp Business API" />
                  <CardBody className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">تفعيل إشعارات واتساب</p>
                        <p className="text-xs text-slate-500">إرسال رسائل تلقائية عند تأكيد الطلب أو تحديث الشحن</p>
                      </div>
                    </label>
                    {waEnabled && (
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number ID</label>
                          <input type="text" placeholder="123456789012345" value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 transition" />
                          <p className="mt-1 text-xs text-slate-500">من Meta Business Suite — WhatsApp — Getting Started</p>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Access Token</label>
                          <input type="password" placeholder="EAAxxxxxxx..." value={waToken} onChange={(e) => setWaToken(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 transition" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveWhatsApp} loading={waSaving}><Save className="h-3.5 w-3.5" />حفظ</Button>
                      {waMsg && <span className={`text-sm ${waMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{waMsg}</span>}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="إشعارات SMS" subtitle="إرسال رسائل نصية تلقائية عبر Twilio" />
                  <CardBody className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={smsEnabled} onChange={(e) => setSmsEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">تفعيل إشعارات SMS</p>
                        <p className="text-xs text-slate-500">إرسال تأكيد الطلب وتحديثات الشحن عبر SMS</p>
                      </div>
                    </label>
                    {smsEnabled && (
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Account SID</label>
                          <input type="text" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={smsSid} onChange={(e) => setSmsSid(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Auth Token</label>
                          <input type="password" placeholder="••••••••••••••••" value={smsToken} onChange={(e) => setSmsToken(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">رقم الإرسال (From)</label>
                          <input type="text" placeholder="+12345678901" value={smsFrom} onChange={(e) => setSmsFrom(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                          <p className="mt-1 text-xs text-slate-500">رقم Twilio الخاص بك بصيغة E.164</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={saveSms} loading={smsSaving}><Save className="h-3.5 w-3.5" />حفظ</Button>
                      {smsMsg && <span className={`text-sm ${smsMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{smsMsg}</span>}
                    </div>
                  </CardBody>
                </Card>
              </>
            )}

            {/* ── SECURITY TAB ── */}
            {activeTab === "security" && (
              <>
                <Card>
                  <CardHeader title="التحقق بخطوتين (2FA)" subtitle="حماية إضافية لحسابك باستخدام Google Authenticator أو Authy" />
                  <CardBody className="space-y-4">
                    {twoFASuccess && (
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <CheckCircle className="h-4 w-4" />{twoFASuccess}
                      </div>
                    )}
                    {!twoFAEnabled && !twoFASetup && (
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                          <ShieldOff className="h-6 w-6 text-slate-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">المصادقة الثنائية معطّلة</p>
                          <p className="text-xs text-slate-500 mt-0.5 mb-3">قم بتفعيل 2FA لحماية حسابك أكثر</p>
                          <Button type="button" size="sm" onClick={start2FASetup} loading={twoFALoading}>
                            <ShieldCheck className="h-4 w-4" />تفعيل 2FA
                          </Button>
                        </div>
                      </div>
                    )}
                    {!twoFAEnabled && twoFASetup && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600"><strong>الخطوة 1:</strong> امسح رمز QR باستخدام تطبيق المصادقة</p>
                        <div className="flex justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={twoFASetup.qrCode} alt="QR Code" className="w-48 h-48 border rounded-xl p-2" />
                        </div>
                        <p className="text-xs text-center text-slate-500 font-mono bg-slate-50 rounded-xl px-3 py-2 break-all">{twoFASetup.secret}</p>
                        <p className="text-sm text-slate-600"><strong>الخطوة 2:</strong> أدخل الرمز المكون من 6 أرقام</p>
                        <div className="flex gap-3">
                          <input maxLength={6} value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="flex-1 text-center text-xl tracking-widest font-mono rounded-xl border border-slate-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                          <Button type="button" onClick={confirm2FAEnable} loading={twoFALoading} disabled={twoFACode.length !== 6}>
                            <QrCode className="h-4 w-4" />تأكيد
                          </Button>
                        </div>
                        {twoFAError && <p className="text-sm text-red-500">{twoFAError}</p>}
                        <button type="button" onClick={() => { setTwoFASetup(null); setTwoFACode(""); setTwoFAError(""); }} className="text-sm text-slate-400 hover:text-slate-600">إلغاء</button>
                      </div>
                    )}
                    {twoFAEnabled && (
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                            <ShieldCheck className="h-6 w-6 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">المصادقة الثنائية مفعّلة</p>
                            <p className="text-xs text-slate-500 mt-0.5">حسابك محمي بخطوة تحقق إضافية</p>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <p className="text-sm text-slate-600 mb-3">لتعطيل 2FA، أدخل الرمز من تطبيق المصادقة:</p>
                          <div className="flex gap-3">
                            <input maxLength={6} value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="flex-1 text-center text-xl tracking-widest font-mono rounded-xl border border-slate-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            <Button type="button" variant="danger" onClick={disable2FA} loading={twoFALoading} disabled={twoFACode.length !== 6}>
                              <ShieldOff className="h-4 w-4" />تعطيل
                            </Button>
                          </div>
                          {twoFAError && <p className="text-sm text-red-500 mt-2">{twoFAError}</p>}
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="فريق العمل" subtitle="إدارة أذونات الوصول لموظفيك" />
                  <CardBody className="space-y-5">
                    {staffList && staffList.length > 0 && (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {staffList.map((member) => (
                          <div key={member.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{member.firstName} {member.lastName}</p>
                              <p className="text-xs text-slate-500">{member.email}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant={member.isActive ? "success" : "default"}>
                                {member.role === "OWNER" ? "مالك" : member.role === "ADMIN" ? "مدير" : "موظف"}
                              </Badge>
                              {!member.acceptedAt && (
                                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">دعوة معلقة</span>
                              )}
                              {member.role !== "OWNER" && (
                                <button type="button" onClick={() => removeStaff(member.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                      <div className="flex items-center gap-2 mb-1">
                        <UserPlus className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-medium text-slate-700">دعوة عضو جديد</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input type="text" placeholder="الاسم الأول" value={inviteFirst} onChange={(e) => setInviteFirst(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" />
                        <input type="text" placeholder="الاسم الأخير" value={inviteLast} onChange={(e) => setInviteLast(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" />
                      </div>
                      <input type="email" placeholder="البريد الإلكتروني" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" />
                      <div className="flex items-center gap-3">
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "STAFF")} className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition">
                          <option value="STAFF">موظف</option>
                          <option value="ADMIN">مدير</option>
                        </select>
                        <Button type="button" size="sm" onClick={sendInvite} loading={inviteLoading} disabled={!inviteEmail || !inviteFirst}>
                          <Send className="h-3.5 w-3.5" />إرسال دعوة
                        </Button>
                      </div>
                      {inviteMsg && <p className={`text-sm ${inviteMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{inviteMsg}</p>}
                    </div>
                  </CardBody>
                </Card>
              </>
            )}

            {/* ── LOYALTY TAB ── */}
            {activeTab === "loyalty" && (
              <Card>
                <CardHeader title="برنامج الولاء" subtitle="منح العملاء نقاطاً عند كل عملية شراء ويستبدلونها بخصومات" />
                <CardBody className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={loyaltyEnabled} onChange={(e) => setLoyaltyEnabled(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">تفعيل برنامج الولاء</p>
                      <p className="text-xs text-slate-500">يكسب العميل نقاطاً عند كل عملية شراء ويستبدلها بخصومات</p>
                    </div>
                  </label>
                  {loyaltyEnabled && (
                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">نقاط لكل دينار بحريني</label>
                          <input type="number" min="1" value={loyaltyPointsPerBD} onChange={(e) => setLoyaltyPointsPerBD(Number(e.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" />
                          <p className="mt-1 text-xs text-slate-500">مثال: 10 نقاط لكل 1 BHD</p>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">قيمة كل نقطة (BHD)</label>
                          <input type="number" min="0.001" step="0.001" value={loyaltyBDPerPoint} onChange={(e) => setLoyaltyBDPerPoint(Number(e.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" />
                          <p className="mt-1 text-xs text-slate-500">مثال: 0.01 BHD لكل نقطة</p>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">الحد الأدنى للاستبدال (نقطة)</label>
                          <input type="number" min="1" value={loyaltyMinRedeem} onChange={(e) => setLoyaltyMinRedeem(Number(e.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">الحد الأقصى للخصم من الطلب %</label>
                          <input type="number" min="1" max="100" value={loyaltyMaxRedeemPct} onChange={(e) => setLoyaltyMaxRedeemPct(Number(e.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={saveLoyalty} loading={loyaltySaving}><Save className="h-3.5 w-3.5" />حفظ إعدادات الولاء</Button>
                    {loyaltyMsg && <span className={`text-sm ${loyaltyMsg.includes("نجاح") ? "text-emerald-600" : "text-red-500"}`}>{loyaltyMsg}</span>}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* ── Form Save Button (general / appearance / tax tabs only) ── */}
            {isFormTab && (
              <div className="flex items-center gap-4 border-t border-slate-100 pt-6">
                <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                  <Save className="h-4 w-4" />
                  حفظ التغييرات
                </Button>
                {saved && <span className="text-sm font-medium text-emerald-600">تم الحفظ بنجاح</span>}
              </div>
            )}

          </div>
        </form>
      </div>
    </div>
  );
}
