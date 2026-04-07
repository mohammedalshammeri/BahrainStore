"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { StorePublic } from "@/lib/types";
import type { ThemeSettings } from "./types";

interface ThemeContextValue {
  themeId: string;
  store: StorePublic;
  themeSettings: ThemeSettings;
  subdomain: string;
  locale: "ar" | "en";
  globalColors: {
    primary: string;
    secondary: string;
    background: string;
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ThemeContextValue;
}) {
  const contextValue = useMemo(() => value, [
    value.themeId,
    value.store.id,
    value.themeSettings,
    value.subdomain,
  ]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

export function useOptionalTheme() {
  return useContext(ThemeContext);
}