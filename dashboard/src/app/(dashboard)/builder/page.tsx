"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Layout,
  Monitor,
  Package2,
  Palette,
  Plus,
  Save,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { getPublicStorefrontOrigin } from "@/lib/env";
import {
  blockMetadataRegistry,
  cloneThemeSection,
  createSectionFromPreset,
  createDefaultBlock,
  createDefaultSection,
  getSectionPresetsForPage,
  normalizeThemeSettings,
  normalizeThemeTemplate,
  sectionMetadataRegistry,
  themeSettingsFields,
  uid,
  type BuilderFieldMeta,
  type ThemeBlock,
  type ThemeBlockType,
  type ThemeSection,
  type ThemeSectionType,
  type ThemeSettingsModel,
  type ThemeTemplate,
} from "@/lib/theme-builder";

type PreviewDevice = "desktop" | "tablet" | "mobile";
type Selection =
  | { kind: "section"; sectionId: string }
  | { kind: "block"; sectionId: string; blockId: string }
  | { kind: "theme" }
  | null;

function PropertyField({
  field,
  value,
  onChange,
}: {
  field: BuilderFieldMeta;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{field.label}</label>
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="min-h-[96px] w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{field.label}</label>
        <select
          value={typeof value === "string" ? value : String(field.defaultValue ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "toggle") {
    return (
      <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
        <span>{field.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
      </label>
    );
  }

  if (field.type === "color") {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{field.label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={typeof value === "string" && value ? value : "#000000"}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-12 rounded border border-gray-200"
          />
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder ?? "#000000"}
            className="h-10"
          />
        </div>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500">{field.label}</label>
        <Input
          type="number"
          value={typeof value === "number" ? value : Number(value ?? field.defaultValue ?? 0)}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-10"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-500">{field.label}</label>
      <Input
        type={field.type === "url" ? "url" : "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className="h-10"
      />
    </div>
  );
}

function SortActions({
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={(event) => {
          event.stopPropagation();
          onMoveUp();
        }}
        disabled={isFirst}
        className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onMoveDown();
        }}
        disabled={isLast}
        className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
    </div>
  );
}

function SectionCard({
  section,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
  children,
}: {
  section: ThemeSection;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  children?: ReactNode;
}) {
  const meta = sectionMetadataRegistry[section.type];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white transition-all",
        isSelected ? "border-indigo-500 shadow-sm" : "border-gray-200"
      )}
    >
      <button onClick={onSelect} className="flex w-full items-start gap-3 px-4 py-4 text-start">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{meta.labelAr}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", section.enabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>
              {section.enabled ? "مفعّل" : "مخفي"}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", section.enabled ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-500")}
          >
            {section.enabled ? "إخفاء" : "إظهار"}
          </button>
          <SortActions isFirst={isFirst} isLast={isLast} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </button>
      {children}
    </div>
  );
}

