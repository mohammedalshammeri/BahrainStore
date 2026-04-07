import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PreviewableThemePage } from "@/components/theme/PreviewableThemePage";
import { resolvePageTemplate } from "@/components/theme/template-resolver";
import type { ThemeGlobalData } from "@/components/theme/types";
import { getBlogPostPageData, getPublicBlogPost } from "@/lib/storefront-server";

interface Props {
  params: Promise<{ subdomain: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const post = await getPublicBlogPost(subdomain, slug).catch(() => null);
  if (!post) return {};
  return {
    title: post.seoTitle || post.titleAr || post.title,
    description: post.seoDesc || post.excerpt,
    openGraph: post.coverImage ? { images: [post.coverImage] } : undefined,
  };
}

export default async function BlogPostPage({
  params,
  searchParams,
}: Props & { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { subdomain, slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const data = await getBlogPostPageData(subdomain, slug).catch(() => null);
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
    blogPost: data.post,
    blogPosts: data.recentPosts,
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
