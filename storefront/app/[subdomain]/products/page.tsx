import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StructuredData } from "@/components/seo/StructuredData";
import { PreviewableThemePage } from "@/components/theme/PreviewableThemePage";
import { resolvePageTemplate } from "@/components/theme/template-resolver";
import type { ThemeGlobalData } from "@/components/theme/types";
import { getCollectionPageData } from "@/lib/storefront-server";
import { buildStorefrontMetadata, getStorefrontUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const { store } = await getCollectionPageData(subdomain);

  return buildStorefrontMetadata({
    title: `منتجات ${store.nameAr || store.name}`,
    description: store.descriptionAr || store.description || `تصفح منتجات ${store.nameAr || store.name}`,
    subdomain,
    path: "/products",
    image: store.logo,
    keywords: [store.nameAr || store.name, "منتجات", "فئات", "تسوق"],
  });
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subdomain } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  try {
    const { store, categories, template } = await getCollectionPageData(subdomain);
    const resolvedTemplate = resolvePageTemplate(template, store, "collection");
    const previewEnabled = resolvedSearchParams.__builderPreview === "1";
    const previewOrigin = typeof resolvedSearchParams.__builderOrigin === "string" ? resolvedSearchParams.__builderOrigin : undefined;

    const globalData: ThemeGlobalData = {
      store,
      products: [],
      categories,
      subdomain,
      pageType: "collection",
      themeSettings: {
        ...resolvedTemplate.themeSettings,
        themeId: resolvedTemplate.themeId,
        source: resolvedTemplate.source,
      },
    };

    const collectionUrl = getStorefrontUrl(subdomain, "/products");
    const collectionSchema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `منتجات ${store.nameAr || store.name}`,
      description: store.descriptionAr || store.description || undefined,
      ...(collectionUrl ? { url: collectionUrl } : {}),
    };

    return (
      <>
        <StructuredData id="collection-schema" data={collectionSchema} />
        <PreviewableThemePage
          store={store}
          subdomain={subdomain}
          pageType="collection"
          initialTemplate={resolvedTemplate.template}
          initialThemeId={resolvedTemplate.themeId ?? store.settings?.theme ?? "default"}
          initialThemeSettings={globalData.themeSettings ?? {}}
          globalData={globalData}
          previewEnabled={previewEnabled}
          previewOrigin={previewOrigin}
        />
      </>
    );
  } catch {
    notFound();
  }
}
