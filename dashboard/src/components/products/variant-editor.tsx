"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface OptionValue {
  value: string;
  valueAr: string;
  color?: string;
}

interface Option {
  name: string;
  nameAr: string;
  values: OptionValue[];
}

interface Variant {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  comparePrice?: number;
  stock: number;
  sku?: string;
  isActive: boolean;
  optionValues?: Array<{ optionValue: { value: string; valueAr: string } }>;
}

interface VariantEditorProps {
  productId: string;
  initialOptions?: Option[];
  initialVariants?: Variant[];
  basePrice: number;
  baseStock: number;
  onSaved?: (variants: Variant[]) => void;
}

const PRESET_OPTIONS = [
  { name: "Color", nameAr: "اللون" },
  { name: "Size", nameAr: "المقاس" },
  { name: "Material", nameAr: "الخامة" },
  { name: "Style", nameAr: "الستايل" },
];

export function VariantEditor({
  productId,
  initialOptions = [],
  initialVariants = [],
  basePrice,
  baseStock,
  onSaved,
}: VariantEditorProps) {
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [variants, setVariants] = useState<Variant[]>(initialVariants);
  const [showVariants, setShowVariants] = useState(variants.length > 0);
  const [success, setSuccess] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => api.post(`/products/${productId}/options/save`, { options }),
    onSuccess: (res) => {
      const saved: Variant[] = res.data.variants;
      // Merge any existing price/stock edits
      const merged = saved.map((sv) => {
        const old = variants.find((v) => v.name === sv.name);
        return old ? { ...sv, price: old.price, stock: old.stock, sku: old.sku } : sv;
      });
      setVariants(merged);
      setShowVariants(true);
      setSuccess(`تم إنشاء ${merged.length} متغير بنجاح`);
      setTimeout(() => setSuccess(""), 3000);
      onSaved?.(merged);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/products/${productId}/variants`, {
        variants: variants.map((v) => ({
          id: v.id,
          price: v.price,
          comparePrice: v.comparePrice,
          stock: v.stock,
          sku: v.sku,
          isActive: v.isActive,
        })),
      }),
    onSuccess: () => {
      setSuccess("تم حفظ أسعار ومخزون المتغيرات");
      setTimeout(() => setSuccess(""), 3000);
    },
  });

  function addOption() {
    setOptions([...options, { name: "", nameAr: "", values: [{ value: "", valueAr: "" }] }]);
  }

  function removeOption(oi: number) {
    setOptions(options.filter((_, i) => i !== oi));
  }

  function updateOption(oi: number, field: keyof Option, val: string) {
    const next = [...options];
    (next[oi] as any)[field] = val;
    setOptions(next);
  }

  function applyPreset(oi: number, preset: { name: string; nameAr: string }) {
    const next = [...options];
    next[oi].name = preset.name;
    next[oi].nameAr = preset.nameAr;
    setOptions(next);
  }

  function addValue(oi: number) {
    const next = [...options];
    next[oi].values.push({ value: "", valueAr: "" });
    setOptions(next);
  }

  function removeValue(oi: number, vi: number) {
    const next = [...options];
    next[oi].values = next[oi].values.filter((_, i) => i !== vi);
    setOptions(next);
  }

  function updateValue(oi: number, vi: number, field: keyof OptionValue, val: string) {
    const next = [...options];
    (next[oi].values[vi] as any)[field] = val;
    setOptions(next);
  }

  function updateVariant(vi: number, field: keyof Variant, val: any) {
    const next = [...variants];
    (next[vi] as any)[field] = val;
    setVariants(next);
  }

  const hasOptions = options.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">
            متغيرات المنتج (اللون، المقاس، ...)
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            أضف خيارات المنتج ثم اضغط "توليد المتغيرات" لإنشاء جميع التركيبات
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addOption}>
          <Plus className="h-3.5 w-3.5" />
          إضافة خيار
        </Button>
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          ✓ {success}
        </div>
      )}

      {/* Options Editor */}
      {options.map((opt, oi) => (
        <div key={oi} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <div className="flex items-start gap-3">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  اسم الخيار (EN)
                </label>
                <input
                  value={opt.name}
                  onChange={(e) => updateOption(oi, "name", e.target.value)}
                  placeholder="e.g. Color"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  اسم الخيار (AR)
                </label>
                <input
                  value={opt.nameAr}
                  onChange={(e) => updateOption(oi, "nameAr", e.target.value)}
                  placeholder="مثال: اللون"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="rtl"
                />
              </div>
            </div>
            <button
              onClick={() => removeOption(oi)}
              className="mt-6 text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_OPTIONS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(oi, p)}
                className="text-xs px-2 py-0.5 rounded-full border border-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-colors bg-white"
              >
                {p.nameAr}
              </button>
            ))}
          </div>

          {/* Values */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">القيم:</p>
            {opt.values.map((val, vi) => (
              <div key={vi} className="flex items-center gap-2">
                <input
                  value={val.value}
                  onChange={(e) => updateValue(oi, vi, "value", e.target.value)}
                  placeholder="e.g. Red"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  value={val.valueAr}
                  onChange={(e) => updateValue(oi, vi, "valueAr", e.target.value)}
                  placeholder="مثال: أحمر"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="rtl"
                />
                {/* Color picker for color option */}
                {(opt.name.toLowerCase() === "color" || opt.nameAr === "اللون") && (
                  <input
                    type="color"
                    value={val.color ?? "#888888"}
                    onChange={(e) => updateValue(oi, vi, "color", e.target.value)}
                    className="h-8 w-8 rounded border border-slate-300 cursor-pointer"
                    title="اختر اللون"
                  />
                )}
                <button
                  onClick={() => removeValue(oi, vi)}
                  disabled={opt.values.length === 1}
                  className="text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addValue(oi)}
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
            >
              <Plus className="h-3 w-3" />
              إضافة قيمة
            </button>
          </div>
        </div>
      ))}

      {/* Generate Button */}
      {hasOptions && (
        <Button
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4" />
          توليد المتغيرات تلقائياً ({options.reduce((acc, o) => acc * Math.max(o.values.filter(v => v.value).length, 1), 1)} متغير)
        </Button>
      )}

      {/* Variants Table */}
      {variants.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowVariants(!showVariants)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-sm font-medium text-slate-700">
              المتغيرات ({variants.length})
            </span>
            {showVariants ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </button>

          {showVariants && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-right px-4 py-2 font-medium text-slate-600">المتغير</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">السعر</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">المخزون</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">SKU</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">نشط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant, vi) => (
                      <tr key={variant.id || vi} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800">{variant.nameAr || variant.name}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={variant.price}
                            onChange={(e) => updateVariant(vi, "price", parseFloat(e.target.value) || 0)}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(e) => updateVariant(vi, "stock", parseInt(e.target.value) || 0)}
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={variant.sku ?? ""}
                            onChange={(e) => updateVariant(vi, "sku", e.target.value)}
                            placeholder="SKU"
                            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={variant.isActive}
                            onChange={(e) => updateVariant(vi, "isActive", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkUpdateMutation.mutate()}
                  loading={bulkUpdateMutation.isPending}
                >
                  حفظ الأسعار والمخزون
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
