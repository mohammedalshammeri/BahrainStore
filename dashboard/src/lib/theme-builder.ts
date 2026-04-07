export type ThemeBlockType = "text" | "button" | "image" | "icon" | "video" | "audio";
export type ThemeSectionType = "hero" | "banner" | "products_grid" | "categories" | "marquee" | "text" | "divider" | "product_detail" | "related_products" | "cart" | "checkout" | "page_content" | "collection_header" | "collection_products" | "blog_posts" | "blog_post_content";
export type ThemePageType = "homepage" | "product" | "collection" | "page" | "cart" | "checkout" | "blog";

export interface ThemeLayout {
  container?: "full" | "boxed" | "fluid";
  background?: string;
  padding?: {
    top?: string;
    bottom?: string;
  };
  direction?: "row" | "column";
  gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
}

export interface ThemeBlock {
  id: string;
  type: ThemeBlockType;
  settings: Record<string, unknown>;
  layout?: ThemeLayout;
}

export interface ThemeSection {
  id: string;
  type: ThemeSectionType;
  enabled: boolean;
  settings: Record<string, unknown>;
  layout?: ThemeLayout;
  blocks: ThemeBlock[];
}

export interface ThemeTemplate {
  pageType: ThemePageType;
  themeId?: string;
  sections: ThemeSection[];
}

export interface ReusableSectionLibraryItem {
  id: string;
  name: string;
  description?: string;
  pageTypes: ThemePageType[];
  section: ThemeSection;
  createdAt?: string;
}

export interface ThemeSettingsModel {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  themeVariant: "default" | "bold" | "elegant" | "fresh" | "dark";
  heroVariant: "default" | "bold" | "elegant" | "fresh" | "dark";
  reusableSections: ReusableSectionLibraryItem[];
}

interface ThemeBlockBlueprint {
  type: ThemeBlockType;
  settings?: Record<string, unknown>;
  layout?: ThemeLayout;
}

interface ThemeSectionBlueprint {
  type: ThemeSectionType;
  enabled?: boolean;
  settings?: Record<string, unknown>;
  layout?: ThemeLayout;
  blocks?: ThemeBlockBlueprint[];
}

export interface SectionPresetDefinition {
  id: string;
  name: string;
  description: string;
  pageTypes: ThemePageType[];
  section: ThemeSectionBlueprint;
}

import {
  sharedBlockMetadata,
  sharedSectionMetadata,
  type SharedBlockMeta,
  type SharedFieldMeta,
  type SharedSectionMeta,
} from "./shared-theme-metadata";

export interface BuilderFieldMeta extends SharedFieldMeta {}

export interface BuilderSectionMeta extends Omit<SharedSectionMeta, "type" | "allowedBlocks"> {
  type: ThemeSectionType;
  allowedBlocks: ThemeBlockType[];
  availablePages: ThemePageType[];
}

export interface BuilderBlockMeta extends Omit<SharedBlockMeta, "type"> {
  type: ThemeBlockType;
}

export const sectionMetadataRegistry = sharedSectionMetadata as unknown as Record<ThemeSectionType, BuilderSectionMeta>;
export const blockMetadataRegistry = sharedBlockMetadata as unknown as Record<ThemeBlockType, BuilderBlockMeta>;

export const themeSettingsFields: BuilderFieldMeta[] = [
  { key: "primaryColor", label: "اللون الأساسي", type: "color", defaultValue: "#2563eb" },
  { key: "secondaryColor", label: "اللون الثانوي", type: "color", defaultValue: "#f97316" },
  {
    key: "fontFamily",
    label: "الخط",
    type: "select",
    defaultValue: "Cairo",
    options: [
      { label: "Cairo", value: "Cairo" },
      { label: "Tajawal", value: "Tajawal" },
      { label: "Noto Sans Arabic", value: "Noto Sans Arabic" },
      { label: "Readex Pro", value: "Readex Pro" },
    ],
  },
  {
    key: "themeVariant",
    label: "ستايل المتجر العام",
    type: "select",
    defaultValue: "default",
    options: [
      { label: "Default", value: "default" },
      { label: "Bold", value: "bold" },
      { label: "Elegant", value: "elegant" },
      { label: "Fresh", value: "fresh" },
      { label: "Dark", value: "dark" },
    ],
  },
  {
    key: "heroVariant",
    label: "ستايل الهيرو الافتراضي",
    type: "select",
    defaultValue: "default",
    options: [
      { label: "Default", value: "default" },
      { label: "Bold", value: "bold" },
      { label: "Elegant", value: "elegant" },
      { label: "Fresh", value: "fresh" },
      { label: "Dark", value: "dark" },
    ],
  },
];

