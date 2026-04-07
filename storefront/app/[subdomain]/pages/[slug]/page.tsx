import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PreviewableThemePage } from "@/components/theme/PreviewableThemePage";
import { resolvePageTemplate } from "@/components/theme/template-resolver";
import type { ThemeGlobalData } from "@/components/theme/types";
import { getContentPageData, getPublicPage } from "@/lib/storefront-server";

interface Props {
  params: Promise<{ subdomain: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const page = await getPublicPage(subdomain, slug).catch(() => null);
  if (!page) return {};
  return {
    title: page.seoTitle || page.titleAr || page.title,
    description: page.seoDesc || page.excerpt,
  };
}

export default async function StorePage({ params, searchParams }: Props) {
  const { subdomain, slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const data = await getContentPageData(subdomain, slug).catch(() => null);
  const page = data?.page ?? null;
  if (!page) notFound();
  const resolvedTemplate = resolvePageTemplate(data?.template, data!.store, "page");
  const previewEnabled = resolvedSearchParams.__builderPreview === "1";
  const previewOrigin = typeof resolvedSearchParams.__builderOrigin === "string" ? resolvedSearchParams.__builderOrigin : undefined;

  const globalData: ThemeGlobalData = {
    store: data!.store,
    products: [],
    categories: [],
    subdomain,
    pageType: "page",
    page,
    themeSettings: {
      ...resolvedTemplate.themeSettings,
      themeId: resolvedTemplate.themeId,
      source: resolvedTemplate.source,
    },
  };

  return (
    <PreviewableThemePage
      store={data!.store}
      subdomain={subdomain}
      pageType="page"
      initialTemplate={resolvedTemplate.template}
      initialThemeId={resolvedTemplate.themeId ?? data!.store.settings?.theme ?? "default"}
      initialThemeSettings={globalData.themeSettings ?? {}}
      globalData={globalData}
      previewEnabled={previewEnabled}
      previewOrigin={previewOrigin}
    />
  );
}
