"use client";

import { useSearchParams } from "next/navigation";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

export default function CollectionHeaderSection({ section, globalData }: SectionProps) {
  const searchParams = useSearchParams();
  const settings = section.settings as Record<string, unknown>;
  const categoryId = searchParams.get("categoryId") ?? "";
  const activeCategory = globalData.categories.find((entry) => entry.id === categoryId)
    ?? globalData.categories.flatMap((entry) => entry.children ?? []).find((entry) => entry.id === categoryId)
    ?? null;

  const defaultTitle = typeof settings.titleAr === "string" && settings.titleAr.trim()
    ? settings.titleAr
    : "كل المنتجات";
  const defaultDescription = typeof settings.descriptionAr === "string" && settings.descriptionAr.trim()
    ? settings.descriptionAr
    : "تصفح منتجات المتجر حسب التصنيف والسعر والتوفر.";
  const showActiveCategory = settings.showActiveCategory !== false;
  const showCategoryCount = settings.showCategoryCount !== false;
  const title = showActiveCategory && activeCategory ? activeCategory.nameAr || activeCategory.name : defaultTitle;
  const count = activeCategory?._count?.products;

  return (
    <SectionLayout section={section}>
      <div className="w-full rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6 py-8 shadow-sm md:px-10 md:py-10" dir="rtl">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Collection</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">{title}</h1>
          <p className="mt-4 text-base leading-8 text-slate-600 md:text-lg">{defaultDescription}</p>
          {showActiveCategory && activeCategory ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-white">{activeCategory.nameAr || activeCategory.name}</span>
              {showCategoryCount && typeof count === "number" ? <span>{count} منتج في هذا التصنيف</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </SectionLayout>
  );
}