export const sectionPresetRegistry: SectionPresetDefinition[] = [
  {
    id: "homepage-hero-bold-sale",
    name: "Hero بيع قوي",
    description: "هيرو جريء لحملة موسمية مع CTA مباشر ورسالة ثقة إضافية.",
    pageTypes: ["homepage"],
    section: {
      type: "hero",
      settings: {
        variant: "bold",
        titleAr: "إطلاق موسمي يرفع التحويل من أول شاشة",
        subtitleAr: "اعرض العرض الرئيسي، اشحن الزائر مباشرة إلى المنتجات، وأضف رسالة ثقة قصيرة أسفل CTA.",
        buttonTextAr: "ابدأ التسوق الآن",
        buttonLink: "/products",
      },
      blocks: [
        {
          type: "text",
          settings: {
            content: "شحن سريع داخل الخليج · دفع آمن · دعم واتساب مباشر",
            align: "center",
            tone: "muted",
          },
        },
      ],
    },
  },
  {
    id: "homepage-banner-launch",
    name: "Banner إطلاق",
    description: "بانر عرض موسمي أو إطلاق منتج جديد مع CTA واضح.",
    pageTypes: ["homepage"],
    section: {
      type: "banner",
      settings: {
        titleAr: "مجموعة جديدة وصلت الآن",
        buttonTextAr: "شاهد المجموعة",
        buttonLink: "/products",
        overlayOpacity: 0.38,
        height: 420,
      },
    },
  },
  {
    id: "homepage-featured-grid",
    name: "شبكة منتجات مميزة",
    description: "بلوك جاهز لعرض المنتجات المميزة مع عنوان تسويقي مباشر.",
    pageTypes: ["homepage"],
    section: {
      type: "products_grid",
      settings: {
        titleAr: "المنتجات الأكثر جذباً للشراء",
        filter: "featured",
        count: 8,
      },
    },
  },
  {
    id: "homepage-marquee-promise",
    name: "شريط وعود المتجر",
    description: "Marquee سريع لرسائل الثقة والشحن والعروض.",
    pageTypes: ["homepage"],
    section: {
      type: "marquee",
      settings: {
        text: "شحن سريع | دفع آمن | دعم واتساب | عروض متجددة أسبوعياً",
        speed: "normal",
        bgColor: "#0f172a",
        textColor: "#ffffff",
      },
    },
  },
  {
    id: "product-conversion-stack",
    name: "Product Conversion Stack",
    description: "إعدادات جاهزة لرفع تحويل صفحة المنتج: trust badges + urgency + sticky CTA.",
    pageTypes: ["product"],
    section: {
      type: "product_detail",
      settings: {
        showBreadcrumbs: true,
        showCategoryLink: true,
        showReviews: true,
        showQuickCartLink: true,
        showTrustBadges: true,
        trustBadge1Ar: "دفع آمن ومشفر 100%",
        trustBadge2Ar: "شحن سريع من داخل الخليج",
        trustBadge3Ar: "استرجاع مرن عند الحاجة",
        shippingPromiseAr: "يتم تجهيز الطلب خلال 24 ساعة في أيام العمل",
        lowStockMessageAr: "الكمية محدودة لهذا المنتج، أتم طلبك قبل النفاد",
        showStickyMobileCart: true,
        stickyCartLabelAr: "أضف للسلة الآن",
      },
    },
  },
  {
    id: "product-related-cross-sell",
    name: "منتجات مشابهة للبيع الإضافي",
    description: "related products بعنوان موجه للبيع الإضافي.",
    pageTypes: ["product"],
    section: {
      type: "related_products",
      settings: {
        titleAr: "أكمل الطلب بهذه المنتجات أيضاً",
        count: 4,
      },
    },
  },
  {
    id: "collection-editorial-header",
    name: "رأس Collection تحريري",
    description: "عنوان ووصف أقوى لصفحة المنتجات العامة أو التصنيف.",
    pageTypes: ["collection"],
    section: {
      type: "collection_header",
      settings: {
        titleAr: "منتجات مختارة بعناية",
        descriptionAr: "صُممت هذه الصفحة لتقود الزائر بسرعة إلى أفضل المنتجات مع فلاتر وفرز واضحين.",
        showActiveCategory: true,
        showCategoryCount: true,
      },
    },
  },
  {
    id: "collection-performance-grid",
    name: "Collection Grid أداء",
    description: "شبكة منتجات مهيأة للبحث والفرز والمقارنة.",
    pageTypes: ["collection"],
    section: {
      type: "collection_products",
      settings: {
        productsPerPage: 24,
        showSearch: true,
        showSort: true,
        showFilters: true,
        emptyTitleAr: "لا توجد منتجات مطابقة حالياً",
        showCompareBar: true,
      },
    },
  },
  {
    id: "page-brand-story",
    name: "صفحة قصة العلامة",
    description: "Preset لصفحات about, policy, brand story داخل قالب أنظف.",
    pageTypes: ["page"],
    section: {
      type: "page_content",
      settings: {
        showTitle: true,
        showExcerpt: true,
        contentWidth: "medium",
        surfaceStyle: "card",
      },
    },
  },
  {
    id: "blog-magazine-grid",
    name: "Blog Magazine Grid",
    description: "شبكة مقالات أقرب للمجلة مع صور وmeta واضحة.",
    pageTypes: ["blog"],
    section: {
      type: "blog_posts",
      settings: {
        titleAr: "أحدث المقالات",
        count: 6,
        columns: 3,
        showExcerpt: true,
        showMeta: true,
        showImages: true,
      },
    },
  },
  {
    id: "blog-article-clean-read",
    name: "مقال نظيف للقراءة",
    description: "قالب قراءة مريح للمقال مع meta وصورة وtags.",
    pageTypes: ["blog"],
    section: {
      type: "blog_post_content",
      settings: {
        showCoverImage: true,
        showBackLink: true,
        showMeta: true,
        showTags: true,
        contentWidth: "narrow",
      },
    },
  },
  {
    id: "cart-conversion-summary",
    name: "سلة مهيأة للتحويل",
    description: "سلة مع coupon وupsell مفعّلين افتراضياً.",
    pageTypes: ["cart"],
    section: {
      type: "cart",
      settings: {
        titleAr: "راجع طلبك قبل الدفع",
        emptyTitleAr: "سلتك بانتظار أول منتج",
        emptyCtaAr: "ابدأ التسوق",
        showCoupon: true,
        showUpsell: true,
      },
    },
  },
  {
    id: "checkout-fast-lane",
    name: "Checkout سريع",
    description: "Preset مبسط لرفع إكمال الطلب بأقل تشتيت.",
    pageTypes: ["checkout"],
    section: {
      type: "checkout",
      settings: {
        titleAr: "أكمل طلبك خلال دقائق",
        emptyTitleAr: "لا توجد منتجات للدفع",
        emptyCtaAr: "عد للمتجر",
        showStepper: true,
        confirmButtonAr: "تأكيد الطلب والدفع",
      },
    },
  },
];

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getFieldDefaultValue(field: BuilderFieldMeta) {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  if (field.type === "number") return 0;
  if (field.type === "toggle") return false;
  return "";
}

