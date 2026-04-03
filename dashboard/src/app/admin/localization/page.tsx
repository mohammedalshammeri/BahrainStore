"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Globe, Languages, Coins, MapPin, Settings2,
  Plus, Trash2, Edit2, Check, X, Star, Building2,
  Phone, Mail, CreditCard, Palette, ImageIcon, Save,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Language {
  id: string; code: string; name: string; nameAr: string;
  direction: string; isActive: boolean; isDefault: boolean; sortOrder: number;
}
interface Currency {
  id: string; code: string; name: string; nameAr: string;
  symbol: string; symbolAr?: string; exchangeRate: number | string;
  baseCurrency: boolean; decimalPlaces: number; isActive: boolean;
}
interface Country {
  id: string; code: string; name: string; nameAr: string;
  phonePrefix?: string; currencyCode?: string; isActive: boolean; isDefault: boolean; sortOrder: number;
}
interface PlatformConf {
  platformName: string; platformNameAr: string;
  logoUrl?: string; faviconUrl?: string;
  primaryColor: string; secondaryColor: string; accentColor: string;
  companyName?: string; companyNameAr?: string;
  companyAddress?: string; companyAddressAr?: string;
  companyPhone?: string; companyEmail?: string;
  companyVatNumber?: string; companyCrNumber?: string;
  bankName?: string; bankNameAr?: string;
  bankIban?: string; bankAccountName?: string; bankSwiftCode?: string;
  supportEmail?: string; supportPhone?: string;
  baseCurrency: string; defaultLanguage: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "languages", label: "اللغات", icon: Languages },
  { id: "currencies", label: "العملات", icon: Coins },
  { id: "countries", label: "الدول", icon: MapPin },
  { id: "platform", label: "إعدادات المنصة", icon: Settings2 },
];

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-[#0c1526] border border-[#1a2840] rounded-xl p-5 ${className}`}>{children}</div>
);

