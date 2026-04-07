import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ThemeSectionType } from "./schema";
import type { SectionProps } from "./types";

type SectionComponent = ComponentType<SectionProps>;
type SectionRegistry = Partial<Record<ThemeSectionType, SectionComponent>>;

const defaultSectionRegistry: SectionRegistry = {
  hero: dynamic<SectionProps>(() => import("./sections/HeroSection")),
  banner: dynamic<SectionProps>(() => import("./sections/BannerSection")),
  products_grid: dynamic<SectionProps>(() => import("./sections/ProductsGridSection")),
  categories: dynamic<SectionProps>(() => import("./sections/CategoriesSection")),
  marquee: dynamic<SectionProps>(() => import("./sections/MarqueeSection")),
  text: dynamic<SectionProps>(() => import("./sections/TextSection")),
  divider: dynamic<SectionProps>(() => import("./sections/DividerSection")),
  product_detail: dynamic<SectionProps>(() => import("./sections/ProductDetailSection")),
  related_products: dynamic<SectionProps>(() => import("./sections/RelatedProductsSection")),
  cart: dynamic<SectionProps>(() => import("./sections/CartSection")),
  checkout: dynamic<SectionProps>(() => import("./sections/CheckoutSection")),
  page_content: dynamic<SectionProps>(() => import("./sections/PageContentSection")),
  collection_header: dynamic<SectionProps>(() => import("./sections/CollectionHeaderSection")),
  collection_products: dynamic<SectionProps>(() => import("./sections/CollectionProductsSection")),
  blog_posts: dynamic<SectionProps>(() => import("./sections/BlogPostsSection")),
  blog_post_content: dynamic<SectionProps>(() => import("./sections/BlogPostContentSection")),
};

const themeSectionOverrides: Record<string, SectionRegistry> = {
  default: {},
};

export function getSectionComponent(themeId: string | undefined, sectionType: ThemeSectionType): SectionComponent | null {
  const themeRegistry = themeId ? themeSectionOverrides[themeId] : undefined;
  return themeRegistry?.[sectionType] ?? defaultSectionRegistry[sectionType] ?? null;
}