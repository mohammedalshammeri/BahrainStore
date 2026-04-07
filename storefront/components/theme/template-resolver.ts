import { getEmergencyBlogTemplate, getEmergencyCartTemplate, getEmergencyCheckoutTemplate, getEmergencyCollectionTemplate, getEmergencyHomepageTemplate, getEmergencyPageTemplate, getEmergencyProductTemplate } from "./emergency-template";
import { PageTemplateSchema, ThemeSectionSchema, type ThemePageType, type ValidatedPageTemplate } from "./schema";
import type { StorePublic } from "@/lib/types";
import type { ThemeSettings } from "./types";

export interface HomepageTemplatePayload {
  template?: unknown;
  blocks?: unknown[];
  source?: string;
  themeId?: string | null;
  themeConfigId?: string | null;
  themeSettings?: ThemeSettings;
}

export interface ResolvedHomepageTemplate {
  template: ValidatedPageTemplate;
  source: string;
  themeId?: string;
  themeConfigId?: string | null;
  themeSettings: ThemeSettings;
}

function getEmergencyTemplate(pageType: ThemePageType, themeId?: string, themeSettings?: ThemeSettings) {
  if (pageType === "product") {
    return getEmergencyProductTemplate(themeId);
  }

  if (pageType === "collection") {
    return getEmergencyCollectionTemplate(themeId);
  }

  if (pageType === "page") {
    return getEmergencyPageTemplate(themeId);
  }

  if (pageType === "blog") {
    return getEmergencyBlogTemplate(themeId);
  }

  if (pageType === "cart") {
    return getEmergencyCartTemplate(themeId);
  }

  if (pageType === "checkout") {
    return getEmergencyCheckoutTemplate(themeId);
  }

  return getEmergencyHomepageTemplate(themeId, themeSettings);
}

export function resolvePageTemplate(
  payload: HomepageTemplatePayload | null | undefined,
  store: StorePublic,
  pageType: ThemePageType = "homepage"
): ResolvedHomepageTemplate {
  const themeId = payload?.themeId ?? store.settings?.theme ?? "default";
  const themeSettings = payload?.themeSettings ?? {
    primaryColor: store.settings?.primaryColor,
    secondaryColor: store.settings?.secondaryColor,
    fontFamily: store.settings?.fontFamily,
    themeVariant: store.settings?.theme,
    heroVariant: store.settings?.theme,
  };

  const parsedTemplate = PageTemplateSchema.safeParse(payload?.template);
  if (parsedTemplate.success && parsedTemplate.data.pageType === pageType) {
    return {
      template: parsedTemplate.data,
      source: payload?.source ?? "store-template",
      themeId,
      themeConfigId: payload?.themeConfigId ?? null,
      themeSettings,
    };
  }

  if (Array.isArray(payload?.blocks)) {
    const sections = payload.blocks.flatMap((entry, index) => {
      const parsedSection = ThemeSectionSchema.safeParse(entry);
      if (parsedSection.success) {
        return [parsedSection.data];
      }

      return [];
    });

    if (sections.length > 0) {
      return {
        template: {
          pageType,
          themeId,
          sections,
        },
        source: payload?.source ?? "store-template",
        themeId,
        themeConfigId: payload?.themeConfigId ?? null,
        themeSettings,
      };
    }
  }

  return {
    template: getEmergencyTemplate(pageType, themeId, themeSettings),
    source: "emergency-template",
    themeId,
    themeConfigId: payload?.themeConfigId ?? null,
    themeSettings,
  };
}

export function resolveHomepageTemplate(payload: HomepageTemplatePayload | null | undefined, store: StorePublic): ResolvedHomepageTemplate {
  return resolvePageTemplate(payload, store, "homepage");
}