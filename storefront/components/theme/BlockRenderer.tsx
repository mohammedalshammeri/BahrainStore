"use client";

import React, { Suspense, memo, useMemo } from "react";
import clsx from "clsx";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { ThemeBlockSchema, type ValidatedThemeBlock, type ValidatedThemeLayout } from "./schema";
import { getBlockComponent } from "./block-registry";
import { transformBlockProps } from "./block-transformers";
import { useOptionalTheme } from "./ThemeContext";
import type { ThemeGlobalData } from "./types";

interface BlockRendererProps {
  blocks: ReadonlyArray<ValidatedThemeBlock | Record<string, unknown>>;
  globalData: ThemeGlobalData;
  context?: string;
  layout?: Partial<ValidatedThemeLayout>;
}

const gapClassMap = {
  none: "gap-0",
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
} as const;

const alignClassMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

const justifyClassMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
} as const;

function resolveBlockKey(block: ValidatedThemeBlock | Record<string, unknown>, index: number) {
  if (typeof block.id === "string" && block.id.length > 0) {
    return block.id;
  }

  if (typeof block.type === "string" && block.type.length > 0) {
    return `${block.type}-${index}`;
  }

  return `block-${index}`;
}

function BlockLoadingCard() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

function RawBlockRenderer({ blocks, globalData, context, layout }: BlockRendererProps) {
  const theme = useOptionalTheme();
  const themeId = theme?.themeId ?? globalData.store.settings?.theme ?? "default";
  const resolvedLayout = useMemo(() => {
    const contextLayouts = theme?.themeSettings?.blockLayouts;
    const themeLayout =
      context && contextLayouts && typeof contextLayouts === "object"
        ? (contextLayouts as Record<string, Partial<ValidatedThemeLayout>>)[context]
        : undefined;

    return {
      direction: "column",
      gap: "md",
      align: "stretch",
      justify: "start",
      ...themeLayout,
      ...layout,
    } as const;
  }, [context, layout, theme?.themeSettings]);

  const validatedBlocks = useMemo(
    () =>
      blocks.map((rawBlock, index) => {
        const key = resolveBlockKey(rawBlock, index);
        const parsedBlock = ThemeBlockSchema.safeParse(rawBlock);

        if (!parsedBlock.success) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`Invalid block skipped: ${key}`, parsedBlock.error.flatten());
          }

          return {
            key,
            valid: false as const,
            rawType: typeof rawBlock.type === "string" ? rawBlock.type : "unknown",
          };
        }

        return {
          key,
          valid: true as const,
          block: parsedBlock.data,
          transformedProps: transformBlockProps(parsedBlock.data, globalData),
        };
      }),
    [blocks, globalData]
  );

  if (!blocks || blocks.length === 0) return null;

  return (
    <div
      className={clsx(
        "blocks-container flex w-full",
        context && `blocks-context-${context}`,
        resolvedLayout.direction === "row" ? "flex-row flex-wrap" : "flex-col",
        gapClassMap[resolvedLayout.gap],
        alignClassMap[resolvedLayout.align],
        justifyClassMap[resolvedLayout.justify]
      )}
    >
      {validatedBlocks.map((entry) => {
        if (!entry.valid) {
          return process.env.NODE_ENV === "development" ? (
            <div key={entry.key} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Invalid block payload skipped: {entry.rawType}
            </div>
          ) : null;
        }

        const BlockComponent = getBlockComponent(themeId, entry.block.type);

        if (!BlockComponent) {
          return process.env.NODE_ENV === "development" ? (
            <div key={entry.key} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Missing block component for type: {entry.block.type} (theme: {themeId})
            </div>
          ) : null;
        }

        return (
          <SectionErrorBoundary key={entry.key} sectionType={entry.block.type} scopeName={`block:${entry.block.type}`} compact>
            <Suspense fallback={<BlockLoadingCard />}>
              <BlockComponent block={entry.block} globalData={globalData} transformedProps={entry.transformedProps} />
            </Suspense>
          </SectionErrorBoundary>
        );
      })}
    </div>
  );
}

export const BlockRenderer = memo(RawBlockRenderer);