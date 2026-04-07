import "server-only";

import { cache } from "react";
import type { Category, Product, StorePublic } from "@/lib/types";
import type { HomepageTemplatePayload } from "@/components/theme/template-resolver";
import { getPublicApiUrl } from "@/lib/env";

const API_BASE_URL = getPublicApiUrl();

export interface StorePixels {
  googleTagId?: string | null;
  facebookPixelId?: string | null;
  tiktokPixelId?: string | null;
  snapchatPixelId?: string | null;
  googleAdsId?: string | null;
}

export interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  titleAr?: string | null;
  excerpt?: string | null;
  coverImage?: string | null;
  authorName?: string | null;
  publishedAt?: string | null;
  views?: number;
  tags?: string[];
  content?: string | null;
  contentAr?: string | null;
  seoTitle?: string | null;
  seoDesc?: string | null;
}

export interface PublicPage {
  slug: string;
  title: string;
  titleAr?: string | null;
  excerpt?: string | null;
  content?: string | null;
  contentAr?: string | null;
  seoTitle?: string | null;
  seoDesc?: string | null;
}

async function fetchStorefrontJson<T>(path: string, revalidate: number, tags: string[]) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate, tags },
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Storefront fetch failed: ${path} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export const getPublicStore = cache(async (subdomain: string) => {
  const data = await fetchStorefrontJson<{ store: StorePublic }>(
    `/stores/s/${subdomain}`,
    300,
    [`store:${subdomain}`]
  );

  return data.store;
});

export const getPublicPixels = cache(async (subdomain: string) => {
  try {
    return await fetchStorefrontJson<StorePixels>(
      `/marketing/public/${subdomain}/pixels`,
      300,
      [`pixels:${subdomain}`]
    );
  } catch {
    return {};
  }
});

export const getHomepageData = cache(async (subdomain: string) => {
  const store = await getPublicStore(subdomain);

  const [productsResponse, categoriesResponse, homepage] = await Promise.all([
    fetchStorefrontJson<{ products: Product[] }>(
      `/products/store/${store.id}`,
      180,
      [`products:${subdomain}`]
    ).catch(() => ({ products: [] })),
    fetchStorefrontJson<{ categories: Category[] }>(
      `/categories/store/${store.id}`,
      300,
      [`categories:${subdomain}`]
    ).catch(() => ({ categories: [] })),
    fetchStorefrontJson<HomepageTemplatePayload>(
      `/stores/s/${subdomain}/homepage`,
      180,
      [`homepage:${subdomain}`]
    ).catch(() => ({ template: null, blocks: [], source: "emergency-template" })),
  ]);

  return {
    store,
    products: productsResponse.products,
    categories: categoriesResponse.categories,
    homepage,
  };
});

export const getProductPageData = cache(async (subdomain: string, slug: string) => {
  const store = await getPublicStore(subdomain);

  const [productResponse, categoriesResponse, templateResponse] = await Promise.all([
    fetchStorefrontJson<{ product: Product }>(
      `/products/public/${subdomain}/${slug}`,
      120,
      [`product:${subdomain}:${slug}`]
    ),
    fetchStorefrontJson<{ categories: Category[] }>(
      `/categories/store/${store.id}`,
      300,
      [`categories:${subdomain}`]
    ).catch(() => ({ categories: [] })),
    fetchStorefrontJson<HomepageTemplatePayload>(
      `/stores/s/${subdomain}/templates/product`,
      180,
      [`template:${subdomain}:product`]
    ).catch(() => ({ template: null, blocks: [], source: "emergency-template" })),
  ]);

  const relatedResponse = await fetchStorefrontJson<{ products: Product[] }>(
    `/products/${productResponse.product.id}/related`,
    120,
    [`related:${productResponse.product.id}`]
  ).catch(() => ({ products: [] }));

  return {
    store,
    product: productResponse.product,
    relatedProducts: relatedResponse.products,
    categories: categoriesResponse.categories,
    template: templateResponse,
  };
});

