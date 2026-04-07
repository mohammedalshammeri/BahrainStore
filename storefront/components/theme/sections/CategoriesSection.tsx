import Link from "next/link";
import { Tag } from "lucide-react";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

export default function CategoriesSection({ section, globalData }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const title = typeof settings.title === "string" ? settings.title : typeof settings.titleAr === "string" ? settings.titleAr : "التصنيفات";
  const columns = typeof settings.columns === "number" ? settings.columns : Number(settings.columns) || 6;

  return (
    <SectionLayout section={section}>
      <section className="w-full">
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Tag className="h-6 w-6" />
          {title}
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {globalData.categories.map((category) => (
            <Link
              key={category.id}
              href={`/${globalData.subdomain}/products?categoryId=${category.id}`}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-center transition hover:border-gray-400 hover:shadow-sm"
            >
              <span className="text-2xl">🏷️</span>
              <span className="w-full truncate text-sm font-medium text-gray-800">{category.nameAr || category.name}</span>
              {category._count && <span className="text-xs text-gray-400">{category._count.products} منتج</span>}
            </Link>
          ))}
        </div>
      </section>
    </SectionLayout>
  );
}