export function createDefaultBlock(type: ThemeBlockType): ThemeBlock {
  const meta = blockMetadataRegistry[type];
  return {
    id: uid(type),
    type,
    settings: Object.fromEntries(meta.fields.map((field) => [field.key, getFieldDefaultValue(field)])),
  };
}

function instantiateBlock(blueprint: ThemeBlockBlueprint): ThemeBlock {
  return {
    id: uid(blueprint.type),
    type: blueprint.type,
    settings: blueprint.settings ? { ...blueprint.settings } : {},
    layout: blueprint.layout ? { ...blueprint.layout } : undefined,
  };
}

export function createDefaultSection(type: ThemeSectionType): ThemeSection {
  const meta = sectionMetadataRegistry[type];
  return {
    id: uid(type),
    type,
    enabled: true,
    settings: Object.fromEntries(meta.fields.map((field) => [field.key, getFieldDefaultValue(field)])),
    blocks: [],
  };
}

export function createSectionFromBlueprint(blueprint: ThemeSectionBlueprint): ThemeSection {
  return {
    id: uid(blueprint.type),
    type: blueprint.type,
    enabled: blueprint.enabled !== false,
    settings: blueprint.settings ? { ...blueprint.settings } : {},
    layout: blueprint.layout ? { ...blueprint.layout } : undefined,
    blocks: (blueprint.blocks ?? []).map(instantiateBlock),
  };
}

export function cloneThemeSection(section: ThemeSection): ThemeSection {
  return createSectionFromBlueprint({
    type: section.type,
    enabled: section.enabled,
    settings: { ...section.settings },
    layout: section.layout ? { ...section.layout } : undefined,
    blocks: section.blocks.map((block) => ({
      type: block.type,
      settings: { ...block.settings },
      layout: block.layout ? { ...block.layout } : undefined,
    })),
  });
}

export function getSectionPresetsForPage(pageType: ThemePageType) {
  return sectionPresetRegistry.filter((preset) => preset.pageTypes.includes(pageType));
}

