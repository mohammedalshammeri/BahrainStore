"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Eye,
  GripVertical,
  Palette,
  Layout,
  Type,
  Image as ImageIcon,
  Tag,
  Package,
  Minus,
  AlignLeft,
  Music,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Block Types ─────────────────────────────────────────────────────────────

type BlockType =
  | "hero"
  | "banner"
  | "products_grid"
  | "categories"
  | "marquee"
  | "text"
  | "divider";

interface Block {
  id: string;
  type: BlockType;
  props: Record<string, any>;
}

const BLOCK_CATALOG: {
  type: BlockType;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  description: string;
  defaultProps: Record<string, any>;
}[] = [
  {
    type: "hero",
    label: "Hero Banner",
    labelAr: "بانر رئيسي",
    icon: Layout,
    description: "عنوان كبير مع زر دعوة للعمل",
    defaultProps: {
      titleAr: "مرحباً بك في متجرنا",
      titleEn: "Welcome to our store",
      subtitleAr: "اكتشف أحدث المنتجات",
      subtitleEn: "Discover the latest products",
      buttonTextAr: "تسوق الآن",
      buttonTextEn: "Shop Now",
      buttonLink: "/products",
      bgColor: "#1e1b4b",
      textColor: "#ffffff",
      align: "center",
    },
  },
  {
    type: "banner",
    label: "Image Banner",
    labelAr: "بانر صورة",
    icon: ImageIcon,
    description: "بانر بصورة خلفية",
    defaultProps: {
      imageUrl: "",
      titleAr: "عنوان البانر",
      titleEn: "Banner title",
      buttonTextAr: "تسوق الآن",
      buttonLink: "/products",
      overlayOpacity: 0.45,
      height: "400",
    },
  },
  {
    type: "products_grid",
    label: "Products Grid",
    labelAr: "شبكة المنتجات",
    icon: Package,
    description: "عرض منتجات مميزة",
    defaultProps: {
      titleAr: "منتجاتنا المميزة",
      titleEn: "Featured Products",
      count: 8,
      filter: "featured",
    },
  },
  {
    type: "categories",
    label: "Categories",
    labelAr: "التصنيفات",
    icon: Tag,
    description: "شبكة التصنيفات",
    defaultProps: {
      titleAr: "تصفح التصنيفات",
      titleEn: "Browse Categories",
      columns: 4,
    },
  },
  {
    type: "marquee",
    label: "Marquee",
    labelAr: "شريط إعلاني",
    icon: Music,
    description: "نص متحرك أفقياً",
    defaultProps: {
      text: "🎉 شحن مجاني على الطلبات فوق 10 دينار · عروض حصرية كل أسبوع · 🎉",
      speed: "normal",
      bgColor: "#1e1b4b",
      textColor: "#ffffff",
    },
  },
  {
    type: "text",
    label: "Text Block",
    labelAr: "نص حر",
    icon: Type,
    description: "فقرة نصية",
    defaultProps: {
      textAr: "أضف نصاً هنا...",
      textEn: "",
      align: "center",
      fontSize: "base",
    },
  },
  {
    type: "divider",
    label: "Divider",
    labelAr: "فاصل",
    icon: Minus,
    description: "فاصل بين القسمين",
    defaultProps: { height: "40", color: "transparent" },
  },
];

// ─── Small helper ─────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

// ─── Property Editors ─────────────────────────────────────────────────────────

