export type SharedFieldType = "text" | "textarea" | "color" | "number" | "select" | "toggle" | "url";

export interface SharedFieldOption {
  label: string;
  value: string;
}

export interface SharedFieldMeta {
  key: string;
  label: string;
  type: SharedFieldType;
  defaultValue?: unknown;
  placeholder?: string;
  options?: SharedFieldOption[];
}

export interface SharedSectionMeta {
  type: string;
  label: string;
  labelAr: string;
  description: string;
  category: "structure" | "content" | "commerce" | "marketing";
  availablePages: string[];
  supportsBlocks: boolean;
  allowedBlocks: string[];
  fields: SharedFieldMeta[];
}

export interface SharedBlockMeta {
  type: string;
  label: string;
  labelAr: string;
  fields: SharedFieldMeta[];
}

const variantOptions = [
  { label: "Default", value: "default" },
  { label: "Bold", value: "bold" },
  { label: "Elegant", value: "elegant" },
  { label: "Fresh", value: "fresh" },
  { label: "Dark", value: "dark" },
];

export const sharedSectionMetadata: Record<string, SharedSectionMeta> = {
  hero: {
    type: "hero",
    label: "Hero",
    labelAr: "هيرو",
    description: "القسم الافتتاحي الرئيسي للمتجر.",
    category: "marketing",
    availablePages: ["homepage"],
    supportsBlocks: true,
    allowedBlocks: ["text", "button", "image", "icon", "video", "audio"],
    fields: [
      { key: "titleAr", label: "العنوان", type: "text", placeholder: "مرحباً بك في متجرنا" },
      { key: "subtitleAr", label: "الوصف", type: "textarea", placeholder: "اكتب الرسالة الرئيسية هنا" },
      { key: "buttonTextAr", label: "نص الزر", type: "text", defaultValue: "تسوق الآن" },
      { key: "buttonLink", label: "رابط الزر", type: "url", defaultValue: "/products" },
      { key: "variant", label: "النمط", type: "select", defaultValue: "default", options: variantOptions },
    ],
  },
  banner: {
    type: "banner",
    label: "Banner",
    labelAr: "بانر",
    description: "بانر بصري مع صورة خلفية وزر.",
    category: "marketing",
    availablePages: ["homepage"],
    supportsBlocks: true,
    allowedBlocks: ["text", "button", "image", "icon", "video", "audio"],
    fields: [
      { key: "titleAr", label: "العنوان", type: "text" },
      { key: "imageUrl", label: "رابط الصورة", type: "url", placeholder: "https://..." },
      { key: "buttonTextAr", label: "نص الزر", type: "text" },
      { key: "buttonLink", label: "رابط الزر", type: "url", defaultValue: "/products" },
      { key: "overlayOpacity", label: "شفافية التغطية", type: "number", defaultValue: 0.45 },
      { key: "height", label: "الارتفاع", type: "number", defaultValue: 400 },
    ],
  },
  products_grid: {
    type: "products_grid",
    label: "Products Grid",
    labelAr: "شبكة المنتجات",
    description: "عرض منتجات المتجر وفق فلتر محدد.",
    category: "commerce",
    availablePages: ["homepage"],
    supportsBlocks: false,
    allowedBlocks: [],
    fields: [
      { key: "titleAr", label: "العنوان", type: "text", defaultValue: "منتجاتنا المميزة" },
      {
        key: "filter",
        label: "الفلتر",
        type: "select",
        defaultValue: "featured",
        options: [
          { label: "مميزة", value: "featured" },
          { label: "الأحدث", value: "latest" },
          { label: "الكل", value: "all" },
        ],
      },
      { key: "count", label: "عدد المنتجات", type: "number", defaultValue: 8 },
    ],
  },
  categories: {
    type: "categories",
    label: "Categories",
    labelAr: "التصنيفات",
    description: "عرض تصنيفات المتجر في شبكة.",
    category: "commerce",
    availablePages: ["homepage"],
    supportsBlocks: false,
    allowedBlocks: [],
    fields: [
      { key: "titleAr", label: "العنوان", type: "text", defaultValue: "تصفح التصنيفات" },
      { key: "columns", label: "عدد الأعمدة", type: "number", defaultValue: 4 },
    ],
  },
  marquee: {
    type: "marquee",
    label: "Marquee",
    labelAr: "شريط متحرك",
    description: "رسالة متحركة للإعلانات والتنبيهات.",
    category: "marketing",
    availablePages: ["homepage"],
    supportsBlocks: false,
    allowedBlocks: [],
    fields: [
      { key: "text", label: "النص", type: "textarea", defaultValue: "🎉 عروض جديدة كل أسبوع" },
      {
        key: "speed",
        label: "السرعة",
        type: "select",
        defaultValue: "normal",
        options: [
          { label: "بطيء", value: "slow" },
          { label: "عادي", value: "normal" },
          { label: "سريع", value: "fast" },
        ],
      },
      { key: "bgColor", label: "لون الخلفية", type: "color", defaultValue: "#1e1b4b" },
      { key: "textColor", label: "لون النص", type: "color", defaultValue: "#ffffff" },
    ],
  },
  text: {
    type: "text",
    label: "Text",
    labelAr: "نص",
    description: "محتوى نصي مرن ويمكن دعمه ببلوكات داخلية.",
    category: "content",
    availablePages: ["homepage"],
    supportsBlocks: true,
    allowedBlocks: ["text", "button", "image", "icon", "video", "audio"],
    fields: [
      { key: "textAr", label: "النص", type: "textarea", defaultValue: "اكتب المحتوى هنا" },
      {
        key: "align",
        label: "المحاذاة",
        type: "select",
        defaultValue: "center",
        options: [
          { label: "يمين", value: "right" },
          { label: "وسط", value: "center" },
          { label: "يسار", value: "left" },
        ],
      },
    ],
  },
  divider: {
    type: "divider",
    label: "Divider",
    labelAr: "فاصل",
    description: "مساحة أو فاصل بصري بين الأقسام.",
    category: "structure",
    availablePages: ["homepage", "product", "cart", "checkout"],
    supportsBlocks: false,
    allowedBlocks: [],
    fields: [
      { key: "height", label: "الارتفاع", type: "number", defaultValue: 40 },
      { key: "color", label: "اللون", type: "color", defaultValue: "transparent" },
    ],
  },
  product_detail: {
    type: "product_detail",
    label: "Product Detail",
    labelAr: "تفاصيل المنتج",
    description: "القسم الأساسي لعرض صور المنتج وسعره وخياراته وإضافته إلى السلة.",
    category: "commerce",
    availablePages: ["product"],
    supportsBlocks: false,
    allowedBlocks: [],
    fields: [
      { key: "showBreadcrumbs", label: "إظهار المسار", type: "toggle", defaultValue: true },
      { key: "showCategoryLink", label: "إظهار رابط التصنيف", type: "toggle", defaultValue: true },
      { key: "showReviews", label: "إظهار التقييمات", type: "toggle", defaultValue: true },
      { key: "showQuickCartLink", label: "إظهار زر الذهاب إلى السلة", type: "toggle", defaultValue: true },
      { key: "showTrustBadges", label: "إظهار شريط الثقة", type: "toggle", defaultValue: true },
      { key: "trustBadge1Ar", label: "شارة الثقة 1", type: "text", defaultValue: "دفع آمن ومشفر" },
      { key: "trustBadge2Ar", label: "شارة الثقة 2", type: "text", defaultValue: "شحن سريع داخل الخليج" },
      { key: "trustBadge3Ar", label: "شارة الثقة 3", type: "text", defaultValue: "استرجاع مرن عند الحاجة" },
      { key: "shippingPromiseAr", label: "وعد الشحن", type: "text", defaultValue: "يتم تجهيز الطلب خلال 24 ساعة في أيام العمل" },
      { key: "lowStockMessageAr", label: "رسالة المخزون المنخفض", type: "text", defaultValue: "كمية محدودة، اطلب الآن قبل النفاد" },
      { key: "showStickyMobileCart", label: "إظهار شريط شراء ثابت للجوال", type: "toggle", defaultValue: true },
      { key: "stickyCartLabelAr", label: "نص زر الشراء الثابت", type: "text", defaultValue: "إضافة سريعة للسلة" },
    ],
  },
  related_products: {
    type: "related_products",
    label: "Related Products",
    labelAr: "منتجات مشابهة",
    description: "يعرض المنتجات المرتبطة بالمنتج الحالي.",
    category: "commerce",
    availablePages: ["product"],
    supportsBlocks: false,
    allowedBlocks: [],
    fields: [
      { key: "titleAr", label: "العنوان", type: "text", defaultValue: "منتجات مشابهة" },
      { key: "count", label: "عدد المنتجات", type: "number", defaultValue: 4 },
    ],
  },
  cart: {
    type: "cart",
    label: "Cart",
    labelAr: "السلة",
    description: "يعرض عناصر السلة، كوبون الخصم، والملخص مع زر الانتقال للدفع.",
    category: "commerce",
    availablePages: ["cart"],
    supportsBlocks: false,
    allowedBlocks: [],
    fields: [
      { key: "titleAr", label: "عنوان الصفحة", type: "text", defaultValue: "سلة التسوق" },
      { key: "emptyTitleAr", label: "عنوان السلة الفارغة", type: "text", defaultValue: "سلتك فارغة" },
      { key: "emptyCtaAr", label: "نص زر السلة الفارغة", type: "text", defaultValue: "ابدأ التسوق" },
      { key: "showCoupon", label: "إظهار كود الخصم", type: "toggle", defaultValue: true },
      { key: "showUpsell", label: "إظهار المنتجات الإضافية", type: "toggle", defaultValue: true },
    ],
  },
  checkout: {
    type: "checkout",
    label: "Checkout",
    labelAr: "الدفع",
    description: "يعرض خطوات إتمام الطلب: البيانات، العنوان، والدفع مع ملخص الطلب.",
    category: "commerce",
    availablePages: ["checkout"],
    supportsBlocks: false,
    allowedBlocks: [],
    fields: [
      { key: "titleAr", label: "عنوان الصفحة", type: "text", defaultValue: "إتمام الطلب" },
      { key: "emptyTitleAr", label: "عنوان السلة الفارغة", type: "text", defaultValue: "سلتك فارغة" },
      { key: "emptyCtaAr", label: "نص زر السلة الفارغة", type: "text", defaultValue: "تسوق الآن" },
      { key: "showStepper", label: "إظهار شريط الخطوات", type: "toggle", defaultValue: true },
      { key: "confirmButtonAr", label: "نص زر التأكيد", type: "text", defaultValue: "تأكيد الطلب" },
    ],
  },
};