export const getCollectionPageData = cache(async (subdomain: string) => {
  const store = await getPublicStore(subdomain);

  const [categoriesResponse, template] = await Promise.all([
    fetchStorefrontJson<{ categories: Category[] }>(
      `/categories/store/${store.id}`,
      300,
      [`categories:${subdomain}`]
    ).catch(() => ({ categories: [] })),
    fetchStorefrontJson<HomepageTemplatePayload>(
      `/stores/s/${subdomain}/templates/collection`,
      180,
      [`template:${subdomain}:collection`]
    ).catch(() => ({ template: null, blocks: [], source: "emergency-template" })),
  ]);

  return {
    store,
    categories: categoriesResponse.categories,
    template,
  };
});

export const getTemplatePageData = cache(async (subdomain: string, pageType: "cart" | "checkout") => {
  const store = await getPublicStore(subdomain);

  const template = await fetchStorefrontJson<HomepageTemplatePayload>(
    `/stores/s/${subdomain}/templates/${pageType}`,
    180,
    [`template:${subdomain}:${pageType}`]
  ).catch(() => ({ template: null, blocks: [], source: "emergency-template" }));

  return {
    store,
    template,
  };
});

export const getContentPageData = cache(async (subdomain: string, slug: string) => {
  const [store, page, template] = await Promise.all([
    getPublicStore(subdomain),
    getPublicPage(subdomain, slug),
    fetchStorefrontJson<HomepageTemplatePayload>(
      `/stores/s/${subdomain}/templates/page`,
      180,
      [`template:${subdomain}:page`]
    ).catch(() => ({ template: null, blocks: [], source: "emergency-template" })),
  ]);

  return {
    store,
    page,
    template,
  };
});

export const getPublicBlogIndex = cache(async (subdomain: string, page = 1, limit = 12) => {
  const data = await fetchStorefrontJson<{ posts?: PublicBlogPost[]; total?: number }>(
    `/blog/public/${subdomain}?page=${page}&limit=${limit}`,
    300,
    [`blog:${subdomain}:${page}:${limit}`]
  ).catch(() => ({ posts: [], total: 0 }));

  return {
    posts: data.posts ?? [],
    total: data.total ?? 0,
  };
});

export const getBlogPageData = cache(async (subdomain: string) => {
  const [store, blog, template] = await Promise.all([
    getPublicStore(subdomain),
    getPublicBlogIndex(subdomain, 1, 12),
    fetchStorefrontJson<HomepageTemplatePayload>(
      `/stores/s/${subdomain}/templates/blog`,
      180,
      [`template:${subdomain}:blog`]
    ).catch(() => ({ template: null, blocks: [], source: "emergency-template" })),
  ]);

  return {
    store,
    blog,
    template,
  };
});

export const getBlogPostPageData = cache(async (subdomain: string, slug: string) => {
  const [store, post, recentPosts, template] = await Promise.all([
    getPublicStore(subdomain),
    getPublicBlogPost(subdomain, slug),
    getPublicBlogIndex(subdomain, 1, 4),
    fetchStorefrontJson<HomepageTemplatePayload>(
      `/stores/s/${subdomain}/templates/blog`,
      180,
      [`template:${subdomain}:blog`]
    ).catch(() => ({ template: null, blocks: [], source: "emergency-template" })),
  ]);

  return {
    store,
    post,
    recentPosts: recentPosts.posts.filter((entry) => entry.slug !== slug),
    template,
  };
});

export const getPublicBlogPost = cache(async (subdomain: string, slug: string) => {
  const data = await fetchStorefrontJson<{ post: PublicBlogPost }>(
    `/blog/public/${subdomain}/${slug}`,
    300,
    [`blog:${subdomain}:${slug}`]
  );

  return data.post;
});

export const getPublicPage = cache(async (subdomain: string, slug: string) => {
  const data = await fetchStorefrontJson<{ page: PublicPage }>(
    `/pages/public/${subdomain}/${slug}`,
    300,
    [`page:${subdomain}:${slug}`]
  );

  return data.page;
});