export function createSectionFromPreset(presetId: string, pageType: ThemePageType): ThemeSection | null {
  const preset = sectionPresetRegistry.find((entry) => entry.id === presetId && entry.pageTypes.includes(pageType));
  if (!preset) return null;
  return createSectionFromBlueprint(preset.section);
}

function normalizeBlock(entry: unknown): ThemeBlock | null {
  if (!entry || typeof entry !== "object") return null;
  const value = entry as Partial<ThemeBlock>;
  if (!value.id || !value.type || !(value.type in blockMetadataRegistry)) return null;

  return {
    id: String(value.id),
    type: value.type as ThemeBlockType,
    settings: typeof value.settings === "object" && value.settings ? value.settings as Record<string, unknown> : {},
    layout: value.layout,
  };
}

function normalizeSection(entry: unknown): ThemeSection | null {
  if (!entry || typeof entry !== "object") return null;
  const value = entry as Partial<ThemeSection>;
  if (!value.id || !value.type || !(value.type in sectionMetadataRegistry)) return null;

  const blocks = Array.isArray(value.blocks) ? value.blocks.map(normalizeBlock).filter((block): block is ThemeBlock => Boolean(block)) : [];

  return {
    id: String(value.id),
    type: value.type as ThemeSectionType,
    enabled: value.enabled !== false,
    settings: typeof value.settings === "object" && value.settings ? value.settings as Record<string, unknown> : {},
    layout: value.layout,
    blocks,
  };
}

function normalizeReusableSection(entry: unknown): ReusableSectionLibraryItem | null {
  if (!entry || typeof entry !== "object") return null;
  const value = entry as Partial<ReusableSectionLibraryItem>;
  const section = normalizeSection(value.section);
  if (!value.id || !value.name || !section || !Array.isArray(value.pageTypes)) return null;

  const pageTypes = value.pageTypes.filter(
    (pageType): pageType is ThemePageType =>
      pageType === "homepage" ||
      pageType === "product" ||
      pageType === "collection" ||
      pageType === "page" ||
      pageType === "cart" ||
      pageType === "checkout" ||
      pageType === "blog"
  );

  if (pageTypes.length === 0) return null;

  return {
    id: String(value.id),
    name: String(value.name),
    description: typeof value.description === "string" ? value.description : undefined,
    pageTypes,
    section,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
  };
}

export function normalizeThemeTemplate(payload: unknown): ThemeTemplate {
  if (!payload || typeof payload !== "object") {
    return { pageType: "homepage", sections: [] };
  }

  const value = payload as Partial<ThemeTemplate>;
  const sections = Array.isArray(value.sections) ? value.sections.map(normalizeSection).filter((section): section is ThemeSection => Boolean(section)) : [];

  return {
    pageType: value.pageType === "product" || value.pageType === "collection" || value.pageType === "page" || value.pageType === "cart" || value.pageType === "checkout" || value.pageType === "blog"
      ? value.pageType
      : "homepage",
    themeId: typeof value.themeId === "string" ? value.themeId : undefined,
    sections,
  };
}

export function normalizeThemeSettings(payload: unknown, fallback?: Partial<ThemeSettingsModel>): ThemeSettingsModel {
  const value = payload && typeof payload === "object" ? payload as Partial<ThemeSettingsModel> : {};

  const normalizeVariant = (input: unknown, fallbackValue: ThemeSettingsModel["themeVariant"]) => (
    input === "bold" || input === "elegant" || input === "fresh" || input === "dark" || input === "default"
      ? input
      : fallbackValue
  );

  const themeVariant = normalizeVariant(value.themeVariant, fallback?.themeVariant ?? "default");
  const reusableSections = Array.isArray(value.reusableSections)
    ? value.reusableSections.map(normalizeReusableSection).filter((entry): entry is ReusableSectionLibraryItem => Boolean(entry))
    : Array.isArray(fallback?.reusableSections)
      ? fallback.reusableSections.map(normalizeReusableSection).filter((entry): entry is ReusableSectionLibraryItem => Boolean(entry))
      : [];

  return {
    primaryColor: typeof value.primaryColor === "string" ? value.primaryColor : fallback?.primaryColor ?? "#2563eb",
    secondaryColor: typeof value.secondaryColor === "string" ? value.secondaryColor : fallback?.secondaryColor ?? "#f97316",
    fontFamily: typeof value.fontFamily === "string" ? value.fontFamily : fallback?.fontFamily ?? "Cairo",
    themeVariant,
    heroVariant: normalizeVariant(value.heroVariant, fallback?.heroVariant ?? themeVariant),
    reusableSections,
  };
}