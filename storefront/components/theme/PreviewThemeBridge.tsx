"use client";

import { useEffect, useMemo, useState } from "react";

const FONT_URLS: Record<string, string> = {
  Cairo: "Cairo:wght@400;500;600;700",
  Tajawal: "Tajawal:wght@400;500;700",
  "Noto Sans Arabic": "Noto+Sans+Arabic:wght@400;500;700",
  "Readex Pro": "Readex+Pro:wght@400;500;700",
};

export function PreviewThemeBridge({
  previewEnabled,
  previewOrigin,
  initialSettings,
  children,
}: {
  previewEnabled: boolean;
  previewOrigin?: string;
  initialSettings: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    themeVariant: string;
  };
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    if (!previewEnabled) return;

    const handler = (event: MessageEvent) => {
      if (previewOrigin && event.origin !== previewOrigin) return;

      const data = event.data as { source?: string; type?: string; payload?: { themeSettings?: Record<string, unknown> } } | null;
      if (!data || data.source !== "bazar-theme-builder" || data.type !== "template-sync") return;

      const nextSettings = data.payload?.themeSettings;
      if (!nextSettings || typeof nextSettings !== "object") return;

      setSettings((current) => ({
        primaryColor: typeof nextSettings.primaryColor === "string" ? nextSettings.primaryColor : current.primaryColor,
        secondaryColor: typeof nextSettings.secondaryColor === "string" ? nextSettings.secondaryColor : current.secondaryColor,
        fontFamily: typeof nextSettings.fontFamily === "string" ? nextSettings.fontFamily : current.fontFamily,
        themeVariant: typeof nextSettings.themeVariant === "string" ? nextSettings.themeVariant : current.themeVariant,
      }));
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [previewEnabled, previewOrigin]);

  const fontUrl = useMemo(() => FONT_URLS[settings.fontFamily] ?? FONT_URLS.Cairo, [settings.fontFamily]);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${fontUrl}&display=swap`} />
      <style>{`:root{--store-primary:${settings.primaryColor};--store-secondary:${settings.secondaryColor};}body{font-family:'${settings.fontFamily}',sans-serif;}`}</style>
      <div className="flex min-h-screen flex-col" data-theme={settings.themeVariant}>{children}</div>
    </>
  );
}