const Badge = ({ active, children }: { active: boolean; children: React.ReactNode }) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
    {children}
  </span>
);

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${checked ? "bg-blue-500" : "bg-[#1a2840]"}`}
  >
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
  </button>
);

// ─── Language Form ────────────────────────────────────────────────────────────
function LangForm({ onSave, onCancel, initial }: { onSave: (d: any) => void; onCancel: () => void; initial?: Partial<Language> }) {
  const [form, setForm] = useState({
    code: initial?.code ?? "", name: initial?.name ?? "", nameAr: initial?.nameAr ?? "",
    direction: initial?.direction ?? "ltr", isActive: initial?.isActive ?? true,
    isDefault: initial?.isDefault ?? false, sortOrder: initial?.sortOrder ?? 0,
  });
  return (
    <div className="bg-[#060b18] border border-[#1a2840] rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">كود اللغة (ar / en)</label>
          <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            placeholder="ar" className="w-full bg-[#0c1526] border border-[#1a2840] rounded px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">الاتجاه</label>
          <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}
            className="w-full bg-[#0c1526] border border-[#1a2840] rounded px-3 py-2 text-sm text-white">
            <option value="rtl">RTL (يمين لشمال)</option>
            <option value="ltr">LTR (شمال ليمين)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">الاسم بالإنجليزي</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Arabic" className="w-full bg-[#0c1526] border border-[#1a2840] rounded px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">الاسم بالعربي</label>
          <input value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
            placeholder="العربية" className="w-full bg-[#0c1526] border border-[#1a2840] rounded px-3 py-2 text-sm text-white" dir="rtl" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Toggle checked={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} /> مفعّلة
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Toggle checked={form.isDefault} onChange={v => setForm(f => ({ ...f, isDefault: v }))} /> افتراضية
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(form)} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
          <Check className="w-4 h-4" /> حفظ
        </button>
        <button onClick={onCancel} className="flex items-center gap-1 bg-[#1a2840] hover:bg-[#243350] text-white text-sm px-4 py-2 rounded-lg">
          <X className="w-4 h-4" /> إلغاء
        </button>
      </div>
    </div>
  );
}

// ─── Currency Form ────────────────────────────────────────────────────────────
function CurrencyForm({ onSave, onCancel, initial }: { onSave: (d: any) => void; onCancel: () => void; initial?: Partial<Currency> }) {
  const [form, setForm] = useState({
    code: initial?.code ?? "", name: initial?.name ?? "", nameAr: initial?.nameAr ?? "",
    symbol: initial?.symbol ?? "", symbolAr: initial?.symbolAr ?? "",
    exchangeRate: initial?.exchangeRate ?? 1, decimalPlaces: initial?.decimalPlaces ?? 3,
    baseCurrency: initial?.baseCurrency ?? false, isActive: initial?.isActive ?? true,
  });
  return (
    <div className="bg-[#060b18] border border-[#1a2840] rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "code", label: "كود العملة (BHD)", placeholder: "BHD" },
          { key: "symbol", label: "الرمز", placeholder: "BD" },
          { key: "symbolAr", label: "الرمز بالعربي", placeholder: "د.ب" },
          { key: "name", label: "الاسم بالإنجليزي", placeholder: "Bahraini Dinar" },
          { key: "nameAr", label: "الاسم بالعربي", placeholder: "الدينار البحريني" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-slate-400 mb-1 block">{label}</label>
            <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder} className="w-full bg-[#0c1526] border border-[#1a2840] rounded px-3 py-2 text-sm text-white" />
          </div>
        ))}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">سعر الصرف</label>
          <input type="number" step="0.000001" value={form.exchangeRate as number}
            onChange={e => setForm(f => ({ ...f, exchangeRate: parseFloat(e.target.value) || 1 }))}
            className="w-full bg-[#0c1526] border border-[#1a2840] rounded px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">الكسور العشرية</label>
          <input type="number" value={form.decimalPlaces}
            onChange={e => setForm(f => ({ ...f, decimalPlaces: parseInt(e.target.value) || 0 }))}
            className="w-full bg-[#0c1526] border border-[#1a2840] rounded px-3 py-2 text-sm text-white" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Toggle checked={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} /> مفعّلة
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Toggle checked={form.baseCurrency} onChange={v => setForm(f => ({ ...f, baseCurrency: v }))} /> العملة الأساسية
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(form)} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
          <Check className="w-4 h-4" /> حفظ
        </button>
        <button onClick={onCancel} className="flex items-center gap-1 bg-[#1a2840] hover:bg-[#243350] text-white text-sm px-4 py-2 rounded-lg">
          <X className="w-4 h-4" /> إلغاء
        </button>
      </div>
    </div>
  );
}

// ─── Country Form ─────────────────────────────────────────────────────────────
function CountryForm({ onSave, onCancel, initial }: { onSave: (d: any) => void; onCancel: () => void; initial?: Partial<Country> }) {
  const [form, setForm] = useState({
    code: initial?.code ?? "", name: initial?.name ?? "", nameAr: initial?.nameAr ?? "",
    phonePrefix: initial?.phonePrefix ?? "", currencyCode: initial?.currencyCode ?? "",
    isActive: initial?.isActive ?? true, isDefault: initial?.isDefault ?? false, sortOrder: initial?.sortOrder ?? 0,
  });
  return (
    <div className="bg-[#060b18] border border-[#1a2840] rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "code", label: "كود الدولة (BH)", placeholder: "BH" },
          { key: "phonePrefix", label: "مفتاح الهاتف", placeholder: "+973" },
          { key: "name", label: "الاسم بالإنجليزي", placeholder: "Bahrain" },
          { key: "nameAr", label: "الاسم بالعربي", placeholder: "البحرين" },
          { key: "currencyCode", label: "العملة الافتراضية", placeholder: "BHD" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-slate-400 mb-1 block">{label}</label>
            <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder} className="w-full bg-[#0c1526] border border-[#1a2840] rounded px-3 py-2 text-sm text-white" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Toggle checked={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} /> مفعّلة
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Toggle checked={form.isDefault} onChange={v => setForm(f => ({ ...f, isDefault: v }))} /> افتراضية
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(form)} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
          <Check className="w-4 h-4" /> حفظ
        </button>
        <button onClick={onCancel} className="flex items-center gap-1 bg-[#1a2840] hover:bg-[#243350] text-white text-sm px-4 py-2 rounded-lg">
          <X className="w-4 h-4" /> إلغاء
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LocalizationPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("languages");
  const [addingLang, setAddingLang] = useState(false);
  const [editingLang, setEditingLang] = useState<Language | null>(null);
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [addingCountry, setAddingCountry] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [platformForm, setPlatformForm] = useState<PlatformConf | null>(null);
  const [platformDirty, setPlatformDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: langData } = useQuery({ queryKey: ["admin", "languages"], queryFn: () => api.get("/admin/localization/languages").then(r => r.data) });
  const { data: currData } = useQuery({ queryKey: ["admin", "currencies"], queryFn: () => api.get("/admin/localization/currencies").then(r => r.data) });
  const { data: countryData } = useQuery({ queryKey: ["admin", "countries"], queryFn: () => api.get("/admin/localization/countries").then(r => r.data) });
  const { data: confData } = useQuery<{ config: PlatformConf }>(
    { queryKey: ["admin", "platform-config"], queryFn: () => api.get("/admin/localization/platform-config").then(r => r.data) }
  );

  // Keep platform form in sync on first load
  if (confData?.config && !platformForm) setPlatformForm(confData.config);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createLang = useMutation({ mutationFn: (d: any) => api.post("/admin/localization/languages", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "languages"] }); setAddingLang(false); } });
  const updateLang = useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/admin/localization/languages/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "languages"] }); setEditingLang(null); } });
  const deleteLang = useMutation({ mutationFn: (id: string) => api.delete(`/admin/localization/languages/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "languages"] }) });

  const createCurrency = useMutation({ mutationFn: (d: any) => api.post("/admin/localization/currencies", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "currencies"] }); setAddingCurrency(false); } });
  const updateCurrency = useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/admin/localization/currencies/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "currencies"] }); setEditingCurrency(null); } });
  const deleteCurrency = useMutation({ mutationFn: (id: string) => api.delete(`/admin/localization/currencies/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "currencies"] }) });

  const createCountry = useMutation({ mutationFn: (d: any) => api.post("/admin/localization/countries", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "countries"] }); setAddingCountry(false); } });
  const updateCountry = useMutation({ mutationFn: ({ id, ...d }: any) => api.patch(`/admin/localization/countries/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "countries"] }); setEditingCountry(null); } });
  const deleteCountry = useMutation({ mutationFn: (id: string) => api.delete(`/admin/localization/countries/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "countries"] }) });

  const savePlatform = useMutation({
    mutationFn: (d: any) => api.patch("/admin/localization/platform-config", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "platform-config"] }); setPlatformDirty(false); setSaveMsg("تم الحفظ ✓"); setTimeout(() => setSaveMsg(""), 2500); },
  });

  const langs: Language[] = langData?.languages ?? [];
  const currencies: Currency[] = currData?.currencies ?? [];
  const countries: Country[] = countryData?.countries ?? [];

  const updatePlatformField = (key: keyof PlatformConf, value: string) => {
    setPlatformForm(f => f ? { ...f, [key]: value } : f);
    setPlatformDirty(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="w-7 h-7 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">التوطين والتوسع</h1>
          <p className="text-slate-400 text-sm">إدارة اللغات والعملات والدول وإعدادات المنصة</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "اللغات", value: langs.length, active: langs.filter(l => l.isActive).length, icon: Languages, color: "blue" },
          { label: "العملات", value: currencies.length, active: currencies.filter(c => c.isActive).length, icon: Coins, color: "emerald" },
          { label: "الدول", value: countries.length, active: countries.filter(c => c.isActive).length, icon: MapPin, color: "violet" },
          { label: "إعدادات المنصة", value: "مُهيَّأة", active: null, icon: Settings2, color: "amber" },
        ].map(({ label, value, active, icon: Icon, color }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">{label}</p>
                <p className="text-2xl font-bold text-white mt-1">{value}</p>
                {active !== null && <p className="text-xs text-slate-500 mt-0.5">{active} مفعّل</p>}
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a2840]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t.id ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Languages Tab ──────────────────────────────────────────────────── */}
      {tab === "languages" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">اللغات المدعومة</h2>
            <button onClick={() => { setAddingLang(true); setEditingLang(null); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
              <Plus className="w-4 h-4" /> إضافة لغة
            </button>
          </div>
          {addingLang && (
            <LangForm onSave={d => createLang.mutate(d)} onCancel={() => setAddingLang(false)} />
          )}
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-[#1a2840]">
                  <th className="text-right pb-3">الكود</th>
                  <th className="text-right pb-3">الاسم</th>
                  <th className="text-right pb-3">بالعربي</th>
                  <th className="text-right pb-3">الاتجاه</th>
                  <th className="text-right pb-3">الحالة</th>
                  <th className="text-right pb-3">افتراضية</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {langs.map(lang => (
                  <>
                    <tr key={lang.id} className="border-b border-[#1a2840] hover:bg-white/5">
                      <td className="py-3 font-mono text-blue-400">{lang.code}</td>
                      <td className="py-3 text-white">{lang.name}</td>
                      <td className="py-3 text-slate-300" dir="rtl">{lang.nameAr}</td>
                      <td className="py-3 text-slate-400">{lang.direction.toUpperCase()}</td>
                      <td className="py-3"><Badge active={lang.isActive}>{lang.isActive ? "مفعّلة" : "معطّلة"}</Badge></td>
                      <td className="py-3">{lang.isDefault && <Star className="w-4 h-4 text-amber-400" />}</td>
                      <td className="py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditingLang(lang); setAddingLang(false); }} className="text-slate-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>
                          {!lang.isDefault && (
                            <button onClick={() => { if (confirm("حذف هذه اللغة؟")) deleteLang.mutate(lang.id); }} className="text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingLang?.id === lang.id && (
                      <tr key={`${lang.id}-edit`}>
                        <td colSpan={7} className="pb-2">
                          <LangForm initial={editingLang} onSave={d => updateLang.mutate({ id: lang.id, ...d })} onCancel={() => setEditingLang(null)} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {langs.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">لا توجد لغات بعد. أضف لغة للبدء.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── Currencies Tab ─────────────────────────────────────────────────── */}
      {tab === "currencies" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">العملات المدعومة</h2>
            <button onClick={() => { setAddingCurrency(true); setEditingCurrency(null); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
              <Plus className="w-4 h-4" /> إضافة عملة
            </button>
          </div>
          {addingCurrency && (
            <CurrencyForm onSave={d => createCurrency.mutate(d)} onCancel={() => setAddingCurrency(false)} />
          )}
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-[#1a2840]">
                  <th className="text-right pb-3">الكود</th>
                  <th className="text-right pb-3">الاسم</th>
                  <th className="text-right pb-3">الرمز</th>
                  <th className="text-right pb-3">سعر الصرف</th>
                  <th className="text-right pb-3">الكسور</th>
                  <th className="text-right pb-3">الحالة</th>
                  <th className="text-right pb-3">أساسية</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {currencies.map(curr => (
                  <>
                    <tr key={curr.id} className="border-b border-[#1a2840] hover:bg-white/5">
                      <td className="py-3 font-mono text-emerald-400">{curr.code}</td>
                      <td className="py-3 text-white">{curr.name}</td>
                      <td className="py-3 text-slate-300">{curr.symbol}{curr.symbolAr ? ` / ${curr.symbolAr}` : ""}</td>
                      <td className="py-3 text-slate-300">{Number(curr.exchangeRate).toFixed(6)}</td>
                      <td className="py-3 text-slate-400">{curr.decimalPlaces}</td>
                      <td className="py-3"><Badge active={curr.isActive}>{curr.isActive ? "مفعّلة" : "معطّلة"}</Badge></td>
                      <td className="py-3">{curr.baseCurrency && <Star className="w-4 h-4 text-amber-400" />}</td>
                      <td className="py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditingCurrency(curr); setAddingCurrency(false); }} className="text-slate-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>
                          {!curr.baseCurrency && (
                            <button onClick={() => { if (confirm("حذف هذه العملة؟")) deleteCurrency.mutate(curr.id); }} className="text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingCurrency?.id === curr.id && (
                      <tr key={`${curr.id}-edit`}>
                        <td colSpan={8} className="pb-2">
                          <CurrencyForm initial={editingCurrency} onSave={d => updateCurrency.mutate({ id: curr.id, ...d })} onCancel={() => setEditingCurrency(null)} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {currencies.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-500">لا توجد عملات بعد. أضف عملة للبدء.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── Countries Tab ──────────────────────────────────────────────────── */}
      {tab === "countries" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">الدول المدعومة</h2>
            <button onClick={() => { setAddingCountry(true); setEditingCountry(null); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
              <Plus className="w-4 h-4" /> إضافة دولة
            </button>
          </div>
          {addingCountry && (
            <CountryForm onSave={d => createCountry.mutate(d)} onCancel={() => setAddingCountry(false)} />
          )}
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-[#1a2840]">
                  <th className="text-right pb-3">الكود</th>
                  <th className="text-right pb-3">الدولة</th>
                  <th className="text-right pb-3">بالعربي</th>
                  <th className="text-right pb-3">مفتاح الهاتف</th>
                  <th className="text-right pb-3">العملة</th>
                  <th className="text-right pb-3">الحالة</th>
                  <th className="text-right pb-3">افتراضية</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {countries.map(c => (
                  <>
                    <tr key={c.id} className="border-b border-[#1a2840] hover:bg-white/5">
                      <td className="py-3 font-mono text-violet-400">{c.code}</td>
                      <td className="py-3 text-white">{c.name}</td>
                      <td className="py-3 text-slate-300" dir="rtl">{c.nameAr}</td>
                      <td className="py-3 text-slate-400">{c.phonePrefix ?? "—"}</td>
                      <td className="py-3 text-slate-400 font-mono">{c.currencyCode ?? "—"}</td>
                      <td className="py-3"><Badge active={c.isActive}>{c.isActive ? "مفعّلة" : "معطّلة"}</Badge></td>
                      <td className="py-3">{c.isDefault && <Star className="w-4 h-4 text-amber-400" />}</td>
                      <td className="py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditingCountry(c); setAddingCountry(false); }} className="text-slate-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>
                          {!c.isDefault && (
                            <button onClick={() => { if (confirm("حذف هذه الدولة؟")) deleteCountry.mutate(c.id); }} className="text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingCountry?.id === c.id && (
                      <tr key={`${c.id}-edit`}>
                        <td colSpan={8} className="pb-2">
                          <CountryForm initial={editingCountry} onSave={d => updateCountry.mutate({ id: c.id, ...d })} onCancel={() => setEditingCountry(null)} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {countries.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-500">لا توجد دول بعد. أضف دولة للبدء.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── Platform Config Tab ────────────────────────────────────────────── */}
      {tab === "platform" && platformForm && (
        <div className="space-y-6">
          {/* Save bar */}
          {platformDirty && (
            <div className="flex items-center justify-between bg-blue-600/10 border border-blue-500/30 rounded-xl px-5 py-3">
              <span className="text-sm text-blue-300">يوجد تغييرات غير محفوظة</span>
              <div className="flex gap-2">
                <button onClick={() => { setPlatformForm(confData?.config ?? null); setPlatformDirty(false); }}
                  className="text-sm text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-[#1a2840]">تراجع</button>
                <button onClick={() => savePlatform.mutate(platformForm)}
                  className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                  <Save className="w-4 h-4" /> حفظ
                </button>
              </div>
            </div>
          )}
          {saveMsg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-xl">{saveMsg}</div>}

          {/* Identity */}
          <Card>
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400" /> هوية المنصة</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "platformName", label: "اسم المنصة (إنجليزي)" },
                { key: "platformNameAr", label: "اسم المنصة (عربي)" },
                { key: "logoUrl", label: "رابط الشعار (URL)" },
                { key: "faviconUrl", label: "رابط الأيقونة (Favicon URL)" },
                { key: "supportEmail", label: "إيميل الدعم" },
                { key: "supportPhone", label: "هاتف الدعم" },
                { key: "defaultLanguage", label: "اللغة الافتراضية (كود)" },
                { key: "baseCurrency", label: "العملة الأساسية (كود)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  <input value={(platformForm as any)[key] ?? ""}
                    onChange={e => updatePlatformField(key as keyof PlatformConf, e.target.value)}
                    className="w-full bg-[#060b18] border border-[#1a2840] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              ))}
            </div>
          </Card>

          {/* Brand Colors */}
          <Card>
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Palette className="w-4 h-4 text-violet-400" /> ألوان المنصة</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: "primaryColor", label: "اللون الأساسي" },
                { key: "secondaryColor", label: "اللون الثانوي" },
                { key: "accentColor", label: "لون التمييز" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 mb-2 block">{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={(platformForm as any)[key] ?? "#000000"}
                      onChange={e => updatePlatformField(key as keyof PlatformConf, e.target.value)}
                      className="h-9 w-12 rounded cursor-pointer border border-[#1a2840] bg-transparent" />
                    <input value={(platformForm as any)[key] ?? ""}
                      onChange={e => updatePlatformField(key as keyof PlatformConf, e.target.value)}
                      className="flex-1 bg-[#060b18] border border-[#1a2840] rounded-lg px-3 py-2 text-sm text-white font-mono" />
                  </div>
                </div>
              ))}
            </div>
            {/* Color preview */}
            <div className="mt-4 flex gap-3">
              {[platformForm.primaryColor, platformForm.secondaryColor, platformForm.accentColor].map((c, i) => (
                <div key={i} className="flex-1 h-8 rounded-lg" style={{ backgroundColor: c }} />
              ))}
            </div>
          </Card>

          {/* Company Info */}
          <Card>
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-400" /> بيانات الشركة (للفواتير والإيميلات)</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "companyName", label: "اسم الشركة (إنجليزي)" },
                { key: "companyNameAr", label: "اسم الشركة (عربي)" },
                { key: "companyAddress", label: "العنوان (إنجليزي)" },
                { key: "companyAddressAr", label: "العنوان (عربي)" },
                { key: "companyPhone", label: "هاتف الشركة" },
                { key: "companyEmail", label: "إيميل الشركة" },
                { key: "companyVatNumber", label: "الرقم الضريبي (VAT)" },
                { key: "companyCrNumber", label: "السجل التجاري (CR)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  <input value={(platformForm as any)[key] ?? ""}
                    onChange={e => updatePlatformField(key as keyof PlatformConf, e.target.value)}
                    className="w-full bg-[#060b18] border border-[#1a2840] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              ))}
            </div>
          </Card>

          {/* Bank / Payment */}
          <Card>
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-400" /> بيانات الحساب البنكي (استقبال الدفع)</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "bankName", label: "اسم البنك (إنجليزي)" },
                { key: "bankNameAr", label: "اسم البنك (عربي)" },
                { key: "bankAccountName", label: "اسم صاحب الحساب" },
                { key: "bankIban", label: "رقم IBAN" },
                { key: "bankSwiftCode", label: "SWIFT / BIC كود" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  <input value={(platformForm as any)[key] ?? ""}
                    onChange={e => updatePlatformField(key as keyof PlatformConf, e.target.value)}
                    className="w-full bg-[#060b18] border border-[#1a2840] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              ))}
            </div>
          </Card>

          {/* Bottom save */}
          <div className="flex justify-end">
            <button onClick={() => savePlatform.mutate(platformForm)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium">
              <Save className="w-4 h-4" /> حفظ إعدادات المنصة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
