import type { Metadata } from "next";
import type { Category, Product, StorePublic } from "@/lib/types";
import { StructuredData } from "@/components/seo/StructuredData";
import { resolveHomepageTemplate, type HomepageTemplatePayload } from "@/components/theme/template-resolver";
import { PreviewableThemePage } from "@/components/theme/PreviewableThemePage";
import type { ThemeGlobalData } from "@/components/theme/types";
import { getHomepageData } from "@/lib/storefront-server";
import { buildStorefrontMetadata, getStorefrontUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const { store } = await getHomepageData(subdomain);

  return buildStorefrontMetadata({
    title: store.nameAr || store.name,
    description: store.descriptionAr || store.description || `تسوق منتجات ${store.nameAr || store.name}`,
    subdomain,
    image: store.logo,
    keywords: [store.nameAr || store.name, "متجر إلكتروني", "البحرين", "Bahrain", "تسوق أونلاين"],
  });
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subdomain } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { store, products, categories, homepage } = await getHomepageData(subdomain);
  const resolvedHomepage = resolveHomepageTemplate(homepage, store);
  const previewEnabled = resolvedSearchParams.__builderPreview === "1";
  const previewOrigin = typeof resolvedSearchParams.__builderOrigin === "string" ? resolvedSearchParams.__builderOrigin : undefined;

  const globalData: ThemeGlobalData = {
    store,
    products,
    categories,
    subdomain,
    themeSettings: {
      ...resolvedHomepage.themeSettings,
      themeId: resolvedHomepage.themeId,
      source: resolvedHomepage.source,
    },
  };

  const storeUrl = getStorefrontUrl(subdomain);
  const websiteSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.nameAr || store.name,
    description: store.descriptionAr || store.description || undefined,
    inLanguage: store.language || "ar",
    image: store.logo || undefined,
    ...(storeUrl ? { url: storeUrl } : {}),
    potentialAction: storeUrl
      ? {
          "@type": "SearchAction",
          target: `${storeUrl}/products?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        }
      : undefined,
  };

  const productListSchema = products.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: products.slice(0, 8).map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: product.nameAr || product.name,
          ...(getStorefrontUrl(subdomain, `/products/${product.slug}`) ? { url: getStorefrontUrl(subdomain, `/products/${product.slug}`) } : {}),
        })),
      }
    : null;

  return (
    <>
      <StructuredData id="store-schema" data={websiteSchema} />
      {productListSchema && <StructuredData id="featured-products-schema" data={productListSchema} />}
      <PreviewableThemePage
        store={store}
        subdomain={subdomain}
        pageType="homepage"
        initialTemplate={resolvedHomepage.template}
        initialThemeId={resolvedHomepage.themeId ?? store.settings?.theme ?? "default"}
        initialThemeSettings={globalData.themeSettings ?? {}}
        globalData={globalData}
        previewEnabled={previewEnabled}
        previewOrigin={previewOrigin}
      />
    </>
  );
}
