import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";
import { ProductCard } from "./shared/ProductCard";

export default function RelatedProductsSection({ section, globalData }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const title = typeof settings.titleAr === "string" ? settings.titleAr : "منتجات مشابهة";
  const count = typeof settings.count === "number" ? settings.count : Number(settings.count) || 4;
  const products = (globalData.relatedProducts ?? []).slice(0, count);

  if (products.length === 0) {
    return null;
  }

  return (
    <SectionLayout section={section}>
      <section className="w-full border-t border-gray-100 pt-10">
        <h2 className="mb-5 text-xl font-bold text-gray-900">{title}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} subdomain={globalData.subdomain} />
          ))}
        </div>
      </section>
    </SectionLayout>
  );
}