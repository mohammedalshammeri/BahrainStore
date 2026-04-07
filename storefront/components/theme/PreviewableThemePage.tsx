"use client";

import { useEffect, useMemo, useState } from "react";
import type { StorePublic } from "@/lib/types";
import { ThemeProvider } from "./ThemeContext";
import { SectionRenderer } from "./SectionRenderer";
import { PageTemplateSchema, type ThemePageType, type ValidatedPageTemplate } from "./schema";
import type { ThemeGlobalData, ThemeSettings } from "./types";

interface PreviewMessagePayload {
  template?: unknown;
  themeId?: string;
  themeSettings?: ThemeSettings;
}

export function PreviewableThemePage({
  store,
  subdomain,
  pageType,
  initialTemplate,
  initialThemeId,
  initialThemeSettings,
  globalData,
  previewEnabled,
  previewOrigin,
}: {
  store: StorePublic;
  subdomain: string;
  pageType: ThemePageType;
  initialTemplate: ValidatedPageTemplate;
  initialThemeId: string;
  initialThemeSettings: ThemeSettings;
  globalData: ThemeGlobalData;
  previewEnabled: boolean;
  previewOrigin?: string;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [themeId, setThemeId] = useState(initialThemeId);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(initialThemeSettings);

  useEffect(() => {
    setTemplate(initialTemplate);
    setThemeId(initialThemeId);
    setThemeSettings(initialThemeSettings);
  }, [initialTemplate, initialThemeId, initialThemeSettings]);

  useEffect(() => {
    if (!previewEnabled) return;

    const handler = (event: MessageEvent) => {
      if (previewOrigin && event.origin !== previewOrigin) return;

      const data = event.data as { source?: string; type?: string; payload?: PreviewMessagePayload } | null;
      if (!data || data.source !== "bazar-theme-builder" || data.type !== "template-sync") return;

      const parsed = PageTemplateSchema.safeParse(data.payload?.template);
      if (!parsed.success || parsed.data.pageType !== pageType) return;

      setTemplate(parsed.data);

      if (typeof data.payload?.themeId === "string") {
        setThemeId(data.payload.themeId);
      }

      if (data.payload?.themeSettings && typeof data.payload.themeSettings === "object") {
        setThemeSettings(data.payload.themeSettings);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pageType, previewEnabled, previewOrigin]);

  const runtimeGlobalData = useMemo<ThemeGlobalData>(() => ({
    ...globalData,
    themeSettings: {
      ...themeSettings,
      themeId,
    },
  }), [globalData, themeId, themeSettings]);

  return (
    <ThemeProvider
      value={{
        themeId,
        store,
        themeSettings: runtimeGlobalData.themeSettings ?? {},
        subdomain,
        locale: store.language === "EN" ? "en" : "ar",
        globalColors: {
          primary: typeof runtimeGlobalData.themeSettings?.primaryColor === "string"
            ? runtimeGlobalData.themeSettings.primaryColor
            : store.settings?.primaryColor ?? "#2563eb",
          secondary: typeof runtimeGlobalData.themeSettings?.secondaryColor === "string"
            ? runtimeGlobalData.themeSettings.secondaryColor
            : store.settings?.secondaryColor ?? "#f97316",
          background: "#ffffff",
        },
      }}
    >
      <SectionRenderer sections={template.sections} globalData={runtimeGlobalData} pageType={pageType} />
    </ThemeProvider>
  );
}