export const sharedBlockMetadata: Record<string, SharedBlockMeta> = {
  text: {
    type: "text",
    label: "Text Block",
    labelAr: "بلوك نص",
    fields: [
      { key: "content", label: "المحتوى", type: "textarea", defaultValue: "نص إضافي" },
      {
        key: "align",
        label: "المحاذاة",
        type: "select",
        defaultValue: "start",
        options: [
          { label: "بداية", value: "start" },
          { label: "وسط", value: "center" },
          { label: "نهاية", value: "end" },
        ],
      },
    ],
  },
  button: {
    type: "button",
    label: "Button Block",
    labelAr: "بلوك زر",
    fields: [
      { key: "label", label: "النص", type: "text", defaultValue: "اكتشف الآن" },
      { key: "href", label: "الرابط", type: "url", defaultValue: "/products" },
    ],
  },
  image: {
    type: "image",
    label: "Image Block",
    labelAr: "بلوك صورة",
    fields: [
      { key: "src", label: "رابط الصورة", type: "url", placeholder: "https://..." },
      { key: "alt", label: "النص البديل", type: "text", defaultValue: "صورة" },
    ],
  },
  icon: {
    type: "icon",
    label: "Icon Block",
    labelAr: "بلوك أيقونة",
    fields: [
      {
        key: "icon",
        label: "الأيقونة",
        type: "select",
        defaultValue: "star",
        options: [
          { label: "نجمة", value: "star" },
          { label: "شحن", value: "truck" },
          { label: "حماية", value: "shield" },
          { label: "قفل", value: "lock" },
          { label: "هدية", value: "gift" },
          { label: "دعم", value: "support" },
          { label: "خصم", value: "discount" },
          { label: "دفع", value: "payment" },
        ],
      },
      { key: "title", label: "العنوان", type: "text", defaultValue: "ميزة قوية" },
      { key: "description", label: "الوصف", type: "textarea", defaultValue: "اشرح هذه الميزة للعميل" },
      { key: "href", label: "الرابط", type: "url", defaultValue: "" },
      {
        key: "align",
        label: "المحاذاة",
        type: "select",
        defaultValue: "center",
        options: [
          { label: "يمين", value: "right" },
          { label: "وسط", value: "center" },
          { label: "يسار", value: "left" },
        ],
      },
      {
        key: "tone",
        label: "النمط اللوني",
        type: "select",
        defaultValue: "primary",
        options: [
          { label: "أساسي", value: "primary" },
          { label: "ثانوي", value: "secondary" },
          { label: "داكن", value: "dark" },
        ],
      },
    ],
  },
  video: {
    type: "video",
    label: "Video Block",
    labelAr: "بلوك فيديو",
    fields: [
      { key: "src", label: "رابط الفيديو", type: "url", placeholder: "https://..." },
      { key: "title", label: "العنوان", type: "text", defaultValue: "فيديو تعريفي" },
      { key: "poster", label: "صورة الغلاف", type: "url", placeholder: "https://..." },
      { key: "autoplay", label: "تشغيل تلقائي", type: "toggle", defaultValue: false },
      { key: "muted", label: "صامت", type: "toggle", defaultValue: true },
      { key: "controls", label: "إظهار التحكم", type: "toggle", defaultValue: true },
    ],
  },
  audio: {
    type: "audio",
    label: "Audio Block",
    labelAr: "بلوك صوت",
    fields: [
      { key: "src", label: "رابط الصوت", type: "url", placeholder: "https://..." },
      { key: "title", label: "العنوان", type: "text", defaultValue: "رسالة صوتية" },
      { key: "subtitle", label: "الوصف", type: "text", defaultValue: "شرح مختصر أو إعلان صوتي" },
      { key: "autoplay", label: "تشغيل تلقائي", type: "toggle", defaultValue: false },
      { key: "loop", label: "إعادة مستمرة", type: "toggle", defaultValue: false },
      { key: "controls", label: "إظهار التحكم", type: "toggle", defaultValue: true },
    ],
  },
};