function PropField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  type?: "text" | "color" | "number" | "select" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {type === "color" ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="w-9 h-9 rounded cursor-pointer border border-gray-200"
          />
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-9 text-xs"
            placeholder="#000000"
          />
        </div>
      ) : type === "textarea" ? (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 min-h-[80px] resize-y"
        />
      ) : type === "number" ? (
        <Input
          type="number"
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 text-sm"
        />
      ) : (
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-sm"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function HeroEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (key: string, v: any) => void;
}) {
  return (
    <div className="space-y-3">
      <PropField label="العنوان (عربي)" value={props.titleAr} onChange={(v) => onChange("titleAr", v)} />
      <PropField label="العنوان (إنجليزي)" value={props.titleEn} onChange={(v) => onChange("titleEn", v)} />
      <PropField label="النص الفرعي (عربي)" value={props.subtitleAr} onChange={(v) => onChange("subtitleAr", v)} />
      <PropField label="نص الزر (عربي)" value={props.buttonTextAr} onChange={(v) => onChange("buttonTextAr", v)} />
      <PropField label="رابط الزر" value={props.buttonLink} onChange={(v) => onChange("buttonLink", v)} placeholder="/products" />
      <PropField label="لون الخلفية" value={props.bgColor} onChange={(v) => onChange("bgColor", v)} type="color" />
      <PropField label="لون النص" value={props.textColor} onChange={(v) => onChange("textColor", v)} type="color" />
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">المحاذاة</label>
        <div className="flex gap-2">
          {["right", "center", "left"].map((a) => (
            <button
              key={a}
              onClick={() => onChange("align", a)}
              className={cn(
                "flex-1 py-1.5 rounded text-xs border",
                props.align === a
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {a === "right" ? "يمين" : a === "center" ? "وسط" : "يسار"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BannerEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (key: string, v: any) => void;
}) {
  return (
    <div className="space-y-3">
      <PropField label="رابط الصورة" value={props.imageUrl} onChange={(v) => onChange("imageUrl", v)} placeholder="https://..." />
      <PropField label="العنوان (عربي)" value={props.titleAr} onChange={(v) => onChange("titleAr", v)} />
      <PropField label="العنوان (إنجليزي)" value={props.titleEn} onChange={(v) => onChange("titleEn", v)} />
      <PropField label="نص الزر (عربي)" value={props.buttonTextAr} onChange={(v) => onChange("buttonTextAr", v)} />
      <PropField label="رابط الزر" value={props.buttonLink} onChange={(v) => onChange("buttonLink", v)} />
      <PropField label="ارتفاع البانر (px)" value={props.height} onChange={(v) => onChange("height", v)} type="number" />
      <PropField label="شفافية التغطية (0-1)" value={props.overlayOpacity} onChange={(v) => onChange("overlayOpacity", parseFloat(String(v)))} type="number" />
    </div>
  );
}

function ProductsGridEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (key: string, v: any) => void;
}) {
  return (
    <div className="space-y-3">
      <PropField label="العنوان" value={props.titleAr} onChange={(v) => onChange("titleAr", v)} />
      <PropField label="عدد المنتجات" value={props.count} onChange={(v) => onChange("count", v)} type="number" />
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">نوع الفلتر</label>
        <div className="flex gap-2">
          {[
            { value: "featured", label: "مميزة" },
            { value: "latest", label: "أحدث" },
            { value: "bestselling", label: "الأكثر مبيعاً" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => onChange("filter", f.value)}
              className={cn(
                "flex-1 py-1.5 rounded text-xs border",
                props.filter === f.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoriesEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (key: string, v: any) => void;
}) {
  return (
    <div className="space-y-3">
      <PropField label="العنوان" value={props.titleAr} onChange={(v) => onChange("titleAr", v)} />
      <PropField label="عدد الأعمدة" value={props.columns} onChange={(v) => onChange("columns", v)} type="number" />
    </div>
  );
}

function MarqueeEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (key: string, v: any) => void;
}) {
  return (
    <div className="space-y-3">
      <PropField label="النص" value={props.text} onChange={(v) => onChange("text", v)} type="textarea" />
      <PropField label="لون الخلفية" value={props.bgColor} onChange={(v) => onChange("bgColor", v)} type="color" />
      <PropField label="لون النص" value={props.textColor} onChange={(v) => onChange("textColor", v)} type="color" />
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">سرعة الحركة</label>
        <div className="flex gap-2">
          {[
            { value: "slow", label: "بطيء" },
            { value: "normal", label: "عادي" },
            { value: "fast", label: "سريع" },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => onChange("speed", s.value)}
              className={cn(
                "flex-1 py-1.5 rounded text-xs border",
                props.speed === s.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TextEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (key: string, v: any) => void;
}) {
  return (
    <div className="space-y-3">
      <PropField label="النص (عربي)" value={props.textAr} onChange={(v) => onChange("textAr", v)} type="textarea" />
      <PropField label="النص (إنجليزي)" value={props.textEn} onChange={(v) => onChange("textEn", v)} type="textarea" />
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">المحاذاة</label>
        <div className="flex gap-2">
          {["right", "center", "left"].map((a) => (
            <button
              key={a}
              onClick={() => onChange("align", a)}
              className={cn(
                "flex-1 py-1.5 rounded text-xs border",
                props.align === a
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {a === "right" ? "يمين" : a === "center" ? "وسط" : "يسار"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DividerEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (key: string, v: any) => void;
}) {
  return (
    <div className="space-y-3">
      <PropField label="الارتفاع (px)" value={props.height} onChange={(v) => onChange("height", v)} type="number" />
      <PropField label="اللون" value={props.color} onChange={(v) => onChange("color", v)} type="color" />
    </div>
  );
}

function BlockPropsEditor({ block, onChange }: { block: Block; onChange: (key: string, v: any) => void }) {
  switch (block.type) {
    case "hero": return <HeroEditor props={block.props} onChange={onChange} />;
    case "banner": return <BannerEditor props={block.props} onChange={onChange} />;
    case "products_grid": return <ProductsGridEditor props={block.props} onChange={onChange} />;
    case "categories": return <CategoriesEditor props={block.props} onChange={onChange} />;
    case "marquee": return <MarqueeEditor props={block.props} onChange={onChange} />;
    case "text": return <TextEditor props={block.props} onChange={onChange} />;
    case "divider": return <DividerEditor props={block.props} onChange={onChange} />;
    default: return <p className="text-xs text-gray-400">لا توجد خصائص</p>;
  }
}

// ─── Block Preview Card ───────────────────────────────────────────────────────

function BlockCard({
  block,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  block: Block;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const meta = BLOCK_CATALOG.find((b) => b.type === block.type);
  const Icon = meta?.icon ?? Layout;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative flex items-center gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-all",
        isSelected
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      )}
    >
      <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-100 shrink-0">
        <Icon className="w-4 h-4 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{meta?.labelAr ?? block.type}</p>
        {block.props.titleAr && (
          <p className="text-xs text-gray-400 truncate">{block.props.titleAr}</p>
        )}
        {block.props.text && (
          <p className="text-xs text-gray-400 truncate">{block.props.text}</p>
        )}
      </div>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUp className="w-3 h-3 text-gray-400" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1.5 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const { store } = useAuthStore();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Load existing blocks
  useEffect(() => {
    if (!store?.id) return;
    api
      .get(`/stores/${store.id}/homepage`)
      .then((res) => {
        if (Array.isArray(res.data.blocks) && res.data.blocks.length > 0) {
          setBlocks(res.data.blocks);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [store?.id]);

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  const addBlock = useCallback((type: BlockType) => {
    const meta = BLOCK_CATALOG.find((c) => c.type === type)!;
    const newBlock: Block = { id: uid(), type, props: { ...meta.defaultProps } };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  }, []);

  const updateProp = useCallback((id: string, key: string, value: any) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b))
    );
  }, []);

  const moveBlock = useCallback((index: number, direction: "up" | "down") => {
    setBlocks((prev) => {
      const arr = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const handleSave = async () => {
    if (!store?.id) return;
    setSaving(true);
    try {
      await api.put(`/stores/${store.id}/homepage`, { blocks });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (!store) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>الرجاء تسجيل الدخول أولاً</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">منشئ الصفحات</h1>
          <p className="text-xs text-gray-500 mt-0.5">صمّم الصفحة الرئيسية لمتجرك</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Device preview toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            {([
              { key: "desktop", icon: Monitor, label: "سطح المكتب" },
              { key: "tablet", icon: Tablet, label: "تابلت" },
              { key: "mobile", icon: Smartphone, label: "جوال" },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                title={label}
                onClick={() => setPreviewDevice(key)}
                className={cn(
                  "p-2 transition-colors",
                  previewDevice === key
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <a
            href={`http://${store.subdomain}.localhost:3000`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-indigo-600 transition"
          >
            <Eye className="w-4 h-4" />
            معاينة
          </a>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "gap-2",
              saved ? "bg-green-600 hover:bg-green-600" : ""
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ التصميم"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Block Catalog ── */}
        <aside className="w-56 shrink-0 border-l bg-white overflow-y-auto p-3 space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 pb-1">
            إضافة قسم
          </p>
          {BLOCK_CATALOG.map(({ type, labelAr, icon: Icon, description }) => (
            <button
              key={type}
              onClick={() => addBlock(type)}
              className="w-full flex items-start gap-2.5 rounded-lg border border-gray-200 px-2.5 py-2 text-start hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100">
                <Icon className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">{labelAr}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{description}</p>
              </div>
            </button>
          ))}
        </aside>

        {/* ── Center: Blocks List ── */}
        <main className="flex-1 overflow-y-auto px-6 py-6 bg-gray-100">
          <div
            className={cn(
              "mx-auto bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300",
              previewDevice === "mobile" ? "max-w-[390px]" :
              previewDevice === "tablet" ? "max-w-[768px]" :
              "max-w-full"
            )}
          >
            {/* Device frame indicator */}
            {previewDevice !== "desktop" && (
              <div className="bg-gray-800 text-gray-300 text-xs text-center py-1.5 flex items-center justify-center gap-1.5">
                {previewDevice === "mobile" ? <Smartphone className="w-3 h-3" /> : <Tablet className="w-3 h-3" />}
                {previewDevice === "mobile" ? "معاينة الجوال (390px)" : "معاينة التابلت (768px)"}
              </div>
            )}
            <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              جاري التحميل...
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
              <Layout className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">الصفحة فارغة</p>
              <p className="text-sm mt-1">أضف قسماً من القائمة اليسرى</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block, i) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  isSelected={selectedId === block.id}
                  isFirst={i === 0}
                  isLast={i === blocks.length - 1}
                  onSelect={() => setSelectedId(block.id)}
                  onMoveUp={() => moveBlock(i, "up")}
                  onMoveDown={() => moveBlock(i, "down")}
                  onDelete={() => deleteBlock(block.id)}
                />
              ))}
              <button
                onClick={() => {}}
                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                أضف قسماً من اليسار
              </button>
            </div>
          )}
            </div>
          </div>
        </main>

        {/* ── Right: Properties Panel ── */}
        <aside className="w-72 shrink-0 border-r bg-white overflow-y-auto">
          {selectedBlock ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                <Palette className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-sm text-gray-800">
                  {BLOCK_CATALOG.find((c) => c.type === selectedBlock.type)?.labelAr}
                </h3>
              </div>
              <BlockPropsEditor
                block={selectedBlock}
                onChange={(key, value) => updateProp(selectedBlock.id, key, value)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-6 text-center">
              <AlignLeft className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">اختر قسماً لتعديل خصائصه</p>
              <p className="text-xs mt-1">اضغط على أي قسم في المنتصف</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
