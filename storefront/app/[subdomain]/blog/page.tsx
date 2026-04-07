import { notFound } from "next/navigation";
import { PreviewableThemePage } from "@/components/theme/PreviewableThemePage";
import { resolvePageTemplate } from "@/components/theme/template-resolver";
import type { ThemeGlobalData } from "@/components/theme/types";
import { getBlogPageData } from "@/lib/storefront-server";

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subdomain } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const data = await getBlogPageData(subdomain).catch(() => null);
  if (!data) notFound();

  const resolvedTemplate = resolvePageTemplate(data.template, data.store, "blog");
  const previewEnabled = resolvedSearchParams.__builderPreview === "1";
  const previewOrigin = typeof resolvedSearchParams.__builderOrigin === "string" ? resolvedSearchParams.__builderOrigin : undefined;

  const globalData: ThemeGlobalData = {
    store: data.store,
    products: [],
    categories: [],
    subdomain,
    pageType: "blog",
    blogPosts: data.blog.posts,
    themeSettings: {
      ...resolvedTemplate.themeSettings,
      themeId: resolvedTemplate.themeId,
      source: resolvedTemplate.source,
    },
  };

  return (
    <PreviewableThemePage
      store={data.store}
      subdomain={subdomain}
      pageType="blog"
      initialTemplate={resolvedTemplate.template}
      initialThemeId={resolvedTemplate.themeId ?? data.store.settings?.theme ?? "default"}
      initialThemeSettings={globalData.themeSettings ?? {}}
      globalData={globalData}
      previewEnabled={previewEnabled}
      previewOrigin={previewOrigin}
    />
  );
}
