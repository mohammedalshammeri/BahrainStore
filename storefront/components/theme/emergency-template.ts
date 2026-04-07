import type { ThemeSettings } from "./types";
import type { ValidatedPageTemplate } from "./schema";

export function getEmergencyHomepageTemplate(themeId?: string, themeSettings?: ThemeSettings): ValidatedPageTemplate {
  return {
    pageType: "homepage",
    themeId,
    sections: [
      {
        id: "emergency-hero",
        type: "hero",
        enabled: true,
        settings: {
          variant: typeof themeSettings?.heroVariant === "string" ? themeSettings.heroVariant : "default",
          ctaLabel: "تسوق الآن",
          ctaHref: "/products",
        },
        blocks: [],
      },
      {
        id: "emergency-categories",
        type: "categories",
        enabled: true,
        settings: {
          title: "التصنيفات",
          columns: 6,
        },
        blocks: [],
      },
      {
        id: "emergency-products",
        type: "products_grid",
        enabled: true,
        settings: {
          title: "منتجات مميزة",
          filter: "featured",
          count: 8,
        },
        blocks: [],
      },
    ],
  };
}

export function getEmergencyProductTemplate(themeId?: string): ValidatedPageTemplate {
  return {
    pageType: "product",
    themeId,
    sections: [
      {
        id: "emergency-product-detail",
        type: "product_detail",
        enabled: true,
        settings: {
          showBreadcrumbs: true,
          showCategoryLink: true,
          showReviews: true,
          showQuickCartLink: true,
          showTrustBadges: true,
          trustBadge1Ar: "دفع آمن ومشفر",
          trustBadge2Ar: "شحن سريع داخل الخليج",
          trustBadge3Ar: "استرجاع مرن عند الحاجة",
          shippingPromiseAr: "يتم تجهيز الطلب خلال 24 ساعة في أيام العمل",
          lowStockMessageAr: "كمية محدودة، اطلب الآن قبل النفاد",
          showStickyMobileCart: true,
          stickyCartLabelAr: "إضافة سريعة للسلة",
        },
        blocks: [],
      },
      {
        id: "emergency-related-products",
        type: "related_products",
        enabled: true,
        settings: {
          titleAr: "منتجات مشابهة",
          count: 4,
        },
        blocks: [],
      },
    ],
  };
}

export function getEmergencyPageTemplate(themeId?: string): ValidatedPageTemplate {
  return {
    pageType: "page",
    themeId,
    sections: [
      {
        id: "emergency-page-content",
        type: "page_content",
        enabled: true,
        settings: {
          showTitle: true,
          showExcerpt: true,
          contentWidth: "narrow",
          surfaceStyle: "plain",
        },
        blocks: [],
      },
    ],
  };
}

export function getEmergencyCollectionTemplate(themeId?: string): ValidatedPageTemplate {
  return {
    pageType: "collection",
    themeId,
    sections: [
      {
        id: "emergency-collection-header",
        type: "collection_header",
        enabled: true,
        settings: {
          titleAr: "كل المنتجات",
          descriptionAr: "تصفح منتجات المتجر حسب التصنيف والسعر والتوفر.",
          showActiveCategory: true,
          showCategoryCount: true,
        },
        blocks: [],
      },
      {
        id: "emergency-collection-products",
        type: "collection_products",
        enabled: true,
        settings: {
          productsPerPage: 20,
          showSearch: true,
          showSort: true,
          showFilters: true,
          emptyTitleAr: "لا توجد منتجات",
          showCompareBar: true,
        },
        blocks: [],
      },
    ],
  };
}

export function getEmergencyBlogTemplate(themeId?: string): ValidatedPageTemplate {
  return {
    pageType: "blog",
    themeId,
    sections: [
      {
        id: "emergency-blog-post-content",
        type: "blog_post_content",
        enabled: true,
        settings: {
          showCoverImage: true,
          showBackLink: true,
          showMeta: true,
          showTags: true,
          contentWidth: "narrow",
        },
        blocks: [],
      },
      {
        id: "emergency-blog-posts",
        type: "blog_posts",
        enabled: true,
        settings: {
          titleAr: "المدونة",
          count: 6,
          columns: 3,
          showExcerpt: true,
          showMeta: true,
          showImages: true,
        },
        blocks: [],
      },
    ],
  };
}

export function getEmergencyCartTemplate(themeId?: string): ValidatedPageTemplate {
  return {
    pageType: "cart",
    themeId,
    sections: [
      {
        id: "emergency-cart",
        type: "cart",
        enabled: true,
        settings: {
          titleAr: "سلة التسوق",
          emptyTitleAr: "سلتك فارغة",
          emptyCtaAr: "ابدأ التسوق",
          showCoupon: true,
          showUpsell: true,
        },
        blocks: [],
      },
    ],
  };
}

export function getEmergencyCheckoutTemplate(themeId?: string): ValidatedPageTemplate {
  return {
    pageType: "checkout",
    themeId,
    sections: [
      {
        id: "emergency-checkout",
        type: "checkout",
        enabled: true,
        settings: {
          titleAr: "إتمام الطلب",
          emptyTitleAr: "سلتك فارغة",
          emptyCtaAr: "تسوق الآن",
          showStepper: true,
          confirmButtonAr: "تأكيد الطلب",
        },
        blocks: [],
      },
    ],
  };
}