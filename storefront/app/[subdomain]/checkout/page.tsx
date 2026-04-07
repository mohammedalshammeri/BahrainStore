import { PreviewableThemePage } from "@/components/theme/PreviewableThemePage";
import { resolvePageTemplate } from "@/components/theme/template-resolver";
import type { ThemeGlobalData } from "@/components/theme/types";
import { getTemplatePageData } from "@/lib/storefront-server";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subdomain } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { store, template } = await getTemplatePageData(subdomain, "checkout");
  const resolvedTemplate = resolvePageTemplate(template, store, "checkout");
  const previewEnabled = resolvedSearchParams.__builderPreview === "1";
  const previewOrigin = typeof resolvedSearchParams.__builderOrigin === "string" ? resolvedSearchParams.__builderOrigin : undefined;

  const globalData: ThemeGlobalData = {
    store,
    products: [],
    categories: [],
    subdomain,
    pageType: "checkout",
    themeSettings: {
      ...resolvedTemplate.themeSettings,
      themeId: resolvedTemplate.themeId,
      source: resolvedTemplate.source,
    },
  };

  return (
    <PreviewableThemePage
      store={store}
      subdomain={subdomain}
      pageType="checkout"
      initialTemplate={resolvedTemplate.template}
      initialThemeId={resolvedTemplate.themeId ?? store.settings?.theme ?? "default"}
      initialThemeSettings={globalData.themeSettings ?? {}}
      globalData={globalData}
      previewEnabled={previewEnabled}
      previewOrigin={previewOrigin}
    />
  );
}
