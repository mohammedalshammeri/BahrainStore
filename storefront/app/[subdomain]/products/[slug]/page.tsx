import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { StructuredData } from "@/components/seo/StructuredData";
import { PreviewableThemePage } from "@/components/theme/PreviewableThemePage";
import { resolvePageTemplate } from "@/components/theme/template-resolver";
import type { ThemeGlobalData } from "@/components/theme/types";
import { getProductPageData } from "@/lib/storefront-server";
import { buildStorefrontMetadata, getStorefrontUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string; slug: string }>;
}): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const { store, product } = await getProductPageData(subdomain, slug);
  const displayName = product.nameAr || product.name;
  const description = product.descriptionAr || product.description || `${displayName} من ${store.nameAr || store.name}`;

  return buildStorefrontMetadata({
    title: displayName,
    description,
    subdomain,
    path: `/products/${slug}`,
    image: product.images?.[0]?.url ?? store.logo,
    keywords: [displayName, store.nameAr || store.name, product.category?.nameAr || product.category?.name || "منتجات"],
  });
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subdomain, slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  try {
    const { store, product, relatedProducts, categories, template } = await getProductPageData(subdomain, slug);
    const resolvedTemplate = resolvePageTemplate(template, store, "product");
    const previewEnabled = resolvedSearchParams.__builderPreview === "1";
    const previewOrigin = typeof resolvedSearchParams.__builderOrigin === "string" ? resolvedSearchParams.__builderOrigin : undefined;

    const globalData: ThemeGlobalData = {
      store,
      products: [],
      categories,
      subdomain,
      pageType: "product",
      product,
      relatedProducts,
      themeSettings: {
        ...resolvedTemplate.themeSettings,
        themeId: resolvedTemplate.themeId,
        source: resolvedTemplate.source,
      },
    };

    const productUrl = getStorefrontUrl(subdomain, `/products/${slug}`);
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "الرئيسية",
          ...(getStorefrontUrl(subdomain) ? { item: getStorefrontUrl(subdomain) } : {}),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "المنتجات",
          ...(getStorefrontUrl(subdomain, "/products") ? { item: getStorefrontUrl(subdomain, "/products") } : {}),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: product.nameAr || product.name,
          ...(productUrl ? { item: productUrl } : {}),
        },
      ],
    };

    const productSchema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.nameAr || product.name,
      description: product.descriptionAr || product.description || undefined,
      image: product.images?.map((image) => image.url).filter(Boolean),
      sku: product.variants?.[0]?.sku || undefined,
      brand: { "@type": "Brand", name: store.nameAr || store.name },
      category: product.category?.nameAr || product.category?.name || undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: store.currency || "BHD",
        price: Number(product.price ?? 0).toFixed(3),
        availability: Number(product.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        ...(productUrl ? { url: productUrl } : {}),
      },
    };

    return (
      <>
        <StructuredData id="breadcrumb-schema" data={breadcrumbSchema} />
        <StructuredData id="product-schema" data={productSchema} />
        <PreviewableThemePage
          store={store}
          subdomain={subdomain}
          pageType="product"
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
    return (
      <div className="text-center py-24">
        <AlertCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">المنتج غير موجود</p>
        <Link href={`/${subdomain}/products`} className="mt-4 inline-block text-blue-600 hover:underline">
          العودة للمنتجات
        </Link>
      </div>
    );
  }
}
