import type { PublicBlogPost, PublicPage } from "@/lib/storefront-server";
import type { Category, Product, StorePublic } from "@/lib/types";
import type { ValidatedThemeBlock, ValidatedThemeSection } from "./schema";

export type ThemeSettings = Record<string, unknown>;

export interface ThemeGlobalData {
  store: StorePublic;
  products: Product[];
  categories: Category[];
  subdomain: string;
  pageType?: string;
  product?: Product;
  page?: PublicPage;
  blogPosts?: PublicBlogPost[];
  blogPost?: PublicBlogPost;
  relatedProducts?: Product[];
  themeSettings?: ThemeSettings;
}

export interface SectionProps {
  section: ValidatedThemeSection;
  globalData: ThemeGlobalData;
}

export interface BlockComponentProps {
  block: ValidatedThemeBlock;
  globalData: ThemeGlobalData;
  transformedProps: Record<string, unknown>;
}