function BlockRow({
  block,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  block: ThemeBlock;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const meta = blockMetadataRegistry[block.type];

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-all",
        isSelected ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
      )}
    >
      <Package2 className="h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-gray-800">{meta.labelAr}</p>
        <p className="truncate text-[11px] text-gray-500">{block.type}</p>
      </div>
      <SortActions isFirst={isFirst} isLast={isLast} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function BuilderPage() {
  const { store } = useAuthStore();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [template, setTemplate] = useState<ThemeTemplate>({ pageType: "homepage", sections: [] });
  const [pageType, setPageType] = useState<ThemeTemplate["pageType"]>("homepage");
  const [selection, setSelection] = useState<Selection>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [previewProductSlug, setPreviewProductSlug] = useState<string | null>(null);
  const [previewPageSlug, setPreviewPageSlug] = useState<string | null>(null);
  const [previewBlogSlug, setPreviewBlogSlug] = useState<string | null>(null);
  const [source, setSource] = useState<string>("-");
  const [themeId, setThemeId] = useState<string>("default");
  const [themeSettings, setThemeSettings] = useState<ThemeSettingsModel>(() => normalizeThemeSettings(undefined));

  const builderOrigin = typeof window === "undefined" ? "" : window.location.origin;

  const previewUrl = useMemo(() => {
    if (!store?.subdomain) return null;

    const storefrontOrigin = getPublicStorefrontOrigin();
    const params = new URLSearchParams({
      __builderPreview: "1",
      __builderOrigin: builderOrigin,
    });

    if (pageType === "product") {
      if (!previewProductSlug) return null;
      return `${storefrontOrigin}/${store.subdomain}/products/${previewProductSlug}?${params.toString()}`;
    }

    if (pageType === "collection") {
      return `${storefrontOrigin}/${store.subdomain}/products?${params.toString()}`;
    }

    if (pageType === "page") {
      if (!previewPageSlug) return null;
      return `${storefrontOrigin}/${store.subdomain}/pages/${previewPageSlug}?${params.toString()}`;
    }

    if (pageType === "blog") {
      if (previewBlogSlug) {
        return `${storefrontOrigin}/${store.subdomain}/blog/${previewBlogSlug}?${params.toString()}`;
      }

      return `${storefrontOrigin}/${store.subdomain}/blog?${params.toString()}`;
    }

    if (pageType === "cart") {
      return `${storefrontOrigin}/${store.subdomain}/cart?${params.toString()}`;
    }

    if (pageType === "checkout") {
      return `${storefrontOrigin}/${store.subdomain}/checkout?${params.toString()}`;
    }

    return `${storefrontOrigin}/${store.subdomain}?${params.toString()}`;
  }, [builderOrigin, pageType, previewBlogSlug, previewPageSlug, previewProductSlug, store?.subdomain]);

  useEffect(() => {
    if (!store?.id) return;

    setLoading(true);
    api
      .get(`/stores/${store.id}/templates/${pageType}`)
      .then((response) => {
        const nextTemplate = normalizeThemeTemplate(response.data.template ?? { sections: response.data.blocks ?? [] });
        setTemplate(nextTemplate);
        setSource(response.data.source ?? "store-template");
        setThemeId(response.data.themeId ?? nextTemplate.themeId ?? "default");
        setThemeSettings(normalizeThemeSettings(response.data.themeSettings, {
          primaryColor: store?.settings?.primaryColor,
          secondaryColor: store?.settings?.secondaryColor,
          fontFamily: store?.settings?.fontFamily,
          themeVariant: store?.settings?.theme === "bold" || store?.settings?.theme === "elegant" || store?.settings?.theme === "fresh" || store?.settings?.theme === "dark" ? store.settings.theme : "default",
          heroVariant: store?.settings?.theme === "bold" || store?.settings?.theme === "elegant" || store?.settings?.theme === "fresh" || store?.settings?.theme === "dark" ? store.settings.theme : "default",
        }));
        if (nextTemplate.sections[0]) {
          setSelection({ kind: "section", sectionId: nextTemplate.sections[0].id });
        } else {
          setSelection({ kind: "theme" });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pageType, store?.id]);

  useEffect(() => {
    if (!store?.id || pageType !== "product") {
      setPreviewProductSlug(null);
      return;
    }

    api
      .get("/products", { params: { storeId: store.id, limit: 1 } })
      .then((response) => {
        const firstProduct = (response.data.products as Array<{ slug?: string }> | undefined)?.[0] ?? null;
        setPreviewProductSlug(firstProduct?.slug ?? null);
      })
      .catch(() => setPreviewProductSlug(null));
  }, [pageType, store?.id]);

  useEffect(() => {
    if (!store?.id || pageType !== "page") {
      setPreviewPageSlug(null);
      return;
    }

    api
      .get("/pages", { params: { storeId: store.id } })
      .then((response) => {
        const firstPage = (response.data.pages as Array<{ slug?: string; isActive?: boolean }> | undefined)?.find((entry) => entry.isActive !== false)
          ?? (response.data.pages as Array<{ slug?: string }> | undefined)?.[0]
          ?? null;
        setPreviewPageSlug(firstPage?.slug ?? null);
      })
      .catch(() => setPreviewPageSlug(null));
  }, [pageType, store?.id]);

  useEffect(() => {
    if (!store?.id || pageType !== "blog") {
      setPreviewBlogSlug(null);
      return;
    }

    api
      .get("/blog", { params: { storeId: store.id, limit: 1 } })
      .then((response) => {
        const firstPost = (response.data.posts as Array<{ slug?: string }> | undefined)?.[0] ?? null;
        setPreviewBlogSlug(firstPost?.slug ?? null);
      })
      .catch(() => setPreviewBlogSlug(null));
  }, [pageType, store?.id]);

  const pushPreviewUpdate = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !previewUrl) return;

    const targetOrigin = new URL(previewUrl).origin;

    iframeRef.current.contentWindow.postMessage(
      {
        source: "bazar-theme-builder",
        type: "template-sync",
        payload: {
          template: { ...template, pageType, themeId },
          themeId,
          themeSettings: {
            ...themeSettings,
            themeId,
            source,
            pageType,
          },
        },
      },
      targetOrigin
    );
  }, [pageType, previewUrl, source, template, themeId, themeSettings]);

  useEffect(() => {
    if (!previewUrl) return;
    const timeout = window.setTimeout(() => pushPreviewUpdate(), 200);
    return () => window.clearTimeout(timeout);
  }, [previewUrl, pushPreviewUpdate]);

  useEffect(() => {
    setSaved(false);
  }, [pageType, template, themeId, themeSettings]);

  const selectedSection = useMemo(() => {
    const sectionId = selection?.kind === "section" || selection?.kind === "block" ? selection.sectionId : null;
    if (!sectionId) return null;
    return template.sections.find((section) => section.id === sectionId) ?? null;
  }, [selection, template.sections]);

  const selectedBlock = useMemo(() => {
    if (selection?.kind !== "block") return null;
    return selectedSection?.blocks.find((block) => block.id === selection.blockId) ?? null;
  }, [selection, selectedSection]);

  const sectionPresets = useMemo(() => getSectionPresetsForPage(pageType), [pageType]);

  const reusableSections = useMemo(
    () => themeSettings.reusableSections.filter((entry) => entry.pageTypes.includes(pageType)),
    [pageType, themeSettings.reusableSections]
  );

  const appendSection = useCallback((section: ThemeSection) => {
    setTemplate((current) => ({ ...current, sections: [...current.sections, section] }));
    setSelection({ kind: "section", sectionId: section.id });
  }, []);

  const addSection = useCallback((type: ThemeSectionType) => {
    const section = createDefaultSection(type);
    appendSection(section);
  }, [appendSection]);

  const addPresetSection = useCallback((presetId: string) => {
    const section = createSectionFromPreset(presetId, pageType);
    if (!section) return;
    appendSection(section);
  }, [appendSection, pageType]);

  const addReusableSection = useCallback((reusableId: string) => {
    const reusableSection = themeSettings.reusableSections.find((entry) => entry.id === reusableId);
    if (!reusableSection) return;
    appendSection(cloneThemeSection(reusableSection.section));
  }, [appendSection, themeSettings.reusableSections]);

  const addBlock = useCallback((sectionId: string, type: ThemeBlockType) => {
    const block = createDefaultBlock(type);
    setTemplate((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, blocks: [...section.blocks, block] } : section
      ),
    }));
    setSelection({ kind: "block", sectionId, blockId: block.id });
  }, []);

  const updateSection = useCallback((sectionId: string, updater: (section: ThemeSection) => ThemeSection) => {
    setTemplate((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
    }));
  }, []);

  const updateBlock = useCallback((sectionId: string, blockId: string, updater: (block: ThemeBlock) => ThemeBlock) => {
    setTemplate((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
        };
      }),
    }));
  }, []);

  const moveSection = useCallback((sectionIndex: number, direction: "up" | "down") => {
    setTemplate((current) => {
      const nextSections = [...current.sections];
      const targetIndex = direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
      if (targetIndex < 0 || targetIndex >= nextSections.length) return current;
      [nextSections[sectionIndex], nextSections[targetIndex]] = [nextSections[targetIndex], nextSections[sectionIndex]];
      return { ...current, sections: nextSections };
    });
  }, []);

  const moveBlock = useCallback((sectionId: string, blockIndex: number, direction: "up" | "down") => {
    updateSection(sectionId, (section) => {
      const nextBlocks = [...section.blocks];
      const targetIndex = direction === "up" ? blockIndex - 1 : blockIndex + 1;
      if (targetIndex < 0 || targetIndex >= nextBlocks.length) return section;
      [nextBlocks[blockIndex], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[blockIndex]];
      return { ...section, blocks: nextBlocks };
    });
  }, [updateSection]);

  const deleteSection = useCallback((sectionId: string) => {
    setTemplate((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== sectionId) }));
    setSelection((current) => (
      current && (current.kind === "section" || current.kind === "block") && current.sectionId === sectionId
        ? null
        : current
    ));
  }, []);

  const deleteBlock = useCallback((sectionId: string, blockId: string) => {
    updateSection(sectionId, (section) => ({ ...section, blocks: section.blocks.filter((block) => block.id !== blockId) }));
    setSelection((current) => (current?.kind === "block" && current.blockId === blockId ? { kind: "section", sectionId } : current));
  }, [updateSection]);

  const saveReusableSection = useCallback((section: ThemeSection) => {
    const suggestedName = sectionMetadataRegistry[section.type].labelAr;
    const name = window.prompt("اسم القسم القابل لإعادة الاستخدام", suggestedName)?.trim();
    if (!name) return;

    const description = window.prompt("وصف قصير اختياري", sectionMetadataRegistry[section.type].description)?.trim();

    setThemeSettings((current) => ({
      ...current,
      reusableSections: [
        {
          id: uid("reusable-section"),
          name,
          description: description || undefined,
          pageTypes: [...sectionMetadataRegistry[section.type].availablePages],
          section: cloneThemeSection(section),
          createdAt: new Date().toISOString(),
        },
        ...current.reusableSections,
      ],
    }));
  }, []);

  const deleteReusableSection = useCallback((reusableId: string) => {
    setThemeSettings((current) => ({
      ...current,
      reusableSections: current.reusableSections.filter((entry) => entry.id !== reusableId),
    }));
  }, []);

  const saveTemplate = useCallback(async () => {
    if (!store?.id) return;
    setSaving(true);
    setSaveError("");

    try {
      await api.put(`/stores/${store.id}/templates/${pageType}`, {
        template: { ...template, pageType, themeId },
        themeSettings,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error: unknown) {
      const message = typeof error === "object" && error && "response" in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setSaveError(message ?? "حدث خطأ أثناء حفظ القالب");
    } finally {
      setSaving(false);
    }
  }, [pageType, store?.id, template, themeId, themeSettings]);

  if (!store) {
    return <div className="flex h-64 items-center justify-center text-gray-400">الرجاء تسجيل الدخول أولاً</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">منشئ الثيم</h1>
          <p className="mt-0.5 text-xs text-gray-500">المحرر الآن يدعم templates موحدة مع presets جاهزة ومكتبة reusable sections محفوظة على مستوى الثيم</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={pageType}
            onChange={(event) => setPageType(event.target.value as ThemeTemplate["pageType"])}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="homepage">الصفحة الرئيسية</option>
            <option value="product">صفحة المنتج</option>
            <option value="collection">صفحة المنتجات</option>
            <option value="blog">المدونة</option>
            <option value="page">صفحات المحتوى</option>
            <option value="cart">صفحة السلة</option>
            <option value="checkout">صفحة الدفع</option>
          </select>
          <div className="hidden rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 sm:block">
            الصفحة: <span className="font-semibold text-gray-700">{pageType}</span> · المصدر: <span className="font-semibold text-gray-700">{source}</span> · الثيم: <span className="font-semibold text-gray-700">{themeId}</span>
          </div>
          <button
            onClick={() => setSelection({ kind: "theme" })}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              selection?.kind === "theme"
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            إعدادات الثيم
          </button>
          <div className="flex items-center overflow-hidden rounded-lg border">
            {([
              { key: "desktop", icon: Monitor, label: "سطح المكتب" },
              { key: "tablet", icon: Tablet, label: "تابلت" },
              { key: "mobile", icon: Smartphone, label: "جوال" },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                title={label}
                onClick={() => setPreviewDevice(key)}
                className={cn("p-2 transition-colors", previewDevice === key ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100")}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <a
            href={previewUrl ?? `${getPublicStorefrontOrigin()}/${store.subdomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-600 transition hover:text-indigo-600"
          >
            <Eye className="h-4 w-4" />
            معاينة
          </a>
          <Button onClick={saveTemplate} disabled={saving} className={cn("gap-2", saved ? "bg-green-600 hover:bg-green-600" : "") }>
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ القالب"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 overflow-y-auto border-l bg-white p-4">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Presets جاهزة</p>
          <div className="space-y-2">
            {sectionPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => addPresetSection(preset.id)}
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-3 text-start transition-colors hover:border-indigo-400 hover:bg-indigo-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-indigo-900">{preset.name}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-600">جاهز</span>
                </div>
                <p className="mt-1 text-xs text-indigo-700/80">{preset.description}</p>
              </button>
            ))}
          </div>

          <div className="my-5 border-t border-gray-100" />
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">إضافة قسم</p>
          <div className="space-y-2">
            {Object.values(sectionMetadataRegistry).map((meta) => (
              meta.availablePages.includes(pageType) ? (
              <button
                key={meta.type}
                onClick={() => addSection(meta.type)}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-start transition-colors hover:border-indigo-400 hover:bg-indigo-50"
              >
                <p className="text-sm font-semibold text-gray-800">{meta.labelAr}</p>
                <p className="mt-1 text-xs text-gray-500">{meta.description}</p>
              </button>
              ) : null
            ))}
          </div>

          <div className="my-5 border-t border-gray-100" />
          <div className="flex items-center justify-between gap-3 px-1 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Reusable Sections</p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{reusableSections.length}</span>
          </div>

          {reusableSections.length > 0 ? (
            <div className="space-y-2">
              {reusableSections.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{entry.description ?? sectionMetadataRegistry[entry.section.type].description}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{sectionMetadataRegistry[entry.section.type].labelAr}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => addReusableSection(entry.id)}
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                    >
                      أدرج في الصفحة
                    </button>
                    <button
                      onClick={() => deleteReusableSection(entry.id)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
              احفظ أي section من اللوحة اليمنى ليظهر هنا وتعيد استخدامه عبر الصفحات المتوافقة.
            </div>
          )}

          {selectedSection && sectionMetadataRegistry[selectedSection.type].supportsBlocks && (
            <>
              <div className="my-5 border-t border-gray-100" />
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">إضافة Block داخلي</p>
              <div className="space-y-2">
                {sectionMetadataRegistry[selectedSection.type].allowedBlocks.map((blockType) => {
                  const meta = blockMetadataRegistry[blockType];
                  return (
                    <button
                      key={blockType}
                      onClick={() => addBlock(selectedSection.id, blockType)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-start transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                    >
                      <p className="text-sm font-semibold text-gray-800">{meta.labelAr}</p>
                      <p className="mt-1 text-xs text-gray-500">{blockType}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto bg-gray-100 px-6 py-6">
          <div className="space-y-6">
            <div className={cn("mx-auto overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300", previewDevice === "mobile" ? "max-w-[390px]" : previewDevice === "tablet" ? "max-w-[768px]" : "max-w-full")}>
              {previewDevice !== "desktop" && (
                <div className="flex items-center justify-center gap-1.5 bg-gray-800 py-1.5 text-center text-xs text-gray-300">
                  {previewDevice === "mobile" ? <Smartphone className="h-3 w-3" /> : <Tablet className="h-3 w-3" />}
                  {previewDevice === "mobile" ? "معاينة الجوال" : "معاينة التابلت"}
                </div>
              )}

              <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-500">
                معاينة حيّة عبر iframe على storefront الحقيقي
              </div>

              {previewUrl ? (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  title="Theme Builder Live Preview"
                  className="h-[640px] w-full border-0 bg-white"
                  onLoad={pushPreviewUpdate}
                />
              ) : pageType === "product" ? (
                <div className="flex h-[320px] flex-col items-center justify-center px-6 text-center text-gray-400">
                  <Package2 className="mb-3 h-10 w-10 opacity-30" />
                  <p className="font-medium text-gray-600">لا يوجد منتج متاح لمعاينة صفحة المنتج</p>
                  <p className="mt-1 text-sm">أضف منتجاً واحداً على الأقل ليعمل iframe preview لهذه الصفحة.</p>
                </div>
              ) : pageType === "page" ? (
                <div className="flex h-[320px] flex-col items-center justify-center px-6 text-center text-gray-400">
                  <AlignLeft className="mb-3 h-10 w-10 opacity-30" />
                  <p className="font-medium text-gray-600">لا توجد صفحة محتوى متاحة للمعاينة</p>
                  <p className="mt-1 text-sm">أنشئ صفحة واحدة على الأقل من إدارة الصفحات ليعمل iframe preview لهذا النوع.</p>
                </div>
              ) : pageType === "blog" ? (
                <div className="flex h-[320px] flex-col items-center justify-center px-6 text-center text-gray-400">
                  <Package2 className="mb-3 h-10 w-10 opacity-30" />
                  <p className="font-medium text-gray-600">لا توجد مقالات متاحة لمعاينة صفحة المدونة</p>
                  <p className="mt-1 text-sm">أضف مقالاً واحداً على الأقل لمعاينة قالب المدونة على صفحة حقيقية.</p>
                </div>
              ) : (
                <div className="flex h-[320px] items-center justify-center text-gray-400">تعذر إنشاء رابط المعاينة الحية</div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-md">
              <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-500">
                هيكل الصفحة وترتيب الأقسام
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="flex h-48 items-center justify-center text-sm text-gray-400">جاري تحميل القالب...</div>
                ) : template.sections.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                    <Layout className="mb-3 h-12 w-12 opacity-30" />
                    <p className="font-medium">لا توجد أقسام بعد</p>
                    <p className="mt-1 text-sm">ابدأ بإضافة أول section من اللوحة اليسرى</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {template.sections.map((section, sectionIndex) => (
                      <SectionCard
                        key={section.id}
                        section={section}
                        isSelected={(selection?.kind === "section" || selection?.kind === "block") && selection.sectionId === section.id}
                        isFirst={sectionIndex === 0}
                        isLast={sectionIndex === template.sections.length - 1}
                        onSelect={() => setSelection({ kind: "section", sectionId: section.id })}
                        onToggle={() => updateSection(section.id, (current) => ({ ...current, enabled: !current.enabled }))}
                        onMoveUp={() => moveSection(sectionIndex, "up")}
                        onMoveDown={() => moveSection(sectionIndex, "down")}
                        onDelete={() => deleteSection(section.id)}
                      >
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {Object.entries(section.settings).slice(0, 4).map(([key, value]) => (
                              <div key={key} className="rounded-lg border border-white/70 bg-white px-3 py-2 text-xs text-gray-600">
                                <span className="font-medium text-gray-800">{key}</span>
                                <div className="mt-1 truncate">{String(value)}</div>
                              </div>
                            ))}
                          </div>

                          {section.blocks.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Blocks</p>
                              {section.blocks.map((block, blockIndex) => (
                                <BlockRow
                                  key={block.id}
                                  block={block}
                                  isSelected={selection?.kind === "block" && selection.blockId === block.id}
                                  isFirst={blockIndex === 0}
                                  isLast={blockIndex === section.blocks.length - 1}
                                  onSelect={() => setSelection({ kind: "block", sectionId: section.id, blockId: block.id })}
                                  onMoveUp={() => moveBlock(section.id, blockIndex, "up")}
                                  onMoveDown={() => moveBlock(section.id, blockIndex, "down")}
                                  onDelete={() => deleteBlock(section.id, block.id)}
                                />
                              ))}
                            </div>
                          )}

                          {section.blocks.length === 0 && sectionMetadataRegistry[section.type].supportsBlocks && (
                            <button
                              onClick={() => setSelection({ kind: "section", sectionId: section.id })}
                              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                            >
                              <Plus className="h-4 w-4" />
                              اختر هذا القسم ثم أضف له Block من اليسار
                            </button>
                          )}
                        </div>
                      </SectionCard>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-r bg-white">
          {selection?.kind === "theme" ? (
            <div className="p-4">
              <div className="mb-4 border-b pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-900">إعدادات الثيم العامة</h3>
                </div>
                <p className="mt-1 text-xs text-gray-500">الألوان والخط والستايل العام تُبث مباشرة إلى iframe وتُحفظ مع الثيم الرئيسي.</p>
              </div>

              <div className="space-y-3">
                {themeSettingsFields.map((field) => (
                  <PropertyField
                    key={field.key}
                    field={field}
                    value={themeSettings[field.key as keyof ThemeSettingsModel]}
                    onChange={(value) => setThemeSettings((current) => ({
                      ...current,
                      [field.key]: value,
                    }))}
                  />
                ))}
              </div>

              {saveError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
            </div>
          ) : selection && selectedSection ? (
            <div className="p-4">
              <div className="mb-4 border-b pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    {selection.kind === "section" ? sectionMetadataRegistry[selectedSection.type].labelAr : blockMetadataRegistry[selectedBlock?.type ?? "text"].labelAr}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {selection.kind === "section" ? "تعديل إعدادات القسم الحالي" : "تعديل إعدادات الـ block الداخلي"}
                </p>
              </div>

              {selection.kind === "section" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-indigo-900">حوّل هذا القسم إلى reusable section</p>
                        <p className="mt-1 text-xs text-indigo-700/80">سيُحفظ داخل الثيم الحالي ويمكن إدراجه لاحقاً في أي صفحة متوافقة.</p>
                      </div>
                      <button
                        onClick={() => saveReusableSection(selectedSection)}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                      >
                        حفظ في المكتبة
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
                    <span>القسم مفعل</span>
                    <input
                      type="checkbox"
                      checked={selectedSection.enabled}
                      onChange={(event) => updateSection(selectedSection.id, (current) => ({ ...current, enabled: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                  {sectionMetadataRegistry[selectedSection.type].fields.map((field) => (
                    <PropertyField
                      key={field.key}
                      field={field}
                      value={selectedSection.settings[field.key]}
                      onChange={(value) => updateSection(selectedSection.id, (current) => ({
                        ...current,
                        settings: { ...current.settings, [field.key]: value },
                      }))}
                    />
                  ))}
                </div>
              )}

              {selection.kind === "block" && selectedBlock && (
                <div className="space-y-3">
                  {blockMetadataRegistry[selectedBlock.type].fields.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                      هذا النوع من الـ blocks معرف لكنه غير مكتمل حقلياً حتى الآن.
                    </div>
                  ) : (
                    blockMetadataRegistry[selectedBlock.type].fields.map((field) => (
                      <PropertyField
                        key={field.key}
                        field={field}
                        value={selectedBlock.settings[field.key]}
                        onChange={(value) => updateBlock(selectedSection.id, selectedBlock.id, (current) => ({
                          ...current,
                          settings: { ...current.settings, [field.key]: value },
                        }))}
                      />
                    ))
                  )}
                </div>
              )}

              {saveError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-gray-400">
              <AlignLeft className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">اختر section أو block للتعديل</p>
              <p className="mt-1 text-xs">القسم المحدد سيظهر هنا بنفس الحقول التي تحفظ داخل template</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
