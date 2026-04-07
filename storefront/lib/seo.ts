import type { Metadata } from "next";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function getOptionalStorefrontBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_BASE_URL?.trim();
  return configured ? normalizeBaseUrl(configured) : null;
}

export function getStorefrontUrl(subdomain: string, pathname = "") {
  const baseUrl = getOptionalStorefrontBaseUrl();
  if (!baseUrl) return null;

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}/${subdomain}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function stripHtml(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function clampText(value: string | null | undefined, maxLength = 160) {
  const normalized = stripHtml(value);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function resolveSeoImage(image: string | null | undefined) {
  if (!image) return undefined;
  return image;
}

interface StorefrontMetadataInput {
  title: string;
  description?: string | null;
  subdomain: string;
  path?: string;
  image?: string | null;
  type?: "website" | "article";
  keywords?: string[];
}

export function buildStorefrontMetadata({
  title,
  description,
  subdomain,
  path = "",
  image,
  type = "website",
  keywords,
}: StorefrontMetadataInput): Metadata {
  const canonical = getStorefrontUrl(subdomain, path) ?? undefined;
  const seoDescription = clampText(description);
  const openGraphImage = resolveSeoImage(image);

  return {
    title,
    description: seoDescription || undefined,
    keywords: keywords?.length ? keywords : undefined,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title,
      description: seoDescription || undefined,
      type,
      url: canonical,
      images: openGraphImage ? [{ url: openGraphImage }] : undefined,
    },
    twitter: {
      card: openGraphImage ? "summary_large_image" : "summary",
      title,
      description: seoDescription || undefined,
      images: openGraphImage ? [openGraphImage] : undefined,
    },
  };
}