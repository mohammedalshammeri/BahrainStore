import Link from "next/link";
import { SectionLayout } from "../SectionLayout";
import { ProductCard } from "./shared/ProductCard";
import type { SectionProps } from "../types";

export default function ProductsGridSection({ section, globalData }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const title = typeof settings.title === "string" ? settings.title : typeof settings.titleAr === "string" ? settings.titleAr : "المنتجات";
  const filter = typeof settings.filter === "string" ? settings.filter : "featured";
  const count = typeof settings.count === "number" ? settings.count : Number(settings.count) || 8;

  let filtered = globalData.products;
  if (filter === "featured") filtered = globalData.products.filter((product) => product.isFeatured);
  if (filter === "latest") filtered = globalData.products.slice().reverse();

  const displayed = filtered.slice(0, count);

  return (
    <SectionLayout section={section}>
      <section className="w-full">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <Link href={`/${globalData.subdomain}/products`} className="text-sm text-blue-600 hover:underline">عرض الكل</Link>
        </div>
        {displayed.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {displayed.map((product) => (
              <ProductCard key={product.id} product={product} subdomain={globalData.subdomain} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-gray-400">لا توجد منتجات</p>
        )}
      </section>
    </SectionLayout>
  );
}